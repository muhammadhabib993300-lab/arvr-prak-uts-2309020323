// File utama: menyambungkan MindAR (kamera + tracking), model 3D, kuis, dan skor.

import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';

import { CONFIG } from './config.js';
import { loadQuestions, attachQuestions, reconcileStore, pickQuestion } from './quiz-data.js';
import { ScoreStore } from './storage.js';
import { SoundFx } from './sound.js';
import { createCardModel, MODEL_NAMES } from './models.js';
import { QuizUI, formatTime } from './quiz-ui.js';

const ui = new QuizUI();
const store = new ScoreStore(CONFIG.storageKey, CONFIG.pointsPerCorrect);
const sfx = new SoundFx(store.settings.sound);

/* ---------------- State ---------------- */
let cards = [];                    // semua kartu dari JSON
const byId = new Map();            // id -> kartu
const visibleIds = [];             // kartu yang sedang terlihat kamera (urut kemunculan)
let activeId = null;               // kartu yang kuisnya sedang tampil
const runtimes = new Map();        // id -> { model, visible, appear }

// Penghitung waktu: hanya jalan saat kuis kartu tersebut tampil
const elapsed = new Map();         // id -> ms terkumpul
let runningId = null;
let runningSince = 0;
let tickHandle = null;

const stats = () => store.getStats(cards.length);
const answeredSet = () => new Set(cards.filter((c) => store.isAnswered(c.id)).map((c) => c.id));
const nextInOrder = () => cards.find((c) => !store.isAnswered(c.id)) || null;

/* ---------------- Timer ---------------- */
function currentMs(id) {
  const base = elapsed.get(id) || 0;
  return runningId === id ? base + (performance.now() - runningSince) : base;
}
function startTimer(id) {
  stopTimer();
  runningId = id;
  runningSince = performance.now();
  ui.setTimer(formatTime(currentMs(id)));
  tickHandle = setInterval(() => ui.setTimer(formatTime(currentMs(id))), 250);
}
function stopTimer() {
  if (runningId !== null) {
    elapsed.set(runningId, currentMs(runningId));
    runningId = null;
  }
  clearInterval(tickHandle);
  tickHandle = null;
}

/* ---------------- Render kuis ---------------- */
function renderActive() {
  ui.renderChips(visibleIds.map((id) => byId.get(id)), activeId, answeredSet(), (id) => {
    activeId = id;
    renderActive();
  });
  stopTimer();

  if (!activeId) {
    ui.hideQuiz();
    ui.showHint('Arahkan kamera ke salah satu kartu 🎴');
    return;
  }
  ui.showHint(null);

  const card = byId.get(activeId);
  const record = store.getAnswer(card.id);

  // Mode urutan: kartu harus dijawab sesuai urutan di JSON
  if (store.settings.sequence && !record) {
    const next = nextInOrder();
    if (next && next.id !== card.id) {
      ui.renderLocked(card, `Mode urutan aktif. Pindai kartu "${next.title}" dulu.`);
      return;
    }
  }

  const question = pickQuestion(card, store);
  ui.renderQuiz(card, question, record);
  if (record) ui.setTimer(formatTime(record.timeMs));
  else startTimer(card.id);
}

function handleAnswer(index) {
  const card = byId.get(activeId);
  if (!card || store.isAnswered(card.id)) return;

  sfx.unlock();
  stopTimer();
  const question = pickQuestion(card, store);
  const correct = index === question.answerIndex;
  store.record(card.id, {
    questionId: question.id,
    selected: index,
    correct,
    timeMs: Math.round(elapsed.get(card.id) || 0),
  });

  if (correct) sfx.correct(); else sfx.wrong();

  renderActive();
  ui.setScore(stats());

  if (answeredSet().size === cards.length) {
    setTimeout(() => { sfx.finish(); ui.showFinish(stats()); }, 900);
  }
}

function resetAll() {
  store.resetProgress();
  elapsed.clear();
  ui.hideFinish();
  ui.setScore(stats());
  renderActive();
}

