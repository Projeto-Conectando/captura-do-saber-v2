export type GameStatus = "START" | "PLAYING" | "END";

export type Verdict = "FATO" | "FAKE";

export interface Headline {
  id: string;
  index: number; // 1-based position in the round
  title: string;
  truth: Verdict;
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

// Latest motion reading, in normalized screen coordinates (0 to 1)
export interface MotionSample {
  x: number;
  y: number;
  mass: number;
}
