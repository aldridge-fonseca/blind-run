# Blind Run Theater

The replay viewer for Blind Run. It plays a recorded run directory as a split-screen show:

1. **Task:** what Kane CLI was asked to do.
2. **Race:** the sighted run (screencast, Kane's steps) next to the blind run (black screen, what the screen reader said, Kane's keystrokes).
3. **Verdict:** Kane's `run_end` verdict, every field quoted verbatim from `kane.ndjson`.
4. **Fix:** the coding agent's real `diff.patch`, typed in.
5. **Rerun:** the blind run again after the fix.
6. **Result:** blind completion time before and after, barriers by WCAG criterion, credits, and links to the raw files.

Everything plays from static files. No API keys, no Kane CLI and no network are needed.

## Run it

```sh
pnpm install
pnpm --filter theater dev        # http://localhost:4320
pnpm --filter theater build      # static site in apps/theater/dist (runs copied into dist/runs)
pnpm --filter theater preview    # serve the build on :4320
```

It reads every directory under the repo's `runs/` that has a `run.json`, plus `fixtures/` (always labelled as a fixture, never as a real run). Set `THEATER_RUNS=/path/to/dir` to add more run directories.

## Links

| URL | What it does |
| --- | --- |
| `/` | Run index |
| `?run=<id>` | Player for one run |
| `?run=latest` | Newest real run (falls back to the fixture) |
| `&t=verdict+2.5` | Start at a moment: seconds (`83.5`), a chapter (`race`, `verdict`, `fix`, `rerun`, `result`), or a chapter with an offset (`verdict+2`, `rerun-1`) |
| `&present=1` | Presentation mode: full-bleed 1920×1080 stage, autoplay, hidden cursor. Add `&autoplay=0` to start paused |
| `&lens=blur\|lowvision\|tunnel` | Vision lens on the sighted panel |
| `&reveal=1` | Show the page and the blind user's focus path under the black screen |
| `&speed=2` | Playback speed |

For a recording, start Chrome with `--autoplay-policy=no-user-gesture-required` so the screen-reader audio plays without a click.

## Keyboard

Space or K play/pause · ←/→ 5 s (Shift: 1 s) · J/L 10 s · Page Up/Down or `[`/`]` chapters · 1–9 jump to chapter · Home/End · `-`/`=` speed · R reveal · V lens · T skip idle time · M mute · C copy a link to this moment · P presentation · ? help. Single-key shortcuts can be switched off in the help dialog.

## Accessibility

The Theater is operable by keyboard and screen reader: a skip link, labelled landmarks, a real slider for the timeline, chapter buttons, a polite live region for chapter changes, `prefers-reduced-motion` support, and text contrast that passes axe-core's WCAG 2.2 AA rules. `pnpm --filter theater a11y` runs axe-core over the index, every chapter, presentation mode and the help dialog, and walks the Tab order.

## Honesty rules

- Verdict text is quoted from Kane's NDJSON, never paraphrased.
- Idle gaps between Kane steps are fast-forwarded by default (press T for real time). Lane clocks always show real elapsed time, and say when idle time is being skipped.
- When a blind lane's frames are the black screen Kane actually saw, "reveal" shows the layout from the sighted run and says so.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm --filter theater a11y` | axe-core audit + Tab-order walk (needs the dev server) |
| `pnpm --filter theater test:keys` | keyboard, deep-link and audio smoke test |
| `pnpm --filter theater shoot <out> <runId> <moment...>` | 1920×1080 screenshots of moments |
| `pnpm --filter theater record <out> <runId> [from] [seconds]` | presentation-mode frame sequence for video |
| `pnpm --filter theater fixture` | rebuild `fixtures/sample-run` |
