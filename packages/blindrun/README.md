# blindrun

**Blind Run** checks a browser task in a normal lane and a keyboard-only blind lane, keeps Kane CLI's raw evidence, and can ask Claude Code to fix the confirmed issue before replaying it.

## Requirements

- Node.js 24 or newer
- Google Chrome or Chromium
- [Kane CLI](https://github.com/LambdaTest/kane-cli), authenticated on your machine
- Claude Code for `fix` and `demo`
- ElevenLabs API key for `voice`

The package is ESM and has no runtime npm dependencies. From a checkout of Blind Run:

```sh
pnpm --filter @blind-run/blindrun build
pnpm --filter @blind-run/blindrun link --global
blindrun --help
```

You can also run it without linking:

```sh
node packages/blindrun/bin/blindrun.js --help
```

## Run sighted and blind lanes

```sh
blindrun run http://127.0.0.1:4310/ \
  "Book two adjacent seats in row F, seats 14–15" \
  --expect "You're going! Order #ENC-4821, Row F · Seats 14–15" \
  --out runs/my-check
```

Each lane gets a fresh headless Chrome process, CDP screencast frames, accessibility-tree announcements, and raw Kane NDJSON. Kane's blind lane runs with a black screen overlay and trusted pointer input blocked; keyboard input remains available. Kane commands are serialized through `/home/aldridge/kane-cli-hackathon/build/kane.lock` in the hackathon environment.

Select lanes or tune the run:

```sh
blindrun run https://example.test/ "Open the menu" --expect "Menu" \
  --lanes blind --timeout 180 --max-steps 10
```

## Explore accessibility findings

```sh
blindrun explore http://127.0.0.1:4310/ --out runs/my-check/explore
```

This runs a one-lease, read-only local Kane exploration. If the account or plan rejects exploration, Blind Run records the error and falls back to analyzer-only accessibility conditions.

## Close the loop with a fix

Keep the app server running, then point `fix` at the run and the app directory:

```sh
blindrun fix runs/my-check --app apps/encore --max-attempts 3
```

Claude Code runs headlessly in the app's `src` directory with only Read, Edit, and Write tools. Blind Run rebuilds the app and accepts a fix only after the blind Kane replay passes. Every attempt records `brief.md`, `diff.patch`, `agent.log`, `kane.ndjson`, `lane.json`, and `result.json`. Unresolved runs get a `BLOCKED_NEEDS_HUMAN` marker.

## Speak announcements

```sh
blindrun voice runs/my-check
```

The command reads `ELEVENLABS_API_KEY` from the process environment or `/home/aldridge/kane-cli-hackathon/.env`, sends announcement text to ElevenLabs, and caches MP3s by voice and text hash under the run's `audio/` directory. The key is never written to run artifacts.

## Reproduce the Encore demo

Once the `encore-baseline` tag and Encore app are available:

```sh
blindrun demo
```

The command creates a detached worktree at the baseline tag, starts Encore on port 4310, records sighted and blind runs, invokes the fix loop, records a final blind replay, and removes its temporary worktree and dev server. Use `--out` to choose a run directory or `--base-url` to change the local port.

## Artifacts

See [ARTIFACTS.md](./ARTIFACTS.md) for the versioned run directory contract and timing semantics. A run can be inspected from its JSON and NDJSON files without credentials; only generating new voice clips needs an ElevenLabs key.
