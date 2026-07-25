/**
 * Tổng hợp âm thanh bằng WebAudio — không tải tệp ngoài, chạy được offline.
 * Rút gọn từ earth-defender-ar, chỉ giữ các âm mà trò Gắp nhiệm vụ dùng tới.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private initialized = false;
  private muted = false;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private musicTimer: number | null = null;
  private intensity = 0.2;

  setIntensity(value: number) {
    this.intensity = Math.max(0, Math.min(1, value));
    if (this.music && this.ctx) this.music.gain.setTargetAtTime(0.08 + this.intensity * 0.07, this.ctx.currentTime, 0.25);
  }

  init() {
    if (this.initialized) {
      this.ctx?.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.initialized = true;
    } catch (e) {
      console.error('Audio context init failed', e);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.02);
    }
  }

  /** Nhạc nền synth nhẹ, được tạo hoàn toàn bằng WebAudio để game chạy offline. */
  startMusic() {
    const ctx = this.ready();
    if (!ctx || !this.master || this.musicTimer !== null) return;
    this.music = ctx.createGain();
    this.music.gain.value = 0.11;
    this.music.connect(this.master);
    const notes = [110, 164.81, 220, 146.83, 196, 246.94, 164.81, 220];
    let step = 0;
    const pulse = () => {
      if (!this.ctx || !this.music) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = step % 4 === 0 ? 'triangle' : 'sine';
      osc.frequency.value = notes[step % notes.length] * (1 + this.intensity * 0.35);
      filter.type = 'lowpass';
      filter.frequency.value = 620 + this.intensity * 1150;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.11, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
      osc.connect(filter); filter.connect(gain); gain.connect(this.music);
      osc.start(t); osc.stop(t + 0.75); step += 1;
      if (this.intensity > 0.65 && step % 2 === 0) {
        this.tone({ type: 'sine', start: 70, end: 48, duration: 0.12, gain: 0.035 + this.intensity * 0.018 });
      }
      if (step % 2 === 0) this.noiseHit(0.018 + this.intensity * 0.018, 0.045, 3600 + this.intensity * 2800);
    };
    pulse();
    this.musicTimer = window.setInterval(pulse, 480);
  }

  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.music && this.ctx) {
      this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      window.setTimeout(() => this.music?.disconnect(), 450);
    }
    this.music = null;
  }

  /** Gắp trúng một quả */
  playGrab() {
    this.tone({ type: 'sine', start: 440, end: 720, duration: 0.1, gain: 0.04 });
  }

  /** Quả mới nhập đấu trường — tiếng không tiết lộ loại nhiệm vụ. */
  playSpawn() {
    this.tone({ type: 'sine', start: 980, end: 620, duration: 0.09, gain: 0.018 });
  }

  playCountdown(value: number) {
    const f = value === 1 ? 760 : 440 + (3 - value) * 80;
    this.tone({ type: 'square', start: f, end: f, duration: 0.08, gain: 0.035 });
    this.tone({ type: 'sine', start: f * 2, end: f * 1.5, duration: 0.18, gain: 0.025, when: 0.02 });
  }

  playPhase(phase: string) {
    if (phase === 'CALIBRATE') return;
    const urgent = phase === 'FINAL';
    this.tone({ type: 'sawtooth', start: urgent ? 180 : 260, end: urgent ? 620 : 520, duration: 0.3, gain: 0.035 });
    this.noiseHit(urgent ? 0.055 : 0.032, 0.16, urgent ? 1300 : 2200);
  }

  playPower() {
    [0, .06, .12, .2].forEach((when, i) => this.tone({ type: 'triangle', start: 440 + i * 170, end: 740 + i * 210, duration: .24, gain: .042, when }));
  }

  /** Thả đúng nhiệm vụ cốt lõi vào giỏ */
  playScore(streak = 0) {
    const lift = Math.min(4, streak) * 60;
    this.tone({ type: 'sine', start: 520 + lift, end: 920 + lift, duration: 0.16, gain: 0.055 });
    this.tone({ type: 'triangle', start: 780 + lift, end: 1240 + lift, duration: 0.18, gain: 0.045, when: 0.07 });
  }

  /** Thả nhầm quả nhiễu vào giỏ */
  playReject() {
    this.tone({ type: 'sawtooth', start: 200, end: 90, duration: 0.22, gain: 0.05, filterStart: 900, filterEnd: 160 });
  }

  /** Quả cốt lõi rơi khỏi màn hình */
  playMiss() {
    this.tone({ type: 'square', start: 300, end: 150, duration: 0.14, gain: 0.03 });
  }

  /** Hoàn thành đủ 6 nhiệm vụ */
  playWin() {
    [0, 0.12, 0.24, 0.4].forEach((when, i) => {
      this.tone({ type: 'triangle', start: 520 + i * 150, end: 900 + i * 190, duration: 0.28, gain: 0.05, when });
    });
  }

  /** Hết giờ */
  playTimeUp() {
    this.tone({ type: 'square', start: 330, end: 330, duration: 0.18, gain: 0.04 });
    this.tone({ type: 'square', start: 200, end: 200, duration: 0.3, gain: 0.04, when: 0.24 });
  }

  private tone(options: {
    type: OscillatorType;
    start: number;
    end: number;
    duration: number;
    gain: number;
    when?: number;
    filterStart?: number;
    filterEnd?: number;
  }) {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + (options.when ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(options.filterStart ?? 2400, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, options.filterEnd ?? options.end * 1.8), t + options.duration);

    osc.type = options.type;
    osc.frequency.setValueAtTime(Math.max(20, options.start), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.end), t + options.duration);
    gain.gain.setValueAtTime(options.gain, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + options.duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + options.duration + 0.03);
  }

  private noiseHit(gainValue: number, duration: number, frequency: number) {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = ctx.createBufferSource(); const filter = ctx.createBiquadFilter(); const gain = ctx.createGain();
    source.buffer = buffer; filter.type = 'highpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(); source.stop(ctx.currentTime + duration);
  }

  private ready() {
    if (this.muted) return null;
    this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
}

export const audio = new AudioEngine();
