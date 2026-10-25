// =============================================================
// routes/public.js - Herkese Acik Endpoint'ler
// =============================================================
// Route katmaninin tek gorevi HTTP: istekten veriyi al, servisi
// cagir, cevabi JSON olarak don. Is mantigi services/ altindadir.
//
// POST /api/vote              -> Oy ver
// GET  /api/results           -> Aday bazli sonuclar
// GET  /api/results/map       -> Il bazli sonuclar (harita)
// GET  /api/chain             -> Tum zincir (seffaflik / denetim)
// GET  /api/chain/verify      -> Zincir butunluk kontrolu
// GET  /api/receipt/:txId     -> Makbuz: oyum zincirde mi?
// =============================================================

const express = require('express');
const router = express.Router();

const voteService = require('../services/voteService');
const resultService = require('../services/resultService');
const chainService = require('../services/chainService');
const { voteLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../utils/errors');

router.post('/vote', voteLimiter, asyncHandler(async (req, res) => {
    const { studentNumber, voterCode, candidateId } = req.body;
    const receipt = await voteService.castVote({ studentNumber, voterCode, candidateId });
    res.status(201).json({ success: true, message: 'Oy basariyla kaydedildi', ...receipt });
}));

router.get('/results', asyncHandler(async (req, res) => {
    const data = await resultService.getResults();
    res.json({ success: true, ...data });
}));

router.get('/results/map', asyncHandler(async (req, res) => {
    const provinces = await resultService.getProvinceResults();
    res.json({ success: true, provinces });
}));

router.get('/chain', asyncHandler(async (req, res) => {
    const blocks = await chainService.getChain();
    res.json({ success: true, length: blocks.length, blocks });
}));

router.get('/chain/verify', asyncHandler(async (req, res) => {
    const result = await chainService.verifyChain();
    res.json({
        success: true,
        ...result,
        message: result.valid ? 'Blockchain butunlugu dogrulandi' : undefined
    });
}));

router.get('/receipt/:txId', asyncHandler(async (req, res) => {
    const block = await chainService.findReceipt(req.params.txId);
    if (!block) {
        return res.status(404).json({ success: false, found: false, error: 'Bu islem numarasi zincirde bulunamadi' });
    }
    res.json({
        success: true,
        found: true,
        blockIndex: block.block_index,
        timestamp: block.timestamp,
        blockHash: block.hash
    });
}));

module.exports = router;
