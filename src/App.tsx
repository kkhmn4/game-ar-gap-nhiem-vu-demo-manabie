import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game } from './components/Game';
import { audio } from './utils/audio';
import { CORE_TASKS, Difficulty, GameState, NOISE_TASKS, TaskDef } from './utils/engine';
import { DEBRIEF_LINE } from './data/tasks';

type Screen = 'intro' | 'playing' | 'debrief';

const SPEEDS: { key: Difficulty; name: string; seconds: number }[] = [
  { key: 'easy', name: 'Thong thả', seconds: 120 },
  { key: 'normal', name: 'Chuẩn', seconds: 90 },
  { key: 'hard', name: 'Nhanh', seconds: 70 },
];

const STEPS = [
  'Đưa bàn tay vào khung hình cho tới khi thấy vòng tròn trắng.',
  'Chụm ngón cái với ngón trỏ ngay trên quả cầu để gắp.',
  'Giữ nguyên tay chụm, kéo quả cầu xuống giỏ ở đáy màn hình.',
  'Mở tay ra để thả quả vào giỏ.',
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
            onQuit={() => { audio.stopMusic(); setScreen('intro'); }}
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
            className={`slot ${size === 'lg' ? 'h-14 px-4 text-sm' : 'h-9 px-2.5 text-[11px]'}`}
            data-filled={filled}
            data-just-filled={justFilledId === task.id}
            title={task.label}
          >
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
/* Bảng điểm — đọc được từ cuối phòng                                  */
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
        <div className={`hud-clock ${low ? 'is-low' : ''}`}><span>THỜI GIAN</span><b>{state.timeLeftSec}</b><i>s</i></div>
        <div className="hud-number"><span>ĐIỂM</span><b>{state.score}</b></div>
        <div className="hud-number hud-combo-mini"><span>COMBO</span><b>×{state.multiplier}</b></div>

        <div className="hud-objective-zone">
          <span className="hud-zone-label">THU THẬP {state.collected.length}/6</span>
          <div className="hud-objectives">
            {CORE_TASKS.map((task, index) => {
              const filled = state.collected.some((item) => item.id === task.id);
              return <div key={task.id} title={task.label} className={filled ? 'is-filled' : ''} data-just-filled={justFilled === task.id}><b>{index + 1}</b><span>{task.short}</span></div>;
            })}
          </div>
        </div>

        <div className="hud-signal" data-live={state.handsVisible > 0}><i />{state.handsVisible > 0 ? `${state.handsVisible} TAY` : 'TÌM TAY'}</div>
        <button className="hud-icon-button" onClick={onToggleMute} title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'} aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}>{muted ? '◌' : '◉'}</button>
        <button className="hud-icon-button is-exit" onClick={onQuit} title="Thoát" aria-label="Thoát">×</button>
      </div>
      <div className={`event-strip phase-${state.phase.toLowerCase()}`}>
        <span>{state.phase}</span>
        <strong>{state.eventText}</strong>
        <i>{state.powerReady ? 'AI FLOW +3 GIÂY' : `CHUỖI ${state.streak}`}</i>
      </div>
    </header>
  );
}

