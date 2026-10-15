import { motion } from "motion/react";
import { CardResult, Headline } from "../types";

interface FeedbackBannerProps {
  headline: Headline;
  result: CardResult;
  progress: number; // 0 → 1 while the banner is on screen
}

/** After each play: whether the player got it right, the real answer and why. */
export function FeedbackBanner({ headline, result, progress }: FeedbackBannerProps) {
  const isFake = headline.truth === "FAKE";
  const verdictText = result.choice === null ? "TEMPO ESGOTADO" : result.correct ? "ACERTOU!" : "ERROU!";
  const verdictColor = result.correct ? "text-emerald-600" : "text-red-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-[6%] left-1/2 -translate-x-1/2 z-40 w-[min(92vw,820px)] pointer-events-none"
    >
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 md:px-8 md:py-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className={`text-3xl md:text-4xl font-black tracking-tighter ${verdictColor}`}>{verdictText}</span>
            <span className="text-lg md:text-xl font-bold text-slate-600">
              Esta manchete é{" "}
              <span className={`inline-block px-3 py-0.5 rounded-full text-white font-black ${isFake ? "bg-red-500" : "bg-emerald-500"}`}>
                {headline.truth}
              </span>
            </span>
          </div>
          <p className="text-sm md:text-base font-semibold text-slate-400 leading-snug">“{headline.title}”</p>
          {headline.explanation && (
            <p className="text-lg md:text-2xl font-medium text-slate-800 leading-snug">{headline.explanation}</p>
          )}
        </div>
        {/* Time left before the next headline */}
        <div className="h-1.5 bg-slate-100">
          <div
            className={`h-full ${isFake ? "bg-red-400" : "bg-emerald-400"}`}
            style={{ width: `${Math.max(0, 1 - progress) * 100}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}
