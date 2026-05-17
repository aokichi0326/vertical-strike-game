const CONFIG = {
  normalPhaseSeconds: 20,
  startingLife: 3,
  enemyScore: 10,
  bossScore: 500,
  bossMaxHp: 24,
  bossAttackIntervalMs: 5200,
  minSpawnMs: 800,
  maxSpawnMs: 1500,
  minEnemyLifeMs: 3000,
  maxEnemyLifeMs: 5000,
};

const refs = {
  score: document.querySelector("#scoreValue"),
  time: document.querySelector("#timeValue"),
  life: document.querySelector("#lifeValue"),
  bossHud: document.querySelector("#bossHud"),
  bossBarFill: document.querySelector("#bossBarFill"),
  gameArea: document.querySelector("#gameArea"),
  titleOverlay: document.querySelector("#titleOverlay"),
  resultOverlay: document.querySelector("#resultOverlay"),
  resultTitle: document.querySelector("#resultTitle"),
  finalScore: document.querySelector("#finalScoreValue"),
  startButton: document.querySelector("#startButton"),
  restartButton: document.querySelector("#restartButton"),
  messageBanner: document.querySelector("#messageBanner"),
};

const state = {
  playing: false,
  phase: "title",
  score: 0,
  life: CONFIG.startingLife,
  timeLeft: CONFIG.normalPhaseSeconds,
  bossHp: CONFIG.bossMaxHp,
  timerId: null,
  spawnTimeoutId: null,
  bossAttackId: null,
  activeEnemies: new Set(),
  bossElement: null,
};

// Later audio files can be dropped into /audio without changing game logic.
const sounds = {
  hit: createAudio("audio/se_hit.mp3"),
  boss: createAudio("audio/se_boss.mp3"),
};

let audioContext = null;

function createAudio(src) {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.addEventListener("error", () => {
    audio.dataset.disabled = "true";
  });
  return audio;
}

function playSound(audio) {
  if (!audio || audio.dataset.disabled === "true") return false;
  audio.currentTime = 0;
  audio.play().catch(() => {});
  return true;
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function playHitSound() {
  if (playSound(sounds.hit)) return;

  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(520, now);
  oscillator.frequency.exponentialRampToValueAtTime(180, now + 0.11);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.15);
}

function playBossSound() {
  if (playSound(sounds.boss)) return;

  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
  gain.connect(context.destination);

  [110, 165, 220].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = index === 0 ? "sawtooth" : "square";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.45, now + 0.65);
    oscillator.connect(gain);
    oscillator.start(now + index * 0.04);
    oscillator.stop(now + 0.78);
  });
}

function startGame() {
  clearGame();
  state.playing = true;
  state.phase = "normal";
  state.score = 0;
  state.life = CONFIG.startingLife;
  state.timeLeft = CONFIG.normalPhaseSeconds;
  state.bossHp = CONFIG.bossMaxHp;

  refs.titleOverlay.classList.add("hidden");
  refs.resultOverlay.classList.add("hidden");
  refs.bossHud.classList.add("hidden");
  refs.bossHud.setAttribute("aria-hidden", "true");

  updateHud();
  state.timerId = window.setInterval(tickTimer, 1000);
  scheduleNextEnemy();
}

function clearGame() {
  window.clearInterval(state.timerId);
  window.clearTimeout(state.spawnTimeoutId);
  window.clearInterval(state.bossAttackId);

  state.activeEnemies.forEach((enemy) => enemy.remove());
  state.activeEnemies.clear();

  if (state.bossElement) {
    state.bossElement.remove();
    state.bossElement = null;
  }

  refs.gameArea.querySelectorAll(".splat").forEach((node) => node.remove());
  hideMessage();
}

function tickTimer() {
  if (!state.playing || state.phase !== "normal") return;

  state.timeLeft -= 1;
  refs.time.textContent = state.timeLeft;

  if (state.timeLeft <= 0) {
    beginBossPhase();
  }
}

function scheduleNextEnemy() {
  if (!state.playing || state.phase !== "normal") return;

  const progress = 1 - state.timeLeft / CONFIG.normalPhaseSeconds;
  const maxDelay = CONFIG.maxSpawnMs - progress * 350;
  const minDelay = CONFIG.minSpawnMs - progress * 150;
  const delay = randomBetween(minDelay, maxDelay);

  state.spawnTimeoutId = window.setTimeout(() => {
    spawnEnemy();
    scheduleNextEnemy();
  }, delay);
}

function spawnEnemy() {
  if (!state.playing || state.phase !== "normal") return;

  const enemy = document.createElement("button");
  enemy.type = "button";
  enemy.className = "enemy";
  enemy.setAttribute("aria-label", "敵");

  const size = randomBetween(68, 92);
  const maxX = Math.max(0, refs.gameArea.clientWidth - size);
  const maxY = Math.max(0, refs.gameArea.clientHeight - size);
  enemy.style.width = `${size}px`;
  enemy.style.height = `${size}px`;
  enemy.style.left = `${randomBetween(8, Math.max(8, maxX - 8))}px`;
  enemy.style.top = `${randomBetween(10, Math.max(10, maxY - 20))}px`;

  appendFace(enemy, "enemy-image");
  enemy.addEventListener("pointerdown", () => defeatEnemy(enemy), { once: true });
  refs.gameArea.appendChild(enemy);
  state.activeEnemies.add(enemy);

  const escapeDelay = randomBetween(CONFIG.minEnemyLifeMs, CONFIG.maxEnemyLifeMs);
  enemy.escapeTimer = window.setTimeout(() => {
    if (!state.activeEnemies.has(enemy)) return;
    state.activeEnemies.delete(enemy);
    enemy.remove();
    damagePlayer();
  }, escapeDelay);
}

