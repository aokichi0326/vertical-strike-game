const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreLabel = document.getElementById("score");
const finalScoreLabel = document.getElementById("finalScore");
const clearScoreLabel = document.getElementById("clearScore");
const titleScreen = document.getElementById("titleScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const clearScreen = document.getElementById("clearScreen");
const startButton = document.getElementById("startButton");
const retryButton = document.getElementById("retryButton");
const clearRetryButton = document.getElementById("clearRetryButton");

const enemyImage = new Image();
let enemyImageReady = false;
enemyImage.src = "enemy.png";
enemyImage.onload = () => {
  enemyImageReady = true;
};
enemyImage.onerror = () => {
  enemyImageReady = false;
};

const keys = new Set();
const stars = Array.from({ length: 90 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  speed: 25 + Math.random() * 90,
  size: 1 + Math.random() * 2
}));

let state = "title";
let score = 0;
let elapsed = 0;
let lastTime = 0;
let spawnTimer = 0;
let fireTimer = 0;
let bossSpawned = false;
let pointerActive = false;

let player = null;
let bullets = [];
let enemyBullets = [];
let enemies = [];
let explosions = [];
let boss = null;

function resetGame() {
  state = "playing";
  score = 0;
  elapsed = 0;
  spawnTimer = 0;
  fireTimer = 0;
  bossSpawned = false;
  player = {
    x: canvas.width / 2,
    y: canvas.height - 82,
    width: 30,
    height: 36,
    speed: 260
  };
  bullets = [];
  enemyBullets = [];
  enemies = [];
  explosions = [];
  boss = null;
  updateScore();
  titleScreen.classList.remove("active");
  gameOverScreen.classList.remove("active");
  clearScreen.classList.remove("active");
}

function updateScore() {
  scoreLabel.textContent = String(score).padStart(6, "0");
}

function startGame() {
  resetGame();
}

function endGame() {
  state = "gameover";
  finalScoreLabel.textContent = String(score).padStart(6, "0");
  gameOverScreen.classList.add("active");
}

function clearGame() {
  state = "clear";
  clearScoreLabel.textContent = String(score).padStart(6, "0");
  clearScreen.classList.add("active");
}

function spawnEnemy() {
  const large = Math.random() < 0.28;
  const width = large ? 74 : 42;
  const height = large ? 96 : 54;
  enemies.push({
    x: 24 + Math.random() * (canvas.width - width - 48),
    y: -height,
    width,
    height,
    speed: large ? 72 : 118,
    hp: large ? 3 : 1,
    value: large ? 300 : 100,
    shootDelay: 0.8 + Math.random() * 1.8,
    large
  });
}

function spawnBoss() {
  bossSpawned = true;
  boss = {
    x: canvas.width / 2 - 96,
    y: -220,
    width: 192,
    height: 240,
    speed: 42,
    hp: 42,
    maxHp: 42,
    direction: 1,
    shootTimer: 0
  };
}

function createExplosion(x, y, radius) {
  explosions.push({
    x,
    y,
    radius,
    life: 0.45,
    maxLife: 0.45
  });
}

function update(dt) {
  updateStars(dt);
  if (state !== "playing") {
    updateExplosions(dt);
    return;
  }

  elapsed += dt;
  movePlayer(dt);
  autoFire(dt);
  spawnTimer += dt;

  if (!bossSpawned && elapsed >= 28) {
    spawnBoss();
  }

  if (!bossSpawned && spawnTimer >= 0.8) {
    spawnTimer = 0;
    spawnEnemy();
  }

  updateBullets(dt);
  updateEnemies(dt);
  updateBoss(dt);
  updateEnemyBullets(dt);
  updateExplosions(dt);
  checkCollisions();
}

function updateStars(dt) {
  for (const star of stars) {
    star.y += star.speed * dt;
    if (star.y > canvas.height) {
      star.y = -4;
      star.x = Math.random() * canvas.width;
    }
  }
}

