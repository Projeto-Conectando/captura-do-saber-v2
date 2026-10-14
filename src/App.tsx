import { useState, useRef, useEffect, useCallback } from 'react';
import { GameStatus, ActiveCard, Headline, MotionSample, Verdict } from './types';
import { HeadlineCard } from './components/HeadlineCard';
import { Hud } from './components/Hud';
import { GameScreens } from './components/GameScreens';
import { sampleMotion, SwipeDetector } from './motion';
import { Maximize, Minimize, Home } from 'lucide-react';
import { initAudio, playHitSound, playMissSound } from './audio';

const TOTAL_ROUNDS = 10;
const START_DURATION_MS = 5000; // Time for the first headline to reach the player
const MIN_DURATION_MS = 3000;
const DURATION_STEP_MS = 200; // Each new headline gets this much faster
const DECISION_START = 0.55; // Progress from which swipes are accepted
const FLY_MS = 700; // Fly-off / feedback animation length
const GAP_MS = 600; // Pause between headlines

function makeHeadline(index: number): Headline {
  return {
    id: Math.random().toString(36).substring(2, 9),
    index,
    title: `Manchete de teste ${index}`,
    truth: Math.random() < 0.5 ? 'FATO' : 'FAKE',
  };
}

interface ViewState {
  card: ActiveCard | null;
  now: number;
  motion: MotionSample | null;
}

