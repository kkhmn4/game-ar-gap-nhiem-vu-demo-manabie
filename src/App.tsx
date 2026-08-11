import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Game } from './components/Game';
import { BRAND_MASCOTS, MANABIE_MARK } from './data/brand';
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

const QA_DEBRIEF: GameState = {
  ...EMPTY,
  score: 1680,
  collected: CORE_TASKS,
  bestStreak: 6,
  timeLeftSec: 24,
  isGameOver: true,
  isWin: true,
  phase: 'FINAL',
  eventText: 'ĐÃ PHÂN LOẠI ĐỦ SÁU NHIỆM VỤ',
};

export default function App() {
  const qaDebrief = new URLSearchParams(window.location.search).get('qa') === 'debrief';
  const [screen, setScreen] = useState<Screen>(qaDebrief ? 'debrief' : 'intro');
  const [demoMode, setDemoMode] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [muted, setMuted] = useState(false);
  const [briefingAcknowledged, setBriefingAcknowledged] = useState(false);
  const [state, setState] = useState<GameState>(EMPTY);
  const [final, setFinal] = useState<GameState>(qaDebrief ? QA_DEBRIEF : EMPTY);
  const [runKey, setRunKey] = useState(0);
  const pointerFrameRef = useRef<number | null>(null);
  const pointerHostRef = useRef<HTMLDivElement | null>(null);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrentRef = useRef({ x: 0, y: 0 });

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

  const animatePointer = useCallback(function tick() {
    const stage = pointerHostRef.current;
    if (!stage) {
      pointerFrameRef.current = null;
      return;
    }

    const target = pointerTargetRef.current;
    const current = pointerCurrentRef.current;
    current.x += (target.x - current.x) * 0.16;
    current.y += (target.y - current.y) * 0.16;

    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);
    stage.style.setProperty('--cursor-x', `${current.x}px`);
    stage.style.setProperty('--cursor-y', `${current.y}px`);
    stage.style.setProperty('--cursor-nx', `${(current.x / width - 0.5) * 2}`);
    stage.style.setProperty('--cursor-ny', `${(current.y / height - 0.5) * 2}`);

    if (Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > 0.35) {
      pointerFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    current.x = target.x;
    current.y = target.y;
    pointerFrameRef.current = null;
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    const stage = event.currentTarget;
    const firstMove = stage.dataset.pointerActive !== 'true';
    const { clientX, clientY } = event;

    pointerHostRef.current = stage;
    pointerTargetRef.current = { x: clientX, y: clientY };
    stage.dataset.pointerActive = 'true';

    if (firstMove) {
      pointerCurrentRef.current = { x: clientX, y: clientY };
      stage.style.setProperty('--cursor-x', `${clientX}px`);
      stage.style.setProperty('--cursor-y', `${clientY}px`);
    }

    if (pointerFrameRef.current === null) {
      pointerFrameRef.current = requestAnimationFrame(animatePointer);
    }
  }, [animatePointer]);

  const onPointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    delete event.currentTarget.dataset.pointerActive;
  }, []);

  useEffect(() => () => {
    if (pointerFrameRef.current !== null) cancelAnimationFrame(pointerFrameRef.current);
    pointerFrameRef.current = null;
    pointerHostRef.current = null;
  }, []);

  return (
    <div
      className="app-pointer-stage flex h-dvh flex-col overflow-hidden bg-[var(--ink)]"
      data-screen={screen}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <span className="pointer-orbit" aria-hidden="true" />
      {screen !== 'playing' && (
        <span className="pointer-mascot" aria-hidden="true">
          <img src={BRAND_MASCOTS.interact} alt="" />
        </span>
      )}
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
        <Intro
          briefingOpen={!briefingAcknowledged}
          difficulty={difficulty}
          onAcknowledgeBriefing={() => setBriefingAcknowledged(true)}
          onDifficulty={setDifficulty}
          onStart={start}
        />
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
  briefingOpen,
  difficulty,
  onAcknowledgeBriefing,
  onDifficulty,
  onStart,
}: {
  briefingOpen: boolean;
  difficulty: Difficulty;
  onAcknowledgeBriefing: () => void;
  onDifficulty: (d: Difficulty) => void;
  onStart: (mouse: boolean) => void;
}) {
  const [launching, setLaunching] = useState(false);
  const [motionCycle, setMotionCycle] = useState(0);
  const [briefingStep, setBriefingStep] = useState(0);
  const [briefingDirection, setBriefingDirection] = useState<'next' | 'prev'>('next');
  const [briefingMorphPhase, setBriefingMorphPhase] = useState<'idle' | 'cover' | 'reveal'>('idle');
  const briefingDeckRef = useRef<HTMLElement | null>(null);
  const briefingMorphSwapTimerRef = useRef<number | null>(null);
  const briefingMorphEndTimerRef = useRef<number | null>(null);
  const briefingMorphLockRef = useRef(false);

  useEffect(() => {
    if (!briefingOpen) return;
    const timer = window.setTimeout(() => briefingDeckRef.current?.focus({ preventScroll: true }), 700);
    return () => window.clearTimeout(timer);
  }, [briefingOpen]);

  useEffect(() => () => {
    if (briefingMorphSwapTimerRef.current !== null) window.clearTimeout(briefingMorphSwapTimerRef.current);
    if (briefingMorphEndTimerRef.current !== null) window.clearTimeout(briefingMorphEndTimerRef.current);
  }, []);

  const goToBriefingStep = (nextStep: number) => {
    const target = Math.max(0, Math.min(2, nextStep));
    if (target === briefingStep || briefingMorphLockRef.current) return;
    briefingMorphLockRef.current = true;
    setBriefingDirection(target > briefingStep ? 'next' : 'prev');
    setBriefingMorphPhase('cover');
    audio.init();
    audio.playPower();
    briefingMorphSwapTimerRef.current = window.setTimeout(() => {
      const updatePage = () => flushSync(() => setBriefingStep(target));
      const documentWithTransitions = document as Document & {
        startViewTransition?: (update: () => void) => { finished: Promise<void> };
      };
      if (documentWithTransitions.startViewTransition) {
        documentWithTransitions.startViewTransition(updatePage).finished.catch(() => undefined);
      } else {
        updatePage();
      }
      setBriefingMorphPhase('reveal');
      briefingMorphSwapTimerRef.current = null;
    }, 320);
    briefingMorphEndTimerRef.current = window.setTimeout(() => {
      setBriefingMorphPhase('idle');
      briefingMorphLockRef.current = false;
      briefingMorphEndTimerRef.current = null;
    }, 1300);
  };

  const advanceBriefing = () => goToBriefingStep(briefingStep + 1);

  const launch = (mouse: boolean) => {
    if (launching) return;
    audio.init();
    audio.playPower();
    setLaunching(true);
    window.setTimeout(() => onStart(mouse), 760);
  };

  return (
    <div className={`workshop-stage force-motion ${launching ? 'is-launching' : ''}`}>
      <div className="launch-wipe" aria-hidden="true">
        <span>KHỞI ĐỘNG HOẠT ĐỘNG 1</span>
      </div>

      <div className="workshop-atmosphere" aria-hidden="true">
        <span className="workshop-grid" />
        <span className="workshop-scanline" />
        <span className="workshop-glow workshop-glow-a" />
        <span className="workshop-glow workshop-glow-b" />
      </div>

      <button
        className="workshop-replay-motion"
        type="button"
        onClick={() => setMotionCycle((cycle) => cycle + 1)}
        aria-label="Xem lại hiệu ứng mở đầu"
      >
        <span>↻</span> XEM LẠI HIỆU ỨNG
      </button>

      <main className="workshop-shell" key={motionCycle}>
        <header className="workshop-header">
          <div className="workshop-brand">
            <img className="manabie-brand-mark" src={MANABIE_MARK} alt="" />
            <span>TẬP HUẤN ỨNG DỤNG AI</span>
            <i>MANABIE AI LAB</i>
          </div>
          <div className="workshop-status"><b /> SẴN SÀNG TRẢI NGHIỆM</div>
          <div className="workshop-code">MODULE 1 · KHỞI ĐỘNG</div>
        </header>

        <section className="workshop-hero">
          <div className="workshop-copy">
            <p className="workshop-kicker"><span>HOẠT ĐỘNG KHỞI ĐỘNG</span> · 20 PHÚT</p>
            <h1 className="workshop-title">
              <span>GẮP VIỆC</span>
              <span className="is-accent">GIAO AI</span>
            </h1>
            <p className="workshop-lead">
              Phân loại 12 công việc để tìm đúng 6 việc trí tuệ nhân tạo có thể hỗ trợ quý thầy cô dựng bản nháp.
            </p>

            <div className="workshop-settings">
              <div className="workshop-speed">
                <img className="workshop-speed-mascot lux-image" src={BRAND_MASCOTS.time} alt="" aria-hidden="true" />
                <span>CHỌN NHỊP CHƠI</span>
                <div>
                  {SPEEDS.map((speed) => (
                    <button
                      key={speed.key}
                      onClick={() => onDifficulty(speed.key)}
                      aria-pressed={difficulty === speed.key}
                      title={speed.desc}
                    >
                      <b>{speed.name}</b>
                      <i>{speed.seconds}s</i>
                    </button>
                  ))}
                </div>
              </div>

              <div className="workshop-actions">
                <button className="workshop-primary pinch-host" onClick={() => launch(false)}>
                  <PinchMark />
                  <span>Bắt đầu bằng camera AR</span>
                  <i>↗</i>
                </button>
                <button className="workshop-secondary" onClick={() => launch(true)}>
                  Chơi bằng chuột
                  <span>DỰ PHÒNG</span>
                </button>
              </div>
            </div>
          </div>

          <div className="workshop-visual" aria-label="Minh họa đấu trường phân loại nhiệm vụ">
            <div className="workshop-morph-gate" aria-hidden="true">
              <span className="is-ring-one" />
              <span className="is-ring-two" />
              <i>AI</i>
              <b>KHO NHIỆM VỤ</b>
            </div>
            <div className="workshop-coach" aria-hidden="true">
              <img className="lux-image" src={BRAND_MASCOTS.explore} alt="" />
              <span>Đọc việc<br />Gọi tên nhóm<br />Rồi mới gắp</span>
            </div>
            <figure className="workshop-arena lux-card">
              <span className="lux-border" aria-hidden="true" />
              <img src="/assets/mission-arena-v2.png" alt="Không gian lớp học số với kho nhiệm vụ và sáu học liệu" />
              <span className="workshop-arena-shade" aria-hidden="true" />
              <figcaption>
                <b>06</b>
                <span>VIỆC AI HỖ TRỢ<br />ĐANG CHỜ ĐƯỢC KHÁM PHÁ</span>
              </figcaption>
            </figure>

          </div>
        </section>

        <footer className="workshop-footer">
          <span><b>01</b> Đọc công việc</span>
          <i />
          <span><b>02</b> Chụm để gắp</span>
          <i />
          <span><b>03</b> Thả vào kho nhiệm vụ</span>
          <em>Quý thầy cô quan sát và cùng gọi tên nhóm việc</em>
        </footer>
      </main>

      {briefingOpen && (
        <section
          ref={briefingDeckRef}
          className={`briefing-overlay briefing-deck ${briefingMorphPhase !== 'idle' ? 'is-morphing' : ''}`}
          data-step={briefingStep + 1}
          data-direction={briefingDirection}
          data-morph-phase={briefingMorphPhase}
          role="dialog"
          aria-modal="true"
          aria-labelledby="briefing-page-title"
          tabIndex={-1}
          onWheel={(event) => {
            if (Math.abs(event.deltaY) < 18) return;
            if (event.deltaY > 0) advanceBriefing();
            else goToBriefingStep(briefingStep - 1);
          }}
          onKeyDown={(event) => {
            if (['ArrowRight', 'ArrowDown', 'PageDown', 'Enter', ' '].includes(event.key)) {
              event.preventDefault();
              advanceBriefing();
            }
            if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
              event.preventDefault();
              goToBriefingStep(briefingStep - 1);
            }
          }}
        >
          <div className="briefing-backdrop" aria-hidden="true" />
          <span className="briefing-cursor-aura" aria-hidden="true"><i /></span>

          <div className="briefing-deck-shell" onClick={briefingStep < 2 ? advanceBriefing : undefined}>
            <span className="briefing-orbit briefing-orbit-a" aria-hidden="true" />
            <span className="briefing-orbit briefing-orbit-b" aria-hidden="true" />

            <header className="briefing-deck-header">
              <div className="briefing-brand">
                <img src={MANABIE_MARK} alt="" />
                <span>MANABIE AI LAB</span>
              </div>
              <div className="briefing-progress" aria-label={`Trang ${briefingStep + 1} trên 3`}>
                {[0, 1, 2].map((step) => (
                  <button
                    key={step}
                    type="button"
                    aria-label={`Mở trang ${step + 1}`}
                    aria-current={briefingStep === step ? 'step' : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      goToBriefingStep(step);
                    }}
                  >
                    <span>{String(step + 1).padStart(2, '0')}</span><i />
                  </button>
                ))}
              </div>
              <span className="briefing-step">MODULE 1 · PROMPT</span>
            </header>

            <main className="briefing-page-stage">
              {briefingStep === 0 && (
                <article className="briefing-page briefing-page-welcome" key="welcome">
                  <div className="briefing-page-visual" aria-hidden="true">
                    <span className="briefing-portal"><i /><i /><b>AI</b></span>
                    <img className="briefing-shared-mascot briefing-animated-mascot" src={BRAND_MASCOTS.presentAnimated} alt="" />
                    <p><b>Mana</b> chào đón quý thầy cô!</p>
                  </div>
                  <div className="briefing-page-copy">
                    <p className="briefing-kicker">CHÀO MỪNG QUÝ THẦY CÔ THAM GIA BUỔI TẬP HUẤN</p>
                    <h2 className="briefing-shared-title" id="briefing-page-title">Ứng dụng trí tuệ nhân tạo <em>vào công việc chuyên môn</em></h2>
                    <div className="briefing-module-card">
                      <span>MODULE 1</span>
                      <strong>Prompt và quy trình tạo tài liệu phục vụ hoạt động dạy học</strong>
                    </div>
                  </div>
                </article>
              )}

              {briefingStep === 1 && (
                <article className="briefing-page briefing-page-question" key="question">
                  <div className="briefing-question-mark" aria-hidden="true">
                    <span>?</span>
                    <img className="briefing-shared-mascot" src={BRAND_MASCOTS.inspect} alt="" />
                  </div>
                  <div className="briefing-question-copy">
                    <p className="briefing-kicker">CÂU HỎI KHỞI ĐỘNG</p>
                    <h2 className="briefing-shared-title" id="briefing-page-title">
                      Một công việc chuyên môn có <em>dấu hiệu gì</em> thì giao được cho trí tuệ nhân tạo?
                    </h2>
                    <div className="briefing-question-divider"><span>VÀ</span></div>
                    <p>
                      Có dấu hiệu gì thì <strong>người dạy phải giữ lại cho mình?</strong>
                    </p>
                  </div>
                </article>
              )}

              {briefingStep === 2 && (
                <article className="briefing-page briefing-page-howto" key="howto">
                  <div className="briefing-howto-heading">
                    <div>
                      <p className="briefing-kicker">HƯỚNG DẪN CHƠI</p>
                      <h2 className="briefing-shared-title" id="briefing-page-title">Ba động tác. <em>Một quyết định.</em></h2>
                    </div>
                    <img className="briefing-shared-mascot" src={BRAND_MASCOTS.action} alt="Mascot Manabie hướng dẫn bắt đầu nhiệm vụ" />
                  </div>
                  <div className="briefing-steps-stage">
                    <ol className="briefing-steps-large">
                      <li><b>01</b><span>Đọc công việc</span><small>Quan sát nội dung trên quả cầu</small></li>
                      <li className="briefing-step-grab"><b>02</b><span>Chụm tay để gắp</span><small>Hoặc giữ và kéo bằng chuột</small></li>
                      <li className="briefing-step-drop"><b>03</b><span>Thả vào kho nhiệm vụ</span><small>Khi AI có thể hỗ trợ công việc đó</small></li>
                    </ol>
                    <div className="briefing-transfer-demo" role="img" aria-label="Minh họa ngón cái và ngón trỏ gắp, kéo quả cầu từ trên xuống rồi thả vào kho nhiệm vụ">
                      <span className="briefing-transfer-start" aria-hidden="true"><i /> NHIỆM VỤ ĐANG RƠI</span>
                      <span className="briefing-transfer-route" aria-hidden="true"><i /></span>
                      <span className="briefing-transfer-caption" aria-hidden="true">CHỤM → KÉO XUỐNG → THẢ</span>
                      <video className="briefing-grab-animated" autoPlay loop muted playsInline preload="auto" poster="/assets/tutorial/grab-sequence/grab-tutorial.webp" aria-hidden="true">
                        <source src="/assets/tutorial/grab-sequence/grab-tutorial.webm" type="video/webm" />
                      </video>
                      <span className="briefing-drop-target" aria-hidden="true">
                        <img src="/assets/mission-collector-v1.png" alt="" />
                        <strong>KHO NHIỆM VỤ</strong>
                      </span>
                    </div>
                  </div>
                  <p className="briefing-objective"><span>ĐÍCH ĐẾN</span> Tìm đúng <b>06 công việc</b> AI có thể hỗ trợ quý thầy cô dựng bản nháp.</p>
                </article>
              )}
            </main>

            <footer className="briefing-deck-footer">
              <button
                className="briefing-back"
                type="button"
                disabled={briefingStep === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  goToBriefingStep(briefingStep - 1);
                }}
              >
                ← <span>Quay lại</span>
              </button>
              <div className="briefing-gesture-hint" aria-hidden="true">
                <i><b /></i>
                <span>{briefingStep < 2 ? 'Lăn chuột hoặc click để xem tiếp' : 'Sẵn sàng bước vào hoạt động'}</span>
              </div>
              {briefingStep < 2 ? (
                <button
                  className="briefing-next"
                  type="button"
                  aria-label="Tiếp tục"
                  onClick={(event) => {
                    event.stopPropagation();
                    advanceBriefing();
                  }}
                >
                  <span>Tiếp tục</span> →
                </button>
              ) : (
                <button
                  className="briefing-accept"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAcknowledgeBriefing();
                  }}
                >
                  <span>Bắt đầu nhiệm vụ</span><i>→</i>
                </button>
              )}
            </footer>
          </div>

          <div className="briefing-morph" aria-hidden="true">
            <span><i /><i /><b>AI</b></span>
            <strong>{briefingDirection === 'next' ? 'MỞ PHẦN TIẾP THEO' : 'QUAY LẠI PHẦN TRƯỚC'}</strong>
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Debrief({ state, onReplay }: { state: GameState; onReplay: () => void }) {
  const collectedIds = new Set(state.collected.map((task) => task.id));
  const missed = CORE_TASKS.filter((task) => !collectedIds.has(task.id));
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [morphTarget, setMorphTarget] = useState<string | null>('KẾT QUẢ → THÔNG ĐIỆP');

  useEffect(() => {
    const timer = window.setTimeout(() => setMorphTarget(null), 1180);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    const revealItems = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { root, threshold: 0.08, rootMargin: '0px 0px -4% 0px' },
    );

    revealItems.forEach((item) => observer.observe(item));
    const onScroll = () => setHasScrolled(root.scrollTop > 100);
    root.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      root.removeEventListener('scroll', onScroll);
    };
  }, []);

  const scrollToSection = (id: string) => {
    const root = scrollerRef.current;
    const section = root?.querySelector<HTMLElement>(`#${id}`);
    if (!root || !section) return;

    const morphLabels: Record<string, string> = {
      'debrief-role': 'AI HỖ TRỢ → QUÝ THẦY CÔ QUYẾT ĐỊNH',
      'debrief-close': 'CHỐT THÔNG ĐIỆP',
      'debrief-next': 'PHẦN 3 → THỰC HIỆN TRÊN CLASSROOM',
    };
    setMorphTarget(morphLabels[id] ?? 'TIẾP TỤC');
    window.setTimeout(() => setMorphTarget(null), 1180);

    // Compute the destination from the current viewport instead of relying on
    // offsetTop (the chapters live inside a nested scrolling story). This keeps
    // each chapter heading directly below the sticky header at every viewport.
    const destination = root.scrollTop
      + section.getBoundingClientRect().top
      - root.getBoundingClientRect().top
      - 70;
    root.scrollTo({ top: destination, behavior: 'smooth' });

    // Clicking a cue is an explicit "advance slide" action. Stage every beat in
    // the destination chapter after the smooth scroll starts, like successive
    // PowerPoint builds. IntersectionObserver remains the fallback for people
    // who scroll manually.
    const chapterBeats = Array.from(section.querySelectorAll<HTMLElement>('[data-reveal]'));
    chapterBeats.forEach((beat, index) => {
      window.setTimeout(() => beat.classList.add('is-visible'), 280 + index * 180);
    });
  };

  const replayVisibleMotion = () => {
    const root = scrollerRef.current;
    if (!root) return;
    setMorphTarget('XEM LẠI NHỊP TRÌNH CHIẾU');
    window.setTimeout(() => setMorphTarget(null), 1180);
    const chapters = Array.from(root.querySelectorAll<HTMLElement>('.debrief-chapter'));
    if (chapters.length === 0) return;
    const active = chapters.reduce((nearest, chapter) => {
      const chapterDistance = Math.abs(chapter.getBoundingClientRect().top - 76);
      const nearestDistance = Math.abs(nearest.getBoundingClientRect().top - 76);
      return chapterDistance < nearestDistance ? chapter : nearest;
    }, chapters[0]);

    const beats = Array.from(active.querySelectorAll<HTMLElement>('[data-reveal]'));
    beats.forEach((beat) => beat.classList.remove('is-visible'));
    void active.offsetWidth;
    beats.forEach((beat, index) => {
      window.setTimeout(() => beat.classList.add('is-visible'), 120 + index * 180);
    });
  };

  return (
    <div className="debrief-v3 force-motion" ref={scrollerRef}>
      <div className="debrief-atmosphere" aria-hidden="true" />
      {morphTarget && (
        <div className="debrief-morph-bridge" aria-hidden="true">
          <span />
          <b>{morphTarget}</b>
        </div>
      )}
      <header className="debrief-header">
          <div className="debrief-brand"><img className="manabie-brand-mark" src={MANABIE_MARK} alt="" /> TẬP HUẤN ỨNG DỤNG AI <i>MODULE 1 · PROMPT</i></div>
          <div className="debrief-header-tools">
            <button className="debrief-replay-motion" type="button" onClick={replayVisibleMotion}>
              <span>↻</span> XEM LẠI CHUYỂN ĐỘNG
            </button>
            <div className="debrief-stats" aria-label="Kết quả lượt chơi">
              <span><b>{state.collected.length}/6</b> việc phù hợp</span>
              <span><b>{state.wrongDrops}</b> lần thả nhầm</span>
              <span><b>{state.score}</b> điểm</span>
            </div>
          </div>
      </header>

      <main className="debrief-story">
        <section className="debrief-chapter debrief-result" id="debrief-result">
          <div className="debrief-result-copy">
            <p className={state.isWin ? 'debrief-kicker is-win' : 'debrief-kicker is-partial'}>
              CHỐT LẦN 1 · CĂN CỨ PHÂN LOẠI CÔNG VIỆC
            </p>

            <div className="debrief-missions" aria-label="Sáu việc AI có thể hỗ trợ dựng bản nháp">
              {CORE_TASKS.map((task, index) => (
                <article
                  className="lux-card"
                  key={task.id}
                  data-found={collectedIds.has(task.id)}
                  data-reveal
                  data-motion={index % 2 === 0 ? 'card-left' : 'card-right'}
                  style={{ transitionDelay: `${120 + index * 75}ms`, animationDelay: `${120 + index * 75}ms` }}
                >
                  <span className="lux-border" aria-hidden="true" />
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <span>{task.label}</span>
                  <i>{collectedIds.has(task.id) ? '✓' : '—'}</i>
                </article>
              ))}
            </div>

            <div
              className="debrief-result-sequence lux-card"
              data-reveal
              data-motion="result-kinetic"
              aria-label="Trong 180 phút sắp tới, quý thầy cô sẽ thực hành 06 việc vừa gắp được"
            >
              <span className="lux-border" aria-hidden="true" />
              <span className="result-beat result-beat-one" aria-hidden="true">QUÝ THẦY CÔ VỪA GẮP ĐÚNG 06 VIỆC</span>
              <span className="result-beat result-beat-two" aria-hidden="true">TRONG 180 PHÚT SẮP TỚI,<br />QUÝ THẦY CÔ SẼ THỰC HÀNH 06 VIỆC NÀY</span>
              <strong className="result-lock" aria-hidden="true">
                <b>TRONG 180 PHÚT SẮP TỚI</b>
                <span>QUÝ THẦY CÔ SẼ THỰC HÀNH 06 VIỆC VỪA GẮP ĐƯỢC</span>
              </strong>
            </div>

            {missed.length > 0 && (
              <p className="debrief-missed">Cần thử lại: <strong>{missed.map((task) => task.short).join(' · ')}</strong></p>
            )}
          </div>

          <aside className="debrief-result-mascot" data-reveal data-motion="mascot-pop">
            <span className="debrief-result-ring" aria-hidden="true" />
            <span className="debrief-confetti" aria-hidden="true">
              {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
            </span>
            <img className="lux-image" src={BRAND_MASCOTS.action} alt="Mascot Manabie thể hiện tinh thần hoàn thành nhiệm vụ" />
            <div><b>{state.collected.length}/6</b><span>VIỆC AI CÓ THỂ<br />HỖ TRỢ DỰNG BẢN NHÁP</span></div>
          </aside>

          <button
            className={`debrief-scroll-cue ${hasScrolled ? 'is-muted' : ''}`}
            onClick={() => scrollToSection('debrief-role')}
            aria-label="Cuộn xuống để xem tiêu chí phân loại"
          >
            <img className="debrief-scroll-mascot" src={BRAND_MASCOTS.scroll} alt="" aria-hidden="true" />
            <span>CUỘN XUỐNG ĐỂ ĐỌC PHẦN CHỐT</span>
            <i aria-hidden="true"><b /></i>
            <strong>↓</strong>
          </button>
        </section>

        <section className="debrief-chapter debrief-role" id="debrief-role">
          <header className="debrief-chapter-heading" data-reveal data-motion="title-wipe">
            <img className="lux-image" src={BRAND_MASCOTS.inspect} alt="Mascot Manabie dùng kính lúp để kiểm tra căn cứ phân loại" />
            <div>
              <span>PHẦN CHỐT 01 · CĂN CỨ PHÂN LOẠI CÔNG VIỆC</span>
              <h2>Ranh giới nằm ở <em>trách nhiệm về kết quả cuối cùng</em></h2>
              <p>Căn cứ nào để xếp một công việc vào nhóm giao được cho trí tuệ nhân tạo?</p>
            </div>
          </header>

          <div className="debrief-portraits" aria-label="Vai trò của trí tuệ nhân tạo và quý thầy cô">
            <figure className="is-ai lux-card" data-reveal data-motion="image-left">
              <span className="lux-border" aria-hidden="true" />
              <img src="/assets/debrief_ai_assistant_3d.png" alt="Trí tuệ nhân tạo hỗ trợ dựng bản nháp học liệu" />
              <figcaption><span>GIAO ĐƯỢC CHO TRÍ TUỆ NHÂN TẠO</span><strong>Sản phẩm là bản nháp bằng chữ</strong><p>Quý thầy cô cần đọc lại và quyết định bản cuối.</p></figcaption>
            </figure>
            <figure className="is-teacher lux-card" data-reveal data-motion="image-right" style={{ transitionDelay: '140ms' }}>
              <span className="lux-border" aria-hidden="true" />
              <img src="/assets/debrief_teacher_inspiring_3d.png" alt="Quý thầy cô trực tiếp dẫn dắt lớp học" />
              <figcaption><span>QUÝ THẦY CÔ GIỮ LẠI</span><strong>Việc cần hiện diện, cần thấu cảm</strong><p>Hoặc cần thao tác vật lí.</p></figcaption>
            </figure>
          </div>

          <button className="debrief-scroll-cue is-inline" onClick={() => scrollToSection('debrief-close')}>
            <img className="debrief-scroll-mascot" src={BRAND_MASCOTS.scroll} alt="" aria-hidden="true" />
            <span>CUỘN TIẾP ĐỂ NHẬN LỜI CHỐT</span><i aria-hidden="true"><b /></i><strong>↓</strong>
          </button>
        </section>

        <section className="debrief-chapter debrief-close" id="debrief-close">
          <div className="debrief-close-mascot" data-reveal data-motion="mascot-celebrate">
            <span aria-hidden="true" />
            <span className="debrief-confetti" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
            </span>
            <img className="lux-image" src={BRAND_MASCOTS.nurture} alt="Mascot Manabie chăm sóc mầm cây, biểu tượng cho trách nhiệm của quý thầy cô" />
          </div>

          <div className="debrief-close-copy">
            <p className="debrief-kicker is-win" data-reveal data-motion="fade-up">PHẦN CHỐT 02 · THÔNG ĐIỆP CẦN NHỚ</p>
            <div
              className="debrief-close-kinetic lux-card"
              data-reveal
              data-motion="close-kinetic"
              aria-label="Việc khó chưa chắc là việc quý thầy cô giữ lại. Ranh giới không nằm ở việc khó hay dễ. Ranh giới nằm ở chỗ ai chịu trách nhiệm về kết quả cuối cùng. Trí tuệ nhân tạo dựng bản nháp. Quý thầy cô quyết định bản cuối và cần chịu trách nhiệm về kết quả cuối cùng."
            >
              <span className="lux-border" aria-hidden="true" />
              <div className="close-beat close-beat-one" aria-hidden="true">
                VIỆC KHÓ CHƯA CHẮC LÀ<br /><strong>VIỆC QUÝ THẦY CÔ GIỮ LẠI</strong>
              </div>
              <div className="close-beat close-beat-two" aria-hidden="true">
                RANH GIỚI KHÔNG NẰM Ở VIỆC<br /><strong><i>KHÓ</i> HAY <i>DỄ</i></strong>
              </div>
              <div className="close-beat close-beat-three" aria-hidden="true">
                AI CHỊU TRÁCH NHIỆM VỀ<br /><strong>KẾT QUẢ CUỐI CÙNG?</strong>
              </div>
              <div className="close-beat close-beat-four" aria-hidden="true">
                <strong>TRÍ TUỆ NHÂN TẠO DỰNG BẢN NHÁP</strong>
                <i>→</i>
                <b>QUÝ THẦY CÔ QUYẾT ĐỊNH BẢN CUỐI</b>
              </div>
              <blockquote className="debrief-quote close-lock">
                <span>LỜI CHỐT CỦA BÁO CÁO VIÊN</span>
                <p>“Ranh giới nằm ở chỗ ai chịu trách nhiệm về kết quả cuối cùng.”</p>
                <div className="close-lock-points">
                  <strong className="is-ai">Trí tuệ nhân tạo dựng bản nháp.</strong>
                  <strong className="is-teacher">Quý thầy cô quyết định bản cuối.</strong>
                  <strong className="is-responsibility">Quý thầy cô cần chịu trách nhiệm về kết quả cuối cùng.</strong>
                </div>
              </blockquote>
            </div>

          </div>

          <button className="debrief-scroll-cue is-inline" onClick={() => scrollToSection('debrief-next')}>
            <img className="debrief-scroll-mascot" src={BRAND_MASCOTS.scroll} alt="" aria-hidden="true" />
            <span>TIẾP TỤC ĐẾN PHẦN 3</span><i aria-hidden="true"><b /></i><strong>↓</strong>
          </button>
        </section>

        <section className="debrief-chapter debrief-next-chapter" id="debrief-next">
          <div className="debrief-next-heading" data-reveal data-motion="title-wipe">
            <div className="debrief-next-number" aria-hidden="true"><span>03</span><i /></div>
            <div>
              <span>PHẦN 3 · THỰC HIỆN NHIỆM VỤ TIẾP THEO</span>
              <h2>Mở Phiếu học tập số 1<br /><em>trên Google Classroom</em></h2>
              <p>Hoàn thành câu hỏi sau phần chốt và nộp phiếu trước khi chuyển sang Hoạt động 2.</p>
            </div>
          </div>

          <div className="debrief-next-workspace">
            <aside className="debrief-next-visual lux-card" data-reveal data-motion="mascot-pop">
              <span className="lux-border" aria-hidden="true" />
              <span className="debrief-next-orbit" aria-hidden="true"><i /><i /><i /></span>
              <img className="lux-image" src={BRAND_MASCOTS.submit} alt="Mascot Manabie hướng dẫn hoàn thành và nộp Phiếu học tập số 1" />
              <div>
                <span>ĐÍCH ĐẾN</span>
                <strong>Ghi câu trả lời và nộp Phiếu học tập số 1</strong>
              </div>
            </aside>

            <article className="debrief-next-panel lux-card" data-reveal data-motion="rise-card">
              <span className="lux-border" aria-hidden="true" />
              <div className="debrief-next-question">
                <span>CÂU HỎI 1</span>
                <strong>Căn cứ nào để xếp một công việc vào nhóm giao được cho trí tuệ nhân tạo?</strong>
                <p>Ghi câu trả lời theo suy nghĩ của quý thầy cô, sau đó đối chiếu với phần chốt của báo cáo viên.</p>
              </div>

              <ol className="debrief-next-steps" aria-label="Thứ tự thao tác ở phần 1.2">
                <li className="lux-card"><span className="lux-border" aria-hidden="true" /><b>01</b><strong>Mở mục 1.2</strong><small>Trên Google Classroom</small></li>
                <li className="lux-card"><span className="lux-border" aria-hidden="true" /><b>02</b><strong>Mở Phiếu học tập số 1</strong><small>Đọc lại yêu cầu</small></li>
                <li className="lux-card"><span className="lux-border" aria-hidden="true" /><b>03</b><strong>Ghi câu trả lời</strong><small>Theo suy nghĩ của quý thầy cô</small></li>
                <li className="lux-card"><span className="lux-border" aria-hidden="true" /><b>04</b><strong>Nộp bài</strong><small>Hoàn tất phần 1.2</small></li>
              </ol>

              <footer className="debrief-next-actions">
                <div><span>TRÌNH TỰ</span><strong>Mở mục 1.2 → Trả lời → Nộp bài</strong></div>
                <button onClick={onReplay}><span>↻</span> Chơi lại</button>
              </footer>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