function Readout({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'mint' | 'alert';
}) {
  const color = tone === 'alert' ? 'var(--ember)' : tone === 'mint' ? 'var(--mint)' : 'var(--chalk)';
  return (
    <div>
      <p className="t-eyebrow mb-0.5 text-[var(--dim)]">{label}</p>
      <p className="t-data leading-none" style={{ color, fontSize: 'clamp(1.9rem, 3.4vw, 2.9rem)' }}>
        {value}
        {unit && <span className="ml-0.5 text-[0.45em] opacity-60">{unit}</span>}
      </p>
    </div>
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
      <div className="launch-wipe" aria-hidden="true"><span>ĐỒNG BỘ ĐẤU TRƯỜNG</span></div>
      <div className="intro-art" aria-hidden="true" />
      <div className="intro-grid" aria-hidden="true" />
      <div className="intro-atmosphere" aria-hidden="true">
        <span className="intro-orb orb-a" /><span className="intro-orb orb-b" /><span className="intro-orb orb-c" />
        <span className="scan-beam" />
      </div>
      <main className="launch-screen relative z-10 mx-auto min-h-full w-full max-w-[1500px] px-[var(--gap)] py-6">
        <nav className="launch-nav rise">
          <div className="launch-brand"><PinchMark live /><span>MANABIE LAB</span></div>
          <div className="launch-status"><i /> CAMERA AR SẴN SÀNG</div>
          <div className="launch-code">MISSION / 01</div>
        </nav>

        <section className="launch-hero">
          <div className="launch-copy rise">
            <p className="launch-kicker">TRÒ CHƠI PHÂN LOẠI NHIỆM VỤ AI</p>
            <h1>Một cử chỉ.<br/><em>Sáu quyết định.</em></h1>
            <p className="launch-lead">Đọc tình huống. Gắp việc có thể giao cho AI. Để những việc cần con người tiếp tục rơi.</p>

            <div className="launch-metrics">
              <div><b>06</b><span>MỤC TIÊU</span></div><div><b>×4</b><span>COMBO TỐI ĐA</span></div><div><b>+3s</b><span>AI FLOW</span></div>
            </div>

            <div className="launch-difficulty">
              <span>CHỌN NHỊP</span>
              {SPEEDS.map((s) => <button key={s.key} onClick={() => onDifficulty(s.key)} aria-pressed={difficulty === s.key}>{s.name}<small>{s.seconds}s</small></button>)}
            </div>

            <div className="launch-actions">
              <button onClick={() => launch(false)} className="launch-primary"><PinchMark /><span>Vào đấu trường</span><b>CAMERA →</b></button>
              <button onClick={() => launch(true)} className="launch-secondary">Chơi thử bằng chuột</button>
            </div>
          </div>

          <div className="mission-reactor rise" aria-label="Mô phỏng cổng nhiệm vụ">
            <div className="reactor-halo halo-one"/><div className="reactor-halo halo-two"/><div className="reactor-scan"/>
            <div className="mission-tile tile-a"/><div className="mission-tile tile-b"/><div className="mission-tile tile-c"/><div className="mission-tile tile-d"/>
            <div className="reactor-core"><span>CHẾ ĐỘ</span><strong>AI FLOW</strong><i>ĐANG CHỜ</i></div>
            <div className="reactor-platform"><span/><span/><span/></div>
            <p>GẮP · ĐỌC · QUYẾT ĐỊNH</p>
          </div>
        </section>

        <footer className="launch-steps rise">
          <span><b>01</b> Đưa tay vào khung</span><i/><span><b>02</b> Chụm ngón để gắp</span><i/><span><b>03</b> Thả vào cổng</span>
        </footer>
      </main>

      <div className="hidden relative z-10 mx-auto w-full max-w-7xl px-[var(--gap)] py-[clamp(2rem,5vh,4rem)]">
        <div className="rise" style={{ animationDelay: '0ms' }}>
          <p className="t-eyebrow flex items-center gap-3 text-[var(--mint)]">
            <PinchMark live />
            Hoạt động khởi động · GẮP VIỆC – GIAO AI
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="mission-chip">● Camera AR</span>
            <span className="mission-chip">6 mục tiêu</span>
            <span className="mission-chip">Combo ×4</span>
          </div>
          <h1 className="t-hero mt-5 max-w-3xl text-[var(--chalk)]">
            Gắp đúng.
            <br />
            Mở khóa AI.
          </h1>
          <p className="t-lead mt-5 max-w-2xl text-[var(--dim)]">
            Quả cầu công việc rơi xuống. Gắp{' '}
            <strong className="font-extrabold text-[var(--chalk)]">sáu việc AI làm được</strong> bỏ vào giỏ. Để những
            việc cần mặt người rơi qua.
          </p>
        </div>

        <div className="mission-brief rise mt-8" style={{ animationDelay: '60ms' }}>
          <span className="mission-index">NHIỆM VỤ 01</span>
          <div><strong>Phân loại công việc giáo viên</strong><p>Thu đủ sáu lõi nhiệm vụ trước khi thời gian chạm 0.</p></div>
          <div className="mission-reward"><span>PHẦN THƯỞNG</span><b>+1.200 XP</b></div>
        </div>

        <div className="rule mt-9 mb-9" />

        <div className="grid gap-4 lg:grid-cols-2">
          <TrayCard
            tone="brand"
            eyebrow="Có thể giao AI"
            title="Gắp vào giỏ"
            note="Đều là việc tạo ra một sản phẩm giấy tờ."
            items={CORE_TASKS}
            delay={80}
          />
          <TrayCard
            tone="ember"
            eyebrow="Cần con người"
            title="Để rơi qua"
            note="Đều là việc cần mặt người, hoặc việc vặt."
            items={NOISE_TASKS.slice(0, 6)}
            delay={160}
          />
        </div>

        <div className="rise mt-9" style={{ animationDelay: '240ms' }}>
          <p className="t-eyebrow mb-4 text-[var(--dim)]">Bốn bước</p>
          <ol className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step} className="border-t border-[var(--edge)] pt-3">
                <span className="t-data block text-2xl text-[var(--mint)]">{i + 1}</span>
                <p className="mt-1.5 text-sm leading-6 text-[var(--dim)]">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="rise mt-10 flex flex-col gap-5" style={{ animationDelay: '320ms' }}>
          <div>
            <p className="t-eyebrow mb-2.5 text-[var(--dim)]">Tốc độ</p>
            <div className="flex flex-wrap gap-2">
              {SPEEDS.map((s) => {
                const on = difficulty === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => onDifficulty(s.key)}
                    aria-pressed={on}
                    className="rounded-lg border px-4 py-2.5 text-left transition"
                    style={{
                      borderColor: on ? 'var(--mint)' : 'var(--edge)',
                      background: on ? 'color-mix(in oklab, var(--mint) 14%, transparent)' : 'transparent',
                    }}
                  >
                    <span className="block text-sm font-semibold" style={{ color: on ? 'var(--chalk)' : 'var(--dim)' }}>
                      {s.name}
                    </span>
                    <span className="t-data block text-xs" style={{ color: on ? 'var(--mint)' : 'var(--dim)' }}>
                      {s.seconds}s
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => launch(false)}
              className="pinch-host group flex flex-1 items-center justify-center gap-4 rounded-xl px-8 py-6 transition hover:brightness-110"
              style={{ background: 'var(--mint)', color: '#032117' }}
            >
              <PinchMark />
              <span className="t-title text-[1.6rem]">Chơi bằng tay</span>
            </button>
            <button
              onClick={() => launch(true)}
              className="rounded-xl border border-[var(--edge)] px-8 py-6 text-base font-semibold text-[var(--dim)] transition hover:border-[var(--chalk)] hover:text-[var(--chalk)]"
            >
              Chơi bằng chuột
            </button>
          </div>

          <p className="max-w-2xl text-sm leading-6 text-[var(--dim)]">
            Chế độ chuột là đường lùi khi phòng không có camera. Chạy thử một lượt trước khi trình bày để chắc chắn
            máy chiếu hiển thị đúng.
          </p>
        </div>
      </div>
    </div>
  );
}

