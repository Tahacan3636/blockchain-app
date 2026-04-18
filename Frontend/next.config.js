/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Netlify deploy icin static export
  output: 'export',
  // Statik dosyalar public/ klasorunde
  // Next.js build sirasinda bunlari otomatik kopyalar
};

module.exports = nextConfig;
