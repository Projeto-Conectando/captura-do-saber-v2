import { GameStatus } from "../types";
import { Play, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

interface GameScreensProps {
  status: GameStatus;
  startGame: () => void;
  correct: number;
  total: number;
  snapshot?: string | null;
}

function BigButton({ onClick, label, icon }: { onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button onClick={onClick} className="group relative w-full max-w-md mx-auto">
      <div className="absolute inset-0 bg-slate-900 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
      <div className="relative bg-slate-900 text-white px-8 py-5 md:px-16 md:py-6 rounded-2xl font-black text-xl md:text-2xl tracking-tighter uppercase flex items-center justify-center gap-4 border-b-4 border-slate-700 hover:bg-slate-800 transition-colors">
        {label}
        {icon}
      </div>
    </button>
  );
}

export function GameScreens({ status, startGame, correct, total, snapshot }: GameScreensProps) {
  if (status === "START") {
    return (
      <div className="absolute inset-0 bg-white/70 backdrop-blur-md flex flex-col items-center justify-center p-6 md:p-20 text-center z-50">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center"
        >
          <img src="/logo.png" alt="Logo" className="w-[640px] max-w-[80vw] h-auto mb-8 object-contain" />

          <div className="flex flex-col md:flex-row gap-4 md:gap-10 mb-10 text-lg md:text-2xl font-black tracking-tight">
            <span className="text-emerald-600">← Arraste para a esquerda: FATO</span>
            <span className="text-red-500">Arraste para a direita: FAKE →</span>
          </div>
          <p className="text-slate-600 font-medium mb-10 max-w-xl">
            Fique de frente para a câmera, dentro do contorno. Quando a manchete chegar perto de você, arraste-a com a mão para o lado certo.
          </p>

          <BigButton onClick={startGame} label="Iniciar Partida" icon={<Play className="w-6 h-6 md:w-8 md:h-8" strokeWidth={3} />} />
        </motion.div>
      </div>
    );
  }

  if (status === "END") {
    const ratio = total ? correct / total : 0;
    const good = ratio >= 0.7;
    return (
      <div className="absolute inset-0 bg-white/70 backdrop-blur-md flex flex-col items-center justify-center p-6 md:p-20 text-center z-50">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="flex flex-col items-center w-full max-w-2xl"
        >
          <h1 className="text-5xl md:text-7xl font-black leading-none mb-6 tracking-tighter uppercase text-slate-900">
            {good ? "Mandou bem!" : "Fim de jogo"}<br />
            <span className={good ? "text-emerald-600" : "text-red-500"}>
              {correct} de {total} acertos
            </span>
          </h1>

          {snapshot && (
            <div className="mb-8 p-3 bg-white rounded-2xl shadow-xl border border-slate-200 rotate-2 hover:rotate-0 transition-transform duration-300">
              <img src={snapshot} alt="Sua reação final" className="w-64 h-48 md:w-[400px] md:h-[300px] object-cover rounded-xl" />
            </div>
          )}

          <BigButton onClick={startGame} label="Jogar de novo" icon={<RefreshCw className="w-6 h-6 md:w-8 md:h-8" strokeWidth={3} />} />
        </motion.div>
      </div>
    );
  }

  return null;
}
