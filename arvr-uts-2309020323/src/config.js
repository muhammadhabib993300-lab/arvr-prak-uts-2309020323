// Semua pengaturan penting ada di sini supaya mudah diubah.
export const CONFIG = {
  // File target hasil kompilasi (isi: 4 gambar kartu, urutan = targetIndex)
  targetSrc: './targets/targets.mind',

  // Bank soal
  questionsSrc: './data/questions.json',

  // Berapa kartu yang boleh dilacak bersamaan (uji "dua kartu terlihat bersamaan")
  maxTrack: 2,

  // Kunci penyimpanan di perangkat (localStorage)
  storageKey: 'ar-flashcard-v2',

  // Poin per jawaban benar
  pointsPerCorrect: 10,
};
