// =============================================================
// types.ts - TypeScript Tip Tanimlari
// =============================================================
// Secim haritasi icin kullanilan tum veri yapilari burada.
// TypeScript ile her degiskenin tipini onceden belirleriz,
// boylece hatalar derleme zamaninda yakalanir.
// =============================================================

/** Bir aday (candidate) tanimlari */
export interface Candidate {
  id: number;
  name: string;
  party: string;
  color: string; // Haritada kullanilacak renk (hex)
}

/** Bir adayin belirli bir ildeki oy verisi */
export interface CandidateVote {
  candidateId: number;
  votes: number;
}

/** Bir ilin toplam oy verisi */
export interface ProvinceVoteData {
  provinceCode: number;       // Plaka kodu (1-81)
  provinceName: string;       // Il adi
  totalVotes: number;         // Toplam kullanilan oy
  countedPercentage: number;  // Sayim yuzdesi (0-100)
  candidates: CandidateVote[]; // Her adayin oylari
}

/** Tooltip'te gosterilecek veri */
export interface TooltipData {
  provinceName: string;
  countedPercentage: number;
  candidates: {
    name: string;
    color: string;
    votes: number;
    percentage: number;
  }[];
  x: number; // Mouse X koordinati
  y: number; // Mouse Y koordinati
}

/** Tum secimin genel durumu */
export interface ElectionState {
  provinces: Map<number, ProvinceVoteData>; // plaka kodu -> il verisi
  totalVotes: number;
  lastUpdate: Date;
  isLive: boolean; // Sayim devam ediyor mu?
}

/** Il tanimi (provinces.ts icin) */
export interface Province {
  code: number;   // Plaka kodu
  name: string;   // Il adi
  population: number; // Yaklasik nufus (oy havuzu hesabi icin)
}
