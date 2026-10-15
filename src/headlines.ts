import { Verdict } from './types';

// Google Sheets "Publish to web" CSV link (File → Share → Publish to web → CSV).
// Empty = only the reserve copy bundled with the game (public/manchetes.csv) is used.
export const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQKr-Etlw6en3LvxHYDpLYAXOSFpD_HLRnSUHrRRfJRt-sgGApYMCkLR7yMYJsLLoDOZ0COmivWwGbc/pub?output=csv';

const RESERVE_CSV_URL = '/manchetes.csv';
const FETCH_TIMEOUT_MS = 6000;
const SEEN_KEY = 'fato-ou-fake:seen-headlines';

export interface HeadlineEntry {
  id: string;
  title: string;
  truth: Verdict;
  explanation: string;
  theme: string;
}

export interface HeadlineBank {
  headlines: HeadlineEntry[]; // active, valid headlines
  source: 'sheet' | 'reserve';
  warnings: string[]; // rows that were skipped and why
  sheetError: string | null; // why the sheet couldn't be used, if it was configured
}

/** Parses CSV text (quoted fields, commas and line breaks inside quotes, "" escapes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, ''); // strip BOM added by some editors

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(cell => cell.trim()));
}

// Lowercase, no accents, no extra spaces: "Explicação " → "explicacao"
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const INACTIVE = new Set(['nao', 'n', 'false', '0', 'inativa', 'off']);

/** Turns sheet rows into headlines, skipping (and explaining) invalid ones. */
export function parseHeadlines(text: string): { headlines: HeadlineEntry[]; warnings: string[] } {
  const rows = parseCsv(text);
  const warnings: string[] = [];
  if (!rows.length) return { headlines: [], warnings: ['A planilha está vazia.'] };

  const header = rows[0].map(normalize);
  const col = (name: string) => header.indexOf(name);
  const cols = {
    id: col('id'),
    title: col('manchete'),
    truth: col('resposta'),
    explanation: col('explicacao'),
    theme: col('tema'),
    active: col('ativa'),
  };
  const missing = (['id', 'manchete', 'resposta'] as const).filter((_, i) => [cols.id, cols.title, cols.truth][i] < 0);
  if (missing.length) {
    return { headlines: [], warnings: [`Faltam as colunas: ${missing.join(', ')}. A primeira linha precisa ter os nomes das colunas.`] };
  }

  const headlines: HeadlineEntry[] = [];
  const ids = new Set<string>();
  rows.slice(1).forEach((row, i) => {
    const line = i + 2; // spreadsheet row number (header is row 1)
    const get = (c: number) => (c >= 0 ? (row[c] ?? '').trim() : '');
    if (cols.active >= 0 && INACTIVE.has(normalize(get(cols.active)))) return;

    const id = get(cols.id);
    const title = get(cols.title);
    const truth = normalize(get(cols.truth)).toUpperCase();
    if (!id) return warnings.push(`Linha ${line}: sem id.`);
    if (!title) return warnings.push(`Linha ${line}: manchete vazia.`);
    if (truth !== 'FATO' && truth !== 'FAKE') {
      return warnings.push(`Linha ${line}: resposta "${get(cols.truth)}" (use FATO ou FAKE).`);
    }
    if (ids.has(id)) return warnings.push(`Linha ${line}: id ${id} repetido.`);
    ids.add(id);
    headlines.push({ id, title, truth, explanation: get(cols.explanation), theme: get(cols.theme) });
  });
  return { headlines, warnings };
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Loads headlines from the published sheet, falling back to the bundled reserve copy. */
export async function loadHeadlines(): Promise<HeadlineBank> {
  let sheetError: string | null = null;
  if (SHEET_CSV_URL) {
    try {
      const parsed = parseHeadlines(await fetchText(SHEET_CSV_URL));
      if (parsed.headlines.length) return { ...parsed, source: 'sheet', sheetError: null };
      sheetError = parsed.warnings[0] ?? 'Nenhuma manchete válida na planilha.';
    } catch (err) {
      sheetError = `Não foi possível ler a planilha (${err instanceof Error ? err.message : String(err)}).`;
    }
  }
  const parsed = parseHeadlines(await fetchText(RESERVE_CSV_URL));
  return { ...parsed, source: 'reserve', sheetError };
}

// --- Not repeating headlines across games (remembered per device) ---

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Storage unavailable: headlines may repeat sooner
  }
}

export function markSeen(id: string) {
  const seen = loadSeen();
  seen.add(id);
  saveSeen(seen);
}

export function resetSeen() {
  saveSeen(new Set());
}

export function countUnseen(headlines: HeadlineEntry[]) {
  const seen = loadSeen();
  return headlines.filter(h => !seen.has(h.id)).length;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Takes up to `count` headlines, half FATO and half FAKE when possible
function takeBalanced(pool: HeadlineEntry[], count: number): HeadlineEntry[] {
  const fatos = shuffle(pool.filter(h => h.truth === 'FATO'));
  const fakes = shuffle(pool.filter(h => h.truth === 'FAKE'));
  const half = Math.random() < 0.5 ? Math.floor(count / 2) : Math.ceil(count / 2);
  const nFatos = Math.min(fatos.length, Math.max(half, count - fakes.length));
  const nFakes = Math.min(fakes.length, count - nFatos);
  return [...fatos.slice(0, nFatos), ...fakes.slice(0, nFakes)];
}

/**
 * Picks the headlines for one game: unseen ones first, balanced between FATO and
 * FAKE. When fewer unseen remain than needed, the cycle restarts (the "seen"
 * memory is cleared). Only repeats within a game if the bank is smaller than `count`.
 */
export function pickHeadlines(all: HeadlineEntry[], count: number): HeadlineEntry[] {
  if (!all.length) return [];
  const seen = loadSeen();
  let picked = takeBalanced(all.filter(h => !seen.has(h.id)), count);

  if (picked.length < count) {
    resetSeen(); // everything has been shown: start a new cycle
    const pickedIds = new Set(picked.map(h => h.id));
    picked = [...picked, ...takeBalanced(all.filter(h => !pickedIds.has(h.id)), count - picked.length)];
  }
  while (picked.length < count) picked.push(...shuffle(all).slice(0, count - picked.length));
  return shuffle(picked);
}
