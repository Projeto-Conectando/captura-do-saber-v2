import { ActiveCard } from "../types";

interface HeadlineCardProps {
  card: ActiveCard;
  now: number;
  decisionStart: number;
  flyMs: number;
  showAnswer: boolean;
}

const easeIn = (t: number) => t * t;

export function HeadlineCard({ card, now, decisionStart, flyMs, showAnswer }: HeadlineCardProps) {
  const p = card.progress;
  const inWindow = p >= decisionStart && !card.result;

  // Card travels from the "horizon" (small, high) towards the player (big, centered)
  const scale = 0.2 + 0.8 * easeIn(p);
  const top = 28 + 22 * p;

  // After a decision the card flies off to the chosen side
  let offsetX = 0;
  let rotate = 0;
  let opacity = 1;
  if (card.result) {
    const t = Math.min(1, (now - card.result.time) / flyMs);
    if (card.result.choice) {
      const dir = card.result.choice === "FAKE" ? 1 : -1;
      offsetX = dir * 110 * easeIn(t);
      rotate = dir * 25 * t;
    } else {
      opacity = 1 - t; // missed: fade out
    }
  }

  const resultColor = card.result
    ? card.result.correct ? "#10b981" : "#ef4444"
    : inWindow ? "#f59e0b" : "#cbd5e1";

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{
        left: `calc(50% + ${offsetX}vw)`,
        top: `${top}%`,
        transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`,
        opacity,
      }}
    >
      <div
        className={`relative w-[44vw] max-w-[620px] aspect-[16/9] bg-white rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col gap-3 ${inWindow ? "animate-pulse" : ""}`}
        style={{ border: `8px solid ${resultColor}` }}
      >
        <span className="text-xs md:text-sm font-black tracking-[0.25em] text-slate-400">
          MANCHETE #{card.headline.index}
        </span>
        <h2 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900 leading-tight">
          {card.headline.title}
        </h2>
        {/* Placeholder text lines */}
        <div className="mt-auto flex flex-col gap-2">
          <div className="h-3 rounded bg-slate-200 w-full" />
          <div className="h-3 rounded bg-slate-200 w-5/6" />
          <div className="h-3 rounded bg-slate-200 w-2/3" />
        </div>
        {showAnswer && (
          <span className="absolute bottom-2 right-3 text-[10px] md:text-xs font-mono text-slate-400">
            teste · resposta: {card.headline.truth}
          </span>
        )}

        {card.result && (
          <div
            className="absolute inset-0 rounded-xl flex items-center justify-center text-4xl md:text-6xl font-black tracking-tighter text-white"
            style={{ backgroundColor: `${resultColor}e6` }}
          >
            {card.result.choice === null ? "TEMPO ESGOTADO" : card.result.correct ? "ACERTOU!" : "ERROU!"}
          </div>
        )}
      </div>
    </div>
  );
}
