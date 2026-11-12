// Semua urusan tampilan (DOM): HUD, panel kuis, chip kartu, overlay.

const $ = (id) => document.getElementById(id);
const LETTERS = ['A', 'B', 'C', 'D'];

export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class QuizUI {
  constructor() {
    this.el = {
      hud: $('hud'), scoreMain: $('score-main'), scoreSub: $('score-sub'), timer: $('timer'),
      chips: $('chips'), hint: $('hint'),
      quiz: $('quiz'), title: $('quiz-title'), fact: $('quiz-fact'), question: $('quiz-question'),
      options: $('quiz-options'), feedback: $('quiz-feedback'),
      finish: $('finish'), finishText: $('finish-text'),
      start: $('start'), loading: $('loading'), loadingText: $('loading-text'),
      error: $('error'), errorText: $('error-text'),
    };
    this.onAnswer = () => {};
    // Satu listener untuk semua tombol opsi (event delegation)
    this.el.options.addEventListener('click', (e) => {
      const btn = e.target.closest('.opt');
      if (btn && !btn.disabled) this.onAnswer(Number(btn.dataset.index));
    });
  }

  /* ---------- Layar ---------- */
  showLoading(text) { this.el.loadingText.textContent = text; this.el.loading.hidden = false; }
  hideLoading() { this.el.loading.hidden = true; }
  hideStart() { this.el.start.hidden = true; }
  showError(msg) { this.hideLoading(); this.el.errorText.textContent = msg; this.el.error.hidden = false; }
  showHud() { this.el.hud.hidden = false; }

  showFinish(stats) {
    this.el.finishText.textContent =
      `Skor akhir ${stats.score} (benar ${stats.correct} dari ${stats.total}). Skor terbaik: ${stats.best}.`;
    this.el.finish.hidden = false;
  }
  hideFinish() { this.el.finish.hidden = true; }

  /* ---------- HUD ---------- */
  setScore(s) {
    this.el.scoreMain.textContent = `Skor ${s.score}`;
    this.el.scoreSub.textContent = `Benar ${s.correct}/${s.total} • Terbaik ${s.best}`;
  }
  setTimer(text) { this.el.timer.textContent = `⏱ ${text}`; }
  setTimerVisible(v) { this.el.timer.hidden = !v; }
  setToggle(id, on) { $(id).setAttribute('aria-pressed', String(on)); }

  /* ---------- Hint & chip ---------- */
  showHint(text) {
    this.el.hint.hidden = !text;
    if (text) this.el.hint.textContent = text;
  }

  renderChips(cards, activeId, answeredIds, onPick) {
    const box = this.el.chips;
    box.innerHTML = '';
    // Chip hanya berguna kalau ada lebih dari satu kartu terlihat
    box.hidden = cards.length < 2;
    cards.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'chip' + (c.id === activeId ? ' active' : '');
      b.textContent = c.title;
      if (answeredIds.has(c.id)) {
        const tick = document.createElement('span');
        tick.className = 'tick';
        tick.textContent = '✓';
        b.appendChild(tick);
      }
      b.addEventListener('click', () => onPick(c.id));
      box.appendChild(b);
    });
  }

  /* ---------- Panel kuis ---------- */
  hideQuiz() { this.el.quiz.hidden = true; }

  // q = soal yang dipilih untuk kartu ini, record = jawaban tersimpan (atau null kalau belum dijawab)
  renderQuiz(card, q, record) {
    this.el.quiz.hidden = false;
    this.el.title.textContent = card.title;
    this.el.fact.textContent = card.fact;
    this.el.question.textContent = q.question;
    this.el.options.hidden = false;
    this.el.options.innerHTML = '';

    q.options.forEach((text, i) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.dataset.index = String(i);
      b.innerHTML = `<span class="letter">${LETTERS[i]}</span><span></span>`;
      b.lastChild.textContent = text;
      if (record) {
        b.disabled = true;
        if (i === q.answerIndex) b.classList.add('correct');
        else if (i === record.selected) b.classList.add('wrong');
      }
      this.el.options.appendChild(b);
    });

    const fb = this.el.feedback;
    if (!record) { fb.hidden = true; return; }
    fb.hidden = false;
    fb.className = record.correct ? 'good' : 'bad';
    fb.textContent = record.correct
      ? `✅ Benar! ${q.explanation}`
      : `❌ Salah. Jawaban yang benar: ${LETTERS[q.answerIndex]}. ${q.options[q.answerIndex]}. ${q.explanation}`;
  }

  // Dipakai saat mode urutan aktif dan kartu belum waktunya dijawab
  renderLocked(card, message) {
    this.el.quiz.hidden = false;
    this.el.title.textContent = card.title;
    this.el.fact.textContent = card.fact;
    this.el.question.textContent = '';
    this.el.options.innerHTML = '';
    this.el.options.hidden = true;
    this.el.feedback.hidden = false;
    this.el.feedback.className = 'lock';
    this.el.feedback.textContent = `🔒 ${message}`;
  }
}
