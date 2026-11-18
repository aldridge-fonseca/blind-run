// Shapes of the run artifact format (runs/<id>/…). Everything except run.json is optional.

export type Rect = { x: number; y: number; w: number; h: number };

export type RunSequenceItem =
  | { kind: 'lane'; lane: 'sighted' | 'blind'; dir: string; t0?: number; t1?: number }
  | { kind: 'fix'; attempt: number; dir: string; t0?: number; t1?: number };

export type Barrier = { id: string; wcag: string; title: string; foundBy?: string; planted?: boolean; fixed?: boolean };

export type RunJson = {
  id: string;
  label?: string;
  fixture?: boolean;
  note?: string;
  title?: string;
  createdAt?: string;
  url?: string;
  task?: string;
  expect?: string;
  app?: { name?: string; commit?: string | null };
  kaneVersion?: string;
  /** Totals over every Kane call in the run, including ones the show does not replay. */
  kane?: { runs: number; credits: number };
  sequence?: RunSequenceItem[];
  outcome?: { blindBefore?: string; blindAfter?: string; barriers?: Barrier[] };
};

export type RunSummary = RunJson & {
  fixture: boolean;
  thumb: string | null;
  broken?: string;
  stats?: { sightedMs: number | null; before: { status?: string; ms?: number } | null; after: { status?: string; ms?: number } | null; credits: number };
};

export type KaneVerdict = {
  bug_title?: string;
  one_liner?: string;
  confidence?: number;
  suggestion?: string;
  severity?: string;
  family?: string;
  category?: string;
  root_cause?: string;
  agent_fault_assessment?: string;
  relevant_steps?: number[];
  signals?: { step?: string; kind?: string; excerpt?: string }[];
  [k: string]: unknown;
};

export type KaneRunEnd = {
  type: 'run_end';
  status?: string;
  summary?: string;
  one_liner?: string;
  reason?: string;
  duration?: number;
  credits_consumed?: number;
  result_code?: number;
  reason_code?: string;
  test_url?: string;
  per_flow_metadata?: { error_message?: string | null; result_code?: string; reason_code?: string }[];
  verdict?: KaneVerdict;
  ts?: string;
};

export type LaneJson = {
  lane?: string;
  status?: string;
  resultCode?: number;
  durationMs?: number;
  steps?: number;
  credits?: number;
  verdict?: KaneVerdict | null;
  startedAt?: string;
  viewport?: { width: number; height: number };
  video?: string;
};

export type KaneStep = {
  n: number;
  /** ms since lane start when Kane began the step (if known) */
  tStart: number | null;
  /** ms since lane start when Kane reported the step finished */
  t: number;
  status: 'done' | 'failed' | 'running' | string;
  action: string;
  /** human description of the step, PRIMARY/HINTS noise stripped */
  text: string;
  /** keyboard key for press_key steps, if Kane named it */
  key: string | null;
  raw: string;
};

export type Announcement = {
  t: number;
  text: string;
  role?: string;
  name?: string;
  states?: string[];
  source?: 'focus' | 'live' | string;
  rect?: Rect;
};

export type AudioClip = { t: number; file: string; text: string; url: string };

export type Lane = {
  dir: string;
  kind: 'sighted' | 'blind';
  meta: LaneJson | null;
  steps: KaneStep[];
  runEnd: KaneRunEnd | null;
  frames: { t: number; url: string }[];
  video: string | null;
  announcements: Announcement[];
  audio: AudioClip[];
  durationMs: number;
  status: 'passed' | 'failed' | 'unknown';
  viewport: { width: number; height: number } | null;
  base: string;
};

export type DiffLine = { kind: 'add' | 'del' | 'ctx' | 'meta'; text: string; oldNo: number | null; newNo: number | null };
export type DiffHunk = { header: string; lines: DiffLine[] };
export type DiffFile = { path: string; oldPath: string; hunks: DiffHunk[]; added: number; removed: number };

export type Fix = {
  dir: string;
  attempt: number;
  diffText: string | null;
  files: DiffFile[];
  brief: string | null;
  result: Record<string, unknown> | null;
  base: string;
  /** The blind rerun recorded inside the fix directory, if the engine put it there. */
  lane: Lane | null;
};

export type Run = {
  id: string;
  base: string;
  meta: RunJson;
  fixture: boolean;
  lanes: Map<string, Lane>;
  fixes: Map<string, Fix>;
  sequence: RunSequenceItem[];
};
