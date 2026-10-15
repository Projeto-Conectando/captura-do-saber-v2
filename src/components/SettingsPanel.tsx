import type { ReactNode } from "react";
import { useState } from "react";
import { X, Camera, Keyboard, RefreshCw } from "lucide-react";
import { Settings, DEFAULT_SETTINGS, headlineDuration } from "../settings";
import { CameraControls, DIGITAL_ZOOM } from "../camera";
import { initAudio, playReadySound } from "../audio";
import { HeadlineBank, SHEET_CSV_URL, countUnseen, resetSeen } from "../headlines";

export type TrackerStatus = "loading" | "ready" | "error";

interface SettingsPanelProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  cameras: MediaDeviceInfo[];
  activeDeviceId: string | null;
  controls: CameraControls | null;
  cameraError: string | null;
  trackerStatus: TrackerStatus;
  totalRounds: number;
  bank: HeadlineBank | null;
  bankLoading: boolean;
  onReloadBank: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-black tracking-[0.2em] text-slate-400 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-1 bg-slate-100 p-1 rounded-xl">
      {options.map(o => (
        <button
          key={o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${value === o.value ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, format, onChange, onRelease }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  onRelease?: () => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-sm font-bold text-slate-700">
        {label}
        <span className="font-mono text-slate-500">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
        className="w-full accent-slate-900"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm font-bold text-slate-700 cursor-pointer">
      {label}
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-5 h-5 accent-slate-900" />
    </label>
  );
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

const Note = ({ children }: { children: ReactNode }) => <p className="text-xs text-slate-500 leading-snug">{children}</p>;

export function SettingsPanel({ settings, onChange, onClose, cameras, activeDeviceId, controls, cameraError, trackerStatus, totalRounds, bank, bankLoading, onReloadBank }: SettingsPanelProps) {
  const [, setSeenVersion] = useState(0); // re-render after clearing the seen history
  const hwZoom = controls?.zoom ?? null;
  const zoomRange = hwZoom ?? DIGITAL_ZOOM;
  const zoomValue = Math.min(zoomRange.max, Math.max(zoomRange.min, settings.zoom));

  return (
    <div className="absolute inset-y-0 right-0 z-[70] w-full max-w-sm bg-white/95 backdrop-blur-md shadow-2xl border-l border-slate-200 flex flex-col">
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
        <h2 className="text-xl font-black tracking-tight">Configurações</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100" title="Fechar">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-7">
        <Section title="Controle">
          <Segmented
            value={settings.inputMode}
            onChange={inputMode => onChange({ inputMode })}
            options={[
              { value: "camera", label: <><Camera className="w-4 h-4" /> Câmera (mãos)</> },
              { value: "keyboard", label: <><Keyboard className="w-4 h-4" /> Teclado</> },
            ]}
          />
          <Note>
            {settings.inputMode === "camera"
              ? "Arraste a manchete com a mão. As setas do teclado ficam desligadas."
              : "Use as setas ← (FATO) e → (FAKE). A câmera não é usada para jogar."}
          </Note>
          {settings.inputMode === "camera" && trackerStatus === "loading" && <Note>Carregando o rastreamento de mãos…</Note>}
          {settings.inputMode === "camera" && trackerStatus === "error" && (
            <p className="text-xs font-bold text-red-600">Não foi possível carregar o rastreamento de mãos. Use o modo teclado.</p>
          )}
        </Section>

        <Section title="Câmera">
          {cameraError ? (
            <p className="text-xs font-bold text-red-600">{cameraError}</p>
          ) : (
            <>
              {cameras.length > 1 && (
                <label className="flex flex-col gap-1 text-sm font-bold text-slate-700">
                  Dispositivo
                  <select
                    value={activeDeviceId ?? ""}
                    onChange={e => onChange({ deviceId: e.target.value || null })}
                    className="border border-slate-300 rounded-lg px-3 py-2 font-medium bg-white"
                  >
                    {cameras.map((c, i) => (
                      <option key={c.deviceId} value={c.deviceId}>{c.label || `Câmera ${i + 1}`}</option>
                    ))}
                  </select>
                </label>
              )}

              <Slider
                label={hwZoom ? "Zoom" : "Zoom digital"}
                value={zoomValue}
                min={zoomRange.min}
                max={zoomRange.max}
                step={zoomRange.step || 0.1}
                format={v => hwZoom ? String(Math.round(v)) : `${v.toFixed(1)}x`}
                onChange={zoom => onChange({ zoom })}
              />
              {!hwZoom && <Note>Esta câmera não tem zoom controlável pelo navegador; o zoom é feito ampliando a imagem.</Note>}
            </>
          )}
        </Section>

        <Section title="Banco de manchetes">
          {bankLoading ? (
            <Note>Carregando manchetes…</Note>
          ) : bank ? (
            <>
              <p className="text-sm font-bold text-slate-700">
                {bank.headlines.length} manchetes ativas
                <span className="font-medium text-slate-500">
                  {" "}· {bank.headlines.filter(h => h.truth === "FATO").length} fatos, {bank.headlines.filter(h => h.truth === "FAKE").length} fakes
                </span>
              </p>
              <Note>
                Fonte: {bank.source === "sheet" ? "planilha do Google" : "cópia de reserva do jogo"}.
                {" "}Ainda não vistas neste aparelho: {countUnseen(bank.headlines)}.
              </Note>
              {!SHEET_CSV_URL && <Note>Nenhuma planilha conectada ainda; usando a cópia de reserva.</Note>}
              {bank.sheetError && <p className="text-xs font-bold text-red-600">{bank.sheetError} Usando a cópia de reserva.</p>}
              {bank.warnings.length > 0 && (
                <details className="text-xs text-amber-700">
                  <summary className="font-bold cursor-pointer">{bank.warnings.length} linha(s) ignorada(s)</summary>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {bank.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p className="text-xs font-bold text-red-600">Não foi possível carregar as manchetes.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onReloadBank}
              disabled={bankLoading}
              className="flex items-center justify-center gap-2 text-sm font-bold px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" /> Recarregar
            </button>
            <button
              onClick={() => {
                resetSeen();
                setSeenVersion(v => v + 1);
              }}
              className="text-sm font-bold px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200"
            >
              Zerar vistas
            </button>
          </div>
        </Section>

        <Section title="Som">
          <Slider
            label="Volume"
            value={settings.volume}
            min={0}
            max={100}
            step={5}
            format={v => v === 0 ? "mudo" : `${v}%`}
            onChange={volume => onChange({ volume })}
            onRelease={() => {
              // Preview the new volume
              initAudio();
              playReadySound();
            }}
          />
        </Section>

        <Section title="Manchete">
          <Slider
            label="Velocidade"
            value={settings.speed}
            min={1}
            max={10}
            step={1}
            onChange={speed => onChange({ speed })}
          />
          <Slider
            label="Aumento de velocidade a cada manchete"
            value={settings.acceleration}
            min={0}
            max={10}
            step={1}
            format={v => v === 0 ? "sem aumento" : String(v)}
            onChange={acceleration => onChange({ acceleration })}
          />
          <Note>
            A primeira manchete leva {seconds(headlineDuration(settings, 1))} para chegar até você;
            a última, {seconds(headlineDuration(settings, totalRounds))}.
          </Note>
        </Section>

        <Section title="Gesto">
          <Slider
            label="Sensibilidade"
            value={settings.sensitivity}
            min={1}
            max={10}
            step={1}
            onChange={sensitivity => onChange({ sensitivity })}
          />
          <Note>Quanto maior, menor o movimento de mão necessário para jogar a manchete.</Note>
          <Toggle label="Mostrar marcador das mãos" checked={settings.showHands} onChange={showHands => onChange({ showHands })} />
          <Toggle label="Modo de teste (mostra a resposta)" checked={settings.debug} onChange={debug => onChange({ debug })} />
        </Section>
      </div>

      <div className="px-6 py-4 border-t border-slate-200">
        <button
          onClick={() => onChange({ ...DEFAULT_SETTINGS, deviceId: settings.deviceId })}
          className="w-full text-sm font-bold text-slate-600 hover:text-slate-900 py-2"
        >
          Restaurar padrão
        </button>
      </div>
    </div>
  );
}
