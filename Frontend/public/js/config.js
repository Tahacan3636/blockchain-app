// =============================================================
// public/js/config.js - Frontend Yapilandirma
// =============================================================
// Backend adresi tek yerde tanimlidir.
// - Lokal (localhost): frontend'i backend sunar -> ayni adres ('')
// - Canli (Netlify):   istekler Render'daki backend'e gider
// Bu dosya HTML'de diger JS dosyalarindan ONCE yuklenmelidir.
// =============================================================

const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? ''
    : 'https://blockchain-app-e63h.onrender.com';
