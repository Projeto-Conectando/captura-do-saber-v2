import { Settings } from './settings';

interface Range {
  min: number;
  max: number;
  step: number;
}

// Zoom capability isn't in TypeScript's DOM typings yet
interface PtzCapabilities {
  zoom?: Range;
}

export interface CameraControls {
  zoom: Range | null; // null = camera has no hardware zoom (digital zoom is used)
}

export const DIGITAL_ZOOM: Range = { min: 1, max: 3, step: 0.1 };

export async function openCamera(deviceId: string | null): Promise<MediaStream> {
  const video: MediaTrackConstraints & { zoom?: boolean } = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    // Asks Chrome for pan/tilt/zoom access, so hardware zoom becomes controllable
    zoom: true,
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
  };
  try {
    return await navigator.mediaDevices.getUserMedia({ video });
  } catch (err) {
    // The chosen camera may be gone: fall back to any camera
    if (deviceId) return navigator.mediaDevices.getUserMedia({ video: true });
    throw err;
  }
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput');
}

export function getControls(track: MediaStreamTrack): CameraControls {
  const caps = (track.getCapabilities?.() ?? {}) as PtzCapabilities;
  const zoom = caps.zoom && caps.zoom.max > caps.zoom.min ? caps.zoom : null;
  return { zoom };
}

/** Applies the zoom setting when the camera supports hardware zoom. */
export async function applyCameraSettings(track: MediaStreamTrack, controls: CameraControls, s: Settings) {
  if (!controls.zoom) return;
  const zoom = Math.min(controls.zoom.max, Math.max(controls.zoom.min, s.zoom));
  try {
    await track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] });
  } catch (err) {
    console.warn('Camera settings not applied', err);
  }
}

/** Digital zoom factor to apply in CSS when the camera has no hardware zoom. */
export function digitalZoom(controls: CameraControls | null, s: Settings) {
  if (controls?.zoom) return 1;
  return Math.min(DIGITAL_ZOOM.max, Math.max(DIGITAL_ZOOM.min, s.zoom));
}
