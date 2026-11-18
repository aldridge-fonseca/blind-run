import type { DiffFile, DiffHunk } from './types';

/** Parses a unified diff (git or plain) into files → hunks → numbered lines. */
export function parseDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  let oldLeft = 0;
  let newLeft = 0;
  const strip = (p: string) => p.replace(/\t.*$/, '').trim().replace(/^[ab]\//, '');
  const newFile = () => {
    file = { path: '', oldPath: '', hunks: [], added: 0, removed: 0 };
    files.push(file);
    hunk = null;
    return file;
  };

  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const inHunk = hunk && (oldLeft > 0 || newLeft > 0);
    if (inHunk) {
      const h = hunk as DiffHunk;
      const f = file as unknown as DiffFile;
      if (line.startsWith('+')) {
        h.lines.push({ kind: 'add', text: line.slice(1), oldNo: null, newNo: newNo++ });
        f.added++;
        newLeft--;
      } else if (line.startsWith('-')) {
        h.lines.push({ kind: 'del', text: line.slice(1), oldNo: oldNo++, newNo: null });
        f.removed++;
        oldLeft--;
      } else if (line.startsWith('\\')) {
        h.lines.push({ kind: 'meta', text: line, oldNo: null, newNo: null });
      } else {
        h.lines.push({ kind: 'ctx', text: line.slice(1), oldNo: oldNo++, newNo: newNo++ });
        oldLeft--;
        newLeft--;
      }
      continue;
    }
    if (line.startsWith('diff --git ')) {
      const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      const f = newFile();
      f.oldPath = m?.[1] ?? '';
      f.path = m?.[2] ?? '';
      continue;
    }
    if (line.startsWith('--- ')) {
      const f: DiffFile = file && !(file as DiffFile).hunks.length ? file : newFile();
      f.oldPath = strip(line.slice(4));
      continue;
    }
    if (line.startsWith('+++ ') && file) {
      const p = strip(line.slice(4));
      (file as DiffFile).path = p === '/dev/null' ? (file as DiffFile).oldPath : p;
      continue;
    }
    const h = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (h && file) {
      oldNo = Number(h[1]);
      oldLeft = h[2] == null ? 1 : Number(h[2]);
      newNo = Number(h[3]);
      newLeft = h[4] == null ? 1 : Number(h[4]);
      hunk = { header: line, lines: [] };
      (file as DiffFile).hunks.push(hunk);
    }
  }
  return files.filter((f) => f.hunks.length);
}

export function languageFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return ({ tsx: 'tsx', ts: 'typescript', jsx: 'jsx', js: 'javascript', mjs: 'javascript', html: 'jsx', css: 'css', json: 'json', md: 'markdown' } as Record<string, string>)[ext] ?? 'tsx';
}
