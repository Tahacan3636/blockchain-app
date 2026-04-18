// =============================================================
// middleware/auth.js - JWT Kimlik Dogrulama Middleware'i
// =============================================================
// Middleware Nedir?
// Express'te request -> response arasinda calisan fonksiyonlardır.
// Bir "guvenlik kontrol noktasi" gibi dusunulebilir.
// Istek hedefe ulasmadan once middleware'den gecer.
//
// Bu middleware JWT (JSON Web Token) ile kimlik dogrulama yapar:
// 1. Authorization header'indan token'i alir
// 2. Token'i dogrular (jwt.verify)
// 3. Gecerliyse req.user'a kullanici bilgisini yazar ve next() cagirir
// 4. Gecersizse 401 veya 403 hata doner
//
// Kullanim:
// router.post('/vote', authenticateToken, async (req, res) => { ... })
// Boylece /vote endpoint'ine sadece gecerli token'a sahip kullanicilar erisebilir.
// =============================================================

const jwt = require('jsonwebtoken');

// ─── JWT SABITLERI ───
// JWT_SECRET: Token imzalamak icin kullanilan gizli anahtar.
// Bu deger .env dosyasinda tanimlanmalidir (min 32 karakter).
if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET tanimlanmamis! .env dosyasina ekleyin.');
    process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// JWT_EXPIRES_IN: Token'in gecerlilik suresi.
// '24h' = 24 saat sonra token gecersiz olur, kullanici tekrar login olmali.
const JWT_EXPIRES_IN = '24h';

// ─── authenticateToken Middleware ───
// Her korunmus endpoint'te calisir.
//
// Authorization Header Formati:
// "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
// "Bearer " kismi standart bir prefix'tir (OAuth 2.0 standardi).
//
// 401 Unauthorized: Token yok veya format hatali
//   -> "Kim oldugunuzu bilmiyorum, lutfen giris yapin"
// 403 Forbidden: Token var ama gecersiz/suresi dolmus
//   -> "Kim oldugunuzu biliyorum ama bu token gecersiz"
function authenticateToken(req, res, next) {
    // 1. Authorization header'ini oku
    const authHeader = req.headers['authorization'];

    // 2. "Bearer <token>" formatindan token kismini ayikla
    // authHeader = "Bearer eyJ..." -> split(' ') -> ["Bearer", "eyJ..."] -> [1] = "eyJ..."
    const token = authHeader && authHeader.split(' ')[1];

    // 3. Token yoksa 401 don
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Erisim icin giris yapmaniz gerekiyor (token bulunamadi)'
        });
    }

    // 4. Token'i dogrula
    // jwt.verify() token'i JWT_SECRET ile cozmeye calisir.
    // Basariliysa decoded = { id, username, role, iat, exp }
    //   iat = issued at (olusturulma zamani)
    //   exp = expiration (son kullanma tarihi)
    // Basarisizsa err nesnesi dolmur (suresi dolmus, imza hatali vb.)
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: 'Gecersiz veya suresi dolmus token'
            });
        }

        // 5. Token gecerli -> kullanici bilgisini req.user'a yaz
        // Bundan sonraki middleware veya route handler'da
        // req.user.id, req.user.username, req.user.role kullanilabilir.
        req.user = decoded;
        next();
    });
}

// ─── requireRole Middleware (Higher-Order Function) ───
// Authentication (Kimlik Dogrulama) = "Sen kimsin?" -> authenticateToken
// Authorization (Yetkilendirme)     = "Bunu yapabilir misin?" -> requireRole
//
// Higher-Order Function Nedir?
// Bir fonksiyon donen fonksiyon. requireRole('admin') cagrildiginda
// geri donen fonksiyon bir Express middleware'idir.
// Bu pattern "middleware factory" olarak da bilinir.
//
// Kullanim (authenticateToken'dan SONRA gelmelidir):
//   router.get('/users', authenticateToken, requireRole('admin'), handler)
//
//   1. authenticateToken: Token gecerli mi? -> req.user = { id, username, role }
//   2. requireRole('admin'): req.user.role === 'admin' mi?
//   3. handler: Her iki kontrol de gecti, istegi isle
//
// 403 Forbidden: "Kim oldugunuzu biliyorum ama bu isleme yetkiniz yok"
function requireRole(role) {
    return (req, res, next) => {
        // authenticateToken oncesinde calisirsa req.user undefined olur
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Kimlik dogrulama gerekli (token bulunamadi)'
            });
        }

        // Kullanicinin rolu istenen role esit mi?
        if (req.user.role !== role) {
            return res.status(403).json({
                success: false,
                error: `Bu islem icin '${role}' yetkisi gerekiyor. Sizin rolunuz: '${req.user.role}'`
            });
        }

        // Yetki uygun, devam et
        next();
    };
}

module.exports = { authenticateToken, requireRole, JWT_SECRET, JWT_EXPIRES_IN };
