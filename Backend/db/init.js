// =============================================================
// db/init.js - Veritabani Semasi ve Baslangic Verileri
// =============================================================
// Sunucu her basladiginda calisir; "IF NOT EXISTS" sayesinde
// tablolar zaten varsa dokunmaz. Elle calistirmak icin:
//   npm run db:init
//
// TABLOLAR
//   candidates     -> adaylar
//   blocks         -> zincirin kendisi (her oy bir blok)
//   allowed_voters -> oy kullanabilecek ogrenciler + oy kodu hash'i
//   users          -> admin hesaplari (bcrypt sifre hash'i)
//
// Tum kurulum tek transaction'dir: yarida hata olursa hicbir sey
// yarim kalmaz ve sunucu baslamaz.
// =============================================================

const bcrypt = require('bcryptjs');
const db = require('./index');
const config = require('../config');
const chainService = require('../services/chainService');

async function createTables(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS candidates (
            id    SERIAL PRIMARY KEY,
            name  VARCHAR(100) NOT NULL,
            party VARCHAR(100) NOT NULL,
            color VARCHAR(20)  NOT NULL
        );
    `);

    // timestamp neden TEXT? Hash, timestamp'in string halinden hesaplanir.
    // TIMESTAMP tipi formati degistirir (saat dilimi vb.) -> hash bozulur.
    // TEXT, gonderilen ISO stringi birebir korur.
    await client.query(`
        CREATE TABLE IF NOT EXISTS blocks (
            id            SERIAL PRIMARY KEY,
            block_index   INTEGER UNIQUE NOT NULL,
            timestamp     TEXT NOT NULL,
            data          JSONB,
            hash          VARCHAR(64) NOT NULL,
            previous_hash VARCHAR(64) NOT NULL
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS users (
            id            SERIAL PRIMARY KEY,
            username      VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(60) NOT NULL,
            role          VARCHAR(20) NOT NULL DEFAULT 'admin',
            created_at    TIMESTAMP DEFAULT NOW()
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS allowed_voters (
            id             SERIAL PRIMARY KEY,
            student_number VARCHAR(9) UNIQUE NOT NULL,
            province_code  INTEGER NOT NULL,
            code_hash      VARCHAR(64) NOT NULL,
            has_voted      BOOLEAN NOT NULL DEFAULT FALSE,
            imported_at    TIMESTAMP DEFAULT NOW()
        );
    `);
}

// Eski surumden (oy kodu olmayan) gelen veritabanini yeni semaya tasir.
// Eski secmen hash'leri duz SHA-256 oldugu icin eski oylar gecersizdir;
// liste ve zincir sifirlanir (admin listeyi yeniden yukler).
async function migrateLegacySchema(client) {
    // Eski surumdeki next_hash (ileri baglanti) kullanilmiyor
    await client.query('ALTER TABLE blocks DROP COLUMN IF EXISTS next_hash');

    const legacy = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'allowed_voters' AND column_name = 'citizenship_number'
    `);
    if (legacy.rows.length === 0) return;

    console.log('  Eski sema bulundu, yeni semaya tasiniyor...');
    await client.query('DROP TABLE IF EXISTS voters');
    await client.query('DROP TABLE allowed_voters');
    await createTables(client);
    await chainService.resetChain(client);
}

async function seedCandidates(client) {
    const existing = await client.query('SELECT COUNT(*) FROM candidates');
    if (parseInt(existing.rows[0].count, 10) === 0) {
        await client.query(`
            INSERT INTO candidates (name, party, color) VALUES
                ('YENİLİKÇİLER', 'Yenilikçi Öğrenci Topluluğu', 'blue'),
                ('GELENEKÇİLER', 'Gelenekçi Öğrenci Topluluğu', 'red');
        `);
    } else {
        await client.query(`UPDATE candidates SET name = 'YENİLİKÇİLER', party = 'Yenilikçi Öğrenci Topluluğu' WHERE id = 1`);
        await client.query(`UPDATE candidates SET name = 'GELENEKÇİLER', party = 'Gelenekçi Öğrenci Topluluğu' WHERE id = 2`);
    }
}

async function seedGenesis(client) {
    const genesis = await client.query('SELECT 1 FROM blocks WHERE block_index = 0');
    if (genesis.rows.length === 0) {
        await chainService.insertBlock(client, chainService.buildGenesisBlock());
        console.log('  Genesis blok olusturuldu');
    }
}

// Admin yoksa olusturulur, varsa sifresi .env'deki ADMIN_PASSWORD ile esitlenir.
async function seedAdmin(client) {
    const hash = await bcrypt.hash(config.adminPassword, 10);
    await client.query(
        `INSERT INTO users (username, password_hash, role) VALUES ('admin', $1, 'admin')
         ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
        [hash]
    );
}

async function initDatabase() {
    await db.withTransaction(async (client) => {
        await createTables(client);
        await migrateLegacySchema(client);
        await seedCandidates(client);
        await seedGenesis(client);
        await seedAdmin(client);
    });
    console.log('Veritabani hazir');
}

if (require.main === module) {
    initDatabase()
        .catch(err => { console.error('Veritabani kurulamadi:', err.message); process.exitCode = 1; })
        .finally(() => db.pool.end());
}

module.exports = initDatabase;
