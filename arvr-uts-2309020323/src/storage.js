// Menyimpan skor & pengaturan di perangkat (localStorage)

const DEFAULT = {
  answers: {},   // { [idKartu]: { questionId, selected, correct, timeMs } }  (putaran sekarang)
  current: {},   // { [idKartu]: idSoal }  soal yang sedang dipakai kartu pada putaran ini
  seen: [],      // idSoal yang sudah pernah dijawab (supaya putaran berikutnya dapat soal baru)
  best: 0,       // skor terbaik sepanjang waktu
  settings: { sound: true, timer: true, sequence: false },
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export class ScoreStore {
  constructor(key, pointsPerCorrect = 10) {
    this.key = key;
    this.points = pointsPerCorrect;
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return clone(DEFAULT);
      const p = JSON.parse(raw);
      const base = clone(DEFAULT);
      return {
        answers: isObj(p.answers) ? p.answers : base.answers,
        current: isObj(p.current) ? p.current : base.current,
        seen: Array.isArray(p.seen) ? p.seen : base.seen,
        best: Number.isFinite(p.best) ? p.best : 0,
        settings: { ...base.settings, ...(isObj(p.settings) ? p.settings : {}) },
      };
    } catch {
      return clone(DEFAULT); // data rusak / localStorage diblokir
    }
  }

  _save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch { /* abaikan */ }
  }

  get settings() { return this.data.settings; }
  setSetting(name, value) { this.data.settings[name] = value; this._save(); }

  /* ---- jawaban ---- */
  getAnswer(cardId) { return this.data.answers[cardId] || null; }
  isAnswered(cardId) { return !!this.data.answers[cardId]; }

  record(cardId, { questionId, selected, correct, timeMs }) {
    this.data.answers[cardId] = { questionId, selected, correct, timeMs };
    if (!this.data.seen.includes(questionId)) this.data.seen.push(questionId);
    const { score } = this.getStats(0);
    if (score > this.data.best) this.data.best = score;
    this._save();
  }

  /* ---- soal yang sedang dipakai ---- */
  getCurrent(cardId) { return this.data.current[cardId] || null; }
  setCurrent(cardId, questionId) { this.data.current[cardId] = questionId; this._save(); }
  clearCard(cardId) {
    delete this.data.answers[cardId];
    delete this.data.current[cardId];
    this._save();
  }

  /* ---- riwayat soal yang pernah muncul ---- */
  get seen() { return this.data.seen; }
  forgetSeen(ids) {
    this.data.seen = this.data.seen.filter((id) => !ids.includes(id));
    this._save();
  }

  getStats(totalCards) {
    const list = Object.values(this.data.answers);
    const correct = list.filter((a) => a.correct).length;
    return {
      score: correct * this.points,
      correct,
      answered: list.length,
      total: totalCards,
      best: this.data.best,
    };
  }

  // Mulai putaran baru: hapus jawaban & soal aktif.
  // Skor terbaik, pengaturan, dan riwayat soal tetap (supaya dapat soal baru).
  resetProgress() {
    this.data.answers = {};
    this.data.current = {};
    this._save();
  }
}
