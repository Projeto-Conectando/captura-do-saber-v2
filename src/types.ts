export type GameStatus = "START" | "PLAYING" | "END";

export type Verdict = "FATO" | "FAKE";

export interface Headline {
  id: string; // id from the headline sheet
  index: number; // 1-based position in the round
  title: string;
  truth: Verdict;
  explanation: string;
}

export interface CardResult {
  choice: Verdict | null; // null = player didn't decide in time
  correct: boolean;
  time: number;
}

export interface ActiveCard {
  headline: Headline;
  spawnTime: number;
  duration: number; // ms to travel from far away to the player
  progress: number; // 0 (far) to 1 (reached the player)
  result: CardResult | null;
}

// A tracked hand's palm center, in normalized screen coordinates (0 to 1)
export interface HandPoint {
  key: string; // stable id per hand ("Left" / "Right")
  x: number;
  y: number;
}

// Diagnostics of one headline, shown after the game in test mode
export interface RoundLog {
  index: number;
  title: string;
  truth: Verdict;
  choice: Verdict | null;
  correct: boolean;
  handSeenPct: number | null; // % of decision-window frames with a hand visible (camera mode)
  strokes: {
    dir: Verdict;
    dx: number;
    minDx: number;
    speed: number;
    minSpeed: number;
    touched: boolean;
    accepted: boolean;
    early: boolean; // happened before the decision window opened (ignored)
    atMs: number; // time since the headline appeared
  }[];
}
