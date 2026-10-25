// =============================================================
// middleware/auth.js - Kimlik Dogrulama ve Yetkilendirme
// =============================================================
// Middleware: istek route'a ulasmadan once calisan "kontrol noktasi".
//   Istek -> [authenticateToken] -> [requireRole('admin')] -> Route
//
// authenticateToken: "Kimsin?"  -> JWT gecerli mi? (401 / 403)
// requireRole:       "Yetkin var mi?" -> rol uygun mu? (403)
// =============================================================

const jwt = require('jsonwebtoken');
const config = require('../config');

function signToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
    );
}

// Header formati: "Authorization: Bearer <token>"
function authenticateToken(req, res, next) {
    const header = req.headers['authorization'];
    const token = header && header.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Giris yapmaniz gerekiyor' });
    }

    jwt.verify(token, config.jwtSecret, (err, decoded) => {
        if (err) {
            return res.status(403).json({ success: false, error: 'Gecersiz veya suresi dolmus oturum' });
        }
        req.user = decoded;
        next();
    });
}

// Fabrika fonksiyonu: requireRole('admin') bir middleware DONDURUR.
function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ success: false, error: `Bu islem icin '${role}' yetkisi gerekiyor` });
        }
        next();
    };
}

module.exports = { signToken, authenticateToken, requireRole };
