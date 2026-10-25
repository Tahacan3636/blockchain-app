// =============================================================
// tests/helpers.js - Ortak Test Yardimcilari
// =============================================================
// Her test dosyasi EN BASTA bunu require eder. Testler gercek
// veritabanina degil, ayri bir test veritabanina baglanir.
// =============================================================

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'blockchain_voting_test';
delete process.env.DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-0123456789abcdef0123456789';
process.env.VOTER_HASH_SECRET = process.env.VOTER_HASH_SECRET || 'test-voter-secret-0123456789abcdef01234567';
process.env.ADMIN_PASSWORD = 'admin123';

const { Client } = require('pg');
const request = require('supertest');
const config = require('../config');

// Test veritabani yoksa olusturur (postgres sistem veritabanina baglanarak)
async function ensureTestDatabase() {
    const client = new Client({ ...config.db, database: 'postgres' });
    await client.connect();
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.db.database]);
    if (exists.rows.length === 0) {
        await client.query(`CREATE DATABASE "${config.db.database}"`);
    }
    await client.end();
}

// Her testten once temiz bir veritabani
async function resetDatabase() {
    const db = require('../db');
    const initDatabase = require('../db/init');
    await db.query('DROP TABLE IF EXISTS blocks, allowed_voters, users, candidates, voters CASCADE');
    await initDatabase();
}

function getApp() {
    return require('../app');
}

async function loginAdmin() {
    const res = await request(getApp())
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
    return res.body.token;
}

// n adet secmen yukler, { studentNumber, provinceCode, code } listesi doner
async function importVoters(token, n = 3, provinceCode = 34) {
    const voters = Array.from({ length: n }, (_, i) => ({
        studentNumber: String(200000001 + i),
        provinceCode
    }));
    const res = await request(getApp())
        .post('/api/admin/voters/import')
        .set('Authorization', `Bearer ${token}`)
        .send({ voters });
    return res.body.voters;
}

function vote(voter, candidateId = 1) {
    return request(getApp())
        .post('/api/vote')
        .send({ studentNumber: voter.studentNumber, voterCode: voter.code, candidateId });
}

async function closeDatabase() {
    await require('../db').pool.end();
}

module.exports = {
    request,
    getApp,
    ensureTestDatabase,
    resetDatabase,
    loginAdmin,
    importVoters,
    vote,
    closeDatabase
};
