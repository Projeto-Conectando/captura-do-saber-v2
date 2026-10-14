let audioCtx: AudioContext | null = null;

export const initAudio = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
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
    gainNode.connect(audioCtx.destination);

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
    gainNode.connect(audioCtx.destination);

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
      gainNode.connect(audioCtx!.destination);

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
