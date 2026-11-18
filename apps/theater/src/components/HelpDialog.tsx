import { useEffect, useRef } from 'react';

const SHORTCUTS: [string, string][] = [
  ['Space or K', 'Play / pause'],
  ['← / →', 'Back / forward 5 s (Shift: 1 s)'],
  ['J / L', 'Back / forward 10 s'],
  ['Page Up / Page Down or [ / ]', 'Previous / next chapter'],
  ['1 – 9', 'Jump to chapter'],
  ['Home / End', 'Start / end'],
  ['- / =', 'Slower / faster'],
  ['R', 'Reveal the page and focus path under the blind screen'],
  ['V', 'Cycle vision lens on the sighted panel'],
  ['T', 'Skip idle time on / off'],
  ['M', 'Mute the screen-reader voice'],
  ['C', 'Copy a link to this moment'],
  ['P', 'Presentation mode (Esc exits)'],
  ['?', 'This help'],
];

export function HelpDialog({ open, onClose, keys, setKeys }: { open: boolean; onClose: () => void; keys: boolean; setKeys: (v: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="help-title"
      className="m-auto w-[min(640px,calc(100vw-32px))] rounded-[24px] border border-line-strong bg-raised p-0 text-fg shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id="help-title" className="text-[22px] font-semibold tracking-tight">Keyboard shortcuts</h2>
          <button onClick={onClose} className="rounded-full border border-line-strong px-3.5 py-1.5 text-[14px] hover:bg-white/5">Close</button>
        </div>
        <table className="mt-5 w-full text-[15px]">
          <caption className="sr-only">Shortcut keys and what they do</caption>
          <thead className="sr-only"><tr><th scope="col">Keys</th><th scope="col">Action</th></tr></thead>
          <tbody>
            {SHORTCUTS.map(([k, v]) => (
              <tr key={k} className="border-t border-line">
                <td className="py-2.5 pr-6 align-top font-mono text-[14px] text-fg">{k}</td>
                <td className="py-2.5 text-dim">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <label className="mt-6 flex items-center gap-3 text-[15px]">
          <input type="checkbox" checked={keys} onChange={(e) => setKeys(e.target.checked)} className="size-4 accent-white" />
          Single-key shortcuts (letters, digits, brackets)
        </label>
        <p className="mt-2 text-[13px] text-faint">Turn these off if they clash with your screen reader. Arrows, Space, Page keys and ? keep working.</p>
      </div>
    </dialog>
  );
}
