// =============================================================
// public/js/api.js - Frontend API Client
// =============================================================
// Bu dosya frontend'ten backend API'ye istek gondermek icin kullanilir.
//
// ONEMLI: config.js bu dosyadan ONCE yuklenmeli!
// config.js'deki API_BASE degiskeni backend adresini belirler.
//
// Lokal:  API_BASE = ''  -> fetch('/api/results')
// Deploy: API_BASE = 'https://xxx.onrender.com' -> fetch('https://xxx.onrender.com/api/results')
// =============================================================

const API = {

    // API_BASE'i al (config.js'den)
    getBase() {
        return (typeof API_BASE !== 'undefined') ? API_BASE : '';
    },

    // ==================== TOKEN YONETIMI ====================
    getToken() {
        return localStorage.getItem('auth_token');
    },

    setToken(token) {
        localStorage.setItem('auth_token', token);
    },

    removeToken() {
        localStorage.removeItem('auth_token');
    },

    // ==================== KULLANICI BILGISI ====================
    getUser() {
        const data = localStorage.getItem('auth_user');
        return data ? JSON.parse(data) : null;
    },

    setUser(user) {
        localStorage.setItem('auth_user', JSON.stringify(user));
    },

    removeUser() {
        localStorage.removeItem('auth_user');
    },

    // ==================== AUTH DURUMU ====================
    isLoggedIn() {
        return !!this.getToken();
    },

    // ==================== AUTH ENDPOINT'LERI ====================

    async register(username, password) {
        const response = await fetch(this.getBase() + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        return await response.json();
    },

    async login(username, password) {
        const response = await fetch(this.getBase() + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (data.success && data.token) {
            this.setToken(data.token);
            this.setUser(data.user);
        }

        return data;
    },

    logout() {
        this.removeToken();
        this.removeUser();
    },

    // ==================== OY VERME ====================

    async vote(candidateId, voterId) {
        const headers = { 'Content-Type': 'application/json' };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(this.getBase() + '/api/vote', {
            method: 'POST',
            headers,
            body: JSON.stringify({ candidateId, voterId })
        });
        return await response.json();
    },

    // ==================== PUBLIC ENDPOINT'LER ====================

    async getResults() {
        const response = await fetch(this.getBase() + '/api/results');
        return await response.json();
    },

    async getChain() {
        const response = await fetch(this.getBase() + '/api/chain');
        const data = await response.json();

        if (data.success && data.blocks) {
            data.blocks = data.blocks.map(block => ({
                index:        block.block_index,
                timestamp:    block.timestamp,
                data:         typeof block.data === 'string' ? JSON.parse(block.data) : block.data,
                hash:         block.hash,
                previousHash: block.previous_hash,
                nextHash:     block.next_hash
            }));
        }

        return data;
    },

    async verifyChain() {
        const response = await fetch(this.getBase() + '/api/chain/verify');
        return await response.json();
    }
};
