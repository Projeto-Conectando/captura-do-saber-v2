import { HandLandmarker, HandLandmarkerOptions } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import { HandPoint } from './types';

const MODEL_PATH = '/models/hand_landmarker.task';

// Landmarks averaged to get the palm center (wrist + base of each finger)
const PALM_LANDMARKS = [0, 5, 9, 13, 17];

export async function createHandTracker(): Promise<HandLandmarker> {
  const fileset = { wasmLoaderPath, wasmBinaryPath };
  const options = (delegate: 'GPU' | 'CPU'): HandLandmarkerOptions => ({
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await HandLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (err) {
    console.warn('GPU hand tracking unavailable, using CPU', err);
    return HandLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

/**
 * Converts a point in the raw video frame (0-1) to screen coordinates (0-1),
 * accounting for the mirrored display, object-cover cropping and digital zoom.
 */
function videoToScreen(vx: number, vy: number, video: HTMLVideoElement, zoom: number): [number, number] {
  const va = video.videoWidth / video.videoHeight;
  const sa = window.innerWidth / window.innerHeight;
  const fx = sa > va ? 1 : sa / va; // fraction of the video width visible on screen
  const fy = sa > va ? va / sa : 1;
  const mx = 1 - vx; // mirror
  return [0.5 + ((mx - 0.5) / fx) * zoom, 0.5 + ((vy - 0.5) / fy) * zoom];
}

export class HandTracker {
  private lastVideoTime = -1;
  private lastHands: HandPoint[] = [];

  constructor(private landmarker: HandLandmarker) {}

  detect(video: HTMLVideoElement, time: number, zoom: number): HandPoint[] {
    if (video.readyState < 2 || !video.videoWidth) return [];
    // Only run the model once per new camera frame
    if (video.currentTime === this.lastVideoTime) return this.lastHands;
    this.lastVideoTime = video.currentTime;

    const result = this.landmarker.detectForVideo(video, time);
    const seen = new Set<string>();
    this.lastHands = result.landmarks.map((landmarks, i) => {
      let px = 0;
      let py = 0;
      for (const idx of PALM_LANDMARKS) {
        px += landmarks[idx].x;
        py += landmarks[idx].y;
      }
      const [x, y] = videoToScreen(px / PALM_LANDMARKS.length, py / PALM_LANDMARKS.length, video, zoom);
      let key = result.handedness[i]?.[0]?.categoryName ?? `hand${i}`;
      if (seen.has(key)) key = `${key}${i}`;
      seen.add(key);
      return { key, x, y };
    });
    return this.lastHands;
  }

  close() {
    this.landmarker.close();
  }
}
