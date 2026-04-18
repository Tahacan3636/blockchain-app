# Blockchain Tabanlı Oylama Sistemi - Proje Özeti

## Proje Hakkında
Yazılım Mühendisliği dersi kapsamında geliştirilen, blockchain teknolojisi ile güvenli ve şeffaf bir elektronik oylama sistemi.

**Teknolojiler:** Node.js, Express, PostgreSQL, JWT, bcrypt, TailwindCSS

---

## Modül 1: Proje Altyapısı
- Express.js ile web sunucusu kuruldu
- Proje klasör yapısı oluşturuldu (routes, public, utils, middleware, db, docs)
- Statik dosya sunumu ve temel middleware'ler eklendi

## Modül 2: Veritabanı
- PostgreSQL kuruldu ve bağlantı havuzu (pool) oluşturuldu
- 3 tablo tasarlandı: candidates, voters, blocks
- Veritabanı başlatma scripti yazıldı (db/init.js)

## Modül 3: REST API
- 4 API endpoint oluşturuldu: vote, results, chain, chain/verify
- Sunucu tarafında SHA-256 hash hesaplama
- Genesis block oluşturma
- Blockchain zincir doğrulama

## Modül 4: Frontend Entegrasyonu
- localStorage yerine fetch API ile backend'e bağlantı
- API client oluşturuldu (public/js/api.js)
- Dashboard, oylama paneli ve blockchain explorer arayüzü

## Modül 5: Kimlik Doğrulama (Authentication)
- JWT tabanlı token sistemi
- bcrypt ile şifre hashleme
- Register ve Login endpoint'leri
- Oy verme artık token ile korunuyor

## Modül 6: Admin Paneli (Authorization)
- Role-based access control (RBAC): voter ve admin rolleri
- requireRole() middleware ile yetkilendirme
- Admin paneli: istatistikler, kullanıcı yönetimi, seçim sıfırlama
- Tek sayfa üzerinden admin ve voter deneyimi
- Logout ile hesaplar arası geçiş

---

## Sonuç
6 modülde adım adım geliştirilen proje; backend, frontend, veritabanı, güvenlik ve yönetim panelini kapsayan tam bir web uygulamasıdır.
