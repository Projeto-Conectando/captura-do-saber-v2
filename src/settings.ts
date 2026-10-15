export type InputMode = 'camera' | 'keyboard';

export interface Settings {
  inputMode: InputMode;
  deviceId: string | null; // null = browser default camera
  zoom: number; // hardware zoom value, or digital zoom factor when unsupported
  sensitivity: number; // 1 (needs a long swipe) to 10 (short swipe is enough)
  speed: number; // 1 (slow) to 10 (fast): how fast the first headline arrives
  acceleration: number; // 0 (constant speed) to 10: speed-up per headline
  volume: number; // 0 (mute) to 100
  showHands: boolean; // show hand markers on screen
  debug: boolean; // show correct answer + hand trail
}

export const DEFAULT_SETTINGS: Settings = {
  inputMode: 'camera',
  deviceId: null,
  zoom: 1,
  sensitivity: 6,
  speed: 6,
  acceleration: 3,
  volume: 80,
  showHands: true,
  debug: false,
};

const STORAGE_KEY = 'fato-ou-fake:settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // Storage unavailable (private window, blocked site data): use defaults
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore: settings just won't persist
  }
}

const MIN_DURATION_MS = 1800;

// Time (ms) the headline of a given round (1-based) takes to reach the player
export function headlineDuration(s: Pick<Settings, 'speed' | 'acceleration'>, round: number) {
  const first = 8000 - (s.speed - 1) * 600; // 1 → 8.0 s, 6 → 5.0 s, 10 → 2.6 s
  const step = s.acceleration * 60; // 3 → each headline 0.18 s faster
  return Math.max(MIN_DURATION_MS, first - (round - 1) * step);
}

// Horizontal distance (fraction of screen width) a hand must travel to count as a swipe
export function swipeDistance(sensitivity: number) {
  return 0.3 - (sensitivity - 1) * 0.025; // 1 → 0.30, 10 → 0.075
}
