// =============================================================
// services/resultService.js - Sonuc ve Istatistik Hesaplari
// =============================================================
// Oylar ayri bir tabloda degil, DOGRUDAN zincirdeki bloklardan
// sayilir. Boylece sonuclar her zaman zincirle birebir tutarlidir.
// =============================================================

const db = require('../db');

async function getResults() {
    const [candidates, votes, allowed] = await Promise.all([
        db.query('SELECT id, name, party, color FROM candidates ORDER BY id'),
        // block_index > 0: genesis blogunda oy yok
        db.query(`
            SELECT data->>'candidateId' AS candidate_id, COUNT(*) AS votes
            FROM blocks WHERE block_index > 0
            GROUP BY data->>'candidateId'
        `),
        db.query('SELECT COUNT(*) FROM allowed_voters')
    ]);

    const voteMap = {};
    votes.rows.forEach(r => { voteMap[r.candidate_id] = parseInt(r.votes, 10); });
    const totalVotes = Object.values(voteMap).reduce((sum, v) => sum + v, 0);

    const results = candidates.rows.map(c => {
        const count = voteMap[String(c.id)] || 0;
        return {
            candidateId: c.id,
            name: c.name,
            party: c.party,
            color: c.color,
            votes: count,
            percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 10000) / 100 : 0
        };
    });

    return {
        totalVotes,
        allowedVoters: parseInt(allowed.rows[0].count, 10),
        results
    };
}

// Harita icin: { "34": { "1": 12, "2": 9 }, "6": {...} }
async function getProvinceResults() {
    const result = await db.query(`
        SELECT data->>'provinceCode' AS province_code,
               data->>'candidateId'  AS candidate_id,
               COUNT(*)              AS votes
        FROM blocks
        WHERE block_index > 0 AND data->>'provinceCode' IS NOT NULL
        GROUP BY 1, 2
    `);

    const provinces = {};
    result.rows.forEach(r => {
        if (!provinces[r.province_code]) provinces[r.province_code] = {};
        provinces[r.province_code][r.candidate_id] = parseInt(r.votes, 10);
    });
    return provinces;
}

async function getStats() {
    const [{ totalVotes, allowedVoters, results }, blocks] = await Promise.all([
        getResults(),
        db.query('SELECT COUNT(*) FROM blocks')
    ]);

    return {
        totalVotes,
        allowedVoters,
        totalBlocks: parseInt(blocks.rows[0].count, 10),
        votesPerCandidate: results.map(r => ({
            candidateId: r.candidateId,
            name: r.name,
            party: r.party,
            votes: r.votes
        }))
    };
}

module.exports = { getResults, getProvinceResults, getStats };
