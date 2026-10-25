// Entegrasyon testleri: oy verme akisi (HTTP -> servis -> veritabani)
const h = require('../helpers');
const { test, describe, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

after(h.closeDatabase);

describe('POST /api/vote', () => {
    let token;
    let voters;

    before(h.ensureTestDatabase);
    beforeEach(async () => {
        await h.resetDatabase();
        token = await h.loginAdmin();
        voters = await h.importVoters(token, 3);
    });

    test('saglik kontrolu veritabani baglantisini dogrular', async () => {
        const res = await h.request(h.getApp()).get('/api/health');
        assert.equal(res.status, 200);
        assert.equal(res.body.database, 'connected');
    });

    test('dogru numara + kod ile oy kaydedilir ve makbuz doner', async () => {
        const res = await h.vote(voters[0], 1);
        assert.equal(res.status, 201);
        assert.equal(res.body.blockIndex, 1);
        assert.match(res.body.txId, /^[0-9a-f]{64}$/);
    });

    test('yanlis oy kodu reddedilir', async () => {
        const res = await h.vote({ ...voters[0], code: 'AAAA-AAAA' });
        assert.equal(res.status, 403);
        assert.equal(res.body.error, 'Ogrenci numarasi veya oy kodu hatali');
    });

    test('listede olmayan numara AYNI mesajla reddedilir (numara listesi sizmaz)', async () => {
        const res = await h.vote({ studentNumber: '999999999', code: voters[0].code });
        assert.equal(res.status, 403);
        assert.equal(res.body.error, 'Ogrenci numarasi veya oy kodu hatali');
    });

    test('ayni secmen ikinci kez oy kullanamaz', async () => {
        await h.vote(voters[0], 1);
        const res = await h.vote(voters[0], 2);
        assert.equal(res.status, 409);
    });

    test('baskasinin kodu ile oy kullanilamaz', async () => {
        const res = await h.vote({ studentNumber: voters[0].studentNumber, code: voters[1].code });
        assert.equal(res.status, 403);
    });

    test('kod kucuk harf ve tiresiz yazilsa da kabul edilir', async () => {
        const res = await h.vote({ ...voters[0], code: voters[0].code.replace('-', '').toLowerCase() });
        assert.equal(res.status, 201);
    });

    test('gecersiz aday reddedilir', async () => {
        const res = await h.vote(voters[0], 99);
        assert.equal(res.status, 400);
    });

    test('oy kodu olmadan istek reddedilir', async () => {
        const res = await h.request(h.getApp()).post('/api/vote')
            .send({ studentNumber: voters[0].studentNumber, candidateId: 1 });
        assert.equal(res.status, 400);
    });

    test('9 haneli olmayan numara reddedilir', async () => {
        const res = await h.vote({ studentNumber: '123', code: voters[0].code });
        assert.equal(res.status, 400);
    });

    test('bozuk JSON 400 doner, sunucu cokmez', async () => {
        const res = await h.request(h.getApp()).post('/api/vote')
            .set('Content-Type', 'application/json').send('{"bozuk":');
        assert.equal(res.status, 400);
    });
});

describe('Sonuclar ve makbuz', () => {
    let voters;

    before(h.ensureTestDatabase);
    beforeEach(async () => {
        await h.resetDatabase();
        const token = await h.loginAdmin();
        voters = await h.importVoters(token, 3);
    });

    test('sonuclar oylari ve yuzdeleri dogru hesaplar', async () => {
        await h.vote(voters[0], 1);
        await h.vote(voters[1], 1);
        await h.vote(voters[2], 2);

        const res = await h.request(h.getApp()).get('/api/results');
        assert.equal(res.body.totalVotes, 3);
        assert.equal(res.body.allowedVoters, 3);
        const [c1, c2] = res.body.results;
        assert.equal(c1.votes, 2);
        assert.equal(c1.percentage, 66.67);
        assert.equal(c2.votes, 1);
    });

    test('il bazli sonuclar plaka koduna gore gruplanir', async () => {
        await h.vote(voters[0], 1);
        await h.vote(voters[1], 2);
        const res = await h.request(h.getApp()).get('/api/results/map');
        assert.deepEqual(res.body.provinces, { 34: { 1: 1, 2: 1 } });
    });

    test('makbuz: txId zincirde bulunur ama kime oy verildigi gosterilmez', async () => {
        const voteRes = await h.vote(voters[0], 1);
        const res = await h.request(h.getApp()).get('/api/receipt/' + voteRes.body.txId);
        assert.equal(res.status, 200);
        assert.equal(res.body.found, true);
        assert.equal(res.body.blockIndex, 1);
        assert.equal(res.body.candidateId, undefined);
    });

    test('makbuz: olmayan txId 404 doner', async () => {
        const res = await h.request(h.getApp()).get('/api/receipt/' + 'f'.repeat(64));
        assert.equal(res.status, 404);
    });

    test('herkese acik zincirde ogrenci numarasi ve oy kodu yer almaz', async () => {
        await h.vote(voters[0], 1);
        const res = await h.request(h.getApp()).get('/api/chain');
        const raw = JSON.stringify(res.body);
        assert.equal(raw.includes(voters[0].studentNumber), false);
        assert.equal(raw.includes(voters[0].code), false);
    });
});
