// =============================================================
// candidates.ts - Aday Tanimlari
// =============================================================
// Secimde yarisan adaylar. Renk kodlari haritada kullanilir.
// Fenerbahçe = lacivert, Galatasaray = kırmızı
// =============================================================

import { Candidate } from "./types";

export const candidates: Candidate[] = [
  {
    id: 1,
    name: "FENERBAHÇE",
    party: "Fenerbahçe SK",
    color: "#001e62", // Lacivert
  },
  {
    id: 2,
    name: "GALATASARAY",
    party: "Galatasaray SK",
    color: "#ef4444", // Kirmizi
  },
];
