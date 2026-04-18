# Blockchain Voting System - Deploy Rehberi

Bu belge, projenin sifirdan internete nasil yayinlandigini adim adim anlatir.

---

## Genel Bakis

Proje uc katmandan olusur ve her biri farkli bir platformda calisir:

| Katman | Platform | URL |
|--------|----------|-----|
| **Backend (API)** | Render Web Service | `https://blockchain-app-e63h.onrender.com` |
| **Veritabani** | Render PostgreSQL | Render Internal URL |
| **Frontend (UI)** | Netlify | Netlify URL |

```
Kullanici (Tarayici)
      |
      v
  [ Netlify ]          --> Frontend (HTML, CSS, JS)
      |
      | API istekleri (fetch)
      v
  [ Render Web Service ] --> Backend (Node.js + Express)
      |
      | SQL sorgulari
      v
  [ Render PostgreSQL ]  --> Veritabani (tablolar, blockchain)
```

---

## ADIM 1: GitHub'a Yukleme

Proje zaten lokal olarak gelistirilmisti. Ilk is GitHub'a yuklemek oldu.

### 1.1 GitHub'da Repo Olusturma

- GitHub'da yeni bir repo olusturuldu: `Tahacan3636/blockchain-app`
- Public olarak ayarlandi

### 1.2 Projeyi Push Etme

```bash
# Proje klasorune git
cd Desktop/blockchain-voting-system

# Git baslat
git init
git add .
git commit -m "Initial commit: Blockchain Voting System"

# GitHub'a bagla ve gonder
git remote add origin https://github.com/Tahacan3636/blockchain-app.git
git branch -M main
git push -u origin main
```

**Sonuc:** Tum kod GitHub'da `main` branch'inde.

---

## ADIM 2: Render'da PostgreSQL Veritabani Olusturma

### 2.1 Render Hesabi

