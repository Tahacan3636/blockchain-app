// Entegrasyon testleri: zincir butunlugu, kurcalama tespiti, es zamanli oylar
const h = require('../helpers');
const { test, describe, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../db');

async function verify() {
    const res = await h.request(h.getApp()).get('/api/chain/verify');
    return res.body;
}

after(h.closeDatabase);

describe('Zincir butunlugu', () => {
    let voters;

    before(h.ensureTestDatabase);
    beforeEach(async () => {
        await h.resetDatabase();
        const token = await h.loginAdmin();
        voters = await h.importVoters(token, 5);
        for (const v of voters.slice(0, 3)) await h.vote(v, 1);
    });

    test('oylardan sonra zincir gecerlidir', async () => {
        const result = await verify();
        assert.equal(result.valid, true);
        assert.equal(result.blockCount, 4);
    });

    test('veritabaninda bir oy degistirilirse tespit edilir', async () => {
        await db.query(`UPDATE blocks SET data = jsonb_set(data, '{candidateId}', '2') WHERE block_index = 2`);
        const result = await verify();
        assert.equal(result.valid, false);
        assert.match(result.reason, /Blok 2: hash uyumsuzlugu/);
    });

    test('zincirin SONUNDAKI blok silinirse capraz kontrol ile tespit edilir', async () => {
        await db.query('DELETE FROM blocks WHERE block_index = 3');
        const result = await verify();
        assert.equal(result.valid, false);
        assert.match(result.reason, /Kayit uyumsuzlugu/);
    });

    test('ortadan blok silinirse tespit edilir', async () => {
        await db.query('DELETE FROM blocks WHERE block_index = 2');
        const result = await verify();
        assert.equal(result.valid, false);
    });

    test('her blok bir oncekinin hash\'ini tasir', async () => {
        const res = await h.request(h.getApp()).get('/api/chain');
        const blocks = res.body.blocks;
        for (let i = 1; i < blocks.length; i++) {
            assert.equal(blocks[i].previous_hash, blocks[i - 1].hash);
        }
    });
});

describe('Es zamanli oylar', () => {
    before(h.ensureTestDatabase);
    beforeEach(h.resetDatabase);

    test('50 oy AYNI ANDA gonderildiginde hicbiri kaybolmaz, zincir gecerli kalir', async () => {
        const token = await h.loginAdmin();
        const voters = await h.importVoters(token, 50);

        const responses = await Promise.all(voters.map((v, i) => h.vote(v, 1 + (i % 2))));
        assert.deepEqual(responses.map(r => r.status), Array(50).fill(201));

        const indexes = responses.map(r => r.body.blockIndex).sort((a, b) => a - b);
        assert.deepEqual(indexes, Array.from({ length: 50 }, (_, i) => i + 1));

        const result = await verify();
        assert.equal(result.valid, true);
        assert.equal(result.blockCount, 51);
    });

    test('ayni secmen ayni anda 5 kez oy gonderirse sadece 1 tanesi kabul edilir', async () => {
        const token = await h.loginAdmin();
        const [voter] = await h.importVoters(token, 1);

        const responses = await Promise.all(Array.from({ length: 5 }, () => h.vote(voter, 1)));
        const statuses = responses.map(r => r.status).sort();
        assert.deepEqual(statuses, [201, 409, 409, 409, 409]);
        assert.equal((await verify()).blockCount, 2);
    });
});
