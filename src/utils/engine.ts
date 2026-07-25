import { ALL_TASKS, CORE_TASKS, NOISE_TASKS, TaskDef, TaskKind } from '../data/tasks';
import { audio } from './audio';

// ---------------------------------------------------------------------------
// Bảng màu Manabie — đồng bộ với Template slide.pptx
// ---------------------------------------------------------------------------
export const PALETTE = {
  bg: '#050A1C',
  bgSoft: '#0D1836',
  edge: '#1D2B57',
  brand: '#4C6DF0',
  brandDeep: '#3C5AD2',
  mint: '#00D89A',
  noise: '#FF6A3D',
  white: '#EEF2FF',
  muted: '#7D8BB8',
  gold: '#F4BE4F',
  cyan: '#32C8E6',
};

const FONT = '"Be Vietnam Pro", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface DifficultyConfig {
  spawnEveryMs: number;
  fallSpeed: number;
  noiseRatio: number;
  durationSec: number;
}

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: { spawnEveryMs: 1500, fallSpeed: 0.030, noiseRatio: 0.35, durationSec: 120 },
  normal: { spawnEveryMs: 1150, fallSpeed: 0.045, noiseRatio: 0.45, durationSec: 90 },
  hard: { spawnEveryMs: 850, fallSpeed: 0.062, noiseRatio: 0.55, durationSec: 70 },
};

/** Đầu vào một bàn tay — giữ nguyên hình dạng của earth-defender-ar để tái dùng lớp camera. */
export interface HandInput {
  x: number;
  y: number;
  ix: number;
  iy: number;
  tx: number;
  ty: number;
  isPinching: boolean;
  handedness: string;
  playerId: number;
}

export interface GameState {
  score: number;
  collected: TaskDef[];
  wrongDrops: number;
  missedCore: number;
  streak: number;
  bestStreak: number;
  timeLeftSec: number;
  isGameOver: boolean;
  isWin: boolean;
  handsVisible: number;
  phase: 'CALIBRATE' | 'FLOW' | 'CRISIS' | 'FINAL';
  multiplier: number;
  accuracy: number;
  eventText: string;
  powerReady: boolean;
  countdown: number;
}

interface Ball {
  id: number;
  task: TaskDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  seed: number;
  grabbedBy: number | null;
  /** Đang bay vào giỏ sau khi thả đúng */
  consumedAt: number | null;
  dead: boolean;
  /** 0→1: quả đang nằm trong tầm với của một bàn tay, dùng để vẽ vòng gợi ý gắp */
  reach: number;
  trail: { x: number; y: number }[];
}

interface Burst {
  x: number;
  y: number;
  age: number;
  life: number;
  color: string;
  text: string;
  shards: { a: number; v: number }[];
}

interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  life: number;
  age: number;
}

interface BgParticle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  pulseSpeed: number;
  color: string;
}

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  size: number;
  color: string;
}

const GRAB_PAD = 26;

export class GameEngine {
  state: GameState;

  private width = 1280;
  private height = 720;
  private balls: Ball[] = [];
  private bursts: Burst[] = [];
  private shockwaves: Shockwave[] = [];
  private bgParticles: BgParticle[] = [];
  private confettiList: Confetti[] = [];
  private hands: HandInput[] = [];
  /** Trạng thái pinch khung trước, để phát hiện cạnh lên/xuống */
  private prevPinch: boolean[] = [];
  private nextId = 1;
  private spawnAccMs = 0;
  private elapsedMs = 0;
  private queue: TaskDef[] = [];
  private cfg: DifficultyConfig;
  private finished = false;
  private bonusTimeMs = 0;
  private shake = 0;
  private lastPhase = '';
  private introMs = 0;
  private lastCountdown = 4;
  private iconAtlas: HTMLImageElement;
  private collectorImage: HTMLImageElement;
  private hitStopMs = 0;
  private successPulse = 0;

