import { MotionSample, Verdict } from './types';

// --- Tuning knobs for the swipe detector ---
// Per-pixel color difference (R+G+B) that counts as "movement"
export const PIXEL_DIFF_THRESHOLD = 90;
// Minimum number of moving pixels for a frame to count as a hand movement
export const MIN_MOTION_MASS = 40;
// Time window in which the horizontal displacement is measured
export const SWIPE_WINDOW_MS = 450;
// Horizontal displacement (fraction of screen width) needed to count as a swipe
export const SWIPE_MIN_DX = 0.18;

// Region (normalized screen coords) where hand motion is tracked
export const DETECTION_ZONE = { x0: 0.08, x1: 0.92, y0: 0.2, y1: 0.85 };

interface Mapping {
  // Converts between screen coords and video coords for an object-cover video
  toVideo: (sx: number, sy: number) => [number, number];
  toScreen: (vx: number, vy: number) => [number, number];
}

function coverMapping(video: HTMLVideoElement): Mapping {
  const va = video.videoWidth / video.videoHeight;
  const sa = window.innerWidth / window.innerHeight;
  // Fraction of the video visible on each axis after object-cover cropping
  const fx = sa > va ? 1 : sa / va;
  const fy = sa > va ? va / sa : 1;
  return {
    toVideo: (sx, sy) => [0.5 + (sx - 0.5) * fx, 0.5 + (sy - 0.5) * fy],
    toScreen: (vx, vy) => [0.5 + (vx - 0.5) / fx, 0.5 + (vy - 0.5) / fy],
  };
}

/**
 * Draws the current (mirrored) video frame into the low-res canvas, diffs it
 * against the previous frame inside DETECTION_ZONE and returns the centroid
 * of the moving pixels, or null when there's not enough movement.
 */
export function sampleMotion(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  prevFrame: { current: Uint8ClampedArray | null },
): MotionSample | null {
  if (video.readyState < 2 || !video.videoWidth) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const width = canvas.width;
  const height = canvas.height;
  ctx.save();
  ctx.scale(-1, 1); // Match the mirrored video feed
  ctx.drawImage(video, -width, 0, width, height);
  ctx.restore();

  const current = ctx.getImageData(0, 0, width, height).data;
  const prev = prevFrame.current;
  prevFrame.current = new Uint8ClampedArray(current);
  if (!prev) return null;

  const map = coverMapping(video);
  const [vx0, vy0] = map.toVideo(DETECTION_ZONE.x0, DETECTION_ZONE.y0);
  const [vx1, vy1] = map.toVideo(DETECTION_ZONE.x1, DETECTION_ZONE.y1);
  const px0 = Math.max(0, Math.floor(vx0 * width));
  const px1 = Math.min(width, Math.ceil(vx1 * width));
  const py0 = Math.max(0, Math.floor(vy0 * height));
  const py1 = Math.min(height, Math.ceil(vy1 * height));

  let mass = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = py0; y < py1; y += 2) {
    for (let x = px0; x < px1; x += 2) {
      const i = (y * width + x) * 4;
      const diff =
        Math.abs(current[i] - prev[i]) +
        Math.abs(current[i + 1] - prev[i + 1]) +
        Math.abs(current[i + 2] - prev[i + 2]);
      if (diff > PIXEL_DIFF_THRESHOLD) {
        mass++;
        sumX += x;
        sumY += y;
      }
    }
  }

  if (mass < MIN_MOTION_MASS) return null;
  const [sx, sy] = map.toScreen(sumX / mass / width, sumY / mass / height);
  return { x: sx, y: sy, mass };
}

/**
 * Keeps a short history of motion centroids and reports a swipe when the
 * centroid travels far enough horizontally within SWIPE_WINDOW_MS.
 * Screen right = FAKE, screen left = FATO.
 */
export class SwipeDetector {
  private history: { t: number; x: number }[] = [];

  reset() {
    this.history = [];
  }

  push(time: number, sample: MotionSample | null): Verdict | null {
    if (sample) this.history.push({ t: time, x: sample.x });
    this.history = this.history.filter(h => time - h.t <= SWIPE_WINDOW_MS);
    if (this.history.length < 3) return null;

    const dx = this.history[this.history.length - 1].x - this.history[0].x;
    if (Math.abs(dx) < SWIPE_MIN_DX) return null;

    this.reset();
    return dx > 0 ? 'FAKE' : 'FATO';
  }
}
