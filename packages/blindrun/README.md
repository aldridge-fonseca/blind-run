# blindrun

**Your app works when you can see it. `blindrun` proves whether it works with your eyes closed.**

`blindrun` gives [Kane CLI](https://www.lambdatest.com/kane-cli) the same task twice: once as a sighted user, and once as a blind user (black screen, mouse disabled, keyboard only). It records what a screen reader would say at every focus change. When the blind run fails, it hands Kane's verdict to Claude Code, rebuilds the app and makes Kane run the task blind again. A fix only counts when that run is green.

## Requirements

- Node.js 24+, Google Chrome (headless is fine)
- Kane CLI 0.10+, logged in (`kane-cli whoami`)
- Claude Code (`claude`) for `fix` and `demo`
- `ELEVENLABS_API_KEY` for `voice` (optional)

No runtime npm dependencies. From the repo root: `node packages/blindrun/bin/blindrun.js --help` (or `pnpm --filter @blind-run/blindrun exec blindrun --help`).

## Commands

```sh
# Sighted + blind lanes on any URL
blindrun run http://127.0.0.1:4310/ "Book 2 seats in row F for Friday's show." \
  --expect "You're going!" --out runs/my-check

# Close the loop: Claude Code fixes <app>/src, the app is rebuilt and Kane reruns blind (≤ 3 attempts)
blindrun fix runs/my-check --app apps/encore --build "pnpm build" --serve "pnpm preview"

# The showcase, end to end, from the encore-baseline tag
blindrun demo

# Screen-reader voice for a run (ElevenLabs, cached by text hash)
blindrun voice runs/my-check

# kane-cli explore, local and read-only
blindrun explore http://127.0.0.1:4310/
```

## How it works

**Blind lane.** Each lane gets its own headless Chrome. `blindrun` attaches over CDP with auto-attach, so it covers every page, including the one Kane opens. Before any page script runs, it injects two scripts:

- The **blindfold** blocks trusted pointer and mouse events. Clicks made by the keyboard (`detail === 0`) still go through. It also paints a black `html::after` overlay, so Kane's screenshots are really black.
- The **screen-reader hooks** report every `focusin`, with the element's bounding box, and every live-region change. For each one, `blindrun` reads the node from Chrome's accessibility tree (`Accessibility.getPartialAXTree`) and writes an NVDA-style line: `button`, `Card number, edit, blank`, `Seat F14, button, not pressed`. An icon-only button really is announced as just "button".

Kane attaches to the same Chrome with `--cdp-endpoint` and runs with `--agent --bug-detection continue`. Its NDJSON is saved byte for byte. A confirmed keyboard barrier comes back as `result_code 740` (`assertion_error.confirmed_product_bug`) with a verdict: bug title, root cause, suggestion and relevant steps.

**Fix loop.** `fix-N/brief.md` is built from Kane's verdict, Kane's steps and what the screen reader said. Claude Code then runs headless:

```
claude -p "<rules + brief>" --restricted --safe-mode --no-session-persistence \
  --permission-mode acceptEdits --permission-prompts none \
  --tools Read,Edit,Write,Glob,Grep --output-format stream-json --verbose
```

It runs with its working directory set to the app's `src/`:

- `--restricted` removes Bash and every other code-running tool, and ignores user and project settings.
- `acceptEdits` allows edits inside the working directory only.
- `--permission-prompts none` denies anything that would prompt.

Afterwards `blindrun` checks `git status`. Any change outside `src/` voids the attempt. It saves the diff, rebuilds, restarts the app and reruns the blind lane in `fix-N/`. If no attempt is green after three tries, it writes `BLOCKED_NEEDS_HUMAN`.

**Demo.** `blindrun demo` checks out `encore-baseline` into a throwaway `git worktree`, so there are no toggles or flags. It builds and serves Encore on :4310 and audits the planted barriers. Then it runs the sighted and blind lanes and the fix loop, audits again and voices the blind lanes. The audit reads the accessibility tree through stable `data-testid`s, before and after the fix. That is how `run.json` knows which barriers were really removed.

**Kane lock.** Every `kane-cli` call is wrapped in `flock $BLINDRUN_KANE_LOCK`, so parallel jobs never share a Kane session.

## Artifacts

Everything is plain files that the Theater (`apps/theater`) replays without keys. See [ARTIFACTS.md](./ARTIFACTS.md).
