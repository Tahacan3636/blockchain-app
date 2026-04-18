// =============================================================
// app/map/page.tsx - /map Sayfasi
// =============================================================
// Next.js App Router sayfasi.
// react-simple-maps SSR desteklemez, bu yuzden dynamic import
// ile sadece client-side'da yuklenir.
// =============================================================

import dynamic from "next/dynamic";

// SSR'yi kapat: react-simple-maps window/document kullanir
const TurkeyElectionMap = dynamic(
  () =>
    import("@/components/turkey-map/TurkeyElectionMap").then(
      (mod) => mod.TurkeyElectionMap
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-lg animate-pulse">
          Harita yükleniyor...
        </div>
      </div>
    ),
  }
);

export default function MapPage() {
  return <TurkeyElectionMap />;
}
