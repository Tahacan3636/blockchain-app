// =============================================================
// db/index.js - Veritabani Baglantisi (Veri Katmani)
// =============================================================
// PostgreSQL'e bir "Connection Pool" (baglanti havuzu) ile baglanir.
// Pool, her istekte yeni baglanti acmak yerine hazir baglantilari
// yeniden kullanir -> daha hizli.
//
// ONEMLI: Transaction (BEGIN/COMMIT) icin pool.query KULLANILMAZ.
// pool.query her cagrida havuzdan FARKLI bir baglanti alabilir;
// BEGIN bir baglantida, INSERT baska baglantida calisirsa transaction
// fiilen yoktur. Bu yuzden withTransaction() tek bir baglanti (client)
// alir ve tum sorgulari o baglanti uzerinden calistirir.
// =============================================================

const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.db);

pool.on('error', (err) => {
    console.error('Veritabani baglanti hatasi:', err.message);
});

// Tek sorgu (transaction gerektirmeyen okumalar icin)
function query(text, params) {
    return pool.query(text, params);
}

// Transaction yardimcisi: fn icindeki tum sorgular ya HEP BIRLIKTE
// kalici olur (COMMIT) ya da hicbiri olmaz (ROLLBACK).
async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release(); // baglantiyi havuza geri ver
    }
}

module.exports = { query, withTransaction, pool };
