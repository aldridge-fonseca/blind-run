# sample-run (FIXTURE)

Not a real Blind Run. Built by `apps/theater/scripts/make-fixture.mjs` so the Theater can be developed before real runs exist.

- `blind-0/kane.ndjson` and `blind-1/kane.ndjson` are real Kane CLI 0.10.6 output from the proof of concept, verbatim.
- `sighted/kane.ndjson` is synthetic (flagged `"fixture": true`).
- Frames, announcements and audio come from replaying the step timings against a local mock page.
- `fix-1/diff.patch` is a hand-written diff between the two mock pages, not agent output.