function appendFace(target, imageClass) {
  const image = document.createElement("img");
  image.src = "assets/enemy_man.png";
  image.alt = "";
  image.className = imageClass;
  image.draggable = false;
  image.addEventListener("error", () => {
    image.remove();
    const fallback = document.createElement("span");
    fallback.className = "fallback-face";
    fallback.textContent = "顔";
    target.appendChild(fallback);
  });
  target.appendChild(image);
}

function defeatEnemy(enemy) {
  if (!state.playing || !state.activeEnemies.has(enemy)) return;

  window.clearTimeout(enemy.escapeTimer);
  state.activeEnemies.delete(enemy);
  enemy.classList.add("hit");
  addScore(CONFIG.enemyScore);
  createSplat(enemy);
  playHitSound();

  window.setTimeout(() => enemy.remove(), 220);
}

function beginBossPhase() {
  state.phase = "boss";
  state.timeLeft = 0;
  refs.time.textContent = "BOSS";

  window.clearInterval(state.timerId);
  window.clearTimeout(state.spawnTimeoutId);
  state.activeEnemies.forEach((enemy) => {
    window.clearTimeout(enemy.escapeTimer);
    enemy.remove();
  });
  state.activeEnemies.clear();

  refs.bossHud.classList.remove("hidden");
  refs.bossHud.setAttribute("aria-hidden", "false");
  updateBossBar();
  showMessage("ボス出現！");
  playBossSound();

  window.setTimeout(() => {
    hideMessage();
    spawnBoss();
  }, 1300);
}

function spawnBoss() {
  const boss = document.createElement("button");
  boss.type = "button";
  boss.className = "boss";
  boss.setAttribute("aria-label", "ボス");

  const size = Math.min(refs.gameArea.clientWidth * 0.62, 270);
  boss.style.width = `${size}px`;
  boss.style.height = `${size}px`;
  boss.style.left = `calc(50% - ${size / 2}px)`;
  boss.style.top = `calc(50% - ${size / 2}px)`;

  appendFace(boss, "boss-image");
  boss.addEventListener("pointerdown", hitBoss);
  refs.gameArea.appendChild(boss);
  state.bossElement = boss;

  state.bossAttackId = window.setInterval(() => {
    if (state.playing && state.phase === "boss") damagePlayer();
  }, CONFIG.bossAttackIntervalMs);
}

function hitBoss() {
  if (!state.playing || state.phase !== "boss" || !state.bossElement) return;

  state.bossHp -= 1;
  updateBossBar();
  createSplat(state.bossElement);
  playHitSound();

  state.bossElement.classList.add("hit");
  window.setTimeout(() => state.bossElement?.classList.remove("hit"), 120);

  if (state.bossHp <= 0) {
    addScore(CONFIG.bossScore);
    finishGame(true);
  }
}

function damagePlayer() {
  if (!state.playing) return;

  state.life -= 1;
  refs.life.textContent = state.life;

  if (state.life <= 0) {
    finishGame(false);
  }
}

function finishGame(cleared) {
  state.playing = false;
  clearGame();
  refs.finalScore.textContent = state.score;
  refs.resultTitle.textContent = cleared ? "クリア！" : "ゲームオーバー";
  refs.resultOverlay.classList.remove("hidden");
}

function addScore(points) {
  state.score += points;
  refs.score.textContent = state.score;
}

function updateHud() {
  refs.score.textContent = state.score;
  refs.time.textContent = state.timeLeft;
  refs.life.textContent = state.life;
}

function updateBossBar() {
  const ratio = Math.max(0, state.bossHp / CONFIG.bossMaxHp);
  refs.bossBarFill.style.width = `${ratio * 100}%`;
}

function createSplat(target) {
  const targetRect = target.getBoundingClientRect();
  const areaRect = refs.gameArea.getBoundingClientRect();
  const splat = document.createElement("span");
  splat.className = "splat";
  splat.style.left = `${targetRect.left - areaRect.left + targetRect.width / 2}px`;
  splat.style.top = `${targetRect.top - areaRect.top + targetRect.height / 2}px`;
  refs.gameArea.appendChild(splat);
  window.setTimeout(() => splat.remove(), 420);
}

function showMessage(text) {
  refs.messageBanner.textContent = text;
  refs.messageBanner.classList.remove("hidden");
}

function hideMessage() {
  refs.messageBanner.classList.add("hidden");
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

refs.startButton.addEventListener("click", startGame);
refs.restartButton.addEventListener("click", startGame);
