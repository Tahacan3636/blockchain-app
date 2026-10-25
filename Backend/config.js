// =============================================================
// config.js - Uygulama Ayarlari (tek merkez)
// =============================================================
// Tum ortam degiskenleri (.env) sadece burada okunur ve kontrol edilir.
// Diger dosyalar process.env yerine bu modulu kullanir.
// Eksik/zayif bir gizli anahtar varsa sunucu hic baslamaz (fail fast).
// =============================================================

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

function requireSecret(name) {
    const value = process.env[name];
    if (!value || value.length < 32) {
        throw new Error(`${name} tanimli degil veya 32 karakterden kisa. .env dosyasini kontrol edin.`);
    }
    return value;
}

const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    frontendUrl: process.env.FRONTEND_URL || '*',

    // Uygulamanin onunde kac proxy var (Render: 1). Dogrudan erisimde 0.
    trustProxy: parseInt(process.env.TRUST_PROXY || '0', 10),

    // JWT: admin oturum token'larini imzalamak icin
    jwtSecret: requireSecret('JWT_SECRET'),
    jwtExpiresIn: '24h',

    // HMAC anahtari: ogrenci numarasi ve oy kodlarini geri cozulemez sekilde hashlemek icin
    voterSecret: requireSecret('VOTER_HASH_SECRET'),

    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

    db: process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432', 10),
            database: process.env.DB_NAME || 'blockchain_voting'
        },

    // Testlerde hiz sinirlamasi kapatilir
    isTest: process.env.NODE_ENV === 'test'
};

module.exports = config;
