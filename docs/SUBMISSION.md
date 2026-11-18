# Blind Run: submission summary

**Repository:** https://github.com/aldridge-fonseca/blind-run (MIT)
**Kane CLI:** 0.10.6 · **Coding agent:** Claude Code (`claude -p`, headless)
**Demo video:** {{TBD}} · **Launch posts:** {{TBD}}

## About the app

*Your app works when you can see it. Does it work with your eyes closed?*

Blind Run is a CLI (`blindrun`) plus a replay viewer (the Theater). It gives Kane CLI one task twice, once as a sighted user and once as a blind one. For the blind run, Blind Run constrains the browser over CDP before Kane attaches: trusted mouse events are blocked, the screen is painted black, and a screen-reader layer reads Chrome's accessibility tree aloud at every focus change. When the blind run fails, Kane's verdict becomes a fix brief for Claude Code, which edits the app's source. The app is rebuilt and Kane runs the task blind again, and only a green blind run closes the loop.

The showcase app is **Encore**, a fictional concert-booking site with six **intentionally planted** accessibility barriers. They're real WCAG failures in ordinary code, with no toggles ([`apps/encore/BARRIERS.md`](../apps/encore/BARRIERS.md)). `blindrun run <url> "<task>"` works on any site.

## The agent: Claude Code

- **Input:** `fix-N/brief.md`, which holds Kane's `run_end` verdict (bug title, root cause, suggestion, the steps Kane took) and what the screen reader said.
- **Constraints:** `claude -p … --restricted --safe-mode --permission-mode acceptEdits --permission-prompts none --tools Read,Edit,Write,Glob,Grep`, with the working directory set to `apps/encore/src`. It has no shell. After each attempt, Blind Run checks `git status`, and any change outside `src/` voids the attempt. The task, the expected text, the tests and Blind Run itself are off-limits.
- **Cap:** 3 attempts, then `BLOCKED_NEEDS_HUMAN`.
- **In the committed run:** attempt 1 (46 turns, $1.12, 7 files) made dates and seats keyboard-operable. Kane's rerun ended `310`, Kane blaming itself (`automation_bug`), so it was re-verified once and never counted. Attempt 2 (26 turns, $0.73, 3 files) fixed a silent seat-replacement bug that the blind run exposed, and Kane's blind rerun **passed**.

## What Kane does: three roles

1. **Product runtime.** Kane *is* the sighted user and the blind user (`kane-cli run --cdp-endpoint` into the browser Blind Run controls).
2. **Verifier.** `--bug-detection continue` gives the red: `result_code 740`, `assertion_error.confirmed_product_bug`, `family: application_issue`, confidence 0.96. The green is Kane completing the task blind and reading *"You're going! Order #ENC-4821 · Row F · Seats 14–15"*.
3. **Gate.** The agent's fix counts only when Kane's blind rerun returns `100`. Kane's `automation_bug` verdicts are treated as "not checked", never as a pass or a product failure.

Also used: `kane-cli explore` (local, read-only) for axe-core findings (`button-name`, `color-contrast`, `scrollable-region-focusable`), and `--analyzer-only --condition` probes on the baseline vs the fixed build.

## The three gates

| Gate | Evidence |
|---|---|
| **Works end to end** | `runs/encore-2026-11-18/`: sighted pass → blind 740 → 2 Claude Code fixes → blind pass, recorded by `blindrun demo`, with a `blindrun explore` pass on the same baseline. Replay with `pnpm demo`; rerun with `pnpm live`. |
| **Kane caught / proved something** | [`blind/kane.ndjson`](../runs/encore-2026-11-18/blind/kane.ndjson), line 28: 740 *"Friday show and seat controls are skipped in keyboard navigation"*. [`fix-2/kane.ndjson`](../runs/encore-2026-11-18/fix-2/kane.ndjson): 100 *"booked two Row F seats for Friday's show"*. Test Manager links are in each `lane.json` (`testUrl`). |
| **Agent and Kane talked** | Kane verdict → [`fix-1/brief.md`](../runs/encore-2026-11-18/fix-1/brief.md) → Claude Code [`fix-1/diff.patch`](../runs/encore-2026-11-18/fix-1/diff.patch) → Kane rerun → [`fix-2/brief.md`](../runs/encore-2026-11-18/fix-2/brief.md) → [`fix-2/diff.patch`](../runs/encore-2026-11-18/fix-2/diff.patch) → Kane green. |

## How to verify (no keys needed)

```sh
git clone https://github.com/aldridge-fonseca/blind-run && cd blind-run
pnpm install
pnpm demo     # http://localhost:4320/?run=latest  (add &present=1 for the 1920×1080 show)
pnpm test     # package tests + evidence integrity: every lane.json must match Kane's run_end verbatim
```

To spend credits instead (requires Kane CLI logged in, Chrome and Claude Code), run `pnpm live`. The committed run used 7 Kane runs and 286.9 credits.

## Numbers

| | Sighted | Blind before | Blind after |
|---|---|---|---|
| Kane result | 100 | **740** | **100** |
| Time | 124.4 s | ∞ (stopped at 98.7 s) | 323.5 s |
| Steps | 18 | 11 | 48 |

Planted barriers: 6 in total, with 5 fixed and verified by the before/after accessibility-tree audit. B6 (contrast) is honestly left open.

## Limitations

- The blind user is simulated: the mouse is blocked, the screen is black and Kane uses the keyboard. Announcements are NVDA-*style*, built from Chrome's accessibility tree, not a real screen reader.
- Kane can fail on its own (`automation_bug`). Blind Run re-verifies instead of counting it, which costs credits (about 99 extra in this run).
- `--analyzer-only` judges a static page. On the fixed build the seat-map conditions stay false because the grid is locked until a night is chosen.
- `explore` was capped at 3 leases (`budget_leases`), so its findings are a sample.
- Mobile (`--target emulator|simulator` on GitHub macOS runners) is **not proven**: see [`MOBILE.md`](MOBILE.md).
