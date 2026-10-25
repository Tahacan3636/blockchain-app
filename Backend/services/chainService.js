// =============================================================
// services/chainService.js - Blockchain Is Mantigi
// =============================================================
// Zincirle ilgili her sey burada: genesis blok, blok ekleme,
// zinciri dogrulama, makbuz (txId) sorgulama, sifirlama.
//
// Katman kurali: Route'lar HTTP ile ilgilenir, servisler is mantigi
// ile ilgilenir. Bu dosyada req/res YOKTUR.
// =============================================================

const db = require('../db');
const { calculateBlockHash } = require('../utils/crypto');

// Zincire yazma islemlerini sirali hale getiren kilidin numarasi.
// Ayni anda iki oy gelirse ikisi de "son blok"u okuyup ayni index'i
// kullanmaya calisirdi. pg_advisory_xact_lock ile ikinci istek,
// birincinin transaction'i bitene kadar bekler (kuyruk mantigi).
const CHAIN_LOCK_ID = 7001;

async function lockChain(client) {
    await client.query('SELECT pg_advisory_xact_lock($1)', [CHAIN_LOCK_ID]);
}

// ---------- Genesis ----------
// Zincirin ilk blogu. Onceki blok olmadigi icin previous_hash = '0'.
function buildGenesisBlock() {
    const block = {
        block_index: 0,
        timestamp: new Date().toISOString(),
        data: { message: 'Genesis Block' },
        previous_hash: '0'
    };
    block.hash = calculateBlockHash(block);
    return block;
}

async function insertBlock(client, block) {
    await client.query(
        `INSERT INTO blocks (block_index, timestamp, data, hash, previous_hash)
         VALUES ($1, $2, $3, $4, $5)`,
        [block.block_index, block.timestamp, JSON.stringify(block.data), block.hash, block.previous_hash]
    );
}

// Zinciri tamamen silip yeni bir genesis blokla baslatir.
async function resetChain(client) {
    await lockChain(client);
    await client.query('TRUNCATE blocks RESTART IDENTITY');
    await insertBlock(client, buildGenesisBlock());
}

// ---------- Blok ekleme ----------
// Cagiran taraf bir transaction icinde olmali (client).
// buildData(prevHash, timestamp) -> blok verisi; txId onceki hash'e
// bagli oldugu icin veri, son blok okunduktan sonra uretilir.
async function appendBlock(client, buildData) {
    await lockChain(client);

    const last = await client.query(
        'SELECT block_index, hash FROM blocks ORDER BY block_index DESC LIMIT 1'
    );
    if (last.rows.length === 0) {
        throw new Error('Genesis blok bulunamadi');
    }
    const prev = last.rows[0];

    const timestamp = new Date().toISOString();
    const block = {
        block_index: prev.block_index + 1,
        timestamp,
        data: buildData(prev.hash, timestamp),
        previous_hash: prev.hash
    };
    block.hash = calculateBlockHash(block);

    await insertBlock(client, block);
    return block;
}

// ---------- Dogrulama (saf fonksiyon) ----------
// Bloklari bastan sona gezer, her blogun hash'ini yeniden hesaplar
// ve baglantilari kontrol eder. Veritabanina dokunmaz -> test edilebilir.
function validateChain(blocks) {
    const fail = (reason) => ({ valid: false, reason });

    if (blocks.length === 0) return fail('Blockchain bos - hic blok yok');

    const genesis = blocks[0];
    if (genesis.block_index !== 0 || genesis.previous_hash !== '0') {
        return fail('Genesis blok gecersiz');
    }
    if (genesis.hash !== calculateBlockHash(genesis)) {
        return fail('Genesis blok hash uyumsuzlugu');
    }

    const seenVoters = new Set();

    for (let i = 1; i < blocks.length; i++) {
        const prev = blocks[i - 1];
        const curr = blocks[i];

        if (curr.block_index !== i) {
            return fail(`Blok ${i}: index hatasi (beklenen: ${i}, bulunan: ${curr.block_index})`);
        }
        // "Bu blok gercekten onceki blogun devami mi?"
        if (curr.previous_hash !== prev.hash) {
            return fail(`Blok ${i}: previousHash uyumsuzlugu`);
        }
        // "Blogun icerigi degistirilmis mi?"
        if (curr.hash !== calculateBlockHash(curr)) {
            return fail(`Blok ${i}: hash uyumsuzlugu (icerik degistirilmis olabilir)`);
        }
        // Ayni secmenin iki blogu olamaz
        const vh = curr.data && curr.data.voterHash;
        if (vh) {
            if (seenVoters.has(vh)) return fail(`Blok ${i}: ayni secmen ikinci kez oy kullanmis`);
            seenVoters.add(vh);
        }
    }

    return { valid: true, blockCount: blocks.length, headHash: blocks[blocks.length - 1].hash };
}

async function getChain() {
    const result = await db.query('SELECT * FROM blocks ORDER BY block_index ASC');
    return result.rows;
}

// Zincir dogrulama + capraz kontrol:
// Zincirin SONUNDAN blok silinirse hash zinciri yine tutarli gorunur.
// Bunu yakalamak icin zincirdeki oy sayisini, secmen tablosunda
// "oy kullandi" olarak isaretlenenlerin sayisiyla karsilastiririz.
async function verifyChain() {
    const blocks = await getChain();
    const result = validateChain(blocks);
    if (!result.valid) return result;

    const voted = await db.query('SELECT COUNT(*) FROM allowed_voters WHERE has_voted = TRUE');
    const votedCount = parseInt(voted.rows[0].count, 10);
    const voteBlocks = blocks.length - 1;
    if (votedCount !== voteBlocks) {
        return {
            valid: false,
            reason: `Kayit uyumsuzlugu: ${votedCount} secmen oy kullanmis gorunuyor ama zincirde ${voteBlocks} oy var (blok silinmis olabilir)`
        };
    }
    return result;
}

// ---------- Makbuz sorgulama ----------
// Secmen txId ile oyunun zincirde oldugunu dogrular.
// Kime oy verildigi bilerek DONDURULMEZ: aksi halde makbuz,
// oy satin alan birine "kanit" olarak gosterilebilirdi.
async function findReceipt(txId) {
    const result = await db.query(
        `SELECT block_index, timestamp, hash FROM blocks WHERE data->>'txId' = $1`,
        [txId]
    );
    return result.rows[0] || null;
}

module.exports = {
    buildGenesisBlock,
    insertBlock,
    resetChain,
    appendBlock,
    validateChain,
    getChain,
    verifyChain,
    findReceipt
};
