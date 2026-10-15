let audioCtx: AudioContext | null = null;
// Every sound goes through this node, so one setting controls the volume
let masterGain: GainNode | null = null;
let volume = 0.8;

export const initAudio = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

// 0 (mute) to 1
export const setVolume = (v: number) => {
  volume = v;
  if (masterGain) masterGain.gain.value = v;
};

export const playHitSound = () => {
  if (!audioCtx) return;
  
  try {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    
    // Sweep frequency up quickly to simulate a "happy pop/ding"
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
    
    // Decay volume quickly
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.connect(gainNode);
    gainNode.connect(masterGain!);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch (e) {
    console.error("Audio error", e);
  }
};

export const playMissSound = () => {
  if (!audioCtx) return;
  
  try {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sawtooth';
    
    // Sweep frequency down to simulate an "error/miss"
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
    
    // Decay volume
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    osc.connect(gainNode);
    gainNode.connect(masterGain!);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    console.error("Audio error", e);
  }
};

let heartbeatTimer: any = null;
let currentKnowledge: number = 100;

const playHeartbeatSound = () => {
  if (!audioCtx) return;
  try {
    const playBeat = (timeOffset: number) => {
      const osc = audioCtx!.createOscillator();
      const gainNode = audioCtx!.createGain();

      osc.type = 'sine';
      
      // Simulate low frequency heartbeat
      osc.frequency.setValueAtTime(80, audioCtx!.currentTime + timeOffset);
      osc.frequency.exponentialRampToValueAtTime(40, audioCtx!.currentTime + timeOffset + 0.15);
      
      // Envelope for a heartbeat thud
      gainNode.gain.setValueAtTime(0, audioCtx!.currentTime + timeOffset);
      gainNode.gain.linearRampToValueAtTime(0.6, audioCtx!.currentTime + timeOffset + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx!.currentTime + timeOffset + 0.3);

      osc.connect(gainNode);
      gainNode.connect(masterGain!);

      osc.start(audioCtx!.currentTime + timeOffset);
      osc.stop(audioCtx!.currentTime + timeOffset + 0.3);
    };

    // Double beat "lub-dub"
    playBeat(0);
    // Only play second beat if not beating too fast
    if (Math.max(0.3, currentKnowledge / 50) > 0.4) {
      playBeat(0.15);
    }

  } catch(e) {
    console.error("Audio error", e);
  }
};

const scheduleNextHeartbeat = () => {
  if (currentKnowledge >= 50) {
    heartbeatTimer = null;
    return;
  }
  
  playHeartbeatSound();
  
  const beatInterval = Math.max(0.3, currentKnowledge / 50) * 1000; 
  
  heartbeatTimer = setTimeout(() => {
      scheduleNextHeartbeat();
  }, beatInterval);
};

export const startHeartbeat = (knowledge: number) => {
  currentKnowledge = knowledge;
  if (!audioCtx) return;
  stopHeartbeat();
  if (currentKnowledge < 50) {
    scheduleNextHeartbeat();
  }
};

export const updateHeartbeat = (knowledge: number) => {
  const previousKnowledge = currentKnowledge;
  currentKnowledge = knowledge;
  
  if (currentKnowledge >= 50) {
    stopHeartbeat();
  } else if (!heartbeatTimer && currentKnowledge < 50) {
    scheduleNextHeartbeat();
  }
};

export const stopHeartbeat = () => {
  if (heartbeatTimer) {
     clearTimeout(heartbeatTimer);
     heartbeatTimer = null;
  }
};

// Bright two-note chime: the headline is close enough to decide
export const playReadySound = () => {
  if (!audioCtx) return;

  try {
    const now = audioCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const start = now + i * 0.09;
      const osc = audioCtx!.createOscillator();
      const gainNode = audioCtx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gainNode.gain.setValueAtTime(0.0001, start);
      gainNode.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

      osc.connect(gainNode);
      gainNode.connect(masterGain!);

      osc.start(start);
      osc.stop(start + 0.35);
    });
  } catch (e) {
    console.error("Audio error", e);
  }
};

// Short beep for each countdown number; a higher, longer one for "go"
export const playCountdownBeep = (final: boolean) => {
  if (!audioCtx) return;

  try {
    const now = audioCtx.currentTime;
    const length = final ? 0.45 : 0.15;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(final ? 990 : 660, now);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + length);

    osc.connect(gainNode);
    gainNode.connect(masterGain!);

    osc.start(now);
    osc.stop(now + length);
  } catch (e) {
    console.error("Audio error", e);
  }
};
