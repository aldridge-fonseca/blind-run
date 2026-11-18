# Fix brief (attempt 1)

Kane CLI ran the task as a blind, keyboard-only user and reported a confirmed product bug.

- **Bug:** Seat 14C cannot be selected with keyboard navigation
- **Evidence:** Seat 14C is a non-focusable DIV (tabIndex -1), so keyboard-only navigation cannot select it.
- **Suggestion:** Make each selectable seat a native button or otherwise keyboard-focusable control, and support Enter and Space to select it. Verify that Tab can reach 14C and that booking then displays “Booked 14C”.

Screen reader heard:
- Encore · Pick a seat, document
- Encore · Pick a seat, document
- Encore · Pick a seat, document

Rules: edit only `src/**`. Do not touch tests, objectives, or the runner.
