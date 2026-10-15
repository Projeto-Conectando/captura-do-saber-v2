import { HandPoint, Verdict } from './types';
import { Rect, inRect } from './geometry';

// --- Swipe detection tuning ---
// Only the last part of a hand's path is considered. Touching the headline
// anywhere in this window counts, so "touch, wind up, throw" works
const PATH_WINDOW_MS = 900;
// A movement back by more than this ends a stroke and starts a new one in the
// opposite direction (so a wind-up before the swipe is ignored)
const REVERSAL_DX = 0.04;
// Minimum peak speed of a stroke (fastest SPEED_WINDOW_MS stretch), in screen
// widths per second. Peak, not average: positioning the hand slowly before
// flicking it in the same direction must not dilute the flick
const MIN_SPEED = 0.7;
const SPEED_WINDOW_MS = 150;
// If a hand is lost for longer than this, its path is dropped. Fast swipes
// often lose the hand for a few frames (motion blur, palm turning sideways)
const MAX_GAP_MS = 400;
// A hand can't move further than MAX_JUMP plus MAX_HAND_SPEED × elapsed time
// since it was last seen: anything further away is another hand
const MAX_JUMP = 0.2;
const MAX_HAND_SPEED = 4; // screen widths per second
// Strokes shorter than this aren't reported in the debug info
const DEBUG_MIN_DX = 0.05;
const MAX_LOGGED_STROKES = 30;
// Smoothing of the hand position (0 = frozen, 1 = raw)
const SMOOTHING = 0.6;

interface PathPoint {
  t: number;
  x: number;
  y: number;
  hit: boolean; // touching the headline at this moment
}

/**
 * Splits a hand path into strokes (runs of movement in one direction) and
 * returns the current one, or null while the hand is basically still.
 */
function currentStroke(path: PathPoint[]): { dir: 1 | -1; startIdx: number } | null {
  const end = path[path.length - 1];
  let dir: 1 | -1 | 0 = 0;
  let startIdx = path.length - 1;
  for (let i = path.length - 2; i >= 0; i--) {
    const p = path[i];
    if (dir === 0) {
      if (Math.abs(end.x - p.x) > REVERSAL_DX) dir = end.x > p.x ? 1 : -1;
      else continue;
    }
    // Before the stroke started, the hand was further along `dir`: that's a reversal
    if ((p.x - path[startIdx].x) * dir > REVERSAL_DX) break;
    if ((p.x - path[startIdx].x) * dir < 0) startIdx = i;
  }
  if (dir === 0 || startIdx === path.length - 1) return null;
  return { dir, startIdx };
}

// Fastest movement along `dir` over any SPEED_WINDOW_MS stretch of the stroke
function peakSpeed(path: PathPoint[], startIdx: number, dir: 1 | -1) {
  let peak = 0;
  let i = startIdx;
  for (let j = startIdx + 1; j < path.length; j++) {
    while (path[j].t - path[i].t > SPEED_WINDOW_MS) i++;
    if (i === j) continue;
    // Short stretches are measured over the full window, so one jittery frame can't spike
    const dt = Math.max(path[j].t - path[i].t, SPEED_WINDOW_MS / 2);
    peak = Math.max(peak, ((path[j].x - path[i].x) * dir) / dt * 1000);
  }
  return peak;
}

interface Track {
  path: PathPoint[];
  sx: number; // smoothed position
  sy: number;
}

// Measurements of the latest significant stroke, shown in debug mode
export interface StrokeInfo {
  dir: Verdict;
  dx: number;
  minDx: number;
  speed: number;
  minSpeed: number;
  touched: boolean;
  accepted: boolean;
  t: number;
}

/**
 * Tracks each hand's path and reports a swipe when the hand touched the
 * headline recently and its current stroke travelled at least `minDx`
 * fast enough.
 * Screen right = FAKE, screen left = FATO.
 */
export class SwipeDetector {
  private tracks: Track[] = [];
  lastStroke: StrokeInfo | null = null;
  // Every significant stroke (peak measurements), until taken with takeStrokes()
  private log: StrokeInfo[] = [];
  private lastStrokeSeen = 0;

  reset() {
    this.tracks = [];
  }

  takeStrokes(): StrokeInfo[] {
    const strokes = this.log;
    this.log = [];
    return strokes;
  }

  trails() {
    return this.tracks.map(t => t.path);
  }

  push(time: number, hands: HandPoint[], minDx: number, hitBox: Rect | null): Verdict | null {
    // Drop old points and tracks of hands that disappeared
    this.tracks = this.tracks.filter(tr => time - tr.path[tr.path.length - 1].t <= MAX_GAP_MS);
    for (const tr of this.tracks) tr.path = tr.path.filter(p => time - p.t <= PATH_WINDOW_MS);

    // Match each hand to the nearest existing track (hand labels from the model can swap)
    const free = new Set(this.tracks);
    for (const hand of hands) {
      let best: Track | null = null;
      let bestDist = Infinity;
      for (const tr of free) {
        const elapsed = (time - tr.path[tr.path.length - 1].t) / 1000;
        const d = Math.hypot(hand.x - tr.sx, hand.y - tr.sy);
        if (d <= MAX_JUMP + MAX_HAND_SPEED * elapsed && d < bestDist) {
          best = tr;
          bestDist = d;
        }
      }
      let track = best;
      if (track) {
        free.delete(track);
        if (track.path[track.path.length - 1].t === time) continue; // same camera frame
        track.sx += (hand.x - track.sx) * SMOOTHING;
        track.sy += (hand.y - track.sy) * SMOOTHING;
      } else {
        track = { path: [], sx: hand.x, sy: hand.y };
        this.tracks.push(track);
      }
      const hit = !!hitBox && inRect(hitBox, track.sx, track.sy);
      track.path.push({ t: time, x: track.sx, y: track.sy, hit });
    }

    for (const tr of this.tracks) {
      const stroke = currentStroke(tr.path);
      if (!stroke) continue;
      const dx = Math.abs(tr.path[tr.path.length - 1].x - tr.path[stroke.startIdx].x);
      const speed = peakSpeed(tr.path, stroke.startIdx, stroke.dir);
      const touched = tr.path.some(p => p.hit);
      const accepted = touched && dx >= minDx && speed >= MIN_SPEED;
      const dir: Verdict = stroke.dir > 0 ? 'FAKE' : 'FATO';
      this.recordStroke({ dir, dx, minDx, speed, minSpeed: MIN_SPEED, touched, accepted, t: time });
      if (accepted) {
        this.reset();
        return dir;
      }
    }
    return null;
  }

  // Keeps the peak measurements of each stroke for the debug display
  private recordStroke(info: StrokeInfo) {
    if (info.dx < DEBUG_MIN_DX) return;
    const prev = this.lastStroke;
    const sameStroke = !!prev && !prev.accepted && prev.dir === info.dir && info.t - this.lastStrokeSeen < 300;
    this.lastStrokeSeen = info.t;
    if (sameStroke && info.dx < prev.dx && !info.accepted) return; // same stroke, past its peak
    this.lastStroke = info;
    if (sameStroke && this.log[this.log.length - 1] === prev) this.log[this.log.length - 1] = info;
    else this.log.push(info);
    if (this.log.length > MAX_LOGGED_STROKES) this.log.shift();
  }
}
