// =============================================================
// db/index.js - Veritabani Baglanti Ayarlari
// =============================================================
// PostgreSQL'e baglanmak icin bir "Connection Pool" olusturur.
// Baglanti bilgileri .env dosyasindan okunur (guvenlik icin).
//
// Render'da: DATABASE_URL otomatik saglanir.
// Lokalde: .env dosyasina yaz veya ayri ayri tanimla.
// =============================================================

const { Pool } = require('pg');

// DATABASE_URL varsa onu kullan (Render, Heroku vb. icin)
// Yoksa ayri ayri degiskenleri kullan
// Production'da DATABASE_URL zorunlu. Lokalde ayri degiskenler kullanilabilir.
let pool;

if (process.env.DATABASE_URL) {
    // Render, Heroku vb. icin (production)
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false  // Render PostgreSQL icin gerekli
        }
    });
} else if (process.env.DB_USER && process.env.DB_PASSWORD) {
    // Lokal gelistirme icin (.env dosyasindan)
    pool = new Pool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'blockchain_voting'
    });
} else {
    console.error('❌ Veritabani bilgileri eksik! .env dosyasina DATABASE_URL veya DB_USER/DB_PASSWORD ekleyin.');
    process.exit(1);
}

// Baglanti kontrolu
pool.on('error', (err) => {
    console.error('Veritabani baglanti hatasi:', err.message);
});

// Baglanti testi
pool.query('SELECT NOW()')
    .then(() => console.log('✅ PostgreSQL baglantisi basarili'))
    .catch(err => console.error('❌ PostgreSQL baglanti hatasi:', err.message));

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool
};
