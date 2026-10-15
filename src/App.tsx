import { useState, useRef, useEffect, useCallback } from 'react';
import { GameStatus, ActiveCard, HandPoint, Verdict, RoundLog, CardResult, Headline } from './types';
import { HeadlineCard } from './components/HeadlineCard';
import { FeedbackBanner } from './components/FeedbackBanner';
import { Hud, HandMarkers } from './components/Hud';
import { GameScreens } from './components/GameScreens';
import { SettingsPanel, TrackerStatus } from './components/SettingsPanel';
import { createHandTracker, HandTracker } from './hands';
import { SwipeDetector, StrokeInfo } from './swipe';
import { openCamera, listCameras, getControls, applyCameraSettings, digitalZoom, CameraControls } from './camera';
import { cardRect, expandRect, Rect } from './geometry';
import { HeadlineBank, HeadlineEntry, loadHeadlines, pickHeadlines, markSeen } from './headlines';
import { Settings, loadSettings, saveSettings, swipeDistance, headlineDuration } from './settings';
import { Maximize, Minimize, Home, Settings as SettingsIcon } from 'lucide-react';
import { initAudio, playHitSound, playMissSound, playReadySound, playCountdownBeep, setVolume } from './audio';

const TOTAL_ROUNDS = 10;
const DECISION_START = 0.55; // Progress from which swipes are accepted
const FLY_MS = 700; // Fly-off / feedback animation length
const GAP_MS = 600; // Pause between headlines
const COUNTDOWN_MS = 3000; // "3, 2, 1" before the first headline
const GO_MS = 700; // How long "JÁ!" stays on screen
// Hit box margin around the card, as a fraction of its width (each side) and
// height. Bigger below the card, where hands naturally are
const HIT_MARGIN_X = 0.25;
const HIT_MARGIN_TOP = 0.4;
const HIT_MARGIN_BOTTOM = 1;

// Time to read the explanation after each play: longer explanations stay longer
function feedbackDuration(explanation: string) {
  if (!explanation) return 1200;
  return Math.min(8000, Math.max(2500, 1500 + explanation.length * 45));
}

interface Feedback {
  headline: Headline;
  result: CardResult;
  until: number;
}