- [render.com](https://render.com) adresine gidildi
- GitHub hesabi ile giris yapildi

### 2.2 PostgreSQL Olusturma

1. Render Dashboard -> **New** -> **PostgreSQL**
2. Ayarlar:
   - **Name:** Istenen bir isim (orn: `blockchain-voting-db`)
   - **Region:** Uygun bir bolge
   - **Plan:** Free
3. **Create Database** butonuna basildi
4. Olusturulduktan sonra **Internal Database URL** kopyalandi

> **ONEMLI:** Internal Database URL suna benzer:
> `postgresql://kullanici:sifre@host:5432/veritabani`
> Bu URL, Backend'in veritabanina baglanmasi icin kullanilacak.

---

## ADIM 3: Render'da Backend Web Service Olusturma

### 3.1 Web Service Olusturma

1. Render Dashboard -> **New** -> **Web Service**
2. **GitHub repo** secildi: `Tahacan3636/blockchain-app`
3. Ayarlar:

| Ayar | Deger |
|------|-------|
| **Name** | `blockchain-app` |
| **Root Directory** | `Backend` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Plan** | Free |

### 3.2 Environment Variables (Ortam Degiskenleri)

Render Dashboard -> **Environment** sekmesinde su degiskenler tanimlandi:

| Degisken | Deger | Aciklama |
|----------|-------|----------|
| `DATABASE_URL` | `postgresql://...` (Render'dan kopyalanan) | Veritabani baglanti adresi |
| `JWT_SECRET` | Guclu bir rastgele string | Token imzalama anahtari |
| `ADMIN_PASSWORD` | `admin123` (veya istenen sifre) | Admin giris sifresi |
| `FRONTEND_URL` | Netlify URL (sonra eklenir) | CORS icin frontend adresi |

### 3.3 Deploy

- **Create Web Service** butonuna basildi
- Render otomatik olarak:
  1. GitHub'dan kodu cekti
  2. `npm install` ile bagimliliklari yukledi
  3. `node server.js` ile sunucuyu baslatti
- Sonuc: `https://blockchain-app-e63h.onrender.com` adresi verildi

### 3.4 Otomatik Deploy

Render, GitHub `main` branch'ine her push yapildiginda otomatik yeniden deploy eder:

```
git push origin main  -->  Render algilar  -->  Yeniden deploy
```

---

## ADIM 4: Veritabani Tablolarinin Otomatik Olusturulmasi

### 4.1 Problem

Render'da `node db/init.js` komutunu elle calistirmak zor. Tablolar olusturulmadan API calismaz.

### 4.2 Cozum: server.js'de Otomatik Init

`db/init.js` dosyasi degistirildi - fonksiyon export edilebilir hale getirildi:

```javascript
// db/init.js - ONCE:
initDatabase();  // Dosya calisinca direkt cagrilir

// db/init.js - SONRA:
if (require.main === module) {
    initDatabase().then(() => db.pool.end());  // Dogrudan calistirilirsa
}
module.exports = initDatabase;  // Import edilebilir
```

`server.js`'de sunucu baslamadan once tablolar olusturulur:

```javascript
const initDatabase = require('./db/init');

initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log('Server basladi');
    });
});
```

### 4.3 Sonuc

Her deploy'da:
1. Tablolar kontrol edilir (IF NOT EXISTS - zaten varsa atlanir)
2. Adaylar, genesis block, admin kullanicisi olusturulur
3. Sonra sunucu baslar

---

## ADIM 5: Frontend'i Backend'e Baglama

### 5.1 config.js Guncelleme

`Frontend/public/js/config.js` dosyasinda API adresi guncellendi:

```javascript
// ONCE (lokal):
const API_BASE = '';

// SONRA (deploy):
const API_BASE = 'https://blockchain-app-e63h.onrender.com';
```

Bu sayede frontend'teki tum API cagrilari Render'daki backend'e yonlendirilir.

---

## ADIM 6: Frontend'i Netlify'a Deploy Etme

### 6.1 Netlify Hesabi

- [netlify.com](https://netlify.com) adresine gidildi
- GitHub hesabi baglandi (Settings -> Connected accounts)

### 6.2 Site Olusturma

1. **Add new site** -> **Import an existing project** -> **GitHub**
2. `Tahacan3636/blockchain-app` repo secildi
3. Ayarlar:

| Ayar | Deger |
|------|-------|
| **Branch to deploy** | `main` |
| **Base directory** | `Frontend/public` |
| **Build command** | _(bos)_ |
| **Publish directory** | `Frontend/public` |

4. **Deploy site** butonuna basildi

### 6.3 Neden Build Command Bos?

Frontend statik HTML/CSS/JS dosyalarindan olusur. Derlemeye (build) gerek yok, Netlify direkt dosyalari sunar.

---

## ADIM 7: Admin Giris Sorunun Cozulmesi

### 7.1 Problem

Admin panelinden `admin` / `admin123` ile giris yapilamiyordu.

### 7.2 Tespit

Debug endpoint eklenerek sorun tespit edildi:
- Render'da `ADMIN_PASSWORD` environment variable `guclu-bir-sifre-belirle` olarak ayarlanmisti
- Bu yuzden sifre `admin123` degil, `guclu-bir-sifre-belirle` idi

### 7.3 Cozum

Render Dashboard -> Environment -> `ADMIN_PASSWORD` degeri `admin123` olarak guncellendi.

### 7.4 Ders

Environment variable'lar koddan onceliklidir:
```javascript
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
//                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                    Eger env var tanimliysa O kullanilir
//                    Tanimli degilse 'admin123' kullanilir
```

---

## Guncelleme Akisi (CI/CD)

Kod degisikligi yaptiktan sonra canli siteyi guncellemek icin:

```bash
# 1. Degisiklikleri kaydet
git add .
git commit -m "Degisiklik aciklamasi"

# 2. GitHub'a gonder
git push origin main

# 3. Otomatik deploy baslar:
#    - Render: Backend yeniden deploy edilir (1-2 dakika)
#    - Netlify: Frontend yeniden deploy edilir (30 saniye)
```

Manuel deploy gerekirse:
- **Render:** Dashboard -> Manual Deploy -> Deploy latest commit
- **Netlify:** Dashboard -> Deploys -> Trigger deploy

---

## Canli URL'ler

| Servis | URL |
|--------|-----|
| **Backend API** | https://blockchain-app-e63h.onrender.com |
| **Health Check** | https://blockchain-app-e63h.onrender.com/api/health |
| **Frontend** | Netlify URL'in |

## Admin Giris Bilgileri

| Alan | Deger |
|------|-------|
| **Username** | `admin` |
| **Password** | Render'daki `ADMIN_PASSWORD` degeri |

---

## Sorun Giderme

### Backend calismiyorsa:
1. Render Dashboard -> Logs sekmesini kontrol et
2. Environment variables dogru mu kontrol et (DATABASE_URL, JWT_SECRET)
3. Manual Deploy dene

### Frontend API'ye baglanamazsa:
1. `Frontend/public/js/config.js` dosyasindaki `API_BASE` dogru mu kontrol et
2. Render'daki `FRONTEND_URL` dogru mu kontrol et (CORS)
3. Tarayicida F12 -> Console sekmesinde hata mesajlarini kontrol et

### Admin girisi calismiyorsa:
1. Render Dashboard -> Environment -> `ADMIN_PASSWORD` degerini kontrol et
2. Deploy bittiginden emin ol (logda "Your service is live" yazmali)

### Veritabani sorunlarinda:
1. Render Dashboard -> PostgreSQL -> Status kontrol et
2. `DATABASE_URL` dogru mu kontrol et
3. Health endpoint'ini test et: `curl https://blockchain-app-e63h.onrender.com/api/health`

---

## Kullanilan Platformlar ve Ucretleri

| Platform | Plan | Sinirlamalar |
|----------|------|-------------|
| **GitHub** | Free | Sinursiz public repo |
| **Render (Web Service)** | Free | 15 dakika hareketsizlikte uyku moduna gecer |
| **Render (PostgreSQL)** | Free | 1 GB depolama, 90 gun sonra silinebilir |
| **Netlify** | Free | Aylik 100 GB bant genisligi |

> **NOT:** Render free plan'da backend 15 dakika istek almazsa uyku moduna gecer.
> Ilk istek geldiginde uyanir ama bu 30-50 saniye surebilir.
