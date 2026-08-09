import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [motionCycle, setMotionCycle] = useState(0);

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
            <span>THCS ĐỒNG KHỞI</span>
            <i>MANABIE AI LAB</i>
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
            <div className="workshop-morph-gate" aria-hidden="true">
              <span className="is-ring-one" />
              <span className="is-ring-two" />
              <i>AI</i>
              <b>CỔNG HỌC LIỆU</b>
            </div>
            <div className="workshop-coach" aria-hidden="true">
              <img src={BRAND_MASCOTS.explore} alt="" />
              <span>Đọc việc<br />Gọi tên nhóm<br />Rồi mới gắp</span>
            </div>
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

    setMorphTarget(id === 'debrief-role' ? 'AI HỖ TRỢ → NHÀ GIÁO QUYẾT ĐỊNH' : 'CHỐT THÔNG ĐIỆP');
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
          <div className="debrief-brand"><img className="manabie-brand-mark" src={MANABIE_MARK} alt="" /> THCS ĐỒNG KHỞI <i>MANABIE AI LAB</i></div>
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
                  key={task.id}
                  data-found={collectedIds.has(task.id)}
                  data-reveal
                  data-motion={index % 2 === 0 ? 'card-left' : 'card-right'}
                  style={{ transitionDelay: `${120 + index * 75}ms`, animationDelay: `${120 + index * 75}ms` }}
                >
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <span>{task.label}</span>
                  <i>{collectedIds.has(task.id) ? '✓' : '—'}</i>
                </article>
              ))}
            </div>

            <div
              className="debrief-result-sequence"
              data-reveal
              data-motion="result-kinetic"
              aria-label="06 việc vừa gắp được chính là 06 việc của 180 phút sắp tới"
            >
              <span className="result-beat result-beat-one" aria-hidden="true">06 VIỆC VỪA GẮP ĐƯỢC</span>
              <span className="result-beat result-beat-two" aria-hidden="true">CHÍNH LÀ 06 VIỆC CỦA 180 PHÚT SẮP TỚI</span>
              <strong className="result-lock" aria-hidden="true">
                <b>06 VIỆC VỪA GẮP ĐƯỢC</b><i>·</i><span>180 PHÚT SẮP TỚI</span>
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
            <img src={BRAND_MASCOTS.action} alt="Mascot Manabie thể hiện tinh thần hoàn thành nhiệm vụ" />
            <div><b>{state.collected.length}/6</b><span>VIỆC AI CÓ THỂ<br />HỖ TRỢ DỰNG BẢN NHÁP</span></div>
          </aside>

          <button
            className={`debrief-scroll-cue ${hasScrolled ? 'is-muted' : ''}`}
            onClick={() => scrollToSection('debrief-role')}
            aria-label="Cuộn xuống để xem tiêu chí phân loại"
          >
            <span>CUỘN XUỐNG ĐỂ ĐỌC PHẦN CHỐT</span>
            <i aria-hidden="true"><b /></i>
            <strong>↓</strong>
          </button>
        </section>

        <section className="debrief-chapter debrief-role" id="debrief-role">
          <header className="debrief-chapter-heading" data-reveal data-motion="title-wipe">
            <img src={BRAND_MASCOTS.inspect} alt="Mascot Manabie dùng kính lúp để kiểm tra căn cứ phân loại" />
            <div>
              <span>PHẦN CHỐT 01 · CĂN CỨ PHÂN LOẠI CÔNG VIỆC</span>
              <h2>Ranh giới nằm ở <em>trách nhiệm về kết quả cuối cùng</em></h2>
              <p>Căn cứ nào để xếp một công việc vào nhóm giao được cho trí tuệ nhân tạo?</p>
            </div>
          </header>

          <div className="debrief-portraits" aria-label="Vai trò của trí tuệ nhân tạo và nhà giáo">
            <figure className="is-ai" data-reveal data-motion="image-left">
              <img src="/assets/debrief_ai_assistant_3d.png" alt="Trí tuệ nhân tạo hỗ trợ dựng bản nháp học liệu" />
              <figcaption><span>GIAO ĐƯỢC CHO TRÍ TUỆ NHÂN TẠO</span><strong>Sản phẩm là bản nháp bằng chữ</strong><p>Nhà giáo cần đọc lại và quyết định bản cuối.</p></figcaption>
            </figure>
            <figure className="is-teacher" data-reveal data-motion="image-right" style={{ transitionDelay: '140ms' }}>
              <img src="/assets/debrief_teacher_inspiring_3d.png" alt="Nhà giáo trực tiếp dẫn dắt lớp học" />
              <figcaption><span>NHÀ GIÁO GIỮ LẠI</span><strong>Việc cần hiện diện, cần thấu cảm</strong><p>Hoặc cần thao tác vật lí.</p></figcaption>
            </figure>
          </div>

          <button className="debrief-scroll-cue is-inline" onClick={() => scrollToSection('debrief-close')}>
            <span>CUỘN TIẾP ĐỂ NHẬN LỜI CHỐT</span><i aria-hidden="true"><b /></i><strong>↓</strong>
          </button>
        </section>

        <section className="debrief-chapter debrief-close" id="debrief-close">
          <div className="debrief-close-mascot" data-reveal data-motion="mascot-celebrate">
            <span aria-hidden="true" />
            <span className="debrief-confetti" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
            </span>
            <img src={BRAND_MASCOTS.nurture} alt="Mascot Manabie chăm sóc mầm cây, biểu tượng cho trách nhiệm của nhà giáo" />
          </div>

          <div className="debrief-close-copy">
            <p className="debrief-kicker is-win" data-reveal data-motion="fade-up">PHẦN CHỐT 02 · THÔNG ĐIỆP CẦN NHỚ</p>
            <div
              className="debrief-close-kinetic"
              data-reveal
              data-motion="close-kinetic"
              aria-label="Việc khó chưa chắc là việc nhà giáo giữ lại. Ranh giới không nằm ở việc khó hay dễ. Ranh giới nằm ở chỗ ai chịu trách nhiệm về kết quả cuối cùng. Trí tuệ nhân tạo dựng bản nháp. Nhà giáo quyết định bản cuối."
            >
              <div className="close-beat close-beat-one" aria-hidden="true">
                VIỆC KHÓ CHƯA CHẮC LÀ<br /><strong>VIỆC NHÀ GIÁO GIỮ LẠI</strong>
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
                <b>NHÀ GIÁO QUYẾT ĐỊNH BẢN CUỐI</b>
              </div>
              <blockquote className="debrief-quote close-lock">
                <span>LỜI CHỐT CỦA BÁO CÁO VIÊN</span>
                <p>“Ranh giới nằm ở chỗ ai chịu trách nhiệm về kết quả cuối cùng.”</p>
                <div className="close-lock-points">
                  <strong className="is-ai">Trí tuệ nhân tạo dựng bản nháp.</strong>
                  <strong className="is-teacher">Nhà giáo quyết định bản cuối.</strong>
                  <strong className="is-responsibility">Nhà giáo chịu trách nhiệm về kết quả cuối cùng.</strong>
                </div>
              </blockquote>
            </div>

            <footer className="debrief-next" data-reveal data-motion="rise-card">
              <div>
                <span>TIẾP THEO · PHẦN 1.2</span>
                <strong>Mở bản sao Phiếu học tập số 1 mang tên quý thầy cô</strong>
                <p><b>Câu hỏi 1.</b> Căn cứ nào để xếp một công việc vào nhóm giao được cho trí tuệ nhân tạo?</p>
                <p>Ghi câu trả lời theo trí nhớ của mình rồi đối chiếu với phần chốt của báo cáo viên.</p>
                <ol aria-label="Thứ tự thao tác ở phần 1.2">
                  <li>Mở mục 1.2</li><li>Mở bản sao phiếu</li><li>Ghi câu trả lời</li><li>Nộp bài</li>
                </ol>
              </div>
              <button onClick={onReplay}><span>↻</span> Chơi lại</button>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
