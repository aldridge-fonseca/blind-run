# Run artifacts

A run directory replays without Kane CLI or API keys. Times (`t`) are milliseconds since the lane's Kane `stream_start`; `t0`/`t1` in `run.json` are milliseconds since the run started.

```text
runs/<id>/
  run.json                 id, title, createdAt, url, task, expect, app{name,path,baseline,commit}, kaneVersion,
                           sequence[{kind:"lane",lane,dir,t0,t1} | {kind:"fix",attempt,dir,t0,t1}],
                           outcome{blindBefore, blindAfter, barriers[{id,wcag,title,planted,foundBy,presentBefore,fixed}]}
  audit/before.json        planted-barrier probe on the baseline (accessibility tree via data-testid)
  audit/after.json         the same probe after the fix loop
  fix.patch                the whole fix: baseline -> final src
  audio.json               [{t, file, text, lane, source, voice}]  (lane = the lane's directory)
  audio/<hash>.mp3         ElevenLabs clips
  sighted/  blind/         one lane each:
    lane.json              lane, status, resultCode, reasonCode, durationMs, steps, credits, verdict, reason,
                           oneLiner, testUrl, startedAt, viewport{width,height}, objective, exitCode, kaneVersion
    kane.ndjson            Kane's stdout, verbatim
    kane.stderr.txt        Kane's stderr (diagnostics)
    frames.json            [{file:"frames/00000.jpg", t}]   throttled CDP screencast (blind frames are the black screen Kane saw)
    announcements.jsonl    {t, text, role, name, states[], source:"focus"|"live", rect{x,y,w,h}, tag}
  fix-N/                   one closed-loop attempt
    brief.md               what the agent was given (Kane verdict, Kane steps, screen-reader log)
    agent.log              the agent's tool calls and summary (no file contents)
    diff.patch             this attempt's change to src/
    build.log              only when the build failed
    result.json            attempt, status, resultCode, credits, agent{turns,durationMs,costUsd,summary}, files
    lane.json, kane.ndjson, frames.json, frames/, announcements.jsonl   the blind rerun
  explore/                 kane-cli explore: explore.ndjson (verbatim), findings.json
  BLOCKED_NEEDS_HUMAN      present only if no attempt passed
```

`rect` is `getBoundingClientRect()` of the focused element in CSS pixels of the viewport in `lane.json`. Consumers must tolerate missing optional files.
