import { MotionSample, Verdict } from "../types";
import { DETECTION_ZONE } from "../motion";

interface HudProps {
  correct: number;
  wrong: number;
  round: number;
  totalRounds: number;
  lastChoice: Verdict | null;
  decisionOpen: boolean;
  motion: MotionSample | null;
  debug: boolean;
}

function SideLabel({ side, active, open }: { side: Verdict; active: boolean; open: boolean }) {
  const isFake = side === "FAKE";
  const color = isFake ? "bg-red-500" : "bg-emerald-500";
  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 ${isFake ? "right-4 md:right-10" : "left-4 md:left-10"} z-20 flex flex-col items-center gap-2 transition-all duration-200 ${active ? "scale-125" : open ? "scale-100" : "scale-90 opacity-60"}`}
    >
      <div className={`${color} text-white font-black text-2xl md:text-5xl tracking-tighter px-4 py-3 md:px-8 md:py-5 rounded-2xl shadow-xl`}>
        {isFake ? "FAKE →" : "← FATO"}
      </div>
    </div>
  );
}

export function Hud({ correct, wrong, round, totalRounds, lastChoice, decisionOpen, motion, debug }: HudProps) {
  return (
    <>
      {/* Score */}
      <div className="absolute top-6 md:top-10 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 md:gap-6 bg-white/85 backdrop-blur-md rounded-full px-5 py-2 md:px-8 md:py-3 shadow-lg border border-slate-200 font-black tracking-tight">
        <span className="text-emerald-600">Acertos {correct}</span>
        <span className="text-red-500">Erros {wrong}</span>
        <span className="text-slate-500">Manchete {Math.min(round, totalRounds)}/{totalRounds}</span>
      </div>

      <SideLabel side="FATO" active={lastChoice === "FATO"} open={decisionOpen} />
      <SideLabel side="FAKE" active={lastChoice === "FAKE"} open={decisionOpen} />

      {decisionOpen && (
        <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 z-40 bg-amber-400 text-slate-900 font-black text-lg md:text-2xl tracking-tight px-6 py-2 rounded-full shadow-lg">
          DECIDA! Arraste com a mão
        </div>
      )}

      {/* Fixed player position guide (head + shoulders outline) */}
      <svg
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[70%] z-10 pointer-events-none opacity-40"
        viewBox="0 0 200 220"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeDasharray="8 6"
      >
        <ellipse cx="100" cy="60" rx="34" ry="44" />
        <path d="M20 220 C20 150 50 125 100 125 C150 125 180 150 180 220" />
      </svg>

      {debug && (
        <>
          <div
            className="absolute z-20 pointer-events-none border-2 border-dashed border-cyan-400/70 rounded-xl"
            style={{
              left: `${DETECTION_ZONE.x0 * 100}%`,
              top: `${DETECTION_ZONE.y0 * 100}%`,
              width: `${(DETECTION_ZONE.x1 - DETECTION_ZONE.x0) * 100}%`,
              height: `${(DETECTION_ZONE.y1 - DETECTION_ZONE.y0) * 100}%`,
            }}
          />
          {motion && (
            <div
              className="absolute z-40 w-6 h-6 -ml-3 -mt-3 rounded-full bg-cyan-400 border-2 border-white shadow pointer-events-none"
              style={{ left: `${motion.x * 100}%`, top: `${motion.y * 100}%` }}
            />
          )}
          <div className="absolute bottom-3 left-3 z-40 text-[10px] md:text-xs font-mono text-white bg-black/50 px-2 py-1 rounded">
            debug (D) · teclas ← FATO / → FAKE · movimento: {motion ? motion.mass : 0}px
          </div>
        </>
      )}
    </>
  );
}
