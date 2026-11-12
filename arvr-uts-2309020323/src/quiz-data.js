// Memuat, memvalidasi, dan memilih soal dari data/questions.json
//
// Struktur JSON:
//   cards:     daftar kartu   (id, targetIndex, title, model, fact)
//   questions: bank soal      (id, cardId, question, options, answerIndex, explanation)
// Satu kartu boleh punya beberapa soal. Tiap putaran, satu kartu menampilkan SATU soal
// yang dipilih acak dari soal miliknya (soal yang belum pernah muncul diprioritaskan).

export async function loadQuestions(url, allowedModels = []) {
  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new Error(`Tidak bisa membuka ${url}.\nPastikan web dijalankan lewat server (bukan klik dua kali file HTML).`);
  }
  if (!res.ok) throw new Error(`Gagal memuat ${url} (HTTP ${res.status}).`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`${url} bukan JSON yang valid.\nCek koma, kurung, dan tanda kutip.`);
  }

  const errors = validateQuestions(data, allowedModels);
  if (errors.length) throw new Error('Format JSON soal salah:\n- ' + errors.join('\n- '));
  return data;
}

// Mengembalikan daftar pesan error. Kosong = valid.
export function validateQuestions(data, allowedModels = []) {
  const errors = [];
  if (!data || typeof data !== 'object' || !Array.isArray(data.cards)) {
    return ['Properti "cards" harus ada dan berupa array.'];
  }
  if (!Array.isArray(data.questions)) {
    return ['Properti "questions" harus ada dan berupa array.'];
  }
  if (data.cards.length < 4) {
    errors.push(`Minimal 4 kartu, sekarang baru ${data.cards.length}.`);
  }

  const isText = (v) => typeof v === 'string' && v.trim().length > 0;

  /* ---- kartu ---- */
  const cardIds = new Set();
  const targets = new Set();
  data.cards.forEach((c, i) => {
    const p = `Kartu #${i + 1}`;
    if (!c || typeof c !== 'object') { errors.push(`${p}: harus berupa objek.`); return; }

    if (!isText(c.id)) errors.push(`${p}: "id" wajib berupa teks.`);
    else if (cardIds.has(c.id)) errors.push(`${p}: "id" "${c.id}" duplikat.`);
    else cardIds.add(c.id);

    if (!Number.isInteger(c.targetIndex) || c.targetIndex < 0) {
      errors.push(`${p}: "targetIndex" harus bilangan bulat >= 0.`);
    } else if (targets.has(c.targetIndex)) {
      errors.push(`${p}: "targetIndex" ${c.targetIndex} dipakai dua kali.`);
    } else targets.add(c.targetIndex);

    if (!isText(c.title)) errors.push(`${p}: "title" wajib berupa teks.`);
    if (!isText(c.fact))  errors.push(`${p}: "fact" wajib berupa teks.`);

    if (!isText(c.model)) errors.push(`${p}: "model" wajib berupa teks.`);
    else if (allowedModels.length && !allowedModels.includes(c.model)) {
      errors.push(`${p}: model "${c.model}" tidak dikenal. Pilihan: ${allowedModels.join(', ')}.`);
    }
  });

  /* ---- soal ---- */
  const qIds = new Set();
  const perCard = new Map();
  data.questions.forEach((q, i) => {
    const p = `Soal #${i + 1}`;
    if (!q || typeof q !== 'object') { errors.push(`${p}: harus berupa objek.`); return; }

    if (!isText(q.id)) errors.push(`${p}: "id" wajib berupa teks.`);
    else if (qIds.has(q.id)) errors.push(`${p}: "id" "${q.id}" duplikat.`);
    else qIds.add(q.id);

    if (!isText(q.cardId)) errors.push(`${p}: "cardId" wajib berupa teks.`);
    else if (!cardIds.has(q.cardId)) errors.push(`${p}: "cardId" "${q.cardId}" tidak ada di daftar kartu.`);
    else perCard.set(q.cardId, (perCard.get(q.cardId) || 0) + 1);

    if (!isText(q.question)) errors.push(`${p}: "question" wajib berupa teks.`);
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4 || !q.options.every(isText)) {
      errors.push(`${p}: "options" harus array 2-4 teks.`);
    } else if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= q.options.length) {
      errors.push(`${p}: "answerIndex" harus 0 sampai ${q.options.length - 1}.`);
    }
    if (!isText(q.explanation)) errors.push(`${p}: "explanation" wajib berupa teks.`);
  });

  cardIds.forEach((id) => {
    if (!perCard.get(id)) errors.push(`Kartu "${id}" belum punya soal sama sekali.`);
  });

  return errors;
}

// Pasang daftar soal ke tiap kartu: card.questions = [...]
export function attachQuestions(data) {
  data.cards.forEach((c) => {
    c.questions = data.questions.filter((q) => q.cardId === c.id);
  });
  return data.cards;
}

// Bersihkan data tersimpan yang tidak cocok lagi dengan JSON (misalnya soal dihapus/diganti)
export function reconcileStore(cards, store) {
  cards.forEach((c) => {
    const ids = c.questions.map((q) => q.id);
    const rec = store.getAnswer(c.id);
    const cur = store.getCurrent(c.id);
    if ((rec && !ids.includes(rec.questionId)) || (cur && !ids.includes(cur))) {
      store.clearCard(c.id);
    }
  });
}

// Pilih soal untuk sebuah kartu. Hasilnya "ditempel" selama satu putaran,
// jadi scan ulang kartu yang sama tidak mengganti soalnya.
export function pickQuestion(card, store) {
  const pool = card.questions;
  const current = pool.find((q) => q.id === store.getCurrent(card.id));
  if (current) return current;

  const seen = store.seen;
  let fresh = pool.filter((q) => !seen.includes(q.id));
  if (!fresh.length) {
    // Semua soal kartu ini sudah pernah muncul: mulai siklus baru, hindari soal terakhir
    const last = [...seen].reverse().find((id) => pool.some((q) => q.id === id));
    store.forgetSeen(pool.map((q) => q.id));
    fresh = pool.length > 1 ? pool.filter((q) => q.id !== last) : pool;
  }
  const q = fresh[Math.floor(Math.random() * fresh.length)];
  store.setCurrent(card.id, q.id);
  return q;
}