interface ViewState {
  card: ActiveCard | null;
  now: number;
  hands: HandPoint[];
  trails: { x: number; y: number }[][];
  hitBox: Rect | null;
  lastStroke: StrokeInfo | null;
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [controls, setControls] = useState<CameraControls | null>(null);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>('loading');
  const [status, setStatus] = useState<GameStatus>('START');
  const [score, setScore] = useState({ correct: 0, wrong: 0, round: 0 });
  const [view, setView] = useState<ViewState>({ card: null, now: 0, hands: [], trails: [], hitBox: null, lastStroke: null });
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [roundLog, setRoundLog] = useState<RoundLog[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bank, setBank] = useState<HeadlineBank | null>(null);
  const [bankLoading, setBankLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const swipeRef = useRef(new SwipeDetector());
  const keyChoiceRef = useRef<Verdict | null>(null);
  const settingsRef = useRef(settings);
  const zoomRef = useRef(1);
  const hitBoxRef = useRef<Rect | null>(null);

  // Mutable game state read by the requestAnimationFrame loop
  const gameState = useRef({
    status: 'START' as GameStatus,
    card: null as ActiveCard | null,
    round: 0,
    correct: 0,
    wrong: 0,
    nextSpawnAt: 0,
    pausedAt: null as number | null,
    countdownEnd: 0,
    lastCount: 0, // last countdown number shown, to beep once per number
    log: [] as RoundLog[],
    // Decision-window frames of the current headline, and how many had a hand visible
    windowFrames: 0,
    handFrames: 0,
    queue: [] as HeadlineEntry[], // headlines picked for this game
    feedback: null as Feedback | null, // answer + explanation shown after a play
  });

  const zoom = digitalZoom(controls, settings);
  settingsRef.current = settings;
  zoomRef.current = zoom;

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // (Re)open the camera when the chosen device changes
  useEffect(() => {
    let cancelled = false;
    let opened: MediaStream | null = null;
    openCamera(settings.deviceId)
      .then(async s => {
        if (cancelled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        opened = s;
        setStream(s);
        setCameraError(null);
        setControls(getControls(s.getVideoTracks()[0]));
        setCameras(await listCameras()); // Labels are only available after permission
      })
      .catch(err => {
        console.error(err);
        setCameraError('Câmera não encontrada ou sem permissão. Verifique as permissões do navegador.');
      });
    return () => {
      cancelled = true;
      opened?.getTracks().forEach(t => t.stop());
    };
  }, [settings.deviceId]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const reloadBank = useCallback(() => {
    setBankLoading(true);
    loadHeadlines()
      .then(setBank)
      .catch(err => {
        console.error(err);
        setBank(null);
      })
      .finally(() => setBankLoading(false));
  }, []);

  useEffect(reloadBank, [reloadBank]);

  useEffect(() => {
    setVolume(settings.volume / 100);
  }, [settings.volume]);

  // Hardware zoom
  useEffect(() => {
    const track = stream?.getVideoTracks()[0];
    if (track && controls) applyCameraSettings(track, controls, settings);
  }, [stream, controls, settings.zoom]);

  // Load the hand tracking model once camera mode is used
  useEffect(() => {
    if (settings.inputMode !== 'camera' || trackerRef.current) return;
    let cancelled = false;
    setTrackerStatus('loading');
    createHandTracker()
      .then(landmarker => {
        if (cancelled) return landmarker.close();
        trackerRef.current = new HandTracker(landmarker);
        setTrackerStatus('ready');
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) setTrackerStatus('error');
      });
    return () => { cancelled = true; };
  }, [settings.inputMode]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Arrow keys only play in keyboard mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsRef.current.inputMode !== 'keyboard') return;
      if (e.key === 'ArrowLeft') keyChoiceRef.current = 'FATO';
      else if (e.key === 'ArrowRight') keyChoiceRef.current = 'FAKE';
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

  const endGame = useCallback(() => {
    gameState.current.status = 'END';
    setStatus('END');
    setRoundLog([...gameState.current.log]);
    captureSnapshot();
  }, [captureSnapshot]);

  const goHome = useCallback(() => {
    gameState.current.status = 'START';
    gameState.current.card = null;
    setStatus('START');
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
    g.feedback = { headline: card.headline, result: card.result, until: time + feedbackDuration(card.headline.explanation) };

    const openAt = card.spawnTime + card.duration * DECISION_START;
    g.log.push({
      index: card.headline.index,
      title: card.headline.title,
      truth: card.headline.truth,
      choice,
      correct,
      handSeenPct: settingsRef.current.inputMode === 'camera' && g.windowFrames
        ? Math.round((g.handFrames / g.windowFrames) * 100)
        : null,
      strokes: swipeRef.current.takeStrokes().map(st => ({
        dir: st.dir,
        dx: st.dx,
        minDx: st.minDx,
        speed: st.speed,
        minSpeed: st.minSpeed,
        touched: st.touched,
        accepted: st.accepted,
        early: st.t < openAt,
        atMs: Math.round(st.t - card.spawnTime),
      })),
    });
  };

  // Advances the game by one frame
  const stepGame = (time: number, hands: HandPoint[]) => {
    const g = gameState.current;
    const s = settingsRef.current;

    // Get-ready countdown before the first headline
    if (time < g.countdownEnd) {
      const count = Math.min(COUNTDOWN_MS / 1000, Math.ceil((g.countdownEnd - time) / 1000));
      if (count !== g.lastCount) {
        g.lastCount = count;
        playCountdownBeep(false);
      }
      return;
    }
    if (g.lastCount !== 0) {
      g.lastCount = 0;
      playCountdownBeep(true);
    }

    // Spawn the next headline once the previous one is gone
    if (!g.card && time >= g.nextSpawnAt) {
      if (g.round >= TOTAL_ROUNDS) {
        endGame();
        return;
      }
      g.round++;
      const entry = g.queue[g.round - 1];
      markSeen(entry.id);
      g.card = {
        headline: { id: entry.id, index: g.round, title: entry.title, truth: entry.truth, explanation: entry.explanation },
        spawnTime: time,
        duration: headlineDuration(s, g.round),
        progress: 0,
        result: null,
      };
      keyChoiceRef.current = null;
      swipeRef.current.reset();
      swipeRef.current.takeStrokes(); // log starts fresh for each headline
      g.windowFrames = 0;
      g.handFrames = 0;
      setScore({ correct: g.correct, wrong: g.wrong, round: g.round });
    }

    // Area where a hand "touches" the headline: the card plus a margin around it
    hitBoxRef.current = g.card && !g.card.result
      ? expandRect(cardRect(g.card.progress, window.innerWidth, window.innerHeight), HIT_MARGIN_X, HIT_MARGIN_TOP, HIT_MARGIN_BOTTOM)
      : null;

    // Hand movement is tracked continuously, but only counts while the headline is close
    const swipe = s.inputMode === 'camera'
      ? swipeRef.current.push(time, hands, swipeDistance(s.sensitivity), hitBoxRef.current)
      : null;
    const keyChoice = keyChoiceRef.current;
    keyChoiceRef.current = null;

    const card = g.card;
    if (!card) return;
    if (!card.result) {
      const wasOpen = card.progress >= DECISION_START;
      card.progress = Math.min(1, (time - card.spawnTime) / card.duration);
      const open = card.progress >= DECISION_START;
      if (open && !wasOpen) playReadySound();
      if (open) {
        g.windowFrames++;
        if (hands.length) g.handFrames++;
      }
      const choice = open ? swipe ?? keyChoice : null;
      if (choice) {
        resolveCard(card, choice, time);
      } else if (card.progress >= 1) {
        resolveCard(card, null, time); // Reached the player without a decision
      }
    } else if (time - card.result.time > FLY_MS) {
      g.card = null;
      // Next headline only after the explanation has been on screen long enough
      g.nextSpawnAt = Math.max(time + GAP_MS, g.feedback?.until ?? 0);
    }
  };

  // Runs for the whole session so hand markers also show on menus and in settings
  useEffect(() => {
    let raf = 0;
    const frame = (time: number) => {
      const g = gameState.current;
      const tracker = trackerRef.current;
      const video = videoRef.current;
      const hands = settingsRef.current.inputMode === 'camera' && tracker && video
        ? tracker.detect(video, time, zoomRef.current)
        : [];

      if (g.status === 'PLAYING' && g.pausedAt === null) stepGame(time, hands);

      setView({
        card: g.card ? { ...g.card } : null,
        now: time,
        hands,
        trails: settingsRef.current.debug ? swipeRef.current.trails() : [],
        hitBox: g.status === 'PLAYING' ? hitBoxRef.current : null,
        lastStroke: swipeRef.current.lastStroke,
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause the game while settings are open, shifting timers on resume
  useEffect(() => {
    const g = gameState.current;
    const now = performance.now();
    if (settingsOpen) {
      if (g.pausedAt === null) g.pausedAt = now;
    } else if (g.pausedAt !== null) {
      const shift = now - g.pausedAt;
      g.pausedAt = null;
      g.nextSpawnAt += shift;
      g.countdownEnd += shift;
      if (g.feedback) g.feedback.until += shift;
      if (g.card) {
        g.card.spawnTime += shift;
        if (g.card.result) g.card.result.time += shift;
      }
      swipeRef.current.reset();
    }
  }, [settingsOpen]);

  const startGame = () => {
    if (!bank?.headlines.length) return;
    initAudio();
    setSnapshot(null);
    gameState.current = {
      status: 'PLAYING',
      card: null,
      round: 0,
      correct: 0,
      wrong: 0,
      nextSpawnAt: performance.now() + COUNTDOWN_MS,
      pausedAt: null,
      countdownEnd: performance.now() + COUNTDOWN_MS,
      lastCount: 0,
      log: [],
      windowFrames: 0,
      handFrames: 0,
      queue: pickHeadlines(bank.headlines, TOTAL_ROUNDS),
      feedback: null,
    };
    setScore({ correct: 0, wrong: 0, round: 0 });
    setStatus('PLAYING');
    swipeRef.current.reset();
  };

  const card = view.card;
  const untilGo = gameState.current.countdownEnd - view.now;
  const countdownText = status !== 'PLAYING' || untilGo < -GO_MS
    ? null
    : untilGo > 0 ? String(Math.min(COUNTDOWN_MS / 1000, Math.ceil(untilGo / 1000))) : 'JÁ!';
  const feedback = gameState.current.feedback;
  const showFeedback = status === 'PLAYING' && !!feedback && view.now < feedback.until;
  const decisionOpen = !!card && !card.result && card.progress >= DECISION_START;
  const roundButton = "p-2 md:p-3 bg-white/80 hover:bg-white text-slate-900 rounded-full shadow-lg backdrop-blur-sm transition-all border border-slate-200 active:scale-95";

  return (
    <div className="relative overflow-hidden w-full h-screen bg-slate-800 font-sans text-slate-900 select-none">
      {/* Mirrored camera feed, with digital zoom when the camera has no hardware zoom */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: `scale(${-zoom}, ${zoom})` }}
      />

      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 md:top-10 md:right-10 z-[60] flex gap-2 md:gap-3">
        {status !== 'START' && (
          <button onClick={goHome} className={roundButton} title="Voltar à Tela Inicial">
            <Home className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        )}
        <button onClick={() => setSettingsOpen(o => !o)} className={roundButton} title="Configurações">
          <SettingsIcon className="w-5 h-5 md:w-6 md:h-6" />
        </button>
        <button onClick={toggleFullscreen} className={roundButton} title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
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
            decisionOpen={decisionOpen && !settingsOpen}
            inputMode={settings.inputMode}
            hands={view.hands}
            trails={view.trails}
            hitBox={view.hitBox}
            lastStroke={view.lastStroke}
            showHands={settings.showHands}
            debug={settings.debug}
          />
          {countdownText && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-white/90 font-black tracking-tight text-2xl md:text-4xl mb-4 drop-shadow-lg">
                {countdownText === 'JÁ!' ? '' : 'Prepare-se!'}
              </span>
              <span
                key={countdownText}
                className="countdown-pop text-white font-black tracking-tighter text-[30vh] leading-none drop-shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
              >
                {countdownText}
              </span>
            </div>
          )}
          {card && (
            <HeadlineCard card={card} now={view.now} decisionStart={DECISION_START} flyMs={FLY_MS} showAnswer={settings.debug} />
          )}
          {showFeedback && feedback && (
            <FeedbackBanner
              key={feedback.headline.index}
              headline={feedback.headline}
              result={feedback.result}
              progress={(view.now - feedback.result.time) / (feedback.until - feedback.result.time)}
            />
          )}
        </>
      )}

      {/* While configuring from a menu, hide it so the camera image is visible */}
      {status !== 'PLAYING' && settingsOpen && (
        <HandMarkers
          inputMode={settings.inputMode}
          hands={view.hands}
          trails={view.trails}
          hitBox={null}
          showHands={settings.showHands}
          debug={settings.debug}
        />
      )}
      {!settingsOpen && (
        <GameScreens
          status={status}
          startGame={startGame}
          bankLoading={bankLoading}
          bankReady={!!bank?.headlines.length}
          correct={score.correct}
          total={TOTAL_ROUNDS}
          snapshot={snapshot}
          roundLog={settings.debug ? roundLog : null}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
          cameras={cameras}
          activeDeviceId={stream?.getVideoTracks()[0]?.getSettings().deviceId ?? settings.deviceId}
          controls={controls}
          cameraError={cameraError}
          trackerStatus={trackerStatus}
          totalRounds={TOTAL_ROUNDS}
          bank={bank}
          bankLoading={bankLoading}
          onReloadBank={reloadBank}
        />
      )}
    </div>
  );
}
