// =============================================================
// routes/admin.js - Admin Endpoint'leri
// =============================================================
// Bu router'daki TUM istekler once iki middleware'den gecer:
//   [authenticateToken] -> [requireRole('admin')] -> Route
//
// GET    /api/admin/stats            -> Istatistikler
// POST   /api/admin/voters/import    -> Secmen listesi yukle (+ oy kodlari)
// GET    /api/admin/voters           -> Secmen listesi
// DELETE /api/admin/voters           -> Listeyi ve oylari temizle
// POST   /api/admin/election/reset   -> Oylari sifirla (liste kalir)
// =============================================================

const express = require('express');
const router = express.Router();

const voterService = require('../services/voterService');
const resultService = require('../services/resultService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../utils/errors');

router.use(authenticateToken, requireRole('admin'));

router.get('/stats', asyncHandler(async (req, res) => {
    const stats = await resultService.getStats();
    res.json({ success: true, stats });
}));

// Cevaptaki oy kodlari SADECE bu an doner; veritabaninda duz hali yoktur.
router.post('/voters/import', asyncHandler(async (req, res) => {
    const voters = await voterService.importVoters(req.body.voters);
    res.json({
        success: true,
        message: `${voters.length} secmen yuklendi, oy kodlari uretildi`,
        count: voters.length,
        voters
    });
}));

router.get('/voters', asyncHandler(async (req, res) => {
    const voters = await voterService.listVoters();
    res.json({ success: true, voters, total: voters.length });
}));

router.delete('/voters', asyncHandler(async (req, res) => {
    await voterService.clearVoters();
    res.json({ success: true, message: 'Secmen listesi ve tum oylar temizlendi, yeni genesis blok olusturuldu' });
}));

router.post('/election/reset', asyncHandler(async (req, res) => {
    if (req.body.confirm !== true) {
        throw new AppError(400, 'Bu islem icin { "confirm": true } gondermelisiniz');
    }
    await voterService.resetElection();
    res.json({ success: true, message: 'Secim sifirlandi, yeni genesis blok olusturuldu' });
}));

module.exports = router;
