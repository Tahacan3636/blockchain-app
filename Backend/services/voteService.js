// =============================================================
// services/voteService.js - Oy Verme Is Mantigi
// =============================================================
// Bir oyun yolculugu:
//  1. Girdiler kontrol edilir (numara 9 hane, kod, aday)
//  2. Secmen listede mi ve oy kodu dogru mu?
//  3. Daha once oy kullanmis mi? (cift oy engeli)
//  4. Oy, zincire yeni bir blok olarak eklenir
//  5. Secmen "oy kullandi" olarak isaretlenir
// 2-5 arasi TEK transaction icindedir: ya hepsi olur ya hicbiri.
// =============================================================

const crypto = require('crypto');
const db = require('../db');
const chainService = require('./chainService');
const { voterHash, voterCodeHash, generateTxId } = require('../utils/crypto');
const { AppError } = require('../utils/errors');

// Numara yok / kod yanlis durumlarinda AYNI mesaj doner.
// Farkli mesaj donseydi saldirgan hangi numaralarin listede
// oldugunu deneyerek ogrenebilirdi.
const INVALID_CREDENTIALS = 'Ogrenci numarasi veya oy kodu hatali';

function safeEqual(a, b) {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

async function castVote({ studentNumber, voterCode, candidateId }) {
    studentNumber = String(studentNumber || '').trim();
    candidateId = Number(candidateId);

    if (!/^\d{9}$/.test(studentNumber)) {
        throw new AppError(400, 'Ogrenci numarasi 9 haneli olmalidir');
    }
    if (!voterCode) {
        throw new AppError(400, 'Oy kodu zorunludur');
    }
    if (!Number.isInteger(candidateId)) {
        throw new AppError(400, 'Gecerli bir aday seciniz');
    }

    const candidate = await db.query('SELECT id FROM candidates WHERE id = $1', [candidateId]);
    if (candidate.rows.length === 0) {
        throw new AppError(400, 'Gecersiz aday');
    }

    return db.withTransaction(async (client) => {
        // FOR UPDATE: ayni secmenin es zamanli iki istegi siraya girer
        const voterResult = await client.query(
            `SELECT id, province_code, code_hash, has_voted
             FROM allowed_voters WHERE student_number = $1 FOR UPDATE`,
            [studentNumber]
        );
        const voter = voterResult.rows[0];

        if (!voter || !safeEqual(voter.code_hash, voterCodeHash(voterCode))) {
            throw new AppError(403, INVALID_CREDENTIALS);
        }
        if (voter.has_voted) {
            throw new AppError(409, 'Bu secmen zaten oy kullanmis');
        }

        const hashedVoter = voterHash(studentNumber);

        const block = await chainService.appendBlock(client, (prevHash, timestamp) => ({
            voterHash: hashedVoter,
            candidateId,
            txId: generateTxId(timestamp, hashedVoter, candidateId, prevHash),
            provinceCode: voter.province_code
        }));

        await client.query('UPDATE allowed_voters SET has_voted = TRUE WHERE id = $1', [voter.id]);

        return {
            txId: block.data.txId,
            blockIndex: block.block_index,
            blockHash: block.hash
        };
    });
}

module.exports = { castVote };