function TrayCard({
  tone,
  eyebrow,
  title,
  note,
  items,
  delay,
}: {
  tone: 'brand' | 'ember';
  eyebrow: string;
  title: string;
  note: string;
  items: TaskDef[];
  delay: number;
}) {
  const color = tone === 'brand' ? 'var(--brand)' : 'var(--ember)';
  return (
    <section
      className="rise rounded-xl border p-6"
      style={{
        animationDelay: `${delay}ms`,
        borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
        background: `color-mix(in oklab, ${color} 9%, transparent)`,
      }}
    >
      <p className="t-eyebrow" style={{ color }}>
        {eyebrow}
      </p>
      <h2 className="t-title mt-1.5 text-[1.7rem] text-[var(--chalk)]">{title}</h2>
      <p className="mt-1.5 text-sm text-[var(--dim)]">{note}</p>
      <ul className="mt-4 space-y-1.5">
        {items.map((t) => (
          <li key={t.id} className="flex items-baseline gap-2.5 text-[0.95rem] text-[var(--chalk)]/85">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
            {t.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Màn tổng kết — người dẫn đọc to phần câu chốt                       */
/* ------------------------------------------------------------------ */

function Debrief({ state, onReplay }: { state: GameState; onReplay: () => void }) {
  const missed = useMemo(
    () => CORE_TASKS.filter((t) => !state.collected.some((c) => c.id === t.id)),
    [state.collected],
  );
  const xp = Math.max(0, state.score + state.bestStreak * 80 - state.wrongDrops * 40);
  const rank = xp >= 1400 ? 'Bậc thầy quy trình' : xp >= 800 ? 'Kiến trúc sư prompt' : 'Tân binh AI';

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-[var(--gap)] py-[clamp(2rem,5vh,4rem)]">
        <div className="rise">
          <p className="t-eyebrow flex items-center gap-3" style={{ color: state.isWin ? 'var(--mint)' : 'var(--ember)' }}>
            <PinchMark />
            {state.isWin ? 'Đủ sáu nhiệm vụ' : 'Hết giờ'}
          </p>
          <h1 className="t-hero mt-3 text-[var(--chalk)]">
            {state.isWin ? 'Giỏ đã đầy' : `Được ${state.collected.length}/6`}
          </h1>
        </div>

        <div className="rise mt-8" style={{ animationDelay: '80ms' }}>
          <SlotRow collected={state.collected} size="lg" />
        </div>

        <div className="rise mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: '140ms' }}>
          <Stat label="Điểm" value={state.score} />
          <Stat label="Chuỗi dài nhất" value={state.bestStreak} />
          <Stat label="Thả nhầm" value={state.wrongDrops} warn={state.wrongDrops > 0} />
          <Stat label="Để rơi mất" value={state.missedCore} warn={state.missedCore > 0} />
        </div>

        <div className="rank-card rise mt-5" style={{ animationDelay: '180ms' }}>
          <div><span>CẤP ĐỘ MỚI</span><strong>{rank}</strong></div>
          <div className="rank-xp"><b>{xp}</b><span> XP</span></div>
        </div>

        {missed.length > 0 && (
          <p className="rise mt-5 text-sm text-[var(--dim)]" style={{ animationDelay: '180ms' }}>
            Chưa gắp được: {missed.map((t) => t.label).join(' · ')}
          </p>
        )}

        <section
          className="rise mt-10 rounded-xl border p-7"
          style={{
            animationDelay: '220ms',
            borderColor: 'color-mix(in oklab, var(--mint) 45%, transparent)',
            background: 'color-mix(in oklab, var(--mint) 9%, transparent)',
          }}
        >
          <p className="t-eyebrow text-[var(--mint)]">Người dẫn đọc to</p>
          <p className="mt-4 text-[clamp(1.2rem,2.3vw,1.9rem)] font-semibold leading-[1.5] text-[var(--chalk)]">
            {DEBRIEF_LINE}
          </p>
          <div className="rule my-6" />
          <p className="t-eyebrow mb-3 text-[var(--dim)]">Câu hỏi chuyển tiếp</p>
          <p className="text-[clamp(1.1rem,2vw,1.6rem)] font-semibold leading-[1.5] text-[var(--mint)]">
            Sáu việc này, mỗi tuần thầy cô làm bao nhiêu lần? Làm sao để làm nhanh nhất mà vẫn chính xác nhất?
          </p>
        </section>

        <button
          onClick={onReplay}
          className="pinch-host mt-8 flex items-center gap-3 rounded-xl border border-[var(--edge)] px-7 py-4 font-semibold text-[var(--dim)] transition hover:border-[var(--chalk)] hover:text-[var(--chalk)]"
        >
          <PinchMark />
          Chơi lại
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="border-t border-[var(--edge)] pt-3">
      <p className="t-eyebrow text-[var(--dim)]">{label}</p>
      <p
        className="t-data mt-1 text-[clamp(1.7rem,3vw,2.4rem)] leading-none"
        style={{ color: warn ? 'var(--ember)' : 'var(--chalk)' }}
      >
        {value}
      </p>
    </div>
  );
}