export default function App() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<GameStatus>('START');
  const [score, setScore] = useState({ correct: 0, wrong: 0, round: 0 });
  const [view, setView] = useState<ViewState>({ card: null, now: 0, motion: null });
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [debug, setDebug] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const requestRef = useRef<number>(0);
  const swipeRef = useRef(new SwipeDetector());
  const keyChoiceRef = useRef<Verdict | null>(null);

  // Mutable game state read by the requestAnimationFrame loop
  const gameState = useRef({
    status: 'START' as GameStatus,
    card: null as ActiveCard | null,
    round: 0,
    correct: 0,
    wrong: 0,
    nextSpawnAt: 0,
  });

  useEffect(() => {
    let active: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then(s => { active = s; setStream(s); })
      .catch(console.error);
    return () => active?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard fallback for testing without a camera, plus debug toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keyChoiceRef.current = 'FATO';
      else if (e.key === 'ArrowRight') keyChoiceRef.current = 'FAKE';
      else if (e.key === 'd' || e.key === 'D') setDebug(d => !d);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const captureSnapshot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      setSnapshot(canvas.toDataURL('image/png'));
    }
  }, []);

  const stopLoop = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  };

  const endGame = useCallback(() => {
    gameState.current.status = 'END';
    setStatus('END');
    captureSnapshot();
    stopLoop();
  }, [captureSnapshot]);

  const goHome = useCallback(() => {
    gameState.current.status = 'START';
    stopLoop();
    setStatus('START');
    setView({ card: null, now: 0, motion: null });
    setSnapshot(null);
  }, []);

  const resolveCard = (card: ActiveCard, choice: Verdict | null, time: number) => {
    const g = gameState.current;
    const correct = choice === card.headline.truth;
    card.result = { choice, correct, time };
    if (correct) {
      g.correct++;
      playHitSound();
    } else {
      g.wrong++;
      playMissSound();
    }
    swipeRef.current.reset();
    setScore({ correct: g.correct, wrong: g.wrong, round: g.round });
  };

  const loop = useCallback((time: number) => {
    const g = gameState.current;
    if (g.status !== 'PLAYING') return;

    // Spawn the next headline once the previous one is gone
    if (!g.card && time >= g.nextSpawnAt) {
      if (g.round >= TOTAL_ROUNDS) {
        endGame();
        return;
      }
      g.round++;
      g.card = {
        headline: makeHeadline(g.round),
        spawnTime: time,
        duration: Math.max(MIN_DURATION_MS, START_DURATION_MS - (g.round - 1) * DURATION_STEP_MS),
        progress: 0,
        result: null,
      };
      keyChoiceRef.current = null;
      swipeRef.current.reset();
      setScore({ correct: g.correct, wrong: g.wrong, round: g.round });
    }

    const motion = videoRef.current && canvasRef.current
      ? sampleMotion(videoRef.current, canvasRef.current, prevFrameRef)
      : null;

    const card = g.card;
    if (card) {
      if (!card.result) {
        card.progress = Math.min(1, (time - card.spawnTime) / card.duration);
        const decisionOpen = card.progress >= DECISION_START;

        // Only listen for swipes while the headline is close to the player
        const swipe = decisionOpen ? swipeRef.current.push(time, motion) : null;
        const keyChoice = decisionOpen ? keyChoiceRef.current : null;
        keyChoiceRef.current = null;

        const choice = swipe ?? keyChoice;
        if (choice) {
          resolveCard(card, choice, time);
        } else if (card.progress >= 1) {
          resolveCard(card, null, time); // Reached the player without a decision
        }
      } else if (time - card.result.time > FLY_MS) {
        g.card = null;
        g.nextSpawnAt = time + GAP_MS;
      }
    }

    setView({ card: g.card ? { ...g.card } : null, now: time, motion });
    requestRef.current = requestAnimationFrame(loop);
  }, [endGame]);

  const startGame = () => {
    initAudio();
    setSnapshot(null);
    gameState.current = {
      status: 'PLAYING',
      card: null,
      round: 0,
      correct: 0,
      wrong: 0,
      nextSpawnAt: performance.now() + GAP_MS,
    };
    setScore({ correct: 0, wrong: 0, round: 0 });
    setStatus('PLAYING');
    prevFrameRef.current = null;
    swipeRef.current.reset();
    stopLoop();
    requestRef.current = requestAnimationFrame(loop);
  };

  const card = view.card;
  const decisionOpen = !!card && !card.result && card.progress >= DECISION_START;

  return (
    <div className="relative overflow-hidden w-full h-screen bg-slate-800 font-sans text-slate-900 select-none">
      {/* Mirrored camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
      />

      {/* Hidden canvas for off-screen motion processing */}
      <canvas ref={canvasRef} width={320} height={240} className="hidden" />

      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 md:top-10 md:right-10 z-[60] flex gap-2 md:gap-3">
        {status !== 'START' && (
          <button
            onClick={goHome}
            className="p-2 md:p-3 bg-white/80 hover:bg-white text-slate-900 rounded-full shadow-lg backdrop-blur-sm transition-all border border-slate-200 active:scale-95"
            title="Voltar à Tela Inicial"
          >
            <Home className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        )}
        <button
          onClick={toggleFullscreen}
          className="p-2 md:p-3 bg-white/80 hover:bg-white text-slate-900 rounded-full shadow-lg backdrop-blur-sm transition-all border border-slate-200 active:scale-95"
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
        >
          {isFullscreen ? <Minimize className="w-5 h-5 md:w-6 md:h-6" /> : <Maximize className="w-5 h-5 md:w-6 md:h-6" />}
        </button>
      </div>

      {status === 'PLAYING' && (
        <>
          <Hud
            correct={score.correct}
            wrong={score.wrong}
            round={score.round}
            totalRounds={TOTAL_ROUNDS}
            lastChoice={card?.result?.choice ?? null}
            decisionOpen={decisionOpen}
            motion={view.motion}
            debug={debug}
          />
          {card && (
            <HeadlineCard card={card} now={view.now} decisionStart={DECISION_START} flyMs={FLY_MS} showAnswer={debug} />
          )}
        </>
      )}

      <GameScreens
        status={status}
        startGame={startGame}
        correct={score.correct}
        total={TOTAL_ROUNDS}
        snapshot={snapshot}
      />
    </div>
  );
}