/* ---------------- Tombol HUD ---------------- */
function bindToolbar() {
  const syncToggles = () => {
    ui.setToggle('btn-sound', store.settings.sound);
    ui.setToggle('btn-timer', store.settings.timer);
    ui.setToggle('btn-seq', store.settings.sequence);
    ui.setTimerVisible(store.settings.timer);
  };
  syncToggles();

  document.getElementById('btn-sound').addEventListener('click', () => {
    store.setSetting('sound', !store.settings.sound);
    sfx.enabled = store.settings.sound;
    sfx.unlock();
    if (sfx.enabled) sfx.found();
    syncToggles();
  });
  document.getElementById('btn-timer').addEventListener('click', () => {
    store.setSetting('timer', !store.settings.timer);
    syncToggles();
  });
  document.getElementById('btn-seq').addEventListener('click', () => {
    store.setSetting('sequence', !store.settings.sequence);
    syncToggles();
    renderActive();
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset semua jawaban dan skor sekarang? (Skor terbaik tetap tersimpan)')) resetAll();
  });
  document.getElementById('finish-again').addEventListener('click', resetAll);
  document.getElementById('finish-close').addEventListener('click', () => ui.hideFinish());
  document.getElementById('error-reload').addEventListener('click', () => location.reload());
  ui.onAnswer = handleAnswer;
}

/* ---------------- Start AR ---------------- */
async function startApp() {
  ui.hideStart();
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Kamera hanya bisa dipakai lewat HTTPS atau http://localhost.\nJalankan lewat server lokal atau hosting HTTPS.');
    }

    ui.showLoading('Memuat soal…');
    const data = await loadQuestions(CONFIG.questionsSrc, MODEL_NAMES);
    cards = attachQuestions(data);          // card.questions = soal milik kartu itu
    cards.forEach((c) => byId.set(c.id, c));
    reconcileStore(cards, store);           // buang data lama yang tidak cocok dengan JSON

    ui.showLoading('Memeriksa file target…');
    const probe = await fetch(CONFIG.targetSrc, { method: 'HEAD' }).catch(() => null);
    if (!probe || !probe.ok) {
      throw new Error(`File target tidak ditemukan: ${CONFIG.targetSrc}\nBuat dulu lewat MindAR Image Compiler (lihat README), lalu simpan di folder targets/.`);
    }

    ui.showLoading('Menyalakan kamera dan memuat model AR…');
    const mindarThree = new MindARThree({
      container: document.getElementById('ar-container'),
      imageTargetSrc: CONFIG.targetSrc,
      maxTrack: CONFIG.maxTrack,      // beberapa kartu sekaligus
      uiLoading: 'no',                // kita pakai layar loading sendiri
      uiScanning: 'no',
      uiError: 'no',
      warmupTolerance: 5,             // tahan flicker saat baru terdeteksi
      missTolerance: 5,               // tahan flicker saat sesaat hilang
    });
    const { renderer, scene, camera } = mindarThree;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    scene.add(new THREE.HemisphereLight(0xffffff, 0x555577, 1.4));
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
    sunLight.position.set(1, 1.5, 2);
    scene.add(sunLight);

    // Satu anchor per kartu (anchor = "tempat menempel" model pada target ke-N)
    cards.forEach((card) => {
      const anchor = mindarThree.addAnchor(card.targetIndex);
      const model = createCardModel(card.model);
      model.group.scale.setScalar(0.001);
      anchor.group.add(model.group);
      const rt = { model, visible: false, appear: 0 };
      runtimes.set(card.id, rt);

      anchor.onTargetFound = () => {
        rt.visible = true;
        if (!visibleIds.includes(card.id)) visibleIds.push(card.id);
        activeId = card.id;               // kartu terbaru jadi aktif
        sfx.found();
        renderActive();
      };
      anchor.onTargetLost = () => {
        rt.visible = false;
        const i = visibleIds.indexOf(card.id);
        if (i >= 0) visibleIds.splice(i, 1);
        if (activeId === card.id) activeId = visibleIds[visibleIds.length - 1] ?? null;
        renderActive();
      };
    });

    await mindarThree.start();

    bindToolbar();
    ui.showHud();
    ui.setScore(stats());
    renderActive();
    ui.hideLoading();

    // Loop animasi: model muncul "membesar" saat kartu terlihat, mengecil saat hilang
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.elapsedTime;
      runtimes.forEach((rt) => {
        rt.appear = THREE.MathUtils.lerp(rt.appear, rt.visible ? 1 : 0, Math.min(dt * 8, 1));
        if (rt.appear < 0.01 && !rt.visible) return;   // hemat performa
        rt.model.group.scale.setScalar(Math.max(rt.appear, 0.001));
        rt.model.update(t, dt);
      });
      renderer.render(scene, camera);
    });
  } catch (err) {
    console.error(err);
    ui.showError(err.message || String(err));
  }
}

document.getElementById('btn-start').addEventListener('click', () => {
  sfx.unlock(); // klik pertama = izin memutar suara
  startApp();
});
