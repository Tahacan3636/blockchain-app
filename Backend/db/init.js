// =============================================================
// db/init.js - Veritabani Tablo Olusturma ve Baslangic Verileri
// =============================================================
// Bu script veritabanindaki tablolari olusturur.
// "npm run db:init" ile calistirilir.
// Tablolar zaten varsa hata vermez (IF NOT EXISTS).
// =============================================================

// .env dosyasini yukle (bu script dogrudan calistirildiginda gerekli)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const db = require('./index');
const { calculateBlockHash } = require('../utils/blockchain');

async function initDatabase() {
    try {
        console.log('Veritabani tablolari olusturuluyor...\n');

        // ─── TABLO 1: candidates (Adaylar) ───
        // Her secimde adaylar olur. Bu tablo aday bilgilerini saklar.
        //
        // SERIAL         = Otomatik artan sayi (1, 2, 3...)
        // PRIMARY KEY    = Bu sutun her satiri benzersiz tanimlar
        // VARCHAR(100)   = Maksimum 100 karakter uzunlugunda metin
        // NOT NULL       = Bu alan bos birakilamaz
        await db.query(`
            CREATE TABLE IF NOT EXISTS candidates (
                id    SERIAL PRIMARY KEY,
                name  VARCHAR(100) NOT NULL,
                party VARCHAR(100) NOT NULL,
                color VARCHAR(20)  NOT NULL
            );
        `);
        console.log('  candidates tablosu olusturuldu');

        // ─── TABLO 2: voters (Secmenler) ───
        // Cift oy vermeyi engellemek icin kullanilir.
        // Gercek kimlik saklanmaz, sadece hash'i tutulur (gizlilik).
        //
        // VARCHAR(64)    = SHA-256 hash her zaman 64 karakter
        // UNIQUE         = Ayni deger iki kez eklenemez (cift oy engeli)
        // DEFAULT NOW()  = Eger deger verilmezse o anki zamani yaz
        await db.query(`
            CREATE TABLE IF NOT EXISTS voters (
                id         SERIAL PRIMARY KEY,
                voter_hash VARCHAR(64) UNIQUE NOT NULL,
                voted_at   TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  voters tablosu olusturuldu');

        // ─── TABLO 3: blocks (Blockchain Bloklari) ───
        // Blockchain zincirindeki her blok burada saklanir.
        //
        // INTEGER        = Tam sayi
        // TEXT            = Metin (timestamp'i TEXT olarak sakliyoruz - asagida aciklama var)
        // JSONB          = JSON verisi (PostgreSQL'in guclu ozelligi)
        //                  Blok icindeki voterHash, candidateId, txId gibi
        //                  verileri esnek sekilde saklar
        // VARCHAR(64)    = Hash degerleri (SHA-256 = 64 karakter)
        //
        // NEDEN timestamp TEXT?
        // Blockchain'de hash hesaplanirken timestamp string olarak kullanilir.
        // PostgreSQL'in TIMESTAMP tipi zamanin formatini degistirir (timezone cevrimi).
        // Ornek: "2026-02-22T23:18:29.096Z" -> "2026-02-22 20:18:29.096" olur.
        // Farkli string = farkli hash -> zincir bozulur!
        // TEXT tipinde ise gonderdigimiz ISO string BIREBIR korunur.
        await db.query(`
            CREATE TABLE IF NOT EXISTS blocks (
                id            SERIAL PRIMARY KEY,
                block_index   INTEGER UNIQUE NOT NULL,
                timestamp     TEXT NOT NULL,
                data          JSONB,
                hash          VARCHAR(64) NOT NULL,
                previous_hash VARCHAR(64) NOT NULL,
                next_hash     VARCHAR(64)
            );
        `);
        console.log('  blocks tablosu olusturuldu');

        // ─── TABLO 4: users (Kullanicilar) ───
        // Kimlik dogrulama (authentication) icin kullanilir.
        // Kullanici kayit olur, sifre hash'lenir (bcrypt), JWT ile giris yapar.
        //
        // VARCHAR(50)    = Kullanici adi (max 50 karakter)
        // UNIQUE         = Ayni username iki kez olamaz
        // VARCHAR(60)    = bcrypt hash ciktisi her zaman 60 karakter
        // VARCHAR(20)    = Rol bilgisi (simdilik 'voter', ileride 'admin' eklenebilir)
        // DEFAULT NOW()  = Hesap olusturma zamani
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id            SERIAL PRIMARY KEY,
                username      VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(60) NOT NULL,
                role          VARCHAR(20) DEFAULT 'voter',
                created_at    TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  users tablosu olusturuldu');

        // ─── TABLO 5: allowed_voters (Secmen Listesi) ───
        // Admin tarafindan Excel ile import edilen secmen listesi.
        // Sadece bu listedeki ogrenci numaralari oy verebilir.
        // Liste bos ise herkes oy verebilir (geriye uyumluluk).
        //
        // VARCHAR(9)     = Ogrenci numarasi her zaman 9 hanedir
        // UNIQUE         = Ayni numara iki kez eklenemez
        // INTEGER        = Il plaka kodu (1-81 arasi)
        // DEFAULT NOW()  = Import zamani otomatik kaydedilir
        await db.query(`
            CREATE TABLE IF NOT EXISTS allowed_voters (
                id                 SERIAL PRIMARY KEY,
                citizenship_number VARCHAR(9) UNIQUE NOT NULL,
                province_code      INTEGER,
                imported_at        TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  allowed_voters tablosu olusturuldu');

        // Mevcut tablo varsa province_code kolonunu ekle (ALTER TABLE)
        await db.query(`
            ALTER TABLE allowed_voters ADD COLUMN IF NOT EXISTS province_code INTEGER;
        `);

        // ─── BASLANGIC VERILERI ───
        // Adaylari ekle (yoksa) veya guncelle (varsa)
        const existingCandidates = await db.query('SELECT COUNT(*) FROM candidates');

        if (parseInt(existingCandidates.rows[0].count) === 0) {
            await db.query(`
                INSERT INTO candidates (name, party, color) VALUES
                    ('FENERBAHÇE', 'Fenerbahçe SK', 'blue'),
                    ('GALATASARAY',  'Galatasaray SK', 'red');
            `);
            console.log('  Baslangic adaylari eklendi (2 aday)');
        } else {
            // Mevcut adaylari guncelle
            await db.query(`UPDATE candidates SET name = 'FENERBAHÇE', party = 'Fenerbahçe SK' WHERE id = 1`);
            await db.query(`UPDATE candidates SET name = 'GALATASARAY', party = 'Galatasaray SK' WHERE id = 2`);
            console.log('  Mevcut adaylar guncellendi');
        }

        // ─── GENESIS BLOCK ───
        // Blockchain'in ilk blogu. Oy verisi icermez, zincirin baslangic noktasidir.
        // Her blockchain bir genesis block ile baslar.
        // block_index = 0, previous_hash = "0" (oncesi yok)
        const existingGenesis = await db.query(
            'SELECT COUNT(*) FROM blocks WHERE block_index = 0'
        );

        if (parseInt(existingGenesis.rows[0].count) === 0) {
            const timestamp = new Date().toISOString();
            const genesisData = { message: 'Genesis Block' };
            const genesisBlock = {
                block_index: 0,
                timestamp: timestamp,
                data: genesisData,
                previous_hash: '0'
            };
            const genesisHash = calculateBlockHash(genesisBlock);

            await db.query(
                `INSERT INTO blocks (block_index, timestamp, data, hash, previous_hash)
                 VALUES ($1, $2, $3, $4, $5)`,
                [0, timestamp, JSON.stringify(genesisData), genesisHash, '0']
            );
            console.log('  Genesis block olusturuldu');
        } else {
            console.log('  Genesis block zaten mevcut, atlaniyor');
        }

        // ─── VARSAYILAN ADMIN KULLANICI ───
        // Ilk admin kullanicisini olustur (zaten varsa atla).
        // Gercek uygulamalarda admin hesabi deploy sirasinda env variable'dan olusturulur.
        // Burada egitim amacli sabit degerler kullaniyoruz.
        const existingAdmin = await db.query(
            "SELECT id FROM users WHERE username = 'admin'"
        );

        const bcrypt = require('bcryptjs');
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

        // Eski admin varsa sil, temiz bir sekilde yeniden olustur
        if (existingAdmin.rows.length > 0) {
            await db.query("DELETE FROM users WHERE username = 'admin'");
        }
        await db.query(
            "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
            ['admin', adminPasswordHash, 'admin']
        );
        console.log('  Admin kullanicisi olusturuldu (admin / admin123)');

        // ─── PERFORMANS INDEXLERI ───
        // Index = kitaptaki icerik tablosu gibi. Arama sorgularini hizlandirir.
        // IF NOT EXISTS ile tekrar calistirmada hata vermez.
        await db.query('CREATE INDEX IF NOT EXISTS idx_voters_hash ON voters(voter_hash)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_blocks_index ON blocks(block_index)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_allowed_voters_tc ON allowed_voters(citizenship_number)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
        console.log('  Performans indexleri olusturuldu');

        console.log('\nVeritabani basariyla hazir!\n');

        // Tablolari listele (dogrulama)
        const tables = await db.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        console.log('Mevcut tablolar:');
        tables.rows.forEach(row => console.log(`  - ${row.table_name}`));

    } catch (err) {
        console.error('Veritabani olusturma hatasi:', err.message);
    }
}

// Eger bu dosya dogrudan calistirilirsa (npm run db:init),
// initDatabase() cagir ve bitince baglanti havuzunu kapat.
// Eger require() ile import edilirse (server.js'den), sadece fonksiyonu ver.
if (require.main === module) {
    initDatabase().then(() => db.pool.end());
}

// server.js'den kullanilabilmesi icin export et
module.exports = initDatabase;
