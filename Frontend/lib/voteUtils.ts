// =============================================================
// voteUtils.ts - Oy Hesaplama Yardimci Fonksiyonlari
// =============================================================
// Rastgele oy uretimi, renk interpolasyonu gibi hesaplamalar.
// setInterval ile canli simulasyon icin kullanilir.
// =============================================================

import { ProvinceVoteData, CandidateVote } from "./types";
import { provinces } from "./provinces";
import { candidates } from "./candidates";

/**
 * Baslangic oy verilerini uretir.
 * Her il icin rastgele oy dagilimi olusturur.
 * Sayim yuzdesi %5-%25 arasinda baslar (canli sayim etkisi).
 */
export function generateInitialVotes(): Map<number, ProvinceVoteData> {
  const result = new Map<number, ProvinceVoteData>();

  for (const province of provinces) {
    // Il nufusuna oranli toplam secmen sayisi (nufusun ~%60'i secmen)
    const totalEligible = Math.floor(province.population * 0.6);
    // Baslangicta %5-%25 arasi sayilmis olsun
    const countedPercentage = 5 + Math.random() * 20;
    const countedVotes = Math.floor(totalEligible * (countedPercentage / 100));

    // Rastgele oy dagilimi: %35-%65 arasi ilk adaya, geri kalan ikinciye
    const ratio = 0.35 + Math.random() * 0.30;
    const candidate1Votes = Math.floor(countedVotes * ratio);
    const candidate2Votes = countedVotes - candidate1Votes;

    const candidateVotes: CandidateVote[] = [
      { candidateId: 1, votes: candidate1Votes },
      { candidateId: 2, votes: candidate2Votes },
    ];

    result.set(province.code, {
      provinceCode: province.code,
      provinceName: province.name,
      totalVotes: countedVotes,
      countedPercentage: Math.round(countedPercentage * 10) / 10,
      candidates: candidateVotes,
    });
  }

  return result;
}

/**
 * Bir ilin oylarini kucuk bir miktarla arttirir.
 * setInterval icinde cagirilir -> canli sayim efekti.
 */
export function generateVoteIncrement(
  current: ProvinceVoteData,
  provincePopulation: number
): ProvinceVoteData {
  if (current.countedPercentage >= 100) return current;

  const totalEligible = Math.floor(provincePopulation * 0.6);
  // Her adim %0.5-%2 arasi artis
  const increment = 0.5 + Math.random() * 1.5;
  const newPercentage = Math.min(100, current.countedPercentage + increment);
  const newTotalVotes = Math.floor(totalEligible * (newPercentage / 100));
  const addedVotes = newTotalVotes - current.totalVotes;

  if (addedVotes <= 0) return { ...current, countedPercentage: newPercentage };

  // Yeni oylari rastgele dagit (mevcut orana yakin, ufak sapma ile)
  const currentRatio = current.candidates[0].votes / Math.max(current.totalVotes, 1);
  const deviation = (Math.random() - 0.5) * 0.1; // +/- %5 sapma
  const newRatio = Math.max(0.2, Math.min(0.8, currentRatio + deviation));
  const added1 = Math.floor(addedVotes * newRatio);
  const added2 = addedVotes - added1;

  return {
    ...current,
    totalVotes: newTotalVotes,
    countedPercentage: Math.round(newPercentage * 10) / 10,
    candidates: [
      { candidateId: 1, votes: current.candidates[0].votes + added1 },
      { candidateId: 2, votes: current.candidates[1].votes + added2 },
    ],
  };
}

/**
 * Oy oranina gore il rengini hesaplar.
 * Kazanan adayin renginin tonunu verir:
 * - %50-55 arasi: Cok acik (yakin yaristaki iller)
 * - %55-65 arasi: Orta ton
 * - %65+: Koyu (net ustunluk)
 *
 * Renk interpolasyonu: beyaz (#f0f0f0) ile aday rengi arasinda.
 */
export function getProvinceColor(data: ProvinceVoteData | undefined): string {
  if (!data || data.totalVotes === 0) return "#e5e7eb"; // Gri (veri yok)

  const vote1 = data.candidates[0]?.votes || 0;
  const vote2 = data.candidates[1]?.votes || 0;
  const total = vote1 + vote2;
  if (total === 0) return "#e5e7eb";

  // Kazanan adayi bul
  const winnerIdx = vote1 >= vote2 ? 0 : 1;
  const winnerPercentage = (Math.max(vote1, vote2) / total) * 100;
  const winnerColor = candidates[winnerIdx].color;

  // Yoğunluk: %50 -> 0.0 (beyaz), %65+ -> 1.0 (tam renk)
  // Formul: (yuzde - 50) / 15, 0-1 arasi clamp
  const intensity = Math.max(0, Math.min(1, (winnerPercentage - 50) / 15));

  return interpolateColor("#f0f0f0", winnerColor, intensity);
}

/**
 * Iki hex renk arasinda lineer interpolasyon yapar.
 * t=0 -> color1, t=1 -> color2
 */
function interpolateColor(color1: string, color2: string, t: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
