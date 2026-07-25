import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game } from './components/Game';
import { audio } from './utils/audio';
import { CORE_TASKS, Difficulty, GameState, TaskDef } from './utils/engine';

type Screen = 'intro' | 'playing' | 'debrief';

const SPEEDS: { key: Difficulty; name: string; seconds: number; desc: string }[] = [
  { key: 'easy', name: 'Thong thả', seconds: 120, desc: 'Phù hợp làm quen' },
  { key: 'normal', name: 'Chuẩn', seconds: 90, desc: 'Khuyên dùng demo' },
  { key: 'hard', name: 'Nhanh', seconds: 70, desc: 'Thử thách cao' },
];

const EMPTY: GameState = {
  score: 0,
  collected: [],
  wrongDrops: 0,
  missedCore: 0,
  streak: 0,
  bestStreak: 0,
  timeLeftSec: 0,
  isGameOver: false,
  isWin: false,
  handsVisible: 0,
  phase: 'CALIBRATE',
  multiplier: 1,
  accuracy: 100,
  eventText: 'ĐANG ĐỒNG BỘ ĐẤU TRƯỜNG',
  powerReady: false,
  countdown: 3,
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('intro');
  const [demoMode, setDemoMode] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [muted, setMuted] = useState(false);
  const [state, setState] = useState<GameState>(EMPTY);
  const [final, setFinal] = useState<GameState>(EMPTY);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    const intensity = state.phase === 'FINAL' ? 1 : state.phase === 'CRISIS' ? 0.72 : state.streak >= 3 ? 0.5 : 0.2;
    audio.setIntensity(intensity);
  }, [state.phase, state.streak]);

  const onGameOver = useCallback((s: GameState) => {
    audio.stopMusic();
    setFinal(s);
    setScreen('debrief');
  }, []);

  const start = (mouse: boolean) => {
    audio.init();
    audio.startMusic();
    setDemoMode(mouse);
    setState(EMPTY);
    setRunKey((k) => k + 1);
    setScreen('playing');
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--ink)]">
      {screen === 'playing' ? (
        <>
          <Scoreboard
            state={state}
            muted={muted}
            onToggleMute={() => {
              setMuted((m) => {
                audio.setMuted(!m);
                return !m;
              });
            }}
            onQuit={() => {
              audio.stopMusic();
              setScreen('intro');
            }}
          />
          <main className="relative min-h-0 flex-1">
            <Game
              key={runKey}
              demoMode={demoMode}
              difficulty={difficulty}
              onStateUpdate={setState}
              onGameOver={onGameOver}
            />
          </main>
        </>
      ) : screen === 'intro' ? (
        <Intro difficulty={difficulty} onDifficulty={setDifficulty} onStart={start} />
      ) : (
        <Debrief state={final} onReplay={() => setScreen('intro')} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chữ ký thị giác: dấu chụm ngón                                      */
/* ------------------------------------------------------------------ */

function PinchMark({ live, className = '' }: { live?: boolean; className?: string }) {
  return <span className={`pinch ${live ? 'pinch-live' : ''} ${className}`} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Ô nhiệm vụ — vật thể tiến độ dùng chung cho màn chơi và màn tổng kết */
/* ------------------------------------------------------------------ */

function SlotRow({
  collected,
  size = 'sm',
  justFilledId,
}: {
  collected: TaskDef[];
  size?: 'sm' | 'lg';
  justFilledId?: string | null;
}) {
  const filledIds = new Set(collected.map((t) => t.id));
  return (
    <div className={`flex flex-wrap ${size === 'lg' ? 'gap-2.5' : 'gap-1.5'}`}>
      {CORE_TASKS.map((task) => {
        const filled = filledIds.has(task.id);
        return (
          <div
            key={task.id}
            className={`slot ${size === 'lg' ? 'h-14 px-4 text-sm' : 'h-9 px-2.5 text-[11px]'} flex items-center gap-2 rounded-lg border transition-all duration-300`}
            data-filled={filled}
            data-just-filled={justFilledId === task.id}
            style={{
              borderColor: filled ? 'var(--mint)' : 'rgba(125, 139, 184, 0.25)',
              background: filled ? 'rgba(0, 216, 154, 0.12)' : 'rgba(5, 10, 28, 0.45)',
              boxShadow: filled ? '0 0 18px rgba(0, 216, 154, 0.25)' : 'none',
            }}
            title={task.label}
          >
            {filled && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--mint)] text-[10px] font-black text-[#032117]">
                ✓
              </span>
            )}
            <span
              className="t-eyebrow whitespace-nowrap"
              style={{
                color: filled ? 'var(--mint)' : 'var(--dim)',
                fontSize: 'inherit',
                letterSpacing: '0.1em',
              }}
            >
              {task.short ?? task.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bảng điểm — HUD độc đáo với phản hồi thị giác nhạy bén               */
/* ------------------------------------------------------------------ */

function Scoreboard({
  state,
  muted,
  onToggleMute,
  onQuit,
}: {
  state: GameState;
  muted: boolean;
  onToggleMute: () => void;
  onQuit: () => void;
}) {
  const prevCount = useRef(0);
  const [justFilled, setJustFilled] = useState<string | null>(null);

  useEffect(() => {
    if (state.collected.length > prevCount.current) {
      const last = state.collected[state.collected.length - 1];
      setJustFilled(last?.id ?? null);
      const t = setTimeout(() => setJustFilled(null), 500);
      prevCount.current = state.collected.length;
      return () => clearTimeout(t);
    }
    prevCount.current = state.collected.length;
  }, [state.collected]);

  const low = state.timeLeftSec <= 10;

  return (
    <header className={`game-hud shrink-0 ${state.streak >= 3 ? 'hud-hot' : ''} ${state.phase === 'FINAL' ? 'hud-final' : ''}`}>
      <div className="hud-compact">
        <div className={`hud-clock ${low ? 'is-low' : ''} relative`}>
          <span>THỜI GIAN</span>
          <div className="flex items-baseline">
            <b>{state.timeLeftSec}</b>
            <i>s</i>
          </div>
        </div>

        <div className="hud-number">
          <span>ĐIỂM SỐ</span>
          <b>{state.score}</b>
        </div>

        <div className="hud-number hud-combo-mini">
          <span>COMBO</span>
          <b style={{ color: state.multiplier > 1 ? 'var(--mint)' : 'var(--chalk)' }}>
            ×{state.multiplier}
          </b>
        </div>

        <div className="hud-objective-zone">
          <span className="hud-zone-label">MỤC TIÊU {state.collected.length}/6</span>
          <div className="hud-objectives">
            {CORE_TASKS.map((task, index) => {
              const filled = state.collected.some((item) => item.id === task.id);
              return (
                <div
                  key={task.id}
                  title={task.label}
                  className={filled ? 'is-filled' : ''}
                  data-just-filled={justFilled === task.id}
                >
                  <b>{index + 1}</b>
                  <span>{task.short}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hud-signal" data-live={state.handsVisible > 0}>
          <i />
          {state.handsVisible > 0 ? `${state.handsVisible} TAY` : 'TÌM TAY'}
        </div>
        <button
          className="hud-icon-button"
          onClick={onToggleMute}
          title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        >
          {muted ? '◌' : '◉'}
        </button>
        <button
          className="hud-icon-button is-exit"
          onClick={onQuit}
          title="Thoát"
          aria-label="Thoát"
        >
          ×
        </button>
      </div>

      <div className={`event-strip phase-${state.phase.toLowerCase()}`}>
        <span>{state.phase}</span>
        <strong>{state.eventText}</strong>
        <i>{state.powerReady ? 'AI FLOW +3 GIÂY' : `CHUỖI ${state.streak}`}</i>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Màn giới thiệu                                                      */
/* ------------------------------------------------------------------ */

function Intro({
  difficulty,
  onDifficulty,
  onStart,
}: {
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  onStart: (mouse: boolean) => void;
}) {
  const [launching, setLaunching] = useState(false);

  const launch = (mouse: boolean) => {
    if (launching) return;
    audio.init();
    audio.playPower();
    setLaunching(true);
    window.setTimeout(() => onStart(mouse), 760);
  };

  return (
    <div className={`intro-shell h-full overflow-y-auto ${launching ? 'is-launching' : ''}`}>
      <div className="launch-wipe" aria-hidden="true">
        <span>ĐỒNG BỘ ĐẤU TRƯỜNG</span>
      </div>
      <div className="intro-art" aria-hidden="true" />
      <div className="intro-grid" aria-hidden="true" />
      <div className="intro-atmosphere" aria-hidden="true">
        <span className="intro-orb orb-a" />
        <span className="intro-orb orb-b" />
        <span className="intro-orb orb-c" />
        <span className="scan-beam" />
      </div>

      <main className="launch-screen relative z-10 mx-auto min-h-full w-full max-w-[1500px] px-[var(--gap)] py-6">
        <nav className="launch-nav rise">
          <div className="launch-brand">
            <PinchMark live />
            <span>MANABIE LAB</span>
          </div>
          <div className="launch-status">
            <i /> CAMERA AR SẴN SÀNG
          </div>
          <div className="launch-code">MISSION / 01</div>
        </nav>

        <section className="launch-hero">
          <div className="launch-copy rise">
            <p className="launch-kicker flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--mint)] shadow-[0_0_10px_var(--mint)]" />
              HOẠT ĐỘNG 01 · GẮP VIỆC GIAO AI
            </p>
            <h1>
              TRÒ CHƠI KHỞI ĐỘNG
              <em>"NHANH TAY LẸ MẮT"</em>
            </h1>
            <p className="launch-lead">
              Đọc tình huống. Gắp việc có thể giao cho AI. Để những việc cần con người tiếp tục rơi.
            </p>

            <div className="launch-metrics">
              <div>
                <b>06</b>
                <span>MỤC TIÊU</span>
              </div>
              <div>
                <b>×4</b>
                <span>COMBO TỐI ĐA</span>
              </div>
              <div>
                <b>+3s</b>
                <span>AI FLOW</span>
              </div>
            </div>

            <div className="launch-difficulty">
              <span>CHỌN NHỊP</span>
              {SPEEDS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => onDifficulty(s.key)}
                  aria-pressed={difficulty === s.key}
                  title={s.desc}
                >
                  {s.name}
                  <small>{s.seconds}s</small>
                </button>
              ))}
            </div>

            <div className="launch-actions">
              <button onClick={() => launch(false)} className="launch-primary">
                <PinchMark />
                <span>Vào đấu trường</span>
                <b>CAMERA →</b>
              </button>
              <button onClick={() => launch(true)} className="launch-secondary">
                Chơi thử bằng chuột
              </button>
            </div>
          </div>

          <div className="mission-reactor rise" aria-label="Mô phỏng cổng nhiệm vụ">
            <div className="reactor-halo halo-one" />
            <div className="reactor-halo halo-two" />
            <div className="reactor-scan" />

            {/* 6 Quả cầu 3D công việc chuyển động xoay quanh tâm AI Flow */}
            <div className="orbit-container">
              <div className="orb-task orb-khbd" title="Tạo kế hoạch bài dạy" style={{ '--angle': '0deg', '--dist': '210px', '--speed': '14s' } as React.CSSProperties}>
                <div className="orb-sphere icon-khbd" />
                <span className="orb-label">Tạo kế hoạch<br />bài dạy</span>
              </div>
              <div className="orb-task orb-slide" title="Tạo slide bài giảng" style={{ '--angle': '60deg', '--dist': '220px', '--speed': '16.5s' } as React.CSSProperties}>
                <div className="orb-sphere icon-slide" />
                <span className="orb-label">Tạo slide<br />bài giảng</span>
              </div>
              <div className="orb-task orb-phieu" title="Thiết kế phiếu học tập" style={{ '--angle': '120deg', '--dist': '200px', '--speed': '13.5s' } as React.CSSProperties}>
                <div className="orb-sphere icon-phieu" />
                <span className="orb-label">Thiết kế<br />phiếu học tập</span>
              </div>
              <div className="orb-task orb-btvn" title="Tạo bài tập về nhà" style={{ '--angle': '180deg', '--dist': '215px', '--speed': '15.5s' } as React.CSSProperties}>
                <div className="orb-sphere icon-btvn" />
                <span className="orb-label">Tạo bài tập<br />về nhà</span>
              </div>
              <div className="orb-task orb-dekt" title="Thiết kế đề kiểm tra" style={{ '--angle': '240deg', '--dist': '225px', '--speed': '17.5s' } as React.CSSProperties}>
                <div className="orb-sphere icon-dekt" />
                <span className="orb-label">Thiết kế<br />đề kiểm tra</span>
              </div>
              <div className="orb-task orb-phuhuynh" title="Giao tiếp với phụ huynh" style={{ '--angle': '300deg', '--dist': '205px', '--speed': '14.5s' } as React.CSSProperties}>
                <div className="orb-sphere icon-phuhuynh" />
                <span className="orb-label">Giao tiếp với<br />phụ huynh</span>
              </div>
            </div>

            <div className="reactor-core">
              <span>CHẾ ĐỘ</span>
              <strong>AI FLOW</strong>
              <i>ĐANG CHỜ</i>
            </div>
            <div className="reactor-platform">
              <span />
              <span />
              <span />
            </div>
            <p>GẮP · ĐỌC · QUYẾT ĐỊNH</p>
          </div>
        </section>

        <footer className="launch-steps rise">
          <span>
            <b>01</b> Đưa tay vào khung
          </span>
          <i />
          <span>
            <b>02</b> Chụm ngón để gắp
          </span>
          <i />
          <span>
            <b>03</b> Thả vào cổng
          </span>
        </footer>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Màn tổng kết — 3D Visual Cards & Pedagogical Debrief               */
/* ------------------------------------------------------------------ */

function Debrief({ state, onReplay }: { state: GameState; onReplay: () => void }) {
  const missed = useMemo(
    () => CORE_TASKS.filter((t) => !state.collected.some((c) => c.id === t.id)),
    [state.collected],
  );
  const targetXp = Math.max(0, state.score + state.bestStreak * 80 - state.wrongDrops * 40);
  const rank = targetXp >= 1400 ? 'Bậc thầy quy trình' : targetXp >= 800 ? 'Kiến trúc sư prompt' : 'Tân binh AI';
  const rankBadgeIcon = targetXp >= 1400 ? '🏆' : targetXp >= 800 ? '⚡' : '🎓';

  const [animScore, setAnimScore] = useState(0);
  const [animXp, setAnimXp] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1200;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min(1, (timestamp - startTimestamp) / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimScore(Math.round(state.score * ease));
      setAnimXp(Math.round(targetXp * ease));

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [state.score, targetXp]);

  return (
    <div className="relative h-full overflow-y-auto bg-gradient-to-b from-[#050a1c] via-[#081536] to-[#050a1c]">
      {/* Background glow atmospheric Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[var(--mint)]/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/3 h-80 w-80 rounded-full bg-[var(--brand)]/15 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-[var(--gap)] py-[clamp(2rem,5vh,4rem)]">
        <div className="rise text-center sm:text-left">
          <p className="t-eyebrow flex items-center justify-center gap-3 sm:justify-start" style={{ color: state.isWin ? 'var(--mint)' : 'var(--ember)' }}>
            <PinchMark live={state.isWin} />
            {state.isWin ? 'ĐỦ SÁU NHIỆM VỤ CỐT LÕI' : 'HẾT THỜI GIAN ĐẤU TRƯỜNG'}
          </p>
          <h1 className="t-hero mt-3 text-[var(--chalk)]">
            {state.isWin ? 'GIỎ ĐÃ ĐẦY' : `ĐẠT ${state.collected.length}/6 NHIỆM VỤ`}
          </h1>
        </div>

        <div className="rise mt-8" style={{ animationDelay: '80ms' }}>
          <SlotRow collected={state.collected} size="lg" />
        </div>

        <div className="rise mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: '140ms' }}>
          <Stat label="Điểm số" value={animScore} />
          <Stat label="Chuỗi dài nhất" value={state.bestStreak} />
          <Stat label="Thả nhầm" value={state.wrongDrops} warn={state.wrongDrops > 0} />
          <Stat label="Để rơi mất" value={state.missedCore} warn={state.missedCore > 0} />
        </div>

        <div className="rank-card rise mt-6 rounded-2xl border border-[var(--mint)]/50 bg-gradient-to-r from-[rgba(0,216,154,0.16)] via-[rgba(76,109,240,0.14)] to-[rgba(5,10,28,0.6)] p-6 shadow-[0_0_50px_rgba(0,216,154,0.15)] backdrop-blur-xl" style={{ animationDelay: '180ms' }}>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--mint)]/20 text-3xl shadow-[0_0_20px_rgba(0,216,154,0.3)] border border-[var(--mint)]/40">
              {rankBadgeIcon}
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--mint)]">CẤP ĐỘ MỚI</span>
              <strong className="block text-2xl font-black text-[var(--chalk)] uppercase tracking-wide">{rank}</strong>
            </div>
          </div>
          <div className="rank-xp text-right">
            <b className="t-data text-4xl font-black text-[var(--mint)]">{animXp}</b>
            <span className="text-sm font-bold text-[var(--dim)]"> XP</span>
          </div>
        </div>

        {missed.length > 0 && (
          <div className="rise mt-5 rounded-xl border border-[var(--edge)] bg-[var(--field)]/40 p-4 backdrop-blur-md" style={{ animationDelay: '200ms' }}>
            <p className="text-sm font-medium text-[var(--dim)]">
              ⚠️ Chưa gắp được: <strong className="text-[var(--chalk)]">{missed.map((t) => t.label).join(' · ')}</strong>
            </p>
          </div>
        )}

        {/* Dual 3D Graphic Cards — Pedagogical Role Separation */}
        <div className="rise mt-10 grid gap-6 md:grid-cols-2" style={{ animationDelay: '240ms' }}>
          {/* Card 1: AI Assistant */}
          <div className="group relative overflow-hidden rounded-2xl border border-[var(--mint)]/35 bg-gradient-to-b from-[rgba(0,216,154,0.12)] to-[rgba(5,10,28,0.7)] p-6 shadow-[0_10px_35px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-[var(--mint)]/60 hover:shadow-[0_15px_45px_rgba(0,216,154,0.2)]">
            <div className="relative h-56 w-full overflow-hidden rounded-xl bg-black/40 border border-white/10 mb-5">
              <img
                src="/assets/debrief_ai_assistant_3d.png"
                alt="AI Tối ưu Hồ sơ & Giáo án"
                className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)] via-transparent to-transparent" />
            </div>
            <h3 className="text-xl font-extrabold uppercase text-[var(--mint)] tracking-wider">
              AI Đồng Hành & Tối Ưu Hồ Sơ
            </h3>
            <p className="mt-2.5 text-base leading-relaxed text-[var(--chalk)]/90 font-medium">
              Các công việc tạo lập hồ sơ, giáo án, phiếu học tập và đề kiểm tra — AI có thể hỗ trợ xử lý tự động hóa nhanh chóng và chính xác.
            </p>
          </div>

          {/* Card 2: Teacher Inspiring */}
          <div className="group relative overflow-hidden rounded-2xl border border-[var(--brand)]/40 bg-gradient-to-b from-[rgba(76,109,240,0.14)] to-[rgba(5,10,28,0.7)] p-6 shadow-[0_10px_35px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-[var(--brand)]/70 hover:shadow-[0_15px_45px_rgba(76,109,240,0.25)]">
            <div className="relative h-56 w-full overflow-hidden rounded-xl bg-black/40 border border-white/10 mb-5">
              <img
                src="/assets/debrief_teacher_inspiring_3d.png"
                alt="Thầy Cô Truyền Cảm Hứng"
                className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)] via-transparent to-transparent" />
            </div>
            <h3 className="text-xl font-extrabold uppercase text-[var(--chalk)] tracking-wider">
              Thầy Cô Dẫn Dắt & Truyền Cảm Hứng
            </h3>
            <p className="mt-2.5 text-base leading-relaxed text-[var(--chalk)]/90 font-medium">
              Sự kết nối, thấu hiểu, cảm xúc và tương tác trực tiếp với từng học sinh — chính thầy cô luôn là trung tâm kiến tạo lớp học hạnh phúc.
            </p>
          </div>
        </div>

        {/* Discussion Hook Banner */}
        <section
          className="rise mt-8 rounded-2xl border border-[var(--mint)]/50 bg-gradient-to-r from-[rgba(0,216,154,0.18)] via-[rgba(76,109,240,0.12)] to-[rgba(5,10,28,0.8)] p-7 shadow-[0_12px_45px_rgba(0,216,154,0.15)] backdrop-blur-xl"
          style={{ animationDelay: '280ms' }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 rounded-full bg-[var(--mint)] shadow-[0_0_12px_var(--mint)] animate-pulse" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[var(--mint)]">
              THẢO LUẬN & MỞ ĐẦU BÀI HỌC
            </span>
          </div>
          <p className="mt-3.5 text-[clamp(1.15rem,2.1vw,1.65rem)] font-bold leading-[1.55] text-[var(--chalk)]">
            Sáu việc này, mỗi tuần thầy cô làm bao nhiêu lần? Làm sao để làm nhanh nhất mà vẫn chính xác nhất?
          </p>
        </section>

        <div className="rise mt-8 flex justify-center" style={{ animationDelay: '320ms' }}>
          <button
            onClick={onReplay}
            className="pinch-host group flex items-center justify-center gap-4 rounded-2xl border border-[var(--mint)] bg-[var(--mint)]/15 px-10 py-5 text-lg font-extrabold text-[var(--chalk)] shadow-[0_0_30px_rgba(0,216,154,0.2)] transition-all duration-300 hover:scale-105 hover:bg-[var(--mint)] hover:text-[#032117] hover:shadow-[0_0_50px_rgba(0,216,154,0.4)]"
          >
            <PinchMark />
            <span>Chơi lại ngay</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--edge)] bg-[var(--field)]/60 p-4 backdrop-blur-md transition-all duration-300 hover:border-[var(--mint)]/40">
      <p className="t-eyebrow text-xs text-[var(--dim)]">{label}</p>
      <p
        className="t-data mt-2 text-[clamp(1.8rem,3.2vw,2.6rem)] font-black leading-none"
        style={{ color: warn ? 'var(--ember)' : 'var(--chalk)' }}
      >
        {value}
      </p>
    </div>
  );
}
