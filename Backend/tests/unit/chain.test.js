// Birim testleri: zincir dogrulama (validateChain) - veritabani gerektirmez
require('../helpers');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildGenesisBlock, validateChain } = require('../../services/chainService');
const { calculateBlockHash } = require('../../utils/crypto');

function nextBlock(prev, data) {
    const block = {
        block_index: prev.block_index + 1,
        timestamp: new Date().toISOString(),
        data,
        previous_hash: prev.hash,
    };
    block.hash = calculateBlockHash(block);
    return block;
}

function buildChain(voteCount) {
    const chain = [buildGenesisBlock()];
    for (let i = 0; i < voteCount; i++) {
        chain.push(nextBlock(chain[chain.length - 1], { voterHash: 'v' + i, candidateId: 1 + (i % 2), txId: 't' + i }));
    }
    return chain;
}

describe('validateChain', () => {
    test('sadece genesis bloktan olusan zincir gecerlidir', () => {
        assert.equal(validateChain(buildChain(0)).valid, true);
    });

    test('dogru kurulmus zincir gecerlidir', () => {
        const result = validateChain(buildChain(5));
        assert.equal(result.valid, true);
        assert.equal(result.blockCount, 6);
    });

    test('bos zincir gecersizdir', () => {
        assert.equal(validateChain([]).valid, false);
    });

    test('bir bloktaki oy degistirilirse yakalanir', () => {
        const chain = buildChain(3);
        chain[2].data.candidateId = 99;
        const result = validateChain(chain);
        assert.equal(result.valid, false);
        assert.match(result.reason, /Blok 2: hash uyumsuzlugu/);
    });

    test('saldirgan degistirdigi blogun hash\'ini yeniden hesaplasa da sonraki blok yakalar', () => {
        const chain = buildChain(3);
        chain[1].data.candidateId = 2;
        chain[1].hash = calculateBlockHash(chain[1]);
        // Hash yeniden hesaplansa bile sonraki blogun previousHash'i tutmaz
        const result = validateChain(chain);
        assert.equal(result.valid, false);
        assert.match(result.reason, /Blok 2: previousHash uyumsuzlugu/);
    });

    test('blok sirasi bozulursa yakalanir', () => {
        const chain = buildChain(3);
        chain[2].block_index = 5;
        assert.match(validateChain(chain).reason, /index hatasi/);
    });

    test('genesis blogu degistirilirse yakalanir', () => {
        const chain = buildChain(1);
        chain[0].previous_hash = 'x';
        assert.equal(validateChain(chain).reason, 'Genesis blok gecersiz');
    });

    test('ayni secmenin iki blogu varsa yakalanir', () => {
        const chain = buildChain(1);
        chain.push(nextBlock(chain[1], { voterHash: 'v0', candidateId: 2, txId: 'tx' }));
        assert.match(validateChain(chain).reason, /ayni secmen/);
    });
});
