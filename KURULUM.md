# Kurulum ve Çalıştırma

Blockchain Tabanlı Öğrenci Temsilcisi Seçim Sistemi — Muhammed Taha Can

Projenin ana mantığı `docs/Proje-Ana-Mantigi.pdf` dosyasında anlatılmıştır.

---

## Yöntem 1: Docker ile (önerilen, tek adım)

Gereken: [Docker Desktop](https://www.docker.com/products/docker-desktop/)

1. Docker Desktop'ı açın.
2. Windows'ta **`baslat.bat`** dosyasına çift tıklayın.
   Diğer sistemlerde bu klasörde terminal açıp şunu çalıştırın:
   ```
   docker compose up --build
   ```
3. Tarayıcıda **http://localhost:3000** adresini açın.
   İlk çalıştırmada indirme nedeniyle birkaç dakika sürebilir.

Kapatmak için terminalde `Ctrl + C`. Veritabanını tamamen silmek için: `docker compose down -v`

> 3000 portu doluysa: `APP_PORT=3005 docker compose up --build` → http://localhost:3005

---

## Yöntem 2: Docker olmadan

Gereken: Node.js 20+ ve PostgreSQL 14+

1. PostgreSQL'de boş bir veritabanı oluşturun: `blockchain_voting`
2. Terminalde:
   ```
   cd Backend
   copy .env.example .env      (macOS/Linux: cp .env.example .env)
   ```
3. `.env` dosyasını açıp veritabanı bilgilerini (DB_USER, DB_PASSWORD, DB_HOST, DB_PORT) girin,
   `DATABASE_URL` satırını silin. `JWT_SECRET` ve `VOTER_HASH_SECRET` en az 32 karakter olmalıdır.
4. Çalıştırın:
   ```
   npm install
   npm start
   ```
5. Tarayıcıda **http://localhost:3000** adresini açın. Tablolar otomatik oluşturulur.

---

## Sistemi denemek

| Adım | Ne yapılır |
|---|---|
| 1. Yönetici girişi | Üstteki **OY VER** butonuna **3 saniye basılı tutun**. Kullanıcı: `admin`, şifre: `admin123` |
| 2. Seçmen listesi | Yönetici panelinde **Excel Yükle** → `Backend/data/blockchain_veriler.xlsx`. Her öğrencinin tek kullanımlık **oy kodu** Excel olarak iner. |
| 3. Oy verme | Ana sayfaya dönüp **OY VER**'e kısa basın. İnen Excel'den bir öğrenci numarası ve oy kodu girip aday seçin. |
| 4. Zinciri inceleme | **Zinciri İncele** / **ZİNCİR** butonu: bloklar, hash bağlantıları ve oy verince alınan TxID ile makbuz doğrulama. |
| 5. Dil | Sağ üstteki **TR / EN** düğmesi. |

### Kurcalama (tamper) testi
Bir oyun veritabanında değiştirilmesi zincir tarafından yakalanır. Docker ile:
```
docker compose exec db psql -U postgres -d blockchain_voting -c "UPDATE blocks SET data = jsonb_set(data, '{candidateId}', '2') WHERE block_index = 1;"
```
Ana sayfadaki **Blockchain Durumu** birkaç saniye içinde "Zincir bozuk – Blok 1: hash uyumsuzluğu" gösterir.

---

## Otomatik testler (61 test)

```
cd Backend
npm install
npm test
```
Entegrasyon testleri ayrı bir test veritabanı (`blockchain_voting_test`) kullanır; `.env`'deki PostgreSQL bilgileriyle otomatik oluşturulur.
