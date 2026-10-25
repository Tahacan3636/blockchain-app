// Birim testleri: utils/crypto.js (veritabani gerektirmez)
require('../helpers');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
    sha256, voterHash, voterCodeHash, canonicalStringify, calculateBlockHash,
    generateTxId, generateVoterCode, normalizeVoterCode
} = require('../../utils/crypto');

describe('sha256', () => {
    test('bilinen test vektorunu dogru hesaplar', () => {
        assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    test('tek karakter degisince hash tamamen degisir', () => {
        assert.notEqual(sha256('oy:1'), sha256('oy:2'));
        assert.equal(sha256('oy:1').length, 64);
    });
});

describe('canonicalStringify', () => {
    test('anahtar sirasi farkli olsa da ayni stringi uretir', () => {
        assert.equal(canonicalStringify({ a: 1, b: 2 }), canonicalStringify({ b: 2, a: 1 }));
    });

    test('ic ice nesne ve dizileri deterministik cevirir', () => {
        const value = { z: [3, { y: true, x: null }], a: 'metin' };
        assert.equal(canonicalStringify(value), '{"a":"metin","z":[3,{"x":null,"y":true}]}');
    });
});

describe('calculateBlockHash', () => {
    const block = { block_index: 1, timestamp: '2026-01-01T00:00:00.000Z', data: { candidateId: 1 }, previous_hash: 'abc' };

    test('ayni blok icin her zaman ayni hash', () => {
        assert.equal(calculateBlockHash(block), calculateBlockHash({ ...block }));
    });

    test('veri degisirse hash degisir', () => {
        assert.notEqual(calculateBlockHash(block), calculateBlockHash({ ...block, data: { candidateId: 2 } }));
    });

    test('previous_hash degisirse hash degisir (bloklar birbirine kilitli)', () => {
        assert.notEqual(calculateBlockHash(block), calculateBlockHash({ ...block, previous_hash: 'abd' }));
    });
});

describe('voterHash (HMAC)', () => {
    test('duz SHA-256 degildir: anahtarsiz brute force ile bulunamaz', () => {
        assert.notEqual(voterHash('200000001'), sha256('200000001'));
        assert.notEqual(voterHash('200000001'), sha256('voter:200000001'));
    });

    test('ayni numara icin deterministiktir, farkli numaralar farklidir', () => {
        assert.equal(voterHash('200000001'), voterHash('200000001'));
        assert.notEqual(voterHash('200000001'), voterHash('200000002'));
    });
});

describe('oy kodu', () => {
    test('XXXX-XXXX formatinda ve karistirilabilen karakter (0,O,1,I,L) icermez', () => {
        for (let i = 0; i < 200; i++) {
            const code = generateVoterCode();
            assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
            assert.doesNotMatch(code, /[01OIL]/);
        }
    });

    test('1000 kod uretildiginde tekrar yoktur', () => {
        const codes = new Set(Array.from({ length: 1000 }, generateVoterCode));
        assert.equal(codes.size, 1000);
    });

    test('kucuk harf ve bosluklu yazim normalize edilir', () => {
        assert.equal(normalizeVoterCode(' k7m4 p9qx '), 'K7M4P9QX');
        assert.equal(voterCodeHash('k7m4p9qx'), voterCodeHash('K7M4-P9QX'));
    });
});

describe('generateTxId', () => {
    test('girdilerden biri degisince farkli txId uretir', () => {
        const a = generateTxId('t', 'v', 1, 'p');
        assert.notEqual(a, generateTxId('t', 'v', 2, 'p'));
        assert.notEqual(a, generateTxId('t', 'v', 1, 'q'));
    });
});
