import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [state, setState] = useState<GameState>(EMPTY);
  const [final, setFinal] = useState<GameState>(qaDebrief ? QA_DEBRIEF : EMPTY);
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
    <div className={`workshop-stage ${launching ? 'is-launching' : ''}`}>
      <div className="launch-wipe" aria-hidden="true">
        <span>KHỞI ĐỘNG HOẠT ĐỘNG 1</span>
      </div>

      <div className="workshop-atmosphere" aria-hidden="true">
        <span className="workshop-grid" />
        <span className="workshop-scanline" />
        <span className="workshop-glow workshop-glow-a" />
        <span className="workshop-glow workshop-glow-b" />
      </div>

      <main className="workshop-shell">
        <header className="workshop-header">
          <div className="workshop-brand">
            <PinchMark live />
            <span>THCS ĐỒNG KHỞI</span>
            <i>AI LEARNING LAB</i>
          </div>
          <div className="workshop-status"><b /> SẴN SÀNG TRẢI NGHIỆM</div>
          <div className="workshop-code">TẬP HUẤN 10/8 · HĐ 01/03</div>
        </header>

        <section className="workshop-hero">
          <div className="workshop-copy">
            <p className="workshop-kicker"><span>HOẠT ĐỘNG KHỞI ĐỘNG</span> · 20 PHÚT</p>
            <h1 className="workshop-title">
              <span>GẮP VIỆC</span>
              <span className="is-accent">GIAO AI</span>
            </h1>
            <p className="workshop-lead">
              Phân loại 12 công việc để tìm đúng 6 việc trí tuệ nhân tạo có thể hỗ trợ nhà giáo dựng bản nháp.
            </p>

            <div className="workshop-rule" aria-label="Quy tắc phân loại">
              <article className="is-ai">
                <span>GẮP VÀO CỔNG AI</span>
                <strong>Kết quả là bản nháp số</strong>
              </article>
              <i aria-hidden="true">/</i>
              <article className="is-teacher">
                <span>GIỮ LẠI CHO NHÀ GIÁO</span>
                <strong>Cần hiện diện, thấu cảm hoặc thao tác vật lí</strong>
              </article>
            </div>

            <div className="workshop-settings">
              <div className="workshop-speed">
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
            <figure className="workshop-arena">
              <img src="/assets/mission-arena-v2.png" alt="Không gian lớp học số với cổng nhiệm vụ và sáu học liệu" />
              <span className="workshop-arena-shade" aria-hidden="true" />
              <figcaption>
                <b>06</b>
                <span>VIỆC AI HỖ TRỢ<br />ĐANG CHỜ ĐƯỢC KHÁM PHÁ</span>
              </figcaption>
            </figure>

            <div className="workshop-missions" aria-label="Sáu sản phẩm sẽ được khám phá">
              {CORE_TASKS.map((task, index) => {
                const icon = task.iconIndex ?? index;
                return (
                  <div className="workshop-mission" key={task.id}>
                    <span
                      className="workshop-mission-icon"
                      style={{ backgroundPosition: `${(icon % 4) * 33.333}% ${Math.floor(icon / 4) * 33.333}%` }}
                      aria-hidden="true"
                    />
                    <b>{String(index + 1).padStart(2, '0')}</b>
                    <span>{task.short}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <footer className="workshop-footer">
          <span><b>01</b> Đọc công việc</span>
          <i />
          <span><b>02</b> Chụm để gắp</span>
          <i />
          <span><b>03</b> Thả đúng cổng AI</span>
          <em>Nhà giáo quan sát và cùng gọi tên nhóm việc</em>
        </footer>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Debrief({ state, onReplay }: { state: GameState; onReplay: () => void }) {
  const collectedIds = new Set(state.collected.map((task) => task.id));
  const missed = CORE_TASKS.filter((task) => !collectedIds.has(task.id));

  return (
    <div className="debrief-v2">
      <div className="debrief-atmosphere" aria-hidden="true" />
      <main className="debrief-shell">
        <header className="debrief-header">
          <div className="debrief-brand"><PinchMark live={state.isWin} /> THCS ĐỒNG KHỞI · AI LEARNING LAB</div>
          <div className="debrief-stats" aria-label="Kết quả lượt chơi">
            <span><b>{state.collected.length}/6</b> việc phù hợp</span>
            <span><b>{state.wrongDrops}</b> lần thả nhầm</span>
            <span><b>{state.score}</b> điểm</span>
          </div>
        </header>

        <section className="debrief-hero">
          <div className="debrief-copy">
            <p className={state.isWin ? 'debrief-kicker is-win' : 'debrief-kicker is-partial'}>
              {state.isWin ? 'ĐÃ PHÂN LOẠI ĐỦ 12 CÔNG VIỆC' : `ĐÃ TÌM ĐƯỢC ${state.collected.length}/6 VIỆC PHÙ HỢP`}
            </p>
            <h1>AI DỰNG BẢN NHÁP.<br /><span>NHÀ GIÁO QUYẾT ĐỊNH BẢN CUỐI.</span></h1>
            <p className="debrief-lead">06 việc vừa gắp chính là 06 sản phẩm sẽ thực hành đồng bộ trong Hoạt động 2.</p>

            <div className="debrief-missions" aria-label="Sáu việc AI có thể hỗ trợ dựng bản nháp">
              {CORE_TASKS.map((task, index) => (
                <article key={task.id} data-found={collectedIds.has(task.id)}>
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <span>{task.label}</span>
                  <i>{collectedIds.has(task.id) ? '✓' : '—'}</i>
                </article>
              ))}
            </div>

            {missed.length > 0 && (
              <p className="debrief-missed">Cần thử lại: <strong>{missed.map((task) => task.short).join(' · ')}</strong></p>
            )}
          </div>

          <div className="debrief-portraits" aria-label="Vai trò của trí tuệ nhân tạo và nhà giáo">
            <figure className="is-ai">
              <img src="/assets/debrief_ai_assistant_3d.png" alt="Trí tuệ nhân tạo hỗ trợ dựng bản nháp học liệu" />
              <figcaption><span>TRÍ TUỆ NHÂN TẠO</span><strong>Dựng bản nháp bằng chữ và hình</strong></figcaption>
            </figure>
            <figure className="is-teacher">
              <img src="/assets/debrief_teacher_inspiring_3d.png" alt="Nhà giáo trực tiếp dẫn dắt lớp học" />
              <figcaption><span>NHÀ GIÁO</span><strong>Kiểm tra, điều chỉnh và chịu trách nhiệm</strong></figcaption>
            </figure>
          </div>
        </section>

        <section className="debrief-boundary" aria-label="Ranh giới phân loại">
          <article className="is-ai"><span>GIAO AI HỖ TRỢ</span><strong>Sản phẩm là bản nháp số có thể kiểm tra và chỉnh sửa</strong></article>
          <i>≠</i>
          <article className="is-teacher"><span>NHÀ GIÁO GIỮ LẠI</span><strong>Việc cần hiện diện, thấu cảm hoặc thao tác vật lí</strong></article>
        </section>

        <blockquote className="debrief-quote">
          <span>LỜI CHỐT CỦA BÁO CÁO VIÊN</span>
          <p>“Ranh giới không nằm ở việc khó hay dễ. Ranh giới nằm ở chỗ ai chịu trách nhiệm về kết quả cuối cùng. Trí tuệ nhân tạo dựng bản nháp, nhà giáo quyết định bản cuối.”</p>
        </blockquote>

        <footer className="debrief-next">
          <div><span>TIẾP THEO · PHIẾU HỌC TẬP SỐ 1</span><strong>Trả lời Câu hỏi 1: Nêu tiêu chí phân loại hai nhóm việc.</strong></div>
          <button onClick={onReplay}><span>↻</span> Chơi lại</button>
        </footer>
      </main>
    </div>
  );
}
