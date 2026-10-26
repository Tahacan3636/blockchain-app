// =============================================================
// scripts/benchmark.js - Performans Olcumu
// =============================================================
// Rapor Bolum 5'teki performans tablolarini uretir:
//   1. Zincir dogrulama suresi (blok sayisina gore)
//   2. Ardisik oy kullanma gecikmesi
//   3. Es zamanli oy kullanma (kayip var mi, ne kadar suruyor)
//   4. Kurcalamanin tespit suresi
//
// Gercek veritabanina DOKUNMAZ; ayri bir benchmark veritabani kullanir.
// Calistirma:  npm run benchmark
// =============================================================

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.BENCH_DB_NAME || 'blockchain_voting_bench';
delete process.env.DATABASE_URL;

const { Client } = require('pg');
const config = require('../config');
const db = require('../db');
const initDatabase = require('../db/init');
const chainService = require('../services/chainService');
const voteService = require('../services/voteService');
const { calculateBlockHash, voterHash, voterCodeHash, generateTxId } = require('../utils/crypto');

const ms = (start) => Number(process.hrtime.bigint() - start) / 1e6;
const now = () => process.hrtime.bigint();
const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

async function ensureDatabase() {
    const client = new Client({ ...config.db, database: 'postgres' });
    await client.connect();
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.db.database]);
    if (exists.rows.length === 0) await client.query(`CREATE DATABASE "${config.db.database}"`);
    await client.end();
}

async function resetDatabase() {
    await db.query('DROP TABLE IF EXISTS blocks, allowed_voters, users, candidates, voters CASCADE');
    await initDatabase();
}

// n secmen ekler ve oy kodlarini dondurur
async function seedVoters(n, offset = 0) {
    const voters = [];
    for (let i = 0; i < n; i++) {
        voters.push({ studentNumber: String(300000001 + offset + i), code: 'KODA' + String(i).padStart(4, '0') });
    }
    for (let i = 0; i < voters.length; i += 1000) {
        const chunk = voters.slice(i, i + 1000);
        const values = chunk.map((_, k) => `($${k * 2 + 1}, 6, $${k * 2 + 2})`).join(',');
        await db.query(`INSERT INTO allowed_voters (student_number, province_code, code_hash) VALUES ${values}`,
            chunk.flatMap(v => [v.studentNumber, voterCodeHash(v.code)]));
    }
    return voters;
}

// n oyluk gecerli bir zinciri dogrudan veritabanina yazar (hizli kurulum icin)
async function buildChain(n) {
    await resetDatabase();
    const voters = await seedVoters(n);
    const genesis = (await db.query('SELECT * FROM blocks WHERE block_index = 0')).rows[0];
    let prevHash = genesis.hash;
    const blocks = [];
    for (let i = 1; i <= n; i++) {
        const timestamp = new Date(Date.now() + i).toISOString();
        const vh = voterHash(voters[i - 1].studentNumber);
        const candidateId = (i % 2) + 1;
        const block = {
            block_index: i, timestamp, previous_hash: prevHash,
            data: { voterHash: vh, candidateId, txId: generateTxId(timestamp, vh, candidateId, prevHash), provinceCode: 6 }
        };
        block.hash = calculateBlockHash(block);
        prevHash = block.hash;
        blocks.push(block);
    }
    for (let i = 0; i < blocks.length; i += 1000) {
        const chunk = blocks.slice(i, i + 1000);
        const values = chunk.map((_, k) => `($${k * 5 + 1}, $${k * 5 + 2}, $${k * 5 + 3}, $${k * 5 + 4}, $${k * 5 + 5})`).join(',');
        await db.query(`INSERT INTO blocks (block_index, timestamp, data, hash, previous_hash) VALUES ${values}`,
            chunk.flatMap(b => [b.block_index, b.timestamp, JSON.stringify(b.data), b.hash, b.previous_hash]));
    }
    await db.query('UPDATE allowed_voters SET has_voted = TRUE');
}

async function benchVerification(sizes, repeats = 5) {
    console.log('\n1) Zincir dogrulama suresi (' + repeats + ' tekrarin medyani)');
    console.log('   Oy sayisi | Uctan uca (DB okuma + dogrulama) | Yalnizca dogrulama (bellekte) | Sonuc');
    const rows = [];
    for (const n of sizes) {
        await buildChain(n);
        const full = [], pure = [];
        let result;
        for (let r = 0; r < repeats; r++) {
            let t = now();
            result = await chainService.verifyChain();
            full.push(ms(t));
            const blocks = await chainService.getChain();
            t = now();
            chainService.validateChain(blocks);
            pure.push(ms(t));
        }
        rows.push({ n, full: median(full), pure: median(pure), valid: result.valid });
        console.log(`   ${String(n).padStart(9)} | ${median(full).toFixed(1).padStart(10)} ms | ${median(pure).toFixed(1).padStart(10)} ms | ${result.valid ? 'gecerli' : 'GECERSIZ'}`);
    }
    return rows;
}

