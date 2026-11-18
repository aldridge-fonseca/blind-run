# Blind Run artifact contract

Every invocation writes evidence as files so a viewer can replay the result without Kane CLI or API keys. Paths below are relative to `runs/<runId>/`.

```text
run.json
<lane>/
  lane.json
  kane.ndjson
  kane.stderr.txt                 # optional diagnostics, never substituted for stdout
  frames/00000.jpg, ...
  frames.json                     # [{"file":"00000.jpg","t":0}]
  announcements.jsonl             # one JSON object per line
  audio/<sha256>.mp3               # created by `blindrun voice`
  audio.json                      # created by `blindrun voice`
fix-1/, fix-2/, ...
  brief.md
  diff.patch
  agent.log
  kane.ndjson
  lane.json
  frames/, frames.json, announcements.jsonl
  result.json
explore/
  explore.ndjson
  findings.json
```

`run.json` contains `id`, `createdAt`, `url`, `task`, `expect`, `app` (`name`, `commit`), `kaneVersion`, a chronological `sequence` of `{kind:"lane", lane, dir, t0, t1}` and `{kind:"fix", attempt, dir, t0, t1}`, and `outcome` (`blindBefore`, `blindAfter`, `barriers`). `t0` and `t1` are milliseconds since the run started.

Each `lane.json` contains the lane name, `status` (`passed`, `failed`, or `unknown`), Kane `resultCode`, `durationMs`, step count, credits, verdict object, and `startedAt`. `kane.ndjson` is Kane's stdout byte-for-byte, including its own NDJSON records. Diagnostics go in the optional stderr file.

Each announcement has `{t, text, role, name, states, source}`. `source` is `focus` or `live`; `t` is elapsed milliseconds from the lane start. A blind lane's captured frames contain the actual black overlay seen by Kane. A theater may show its own black panel or mask the frame; it must not reveal these frames as an unoccluded view of the page.

The closed loop records a concise verdict brief, the agent's log, a real source diff, and the blind verification result for every attempt. After three failed or unusable attempts, `BLOCKED_NEEDS_HUMAN` marks the unresolved run. `explore/findings.json` keeps the selected mode and the parsed Kane records; an analyzer-only fallback is identified explicitly.

Optional fields and directories may be absent. Consumers should use `run.json` sequence entries to locate lane directories and tolerate missing audio, frames, or exploration results.
