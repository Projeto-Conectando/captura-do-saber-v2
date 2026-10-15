import { useMemo, CSSProperties } from "react";

const COLORS = ["#fbbf24", "#f97316", "#fde047", "#ffffff"];
const BURST_COUNT = 28;
const SPARK_COUNT = 30;

interface Particle {
  left: number; // % of card width
  top: number; // % of card height
  dx: number; // px
  dy: number; // px
  size: number; // px
  color: string;
  dur: number; // ms
  delay: number; // ms
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// A random point on the card border, with the outward direction at that point
function perimeterPoint(): { left: number; top: number; nx: number; ny: number } {
  // Card is 16:9, so long sides get proportionally more particles
  const r = Math.random() * (16 + 9) * 2;
  if (r < 16) return { left: (r / 16) * 100, top: 0, nx: 0, ny: -1 };
  if (r < 32) return { left: ((r - 16) / 16) * 100, top: 100, nx: 0, ny: 1 };
  if (r < 41) return { left: 0, top: ((r - 32) / 9) * 100, nx: -1, ny: 0 };
  return { left: 100, top: ((r - 41) / 9) * 100, nx: 1, ny: 0 };
}

function makeParticles(count: number, minDist: number, maxDist: number, minSize: number, maxSize: number, minDur: number, maxDur: number, maxDelay: number): Particle[] {
  return Array.from({ length: count }, () => {
    const p = perimeterPoint();
    const dist = rand(minDist, maxDist);
    const spread = rand(-0.6, 0.6); // sideways drift along the border
    return {
      left: p.left,
      top: p.top,
      dx: (p.nx + (p.ny !== 0 ? spread : 0)) * dist,
      dy: (p.ny + (p.nx !== 0 ? spread : 0)) * dist,
      size: rand(minSize, maxSize),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      dur: rand(minDur, maxDur),
      delay: rand(0, maxDelay),
    };
  });
}

function ParticleDot({ p, loop }: { p: Particle; loop?: boolean }) {
  const style = {
    left: `${p.left}%`,
    top: `${p.top}%`,
    width: p.size,
    height: p.size,
    backgroundColor: p.color,
    boxShadow: `0 0 ${p.size}px ${p.color}`,
    "--dx": `${p.dx}px`,
    "--dy": `${p.dy}px`,
    "--dur": `${p.dur}ms`,
    "--delay": `${p.delay}ms`,
  } as CSSProperties;
  return <span className={`particle ${loop ? "particle-loop" : ""}`} style={style} />;
}

/**
 * Burst of particles when the headline becomes decidable, followed by
 * continuous sparks drifting out of its border. Mount it when the decision
 * window opens (it plays the burst on mount).
 */
export function ReadyParticles() {
  const burst = useMemo(() => makeParticles(BURST_COUNT, 90, 220, 8, 16, 600, 900, 60), []);
  const sparks = useMemo(() => makeParticles(SPARK_COUNT, 40, 110, 8, 14, 900, 1500, 1500), []);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {burst.map((p, i) => <ParticleDot key={`b${i}`} p={p} />)}
      {sparks.map((p, i) => <ParticleDot key={`s${i}`} p={p} loop />)}
    </div>
  );
}