function movePlayer(dt) {
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowLeft") || keys.has("a")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("w")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) dy += 1;

  const length = Math.hypot(dx, dy) || 1;
  player.x += (dx / length) * player.speed * dt;
  player.y += (dy / length) * player.speed * dt;
  player.x = clamp(player.x, player.width / 2, canvas.width - player.width / 2);
  player.y = clamp(player.y, canvas.height * 0.56, canvas.height - player.height / 2 - 8);
}

function autoFire(dt) {
  fireTimer += dt;
  if (fireTimer >= 0.16) {
    fireTimer = 0;
    bullets.push({
      x: player.x,
      y: player.y - player.height / 2,
      width: 5,
      height: 16,
      speed: 420
    });
  }
}

function updateBullets(dt) {
  for (const bullet of bullets) {
    bullet.y -= bullet.speed * dt;
  }
  bullets = bullets.filter((bullet) => bullet.y + bullet.height > 0);
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    enemy.y += enemy.speed * dt;
    enemy.shootDelay -= dt;
    if (enemy.shootDelay <= 0) {
      enemyBullets.push({
        x: enemy.x + enemy.width / 2,
        y: enemy.y + enemy.height,
        radius: enemy.large ? 6 : 4,
        speed: enemy.large ? 180 : 220
      });
      enemy.shootDelay = enemy.large ? 1.25 : 1.8 + Math.random();
    }
  }
  enemies = enemies.filter((enemy) => enemy.y < canvas.height + enemy.height);
}

function updateBoss(dt) {
  if (!boss) return;

  if (boss.y < 36) {
    boss.y += boss.speed * dt;
  } else {
    boss.x += boss.direction * 72 * dt;
    if (boss.x <= 18 || boss.x + boss.width >= canvas.width - 18) {
      boss.direction *= -1;
    }
    boss.shootTimer += dt;
    if (boss.shootTimer >= 0.72) {
      boss.shootTimer = 0;
      for (const offset of [-42, 0, 42]) {
        enemyBullets.push({
          x: boss.x + boss.width / 2 + offset,
          y: boss.y + boss.height - 18,
          radius: 7,
          speed: 210
        });
      }
    }
  }
}

function updateEnemyBullets(dt) {
  for (const bullet of enemyBullets) {
    bullet.y += bullet.speed * dt;
  }
  enemyBullets = enemyBullets.filter((bullet) => bullet.y - bullet.radius < canvas.height);
}

function updateExplosions(dt) {
  for (const explosion of explosions) {
    explosion.life -= dt;
  }
  explosions = explosions.filter((explosion) => explosion.life > 0);
}