async function benchTamperDetection(n) {
    console.log(`\n4) Kurcalama tespiti (${n} oyluk zincir, ortadaki blok degistiriliyor)`);
    await buildChain(n);
    const mid = Math.floor(n / 2);
    await db.query(`UPDATE blocks SET data = jsonb_set(data, '{candidateId}', '2'::jsonb) WHERE block_index = $1 AND (data->>'candidateId')::int = 1`, [mid]);
    await db.query(`UPDATE blocks SET data = jsonb_set(data, '{candidateId}', '1'::jsonb) WHERE block_index = $1 AND (data->>'candidateId')::int = 2`, [mid + 1]);
    const t = now();
    const result = await chainService.verifyChain();
    const elapsed = ms(t);
    console.log(`   Tespit suresi: ${elapsed.toFixed(1)} ms | Sonuc: ${result.reason}`);
    return { n, elapsed, reason: result.reason };
}

async function benchSequential(n) {
    console.log(`\n2) Ardisik oy kullanma (${n} oy, tek tek)`);
    await resetDatabase();
    const voters = await seedVoters(n);
    const lat = [];
    const t0 = now();
    for (let i = 0; i < n; i++) {
        const t = now();
        await voteService.castVote({ studentNumber: voters[i].studentNumber, voterCode: voters[i].code, candidateId: (i % 2) + 1 });
        lat.push(ms(t));
    }
    const total = ms(t0);
    const res = { n, median: median(lat), p95: pct(lat, 0.95), max: Math.max(...lat), perSec: n / (total / 1000) };
    console.log(`   Medyan: ${res.median.toFixed(1)} ms | %95: ${res.p95.toFixed(1)} ms | En fazla: ${res.max.toFixed(1)} ms | Saniyede ${res.perSec.toFixed(0)} oy`);
    return res;
}

async function benchConcurrent(sizes) {
    console.log('\n3) Es zamanli oy kullanma');
    console.log('   Es zamanli oy | Basarili | Toplam sure | Zincir');
    const rows = [];
    for (const n of sizes) {
        await resetDatabase();
        const voters = await seedVoters(n);
        const t = now();
        const results = await Promise.allSettled(voters.map((v, i) =>
            voteService.castVote({ studentNumber: v.studentNumber, voterCode: v.code, candidateId: (i % 2) + 1 })));
        const elapsed = ms(t);
        const ok = results.filter(r => r.status === 'fulfilled').length;
        const verify = await chainService.verifyChain();
        const blocks = (await db.query('SELECT COUNT(*) FROM blocks')).rows[0].count - 1;
        rows.push({ n, ok, elapsed, blocks, valid: verify.valid });
        console.log(`   ${String(n).padStart(13)} | ${String(ok).padStart(4)}/${n} | ${elapsed.toFixed(0).padStart(7)} ms | ${blocks} blok, ${verify.valid ? 'gecerli' : 'GECERSIZ'}`);
    }
    return rows;
}

// Ayni secmenin ayni anda gonderdigi coklu oy denemesi
async function benchDoubleVote(attempts) {
    console.log(`\n5) Ayni secmenle ayni anda ${attempts} oy denemesi`);
    await resetDatabase();
    const [v] = await seedVoters(1);
    const results = await Promise.allSettled(Array.from({ length: attempts }, () =>
        voteService.castVote({ studentNumber: v.studentNumber, voterCode: v.code, candidateId: 1 })));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const conflict = results.filter(r => r.status === 'rejected' && r.reason.status === 409).length;
    const blocks = (await db.query('SELECT COUNT(*) FROM blocks')).rows[0].count - 1;
    console.log(`   Kabul edilen: ${ok} | Reddedilen (409): ${conflict} | Zincirdeki oy: ${blocks}`);
    return { attempts, ok, conflict, blocks };
}

async function main() {
    await ensureDatabase();
    const pg = (await db.query('SHOW server_version')).rows[0].server_version;
    console.log(`Node.js ${process.version} | PostgreSQL ${pg} | havuz boyutu: ${db.pool.options.max || 10}`);

    const out = {
        verification: await benchVerification([100, 1000, 10000, 50000]),
        sequential: await benchSequential(500),
        concurrent: await benchConcurrent([10, 50, 100, 200]),
        tamper: await benchTamperDetection(10000),
        doubleVote: await benchDoubleVote(20)
    };
    require('fs').writeFileSync(require('path').join(__dirname, 'benchmark-sonuc.json'), JSON.stringify(out, null, 2));
    await db.pool.end();
}

main().catch(async (err) => {
    console.error(err);
    await db.pool.end();
    process.exit(1);
});
