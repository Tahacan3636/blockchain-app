// Entegrasyon testleri: admin girisi, yetkilendirme, secmen yonetimi
const h = require('../helpers');
const { test, describe, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../db');

after(h.closeDatabase);

describe('Kimlik dogrulama ve yetki', () => {
    before(h.ensureTestDatabase);
    beforeEach(h.resetDatabase);

    test('dogru sifre ile giris JWT token doner', async () => {
        const res = await h.request(h.getApp()).post('/api/auth/login')
            .send({ username: 'admin', password: 'admin123' });
        assert.equal(res.status, 200);
        assert.equal(res.body.token.split('.').length, 3); // header.payload.signature
        assert.equal(res.body.user.role, 'admin');
    });

    test('yanlis sifre 401 doner', async () => {
        const res = await h.request(h.getApp()).post('/api/auth/login')
            .send({ username: 'admin', password: 'yanlis' });
        assert.equal(res.status, 401);
    });

    test('sifreler veritabaninda duz metin degil bcrypt hash olarak durur', async () => {
        const result = await db.query("SELECT password_hash FROM users WHERE username = 'admin'");
        assert.match(result.rows[0].password_hash, /^\$2[aby]\$10\$/);
    });

    test('token olmadan admin endpoint\'i 401 doner', async () => {
        const res = await h.request(h.getApp()).get('/api/admin/stats');
        assert.equal(res.status, 401);
    });

    test('sahte token 403 doner', async () => {
        const res = await h.request(h.getApp()).get('/api/admin/stats')
            .set('Authorization', 'Bearer sahte.token.degeri');
        assert.equal(res.status, 403);
    });

    test('olmayan endpoint 404 doner', async () => {
        const res = await h.request(h.getApp()).get('/api/yok');
        assert.equal(res.status, 404);
    });
});

describe('Secmen yonetimi', () => {
    let token;

    before(h.ensureTestDatabase);
    beforeEach(async () => {
        await h.resetDatabase();
        token = await h.loginAdmin();
    });

    test('liste yuklenince her secmene benzersiz oy kodu uretilir', async () => {
        const voters = await h.importVoters(token, 10);
        assert.equal(voters.length, 10);
        assert.equal(new Set(voters.map(v => v.code)).size, 10);
    });

    test('oy kodlari veritabaninda duz halde saklanmaz', async () => {
        const voters = await h.importVoters(token, 2);
        const result = await db.query('SELECT code_hash FROM allowed_voters');
        const stored = JSON.stringify(result.rows);
        assert.equal(stored.includes(voters[0].code), false);
        assert.equal(stored.includes(voters[0].code.replace('-', '')), false);
    });

    test('hatali satir iceren liste 400 ile reddedilir', async () => {
        const res = await h.request(h.getApp()).post('/api/admin/voters/import')
            .set('Authorization', `Bearer ${token}`)
            .send({ voters: [{ studentNumber: 'abc', provinceCode: 34 }] });
        assert.equal(res.status, 400);
    });

    test('istatistikler oy ve katilim bilgisini doner', async () => {
        const voters = await h.importVoters(token, 4);
        await h.vote(voters[0], 1);
        const res = await h.request(h.getApp()).get('/api/admin/stats')
            .set('Authorization', `Bearer ${token}`);
        assert.equal(res.body.stats.totalVotes, 1);
        assert.equal(res.body.stats.allowedVoters, 4);
        assert.equal(res.body.stats.totalBlocks, 2);
    });

    test('secim sifirlaninca oylar silinir, liste korunur, ayni kodla tekrar oy verilebilir', async () => {
        const voters = await h.importVoters(token, 2);
        await h.vote(voters[0], 1);

        const reset = await h.request(h.getApp()).post('/api/admin/election/reset')
            .set('Authorization', `Bearer ${token}`).send({ confirm: true });
        assert.equal(reset.status, 200);

        const results = await h.request(h.getApp()).get('/api/results');
        assert.equal(results.body.totalVotes, 0);
        assert.equal(results.body.allowedVoters, 2);
        assert.equal((await h.vote(voters[0], 2)).status, 201);
    });

    test('onay (confirm) olmadan secim sifirlanamaz', async () => {
        const res = await h.request(h.getApp()).post('/api/admin/election/reset')
            .set('Authorization', `Bearer ${token}`).send({});
        assert.equal(res.status, 400);
    });

    test('liste temizlenince secmenler ve oylar silinir', async () => {
        const voters = await h.importVoters(token, 2);
        await h.vote(voters[0], 1);

        await h.request(h.getApp()).delete('/api/admin/voters').set('Authorization', `Bearer ${token}`);

        const res = await h.request(h.getApp()).get('/api/admin/voters').set('Authorization', `Bearer ${token}`);
        assert.equal(res.body.total, 0);
        assert.equal((await h.vote(voters[1], 1)).status, 403);
    });
});
