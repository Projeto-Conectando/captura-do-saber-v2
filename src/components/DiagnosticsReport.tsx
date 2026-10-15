import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { RoundLog } from "../types";

type Stroke = RoundLog["strokes"][number];

const arrow = (dir: RoundLog["truth"]) => (dir === "FAKE" ? "→ FAKE" : "← FATO");
const num = (n: number) => n.toFixed(2);
const strokesLabel = (n: number) => `${n} ${n === 1 ? "golpe" : "golpes"}`;

// Why a stroke did or didn't count, in plain words
function strokeVerdict(st: Stroke): { ok: boolean; text: string } {
  if (st.accepted && !st.early) return { ok: true, text: "VALEU" };
  if (st.accepted) return { ok: false, text: "ignorado: antes da hora de decidir" };
  const reasons: string[] = [];
  if (!st.touched) reasons.push("não tocou a manchete");
  if (st.dx < st.minDx) reasons.push(`curto (${num(st.dx)} de ${num(st.minDx)})`);
  if (st.speed < st.minSpeed) reasons.push(`lento (${num(st.speed)} de ${num(st.minSpeed)})`);
  if (st.early) reasons.push("antes da hora de decidir");
  return { ok: false, text: reasons.join(", ") || "não valeu" };
}

function choiceText(r: RoundLog) {
  if (r.choice === null) return "tempo esgotado";
  return `${r.choice} ${r.correct ? "✓" : "✗"}`;
}

function summarize(log: RoundLog[]) {
  const strokes = log.flatMap(r => r.strokes);
  const byDir = (dir: RoundLog["truth"]) => {
    const all = strokes.filter(s => s.dir === dir);
    return { total: all.length, valid: all.filter(s => s.accepted && !s.early).length };
  };
  const rejected = strokes.filter(s => !s.accepted);
  return {
    left: byDir("FATO"),
    right: byDir("FAKE"),
    noTouch: rejected.filter(s => !s.touched).length,
    short: rejected.filter(s => s.dx < s.minDx).length,
    slow: rejected.filter(s => s.speed < s.minSpeed).length,
    early: strokes.filter(s => s.accepted && s.early).length,
    timeouts: log.filter(r => r.choice === null).length,
  };
}

function reportText(log: RoundLog[]) {
  const s = summarize(log);
  const lines = [
    "Diagnóstico do gesto — Fato ou Fake",
    `Golpes para a esquerda (FATO): ${s.left.total}, valeram ${s.left.valid}`,
    `Golpes para a direita (FAKE): ${s.right.total}, valeram ${s.right.valid}`,
    `Recusados — sem toque: ${s.noTouch}, curtos: ${s.short}, lentos: ${s.slow}; antes da hora: ${s.early}; tempo esgotado: ${s.timeouts}`,
    "",
  ];
  for (const r of log) {
    const seen = r.handSeenPct === null ? "" : ` · mão visível ${r.handSeenPct}%`;
    lines.push(`#${r.index} "${r.title}" — resposta ${r.truth} · escolha ${choiceText(r)}${seen}`);
    if (!r.strokes.length) lines.push("   nenhum golpe detectado");
    for (const st of r.strokes) {
      lines.push(
        `   ${st.atMs}ms ${arrow(st.dir)} — ${strokeVerdict(st).text} · tocou ${st.touched ? "sim" : "não"} · dist ${num(st.dx)}/${num(st.minDx)} · vel ${num(st.speed)}/${num(st.minSpeed)}`,
      );
    }
  }
  return lines.join("\n");
}

export function DiagnosticsReport({ log }: { log: RoundLog[] }) {
  const [copied, setCopied] = useState(false);
  const s = summarize(log);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText(log));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-200 text-left overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200">
        <h2 className="font-black tracking-tight text-lg">Diagnóstico do gesto</h2>
        <button
          onClick={copy}
          className="flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 py-4 text-sm border-b border-slate-200">
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="font-black text-emerald-600">← Esquerda (FATO)</div>
          <div className="text-slate-600">{strokesLabel(s.left.total)} · <b>{s.left.valid}</b> valeram</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="font-black text-red-500">Direita (FAKE) →</div>
          <div className="text-slate-600">{strokesLabel(s.right.total)} · <b>{s.right.valid}</b> valeram</div>
        </div>
        <div className="col-span-2 text-xs text-slate-500">
          Recusados — sem toque: <b>{s.noTouch}</b> · curtos: <b>{s.short}</b> · lentos: <b>{s.slow}</b> ·
          antes da hora: <b>{s.early}</b> · tempo esgotado: <b>{s.timeouts}</b>
        </div>
      </div>

      <ol className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100">
        {log.map(r => (
          <li key={r.index} className="px-5 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 text-sm font-bold">
              <span>#{r.index}</span>
              <span className="font-medium text-slate-700">“{r.title}”</span>
              <span className="text-slate-500">resposta {r.truth}</span>
              <span className={r.correct ? "text-emerald-600" : "text-red-500"}>escolha: {choiceText(r)}</span>
              {r.handSeenPct !== null && (
                <span className={`text-xs font-medium ${r.handSeenPct < 70 ? "text-amber-600" : "text-slate-400"}`}>
                  mão visível {r.handSeenPct}%
                </span>
              )}
            </div>
            {r.strokes.length === 0 ? (
              <p className="text-xs text-slate-400 mt-1">nenhum golpe detectado</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-0.5 font-mono text-[11px] md:text-xs">
                {r.strokes.map((st, i) => {
                  const v = strokeVerdict(st);
                  return (
                    <li key={i} className={v.ok ? "text-emerald-700" : "text-slate-600"}>
                      <span className="text-slate-400">{(st.atMs / 1000).toFixed(1)}s</span> {arrow(st.dir)} —{" "}
                      <span className={v.ok ? "font-bold" : "text-red-600"}>{v.text}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
