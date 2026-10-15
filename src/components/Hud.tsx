import { Hand } from "lucide-react";
import { HandPoint, Verdict } from "../types";
import { InputMode } from "../settings";
import { Rect } from "../geometry";
import { StrokeInfo } from "../swipe";

interface HudProps {
  correct: number;
  wrong: number;
  round: number;
  totalRounds: number;
  lastChoice: Verdict | null;
  decisionOpen: boolean;
  inputMode: InputMode;
  hands: HandPoint[];
  trails: { x: number; y: number }[][];
  hitBox: Rect | null;
  lastStroke: StrokeInfo | null;
  showHands: boolean;
  debug: boolean;
}

// Explains in plain words why the last stroke did or didn't count
function StrokeDebug({ s }: { s: StrokeInfo }) {
  const ok = "text-emerald-300";
  const bad = "text-red-300";
  return (
    <div className="absolute bottom-10 left-3 z-40 text-[10px] md:text-xs font-mono text-white bg-black/60 px-2 py-1 rounded flex flex-col gap-0.5">
      <span>
        último golpe: {s.dir === "FAKE" ? "→ FAKE" : "← FATO"} ·{" "}
        <span className={s.accepted ? ok : bad}>{s.accepted ? "VALEU" : "não valeu"}</span>
      </span>
      <span className={s.touched ? ok : bad}>tocou a manchete: {s.touched ? "sim" : "não"}</span>
      <span className={s.dx >= s.minDx ? ok : bad}>distância: {s.dx.toFixed(2)} (mín {s.minDx.toFixed(2)})</span>
      <span className={s.speed >= s.minSpeed ? ok : bad}>velocidade: {s.speed.toFixed(2)} (mín {s.minSpeed.toFixed(2)})</span>
    </div>
  );
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

export function Hud({ correct, wrong, round, totalRounds, lastChoice, decisionOpen, inputMode, hands, trails, hitBox, lastStroke, showHands, debug }: HudProps) {
  const camera = inputMode === "camera";
  const prompt = camera
    ? hands.length ? "DECIDA! Arraste com a mão" : "DECIDA! Mostre a mão para a câmera"
    : "DECIDA! Use as setas ← →";

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
        <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 z-40 bg-amber-400 text-slate-900 font-black text-lg md:text-2xl tracking-tight px-6 py-2 rounded-full shadow-lg whitespace-nowrap">
          {prompt}
        </div>
      )}

      {/* Player position guide, only needed when not using the camera */}
      {!camera && (
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
      )}

      <HandMarkers inputMode={inputMode} hands={hands} trails={trails} hitBox={hitBox} showHands={showHands} debug={debug} />

      {debug && camera && lastStroke && <StrokeDebug s={lastStroke} />}

      {debug && (
        <div className="absolute bottom-3 left-3 z-40 text-[10px] md:text-xs font-mono text-white bg-black/50 px-2 py-1 rounded">
          modo {camera ? `câmera · mãos detectadas: ${hands.length}` : "teclado · ← FATO / → FAKE"}
        </div>
      )}
    </>
  );
}

interface HandMarkersProps {
  inputMode: InputMode;
  hands: HandPoint[];
  trails: { x: number; y: number }[][];
  hitBox: Rect | null;
  showHands: boolean;
  debug: boolean;
}

export function HandMarkers({ inputMode, hands, trails, hitBox, showHands, debug }: HandMarkersProps) {
  const camera = inputMode === "camera";
  return (
    <>
      {camera && debug && (
        <>
          {/* Area where a hand counts as touching the headline */}
          {hitBox && (
            <div
              className="absolute z-40 pointer-events-none bg-cyan-400/10 border-2 border-dashed border-cyan-400/70 rounded-xl"
              style={{
                left: `${hitBox.x0 * 100}%`,
                top: `${hitBox.y0 * 100}%`,
                width: `${(hitBox.x1 - hitBox.x0) * 100}%`,
                height: `${(hitBox.y1 - hitBox.y0) * 100}%`,
              }}
            />
          )}
          {trails.flat().map((p, i) => (
            <div
              key={i}
              className="absolute z-40 w-2 h-2 -ml-1 -mt-1 rounded-full bg-cyan-300/80 pointer-events-none"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            />
          ))}
        </>
      )}

      {camera && showHands && hands.map(h => (
        <div
          key={h.key}
          className="absolute z-40 w-14 h-14 -ml-7 -mt-7 rounded-full bg-white/30 border-4 border-white shadow-lg flex items-center justify-center pointer-events-none backdrop-blur-[2px]"
          style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%` }}
        >
          <Hand className="w-7 h-7 text-white drop-shadow" strokeWidth={2.5} />
        </div>
      ))}

    </>
  );
}