function checkCollisions() {
  bullets = bullets.filter((bullet) => {
    for (const enemy of enemies) {
      if (rectsOverlap(bulletRect(bullet), entityRect(enemy))) {
        enemy.hp -= 1;
        if (enemy.hp <= 0) {
          createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.large ? 42 : 26);
          score += enemy.value;
          updateScore();
          enemy.dead = true;
        }
        return false;
      }
    }

    if (boss && rectsOverlap(bulletRect(bullet), entityRect(boss))) {
      boss.hp -= 1;
      createExplosion(bullet.x, bullet.y, 16);
      if (boss.hp <= 0) {
        createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2, 110);
        score += 2500;
        updateScore();
        boss = null;
        clearGame();
      }
      return false;
    }

    return true;
  });

  enemies = enemies.filter((enemy) => !enemy.dead);

  for (const enemy of enemies) {
    if (rectsOverlap(playerRect(), entityRect(enemy))) {
      createExplosion(player.x, player.y, 46);
      endGame();
      return;
    }
  }

  if (boss && rectsOverlap(playerRect(), entityRect(boss))) {
    createExplosion(player.x, player.y, 46);
    endGame();
    return;
  }

  for (const bullet of enemyBullets) {
    if (circleRectOverlap(bullet, playerRect())) {
      createExplosion(player.x, player.y, 46);
      endGame();
      return;
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawPlayer();
  drawBullets();
  drawEnemies();
  drawBoss();
  drawEnemyBullets();
  drawExplosions();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#07192b");
  gradient.addColorStop(1, "#03101a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(219, 244, 255, 0.8)";
  for (const star of stars) {
    ctx.fillRect(star.x, star.y, star.size, star.size * 2.2);
  }
}

function drawPlayer() {
  if (!player) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = "#7ce7ff";
  ctx.beginPath();
  ctx.moveTo(0, -player.height / 2);
  ctx.lineTo(player.width / 2, player.height / 2);
  ctx.lineTo(0, player.height / 4);
  ctx.lineTo(-player.width / 2, player.height / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-3, -10, 6, 18);
  ctx.restore();
}

function drawBullets() {
  ctx.fillStyle = "#fff07a";
  for (const bullet of bullets || []) {
    ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height);
  }
}

function drawEnemies() {
  for (const enemy of enemies || []) {
    drawEnemySprite(enemy.x, enemy.y, enemy.width, enemy.height);
  }
}

function drawBoss() {
  if (!boss) return;
  drawEnemySprite(boss.x, boss.y, boss.width, boss.height);

  const barWidth = 220;
  const hpRatio = boss.hp / boss.maxHp;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect((canvas.width - barWidth) / 2, 12, barWidth, 10);
  ctx.fillStyle = "#ff445f";
  ctx.fillRect((canvas.width - barWidth) / 2, 12, barWidth * hpRatio, 10);
}

function drawEnemySprite(x, y, width, height) {
  if (enemyImageReady) {
    ctx.drawImage(enemyImage, x, y, width, height);
    return;
  }

  ctx.fillStyle = "#ff6478";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#1c0910";
  ctx.fillRect(x + width * 0.18, y + height * 0.2, width * 0.64, height * 0.2);
  ctx.fillStyle = "#ffe0e5";
  ctx.fillRect(x + width * 0.3, y + height * 0.48, width * 0.4, height * 0.18);
}

function drawEnemyBullets() {
  ctx.fillStyle = "#ff7a62";
  for (const bullet of enemyBullets || []) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExplosions() {
  for (const explosion of explosions || []) {
    const progress = 1 - explosion.life / explosion.maxLife;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = "#ffb347";
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius * progress, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6c7";
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius * progress * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.033);
  lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function entityRect(entity) {
  return {
    x: entity.x,
    y: entity.y,
    width: entity.width,
    height: entity.height
  };
}

function bulletRect(bullet) {
  return {
    x: bullet.x - bullet.width / 2,
    y: bullet.y,
    width: bullet.width,
    height: bullet.height
  };
}

function playerRect() {
  return {
    x: player.x - player.width / 2,
    y: player.y - player.height / 2,
    width: player.width,
    height: player.height
  };
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function circleRectOverlap(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

document.addEventListener("keydown", (event) => {
  keys.add(event.key);
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

canvas.addEventListener("pointerdown", (event) => {
  if (state !== "playing") return;
  pointerActive = true;
  canvas.setPointerCapture(event.pointerId);
  movePlayerToPointer(event);
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointerActive || state !== "playing") return;
  movePlayerToPointer(event);
  event.preventDefault();
});

function movePlayerToPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  player.x = clamp(x, player.width / 2, canvas.width - player.width / 2);
  player.y = clamp(y, canvas.height * 0.56, canvas.height - player.height / 2 - 8);
}

canvas.addEventListener("pointerup", () => {
  pointerActive = false;
});

canvas.addEventListener("pointercancel", () => {
  pointerActive = false;
});

startButton.addEventListener("click", startGame);
retryButton.addEventListener("click", startGame);
clearRetryButton.addEventListener("click", startGame);

requestAnimationFrame(loop);
