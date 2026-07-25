import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { Difficulty, GameEngine, GameState, HandInput } from '../utils/engine';
import { audio } from '../utils/audio';

const CANVAS_RENDER_SCALE = 0.62;
/** Ngưỡng chụm ngón. Rộng hơn bản bắn của earth-defender-ar vì thao tác gắp cần dung sai lớn hơn. */
const PINCH_DISTANCE = 42;
const MAX_HANDS = 2;

interface GameProps {
  onGameOver: (state: GameState) => void;
  onStateUpdate: (state: GameState) => void;
  demoMode: boolean;
  difficulty: Difficulty;
}

export function Game({ onGameOver, onStateUpdate, demoMode, difficulty }: GameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const requestRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastHandDetectMsRef = useRef<number>(0);
  const cachedInputsRef = useRef<HandInput[]>([]);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, down: false, inside: false });
  const finishedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(!demoMode);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    let active = true;
    finishedRef.current = false;

    engineRef.current = new GameEngine((state) => {
      onStateUpdate(state);
      if (state.isGameOver && !finishedRef.current) {
        finishedRef.current = true;
        onGameOver(state);
      }
    }, { difficulty });

    const init = async () => {
      audio.init();
      // Canvas vẽ chữ bằng Be Vietnam Pro — chờ font sẵn sàng, nếu không
      // khung hình đầu tiên sẽ rơi về font hệ thống rồi nhảy cỡ khi font tới.
      await document.fonts?.ready?.catch(() => undefined);
      if (!active) return;

      if (demoMode) {
        setIsLoading(false);
        startGameLoop();
        return;
      }

      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm',
        );
        if (!active) return;

        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: MAX_HANDS,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraReady(true);
            setIsLoading(false);
            startGameLoop();
          };
        }
      } catch (err) {
        console.error('Không khởi tạo được camera:', err);
        setCameraError('Không mở được camera. Trò chơi đã tự chuyển sang chế độ chuột — vẫn chơi và trình chiếu bình thường.');
        setIsLoading(false);
        startGameLoop();
      }
    };

    init();

    return () => {
      active = false;
      cancelAnimationFrame(requestRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, demoMode]);

  const startGameLoop = () => {
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const engine = engineRef.current;
      if (!canvas || !container || !engine) return;

      const dt = currentTime - lastTime;
      lastTime = currentTime;

      const targetWidth = Math.max(1, Math.floor(container.clientWidth * CANVAS_RENDER_SCALE));
      const targetHeight = Math.max(1, Math.floor(container.clientHeight * CANVAS_RENDER_SCALE));
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctxRef.current = canvas.getContext('2d', { alpha: false, desynchronized: true } as CanvasRenderingContext2DSettings);
        engine.resize(canvas.width, canvas.height);
      }

      const ctx = ctxRef.current || canvas.getContext('2d', { alpha: false, desynchronized: true } as CanvasRenderingContext2DSettings);
      if (!ctx) return;
      ctxRef.current = ctx;

      const hands = demoMode || cameraError ? getMouseInputs() : getCameraInputs(canvas);
      engine.updateHands(hands);
      engine.update(dt);
      engine.draw(ctx);

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
  };

  const getCameraInputs = (canvas: HTMLCanvasElement): HandInput[] => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) return cachedInputsRef.current;

    const now = performance.now();
    if (now - lastHandDetectMsRef.current < 33) return cachedInputsRef.current;
    if (lastVideoTimeRef.current === video.currentTime) return cachedInputsRef.current;

    lastVideoTimeRef.current = video.currentTime;
    lastHandDetectMsRef.current = now;

    let results: HandLandmarkerResult | null = null;
    try {
      results = landmarker.detectForVideo(video, now);
    } catch {
      return cachedInputsRef.current;
    }

    if (!results?.landmarks?.length) {
      cachedInputsRef.current = [];
      return cachedInputsRef.current;
    }

    const cw = canvas.width;
    const ch = canvas.height;
    const inputs: HandInput[] = [];

    results.landmarks.forEach((landmarks, index) => {
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      // Ảnh camera bị lật gương nên phải đảo trục x
      const ix = (1 - indexTip.x) * cw;
      const iy = indexTip.y * ch;
      const tx = (1 - thumbTip.x) * cw;
      const ty = thumbTip.y * ch;
      const dist = Math.hypot(ix - tx, iy - ty);

      inputs.push({
        x: (ix + tx) / 2,
        y: (iy + ty) / 2,
        ix,
        iy,
        tx,
        ty,
        isPinching: dist < PINCH_DISTANCE,
        handedness: results?.handednesses[index]?.[0]?.categoryName || 'Unknown',
        playerId: index,
      });
    });

    cachedInputsRef.current = inputs;
    return cachedInputsRef.current;
  };

  const getMouseInputs = (): HandInput[] => {
    const mouse = mouseRef.current;
    if (!mouse.inside) return [];
    return [
      {
        x: mouse.x,
        y: mouse.y,
        ix: mouse.x - (mouse.down ? 6 : 26),
        iy: mouse.y - (mouse.down ? 4 : 16),
        tx: mouse.x + (mouse.down ? 6 : 26),
        ty: mouse.y + (mouse.down ? 4 : 16),
        isPinching: mouse.down,
        handedness: 'Right',
        playerId: 0,
      },
    ];
  };

  const updateMouse = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseRef.current.x = (event.clientX - rect.left) * CANVAS_RENDER_SCALE;
    mouseRef.current.y = (event.clientY - rect.top) * CANVAS_RENDER_SCALE;
    mouseRef.current.inside = true;
  };

  const usingMouse = demoMode || Boolean(cameraError);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[var(--ink)]"
      onPointerMove={updateMouse}
      onPointerDown={(event) => {
        updateMouse(event);
        mouseRef.current.down = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        mouseRef.current.down = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerLeave={() => {
        mouseRef.current.inside = false;
        mouseRef.current.down = false;
      }}
    >
      {isLoading && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-[var(--ink)]/94 backdrop-blur-sm">
          <div className="max-w-md px-6 text-center">
            <span className="pinch pinch-live text-[2.6rem] text-[var(--mint)]" aria-hidden="true" />
            <p className="t-title mt-7 text-[1.7rem] text-[var(--chalk)]">Đang bật camera</p>
            <p className="mt-3 text-[0.95rem] leading-6 text-[var(--dim)]">
              Cho phép truy cập camera để trò chơi nhìn thấy bàn tay. Không cho phép cũng không sao — trò chơi tự
              chuyển sang chế độ chuột.
            </p>
          </div>
        </div>
      )}

      {cameraError && (
        <div
          role="status"
          className="absolute left-1/2 top-5 z-40 w-[min(92vw,620px)] -translate-x-1/2 rounded-xl border px-5 py-4"
          style={{
            borderColor: 'color-mix(in oklab, var(--ember) 55%, transparent)',
            background: 'color-mix(in oklab, var(--ember) 14%, var(--ink))',
          }}
        >
          <p className="t-eyebrow mb-1.5 text-[var(--ember)]">Đã chuyển sang chế độ chuột</p>
          <p className="text-sm leading-6 text-[var(--chalk)]/85">{cameraError}</p>
        </div>
      )}

      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full -scale-x-100 object-cover opacity-25 mix-blend-screen ${cameraReady ? '' : 'hidden'}`}
        playsInline
        muted
      />

      <canvas ref={canvasRef} className="absolute inset-0 z-10 h-full w-full" style={{ touchAction: 'none' }} />

      <div className="pointer-events-none absolute bottom-4 left-4 z-20 hidden max-w-[320px] sm:block">
        <p className="t-eyebrow mb-1.5 text-[var(--mint)]">
          {usingMouse ? 'Điều khiển bằng chuột' : 'Điều khiển bằng tay'}
        </p>
        <p className="text-[0.9rem] leading-6 text-[var(--dim)]">
          {usingMouse
            ? 'Giữ chuột lên quả cầu để gắp, kéo xuống giỏ rồi thả chuột.'
            : 'Chụm ngón cái với ngón trỏ để gắp, kéo xuống giỏ rồi mở tay ra.'}
        </p>
      </div>
    </div>
  );
}
