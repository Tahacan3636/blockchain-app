// Birim testleri: secmen listesi dogrulama - veritabani gerektirmez
require('../helpers');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { validateVoterList } = require('../../services/voterService');
const { AppError } = require('../../utils/errors');

describe('validateVoterList', () => {
    test('bos liste reddedilir', () => {
        assert.throws(() => validateVoterList([]), AppError);
        assert.throws(() => validateVoterList(undefined), AppError);
    });

    test('9 haneli olmayan ogrenci numarasi reddedilir', () => {
        assert.throws(
            () => validateVoterList([{ studentNumber: '12345', provinceCode: 34 }]),
            /Satir 1: Gecersiz ogrenci numarasi/
        );
    });

    test('1-81 disindaki il kodu reddedilir', () => {
        assert.throws(
            () => validateVoterList([{ studentNumber: '200000001', provinceCode: 82 }]),
            /Gecersiz il kodu/
        );
    });

    test('tekrar eden numaralar tek kayda indirilir', () => {
        const result = validateVoterList([
            { studentNumber: '200000001', provinceCode: 34 },
            { studentNumber: '200000001', provinceCode: 34 },
            { studentNumber: '200000002', provinceCode: '6' }
        ]);
        assert.deepEqual(result, [
            { studentNumber: '200000001', provinceCode: 34 },
            { studentNumber: '200000002', provinceCode: 6 }
        ]);
    });
});