  constructor(
    private onUpdate: (state: GameState) => void,
    options: { difficulty: Difficulty } = { difficulty: 'normal' },
  ) {
    this.iconAtlas = new Image();
    this.iconAtlas.src = '/assets/mission-icon-atlas-v2.png';
    this.collectorImage = new Image();
    this.collectorImage.src = '/assets/mission-collector-v1.png';
    this.cfg = DIFFICULTY[options.difficulty];
    this.state = {
      score: 0,
      collected: [],
      wrongDrops: 0,
      missedCore: 0,
      streak: 0,
      bestStreak: 0,
      timeLeftSec: this.cfg.durationSec,
      isGameOver: false,
      isWin: false,
      handsVisible: 0,
      phase: 'CALIBRATE',
      multiplier: 1,
      accuracy: 100,
      eventText: 'HIỆU CHỈNH HỆ THỐNG',
      powerReady: false,
      countdown: 3,
    };
    this.buildQueue();
    this.initBgParticles();
  }

  private initBgParticles() {
    const colors = [PALETTE.mint, PALETTE.brand, PALETTE.cyan, PALETTE.gold];
    this.bgParticles = Array.from({ length: 35 }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      size: 1.5 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -0.15 - Math.random() * 0.35,
      alpha: 0.1 + Math.random() * 0.45,
      pulseSpeed: 0.002 + Math.random() * 0.004,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    if (this.bgParticles.length === 0) this.initBgParticles();
  }

  updateHands(hands: HandInput[]) {
    this.hands = hands;
    this.state.handsVisible = hands.length;
  }

  // -------------------------------------------------------------------------
  // Hàng đợi quả cầu
  // -------------------------------------------------------------------------
  private buildQueue() {
    const cores = shuffle([...CORE_TASKS]);
    const noises = shuffle([...NOISE_TASKS, ...NOISE_TASKS]);
    const perCore = Math.max(1, Math.round(this.cfg.noiseRatio / (1 - this.cfg.noiseRatio)));

    const queue: TaskDef[] = [];
    cores.forEach((core, i) => {
      queue.push(core);
      for (let n = 0; n < perCore; n += 1) {
        const pick = noises[(i * perCore + n) % noises.length];
        if (pick) queue.push(pick);
      }
    });
    this.queue = queue;
  }

  private takeNextTask(): TaskDef {
    if (this.queue.length) return this.queue.shift() as TaskDef;
    const remaining = CORE_TASKS.filter((t) => !this.state.collected.some((c) => c.id === t.id));
    const onScreen = new Set(this.balls.filter((b) => !b.dead).map((b) => b.task.id));
    const pending = remaining.filter((t) => !onScreen.has(t.id));
    if (pending.length) return pending[Math.floor(Math.random() * pending.length)];
    return NOISE_TASKS[Math.floor(Math.random() * NOISE_TASKS.length)];
  }

  private spawn() {
    const task = this.takeNextTask();
    const r = Math.max(52, Math.min(86, this.width * 0.055));
    const margin = r + 16;
    const x = margin + Math.random() * Math.max(1, this.width - margin * 2);
    this.balls.push({
      id: this.nextId++,
      task,
      x,
      y: -r - 10,
      vx: (Math.random() - 0.5) * 0.02,
      vy: this.cfg.fallSpeed * (0.85 + Math.random() * 0.35),
      r,
      seed: Math.random() * Math.PI * 2,
      grabbedBy: null,
      consumedAt: null,
      dead: false,
      reach: 0,
      trail: [],
    });
    audio.playSpawn();
  }

  // -------------------------------------------------------------------------
  // Giỏ: hình thang ở đáy giữa màn hình
  // -------------------------------------------------------------------------
  basket() {
    const w = Math.min(this.width * 0.36, 460);
    const h = Math.min(this.height * 0.2, 170);
    return { x: (this.width - w) / 2, y: this.height - h - 12, w, h };
  }

  private isOverBasket(x: number, y: number) {
    const b = this.basket();
    return x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 40 && y < b.y + b.h;
  }

  // -------------------------------------------------------------------------
  update(dt: number) {
    if (this.state.isGameOver) {
      if (this.confettiList.length > 0) {
        this.updateConfetti(dt);
      }
      return;
    }
    const step = Math.max(0, Math.min(64, dt));

    if (this.hitStopMs > 0) {
      this.hitStopMs -= step;
      this.successPulse = Math.max(0, this.successPulse - step / 520);
      return;
    }

    if (this.introMs < 3000) {
      this.introMs += step;
      this.state.countdown = Math.max(1, Math.ceil((3000 - this.introMs) / 1000));
      if (this.state.countdown !== this.lastCountdown) {
        this.lastCountdown = this.state.countdown;
        audio.playCountdown(this.state.countdown);
      }
      this.onUpdate({ ...this.state, collected: [...this.state.collected] });
      return;
    }
    this.state.countdown = 0;

    this.elapsedMs += step;
    this.successPulse = Math.max(0, this.successPulse - step / 520);
    this.state.timeLeftSec = Math.max(0, Math.ceil(this.cfg.durationSec + this.bonusTimeMs / 1000 - this.elapsedMs / 1000));

    const progress = this.elapsedMs / (this.cfg.durationSec * 1000 + this.bonusTimeMs);
    this.state.phase = progress < .12 ? 'CALIBRATE' : progress < .52 ? 'FLOW' : progress < .82 ? 'CRISIS' : 'FINAL';
    this.state.multiplier = Math.min(4, 1 + Math.floor(this.state.streak / 2));
    const attempts = this.state.collected.length + this.state.wrongDrops + this.state.missedCore;
    this.state.accuracy = attempts ? Math.round((this.state.collected.length / attempts) * 100) : 100;
    this.state.powerReady = this.state.streak >= 4;
    this.state.eventText = this.state.phase === 'FINAL' ? 'FINAL RUSH · ĐIỂM NHÂN ĐÔI' : this.state.phase === 'CRISIS' ? 'QUÁ TẢI HÀNH CHÍNH' : this.state.phase === 'FLOW' ? 'AI FLOW ĐANG ỔN ĐỊNH' : 'HIỆU CHỈNH HỆ THỐNG';
    if (this.state.phase !== this.lastPhase) {
      this.lastPhase = this.state.phase;
      audio.playPhase(this.state.phase);
      if (this.state.phase !== 'CALIBRATE') this.pushBurst(this.width / 2, this.height * .24, PALETTE.mint, this.state.eventText);
    }

    this.spawnAccMs += step;
    const phaseRate = this.state.phase === 'FINAL' ? .52 : this.state.phase === 'CRISIS' ? .7 : 1;
    if (this.spawnAccMs >= this.cfg.spawnEveryMs * phaseRate) {
      this.spawnAccMs = 0;
      this.spawn();
    }

    this.updateBgParticles(step);
    this.handleHands();
    this.moveBalls(step);
    this.updateReach();
    this.ageBursts(step);
    this.updateShockwaves(step);

    const allCollected = this.state.collected.length >= CORE_TASKS.length;
    if (!this.finished && (allCollected || this.state.timeLeftSec <= 0)) {
      this.finished = true;
      this.state.isGameOver = true;
      this.state.isWin = allCollected;
      if (allCollected) {
        audio.playWin();
        this.spawnConfetti();
      } else {
        audio.playTimeUp();
      }
    }

    this.onUpdate({ ...this.state, collected: [...this.state.collected] });
  }

  private updateBgParticles(step: number) {
    for (const p of this.bgParticles) {
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.alpha += Math.sin(this.elapsedMs * p.pulseSpeed) * 0.02;

      if (p.y < -10) {
        p.y = this.height + 10;
        p.x = Math.random() * this.width;
      }
      if (p.x < -10) p.x = this.width + 10;
      if (p.x > this.width + 10) p.x = -10;
    }
  }

  private spawnConfetti() {
    const colors = [PALETTE.mint, PALETTE.brand, PALETTE.gold, PALETTE.cyan, PALETTE.white, '#FF7EC5'];
    this.confettiList = Array.from({ length: 90 }, () => ({
      x: this.width / 2 + (Math.random() - 0.5) * 300,
      y: this.height * 0.4 + (Math.random() - 0.5) * 100,
      vx: (Math.random() - 0.5) * 14,
      vy: -6 - Math.random() * 12,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2,
      size: 7 + Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }

  private updateConfetti(step: number) {
    for (const c of this.confettiList) {
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.25;
      c.rot += c.vRot;
    }
    this.confettiList = this.confettiList.filter((c) => c.y < this.height + 50);
  }

  private handleHands() {
    this.hands.forEach((hand, index) => {
      const wasPinching = this.prevPinch[index] ?? false;

      if (hand.isPinching && !wasPinching) {
        this.tryGrab(hand, index);
      } else if (!hand.isPinching && wasPinching) {
        this.tryRelease(index);
      }

      if (hand.isPinching) {
        const held = this.balls.find((b) => b.grabbedBy === index && !b.dead);
        if (held) {
          held.x += (hand.x - held.x) * 0.45;
          held.y += (hand.y - held.y) * 0.45;
          held.vx = 0;
          held.vy = 0;
          held.trail.push({ x: held.x, y: held.y });
          if (held.trail.length > 14) held.trail.shift();
        }
      }

      this.prevPinch[index] = hand.isPinching;
    });

    for (let i = this.hands.length; i < this.prevPinch.length; i += 1) {
      if (this.prevPinch[i]) this.tryRelease(i);
      this.prevPinch[i] = false;
    }
  }

  tryGrab(hand: HandInput | { x: number; y: number }, handIndex: number | string) {
    const hIdx = typeof handIndex === 'number' ? handIndex : 0;
    if (this.balls.some((b) => b.grabbedBy === hIdx && !b.dead)) return false;

    let best: Ball | null = null;
    let bestDist = Infinity;
    for (const ball of this.balls) {
      if (ball.dead || ball.grabbedBy !== null || ball.consumedAt !== null) continue;
      const d = Math.hypot(ball.x - hand.x, ball.y - hand.y);
      if (d < ball.r + GRAB_PAD && d < bestDist) {
        best = ball;
        bestDist = d;
      }
    }

    if (best) {
      best.grabbedBy = hIdx;
      audio.playGrab();
      this.pushShockwave(best.x, best.y, PALETTE.cyan, 60);
      return true;
    }
    return false;
  }

  tryRelease(handIndex: number | string) {
    const hIdx = typeof handIndex === 'number' ? handIndex : 0;
    const ball = this.balls.find((b) => b.grabbedBy === hIdx && !b.dead);
    if (!ball) return;
    ball.grabbedBy = null;
    ball.trail = [];

    if (!this.isOverBasket(ball.x, ball.y)) {
      ball.vy = this.cfg.fallSpeed;
      return;
    }

    const bkt = this.basket();
    const bx = bkt.x + bkt.w / 2;
    const by = bkt.y + bkt.h / 2;

    if (ball.task.kind === 'CORE') {
      const already = this.state.collected.some((t) => t.id === ball.task.id);
      if (already) {
        ball.dead = true;
        return;
      }
      this.state.collected.push(ball.task);
      this.state.streak += 1;
      this.state.bestStreak = Math.max(this.state.bestStreak, this.state.streak);
      const finalBoost = this.state.phase === 'FINAL' ? 2 : 1;
      this.state.score += (100 + (this.state.streak - 1) * 25) * this.state.multiplier * finalBoost;
      this.hitStopMs = this.state.streak >= 3 ? 82 : 48;
      this.successPulse = Math.min(1.25, .58 + this.state.streak * .12);
      this.pushBurst(bx, by - 30, PALETTE.mint, `+${100 * this.state.multiplier * finalBoost} · COMBO ×${this.state.multiplier}`);
      this.pushShockwave(bx, by, PALETTE.mint, 180);
      audio.playScore(this.state.streak);
      if (this.state.streak === 4) {
        this.bonusTimeMs += 3000;
        audio.playPower();
        this.pushBurst(bx, by - 70, PALETTE.cyan, 'AI FLOW · +3 GIÂY');
        this.pushShockwave(bx, by, PALETTE.gold, 260);
      }
    } else {
      this.state.wrongDrops += 1;
      this.state.streak = 0;
      this.state.score = Math.max(0, this.state.score - 50);
      this.pushBurst(bx, by - 20, PALETTE.noise, 'VIỆC CẦN NGƯỜI');
      this.pushShockwave(bx, by, PALETTE.noise, 120);
      audio.playReject();
      this.shake = 16;
    }
    ball.consumedAt = this.elapsedMs;
  }

  private moveBalls(step: number) {
    const basket = this.basket();
    for (const ball of this.balls) {
      if (ball.dead) continue;

      if (ball.consumedAt !== null) {
        const tx = basket.x + basket.w / 2;
        const ty = basket.y + basket.h * 0.55;
        ball.x += (tx - ball.x) * 0.2;
        ball.y += (ty - ball.y) * 0.2;
        ball.r *= 0.94;
        if (ball.r < 12) ball.dead = true;
        continue;
      }

      if (ball.grabbedBy !== null) continue;

      ball.x += ball.vx * step;
      ball.y += ball.vy * step;
      ball.vy += 0.00004 * step;

      if (ball.x < ball.r) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
      }
      if (ball.x > this.width - ball.r) {
        ball.x = this.width - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }

      if (ball.y - ball.r > this.height) {
        ball.dead = true;
        if (ball.task.kind === 'CORE' && !this.state.collected.some((t) => t.id === ball.task.id)) {
          this.state.missedCore += 1;
          this.state.streak = 0;
          audio.playMiss();
        }
      }
    }
    this.balls = this.balls.filter((b) => !b.dead);
  }

  private pushBurst(x: number, y: number, color: string, text: string) {
    const shards = Array.from({ length: 12 }, (_, i) => ({
      a: (Math.PI * 2 * i) / 12 + Math.random() * 0.3,
      v: 0.7 + Math.random() * 0.9,
    }));
    this.bursts.push({ x, y, age: 0, life: 950, color, text, shards });
  }

  private pushShockwave(x: number, y: number, color: string, maxR: number) {
    this.shockwaves.push({ x, y, r: 10, maxR, color, life: 600, age: 0 });
  }

  private updateShockwaves(step: number) {
    for (const sw of this.shockwaves) {
      sw.age += step;
      sw.r += (sw.maxR - sw.r) * 0.12;
    }
    this.shockwaves = this.shockwaves.filter((sw) => sw.age < sw.life);
  }

  private updateReach() {
    for (const ball of this.balls) {
      if (ball.dead || ball.consumedAt !== null) continue;
      if (ball.grabbedBy !== null) {
        ball.reach = 1;
        continue;
      }
      let near = 0;
      for (const hand of this.hands) {
        const d = Math.hypot(ball.x - hand.x, ball.y - hand.y);
        near = Math.max(near, 1 - Math.min(1, d / (ball.r + GRAB_PAD + 70)));
      }
      ball.reach += (near - ball.reach) * 0.25;
    }
  }

  private ageBursts(step: number) {
    this.bursts.forEach((b) => {
      b.age += step;
    });
    this.bursts = this.bursts.filter((b) => b.age < b.life);
  }

  // -------------------------------------------------------------------------
  // Vẽ
  // -------------------------------------------------------------------------
  draw(ctx: CanvasRenderingContext2D) {
    const { width: w, height: h } = this;

    ctx.save();
    if (this.shake > .2) {
      ctx.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake);
      this.shake *= .86;
    }
    const grad = ctx.createRadialGradient(w * .5, h * .7, 20, w * .5, h * .5, Math.max(w, h));
    grad.addColorStop(0, PALETTE.bg);
    grad.addColorStop(1, PALETTE.bgSoft);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    this.drawBgParticles(ctx);
    this.drawAmbientGrid(ctx);
    this.drawBasket(ctx);
    this.drawShockwaves(ctx);
    this.balls.forEach((ball) => this.drawBall(ctx, ball));
    this.drawHands(ctx);
    this.drawBursts(ctx);
    this.drawImpactOverlay(ctx);
    this.drawPhase(ctx);
    this.drawConfetti(ctx);
    ctx.restore();
  }

  private drawBgParticles(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.bgParticles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawShockwaves(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const sw of this.shockwaves) {
      const progress = sw.age / sw.life;
      ctx.globalAlpha = (1 - progress) * 0.75;
      ctx.strokeStyle = sw.color;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.5 * (1 - progress);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawConfetti(ctx: CanvasRenderingContext2D) {
    if (this.confettiList.length === 0) return;
    ctx.save();
    for (const c of this.confettiList) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawPhase(ctx: CanvasRenderingContext2D) {
    if (this.state.countdown > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(5,10,28,.66)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = PALETTE.mint;
      ctx.shadowBlur = 42;
      ctx.fillStyle = PALETTE.white;
      ctx.font = `900 ${Math.min(180, this.width * .16)}px ${MONO}`;
      ctx.fillText(String(this.state.countdown), this.width / 2, this.height / 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = PALETTE.mint;
      ctx.font = `800 16px ${FONT}`;
      ctx.fillText('SẴN SÀNG GẮP NHIỆM VỤ', this.width / 2, this.height / 2 + 105);
      ctx.restore();
      return;
    }
    if (this.state.phase === 'FINAL') {
      const pulse = .1 + Math.sin(this.elapsedMs / 120) * .035;
      ctx.fillStyle = `rgba(255,106,61,${pulse})`;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.strokeStyle = 'rgba(255,106,61,.75)';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, this.width - 6, this.height - 6);
    }
    ctx.fillStyle = 'rgba(5,10,28,.72)';
    ctx.fillRect(this.width / 2 - 160, 18, 320, 34);
    ctx.fillStyle = this.state.phase === 'FINAL' ? PALETTE.noise : PALETTE.mint;
    ctx.font = `800 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.state.eventText, this.width / 2, 35);
  }

  private drawImpactOverlay(ctx: CanvasRenderingContext2D) {
    if (this.successPulse <= 0) return;
    const p = this.successPulse;
    const cx = this.width / 2;
    const cy = this.height * .74;
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.width * .48);
    glow.addColorStop(0, `rgba(0,216,154,${Math.min(.2, p * .16)})`);
    glow.addColorStop(.35, `rgba(76,109,240,${Math.min(.12, p * .09)})`);
    glow.addColorStop(1, 'rgba(5,10,28,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = `rgba(238,242,255,${Math.min(.65, p * .55)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, (1.25 - p) * this.width * .34 + 32, 0, Math.PI * 2);
    ctx.stroke();
    if (p > .72) {
      ctx.globalAlpha = (p - .72) * .28;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, this.width, this.height);
    }
    ctx.restore();
  }

  private drawAmbientGrid(ctx: CanvasRenderingContext2D) {
    const spacing = 46;
    const drift = (this.elapsedMs / 90) % spacing;
    ctx.save();
    ctx.fillStyle = 'rgba(124, 139, 184, 0.12)';
    for (let y = -spacing + drift; y < this.height; y += spacing) {
      for (let x = 0; x < this.width; x += spacing) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
    ctx.restore();
  }

  private drawBasket(ctx: CanvasRenderingContext2D) {
    const b = this.basket();
    const filled = this.state.collected.length;
    ctx.save();
    const cx = b.x + b.w / 2;
    const pulse = (Math.sin(this.elapsedMs / 360) + 1) / 2;

    if (this.collectorImage.complete && this.collectorImage.naturalWidth > 0) {
      const size = Math.min(b.w * .86, b.h * 1.8);
      const x = cx - size / 2;
      const y = this.height - size - 4;
      const aura = ctx.createRadialGradient(cx, b.y + b.h * .58, 0, cx, b.y + b.h * .58, size * .62);
      aura.addColorStop(0, `rgba(76,109,240,${.22 + pulse * .12})`);
      aura.addColorStop(.55, 'rgba(0,216,154,.12)');
      aura.addColorStop(1, 'rgba(5,10,28,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(x - 45, y - 45, size + 90, size + 90);
      ctx.shadowColor = '#6D8BFF';
      ctx.shadowBlur = 22 + pulse * 18;
      ctx.drawImage(this.collectorImage, x, y, size, size);
      ctx.shadowBlur = 0;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PALETTE.white;
      ctx.font = `900 ${Math.round(b.h * .22)}px ${MONO}`;
      ctx.fillText(`${filled}/${CORE_TASKS.length}`, cx, b.y + b.h * .53);
      ctx.fillStyle = 'rgba(238,242,255,.92)';
      ctx.font = `800 ${Math.round(b.h * .085)}px ${FONT}`;
      ctx.letterSpacing = '.16em';
      ctx.fillText('KHO NHIỆM VỤ', cx, b.y + b.h * .72);
      ctx.letterSpacing = '0px';
      ctx.restore();
      return;
    }

    // Cột ánh sáng hút nhiệm vụ
    const beam = ctx.createLinearGradient(0, b.y - b.h * .7, 0, b.y + b.h);
    beam.addColorStop(0, 'rgba(76,109,240,0)');
    beam.addColorStop(.55, 'rgba(76,109,240,.12)');
    beam.addColorStop(1, 'rgba(0,216,154,.32)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(cx - b.w * .22, b.y - b.h * .62);
    ctx.lineTo(cx + b.w * .22, b.y - b.h * .62);
    ctx.lineTo(cx + b.w * .44, b.y + b.h * .36);
    ctx.lineTo(cx - b.w * .44, b.y + b.h * .36);
    ctx.closePath();
    ctx.fill();

    // Đế hologram
    ctx.shadowColor = PALETTE.mint;
    ctx.shadowBlur = 18 + pulse * 16;
    for (let i = 2; i >= 0; i -= 1) {
      ctx.beginPath();
      ctx.ellipse(cx, b.y + b.h * (.72 + i * .06), b.w * (.46 - i * .035), b.h * (.23 - i * .025), 0, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? 'rgba(8,22,52,.94)' : `rgba(76,109,240,${.08 + i * .04})`;
      ctx.fill();
      ctx.strokeStyle = i === 0 ? PALETTE.mint : 'rgba(109,139,255,.55)';
      ctx.lineWidth = i === 0 ? 3 : 1.5;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Vòng quét xoay
    ctx.save();
    ctx.translate(cx, b.y + b.h * .7);
    ctx.rotate(this.elapsedMs / 2400);
    ctx.strokeStyle = 'rgba(238,242,255,.58)';
    ctx.lineWidth = 2;
    ctx.setLineDash([b.w * .13, b.w * .07]);
    ctx.beginPath();
    ctx.ellipse(0, 0, b.w * .37, b.h * .16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Sáu lõi tiến độ
    const segW = b.w * .09;
    const gap = b.w * .025;
    const total = CORE_TASKS.length * segW + 5 * gap;
    for (let i = 0; i < CORE_TASKS.length; i += 1) {
      const x = cx - total / 2 + i * (segW + gap);
      ctx.beginPath();
      ctx.roundRect(x, b.y + b.h * .82, segW, 6, 3);
      ctx.fillStyle = i < filled ? PALETTE.mint : 'rgba(125,139,184,.25)';
      ctx.fill();
      if (i < filled) {
        ctx.shadowColor = PALETTE.mint;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.mint;
    ctx.font = `800 ${Math.round(b.h * 0.12)}px ${FONT}`;
    ctx.letterSpacing = '0.18em';
    ctx.fillText('CỔNG THU NHIỆM VỤ', cx, b.y + b.h * 0.36);
    ctx.letterSpacing = '0px';

    ctx.fillStyle = PALETTE.white;
    ctx.font = `900 ${Math.round(b.h * 0.31)}px ${MONO}`;
    ctx.fillText(`${filled}/${CORE_TASKS.length}`, cx, b.y + b.h * 0.58);

    ctx.restore();
  }

  private drawBall(ctx: CanvasRenderingContext2D, ball: Ball) {
    const held = ball.grabbedBy !== null;
    const taskIndex = Math.max(0, ALL_TASKS.findIndex((task) => task.id === ball.task.id));
    const accents = ['#6D8BFF', '#AF7CFF', '#32C8E6', '#FF8A5B', '#F4BE4F', '#4ED6AD', '#F178B6'];
    const accent = accents[taskIndex % accents.length];
    const wobble = Math.sin(this.elapsedMs / 420 + ball.seed) * 3;

    // Vệt kéo khi đang cầm
    if (held && ball.trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineCap = 'round';
      ball.trail.forEach((point, i) => {
        if (i === 0) return;
        const prev = ball.trail[i - 1];
        ctx.globalAlpha = (i / ball.trail.length) * 0.42;
        ctx.lineWidth = (i / ball.trail.length) * ball.r * 0.95;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      });
      ctx.restore();
    }

    ctx.save();
    ctx.translate(ball.x, ball.y + wobble);

    // Vòng gợi ý
    if (ball.reach > 0.04 && !held) {
      ctx.save();
      ctx.globalAlpha = ball.reach * 0.95;
      ctx.strokeStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 9]);
      ctx.lineDashOffset = -this.elapsedMs / 26;
      ctx.beginPath();
      ctx.arc(0, 0, ball.r + 15 - ball.reach * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (held) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = 40;
    }

    // Outer glow aura
    ctx.save();
    ctx.globalAlpha = held ? 0.35 : 0.15;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, 0, ball.r + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
    const orb = ctx.createRadialGradient(-ball.r * .28, -ball.r * .34, 4, 0, 0, ball.r);
    orb.addColorStop(0, 'rgba(255,255,255,.96)');
    orb.addColorStop(.14, accent);
    orb.addColorStop(1, '#0c142d');
    ctx.fillStyle = orb;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (this.iconAtlas.complete && this.iconAtlas.naturalWidth > 0) {
      const cellW = this.iconAtlas.naturalWidth / 4;
      const cellH = this.iconAtlas.naturalHeight / 4;
      const col = taskIndex % 4;
      const row = Math.floor(taskIndex / 4);
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -ball.r * .22, ball.r * .72, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.iconAtlas, col * cellW, row * cellH, cellW, cellH, -ball.r * .76, -ball.r * .98, ball.r * 1.52, ball.r * 1.52);
      ctx.restore();
    }

    // Vành sáng phía trên
    ctx.beginPath();
    ctx.arc(0, 0, ball.r - 3, Math.PI * 1.12, Math.PI * 1.88);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
    ctx.strokeStyle = held ? PALETTE.white : 'rgba(255,255,255,0.28)';
    ctx.lineWidth = held ? 4 : 1.5;
    ctx.stroke();

    // Nhãn nhiệm vụ
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.max(11, Math.round(ball.r * 0.19));
    ctx.font = `800 ${fontSize}px ${FONT}`;

    const lines = wrapText(ctx, ball.task.label, ball.r * 1.52).slice(0, 3);
    const lineHeight = fontSize * 1.18;
    const panelH = Math.max(ball.r * .52, lines.length * lineHeight + 10);
    ctx.fillStyle = 'rgba(5,10,28,.92)';
    ctx.beginPath();
    ctx.roundRect(-ball.r * .84, ball.r - panelH - 5, ball.r * 1.68, panelH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    const startY = ball.r - panelH / 2 - ((lines.length - 1) * lineHeight) / 2 - 5;
    lines.forEach((line, i) => ctx.fillText(line, 0, startY + i * lineHeight));

    ctx.restore();
  }

  private drawHands(ctx: CanvasRenderingContext2D) {
    this.hands.forEach((hand) => {
      const on = hand.isPinching;
      const color = on ? PALETTE.mint : 'rgba(238,242,255,0.72)';

      ctx.save();
      ctx.lineCap = 'round';

      ctx.strokeStyle = color;
      ctx.lineWidth = on ? 4.5 : 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = on ? 16 : 6;
      ctx.beginPath();
      ctx.moveTo(hand.ix, hand.iy);
      ctx.lineTo(hand.tx, hand.ty);
      ctx.stroke();

      [[hand.ix, hand.iy], [hand.tx, hand.ty]].forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, on ? 10 : 7.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });

      ctx.beginPath();
      ctx.arc(hand.x, hand.y, on ? 16 : 28, 0, Math.PI * 2);
      ctx.strokeStyle = on ? PALETTE.mint : 'rgba(238,242,255,0.32)';
      ctx.lineWidth = 2.5;
      if (!on) ctx.setLineDash([6, 8]);
      ctx.stroke();
      ctx.restore();
    });
  }

  private drawBursts(ctx: CanvasRenderingContext2D) {
    this.bursts.forEach((burst) => {
      const t = burst.age / burst.life;
      const ease = 1 - Math.pow(1 - t, 3);

      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.translate(burst.x, burst.y - ease * 58);

      ctx.beginPath();
      ctx.arc(0, 0, 26 + ease * 84, 0, Math.PI * 2);
      ctx.strokeStyle = burst.color;
      ctx.shadowColor = burst.color;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3.5 * (1 - t);
      ctx.stroke();

      ctx.strokeStyle = burst.color;
      ctx.lineWidth = 2.5 * (1 - t);
      ctx.lineCap = 'round';
      burst.shards.forEach((shard) => {
        const inner = 28 + ease * 60 * shard.v;
        const outer = inner + 16 * (1 - t);
        ctx.beginPath();
        ctx.moveTo(Math.cos(shard.a) * inner, Math.sin(shard.a) * inner);
        ctx.lineTo(Math.cos(shard.a) * outer, Math.sin(shard.a) * outer);
        ctx.stroke();
      });

      ctx.fillStyle = burst.color;
      ctx.font = `800 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 14;
      ctx.fillText(burst.text, 0, -48);
      ctx.restore();
    });
  }
}

// ---------------------------------------------------------------------------

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export { ALL_TASKS, CORE_TASKS, NOISE_TASKS };
export type { TaskDef, TaskKind };
