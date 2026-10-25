// =============================================================
// public/js/api.js - Frontend API Client
// =============================================================
// Frontend'in backend ile konustugu TEK dosya. Sayfalar fetch'i
// dogrudan cagirmaz, buradaki fonksiyonlari kullanir.
// Backend adresi config.js'teki API_BASE'ten gelir (bu dosyadan once yuklenmeli).
// =============================================================

const API = {

    getBase() {
        return (typeof API_BASE !== 'undefined') ? API_BASE : '';
    },

    // Ortak istek fonksiyonu: JSON gonderir, JSON cevap doner.
    // Cevaba HTTP durum kodu da eklenir (status), boylece sayfa hatayi
    // kendi dilinde gosterebilir (403 -> "kod hatali", 409 -> "zaten oy verdi").
    async request(path, { method = 'GET', body, auth = false } = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (auth) headers['Authorization'] = `Bearer ${this.getToken()}`;

        const response = await fetch(this.getBase() + path, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
        const data = await response.json();
        data.status = response.status;
        return data;
    },

    // ==================== OTURUM (admin) ====================
    getToken() {
        return localStorage.getItem('auth_token');
    },

    getUser() {
        const data = localStorage.getItem('auth_user');
        return data ? JSON.parse(data) : null;
    },

    isLoggedIn() {
        return !!this.getToken();
    },

    async login(username, password) {
        const data = await this.request('/api/auth/login', { method: 'POST', body: { username, password } });
        if (data.success && data.token) {
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
        }
        return data;
    },

    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    },

    // ==================== HERKESE ACIK ====================
    vote(studentNumber, voterCode, candidateId) {
        return this.request('/api/vote', { method: 'POST', body: { studentNumber, voterCode, candidateId } });
    },

    getResults() {
        return this.request('/api/results');
    },

    getProvinceResults() {
        return this.request('/api/results/map');
    },

    // Backend snake_case doner (block_index); frontend camelCase kullanir.
    async getChain() {
        const data = await this.request('/api/chain');
        if (data.success && data.blocks) {
            data.blocks = data.blocks.map(block => ({
                index:        block.block_index,
                timestamp:    block.timestamp,
                data:         typeof block.data === 'string' ? JSON.parse(block.data) : block.data,
                hash:         block.hash,
                previousHash: block.previous_hash
            }));
        }
        return data;
    },

    verifyChain() {
        return this.request('/api/chain/verify');
    },

    getReceipt(txId) {
        return this.request('/api/receipt/' + encodeURIComponent(txId));
    },

    // ==================== ADMIN ====================
    getStats() {
        return this.request('/api/admin/stats', { auth: true });
    },

    getVoters() {
        return this.request('/api/admin/voters', { auth: true });
    },

    importVoters(voters) {
        return this.request('/api/admin/voters/import', { method: 'POST', body: { voters }, auth: true });
    },

    clearVoters() {
        return this.request('/api/admin/voters', { method: 'DELETE', auth: true });
    },

    resetElection() {
        return this.request('/api/admin/election/reset', { method: 'POST', body: { confirm: true }, auth: true });
    }
};
