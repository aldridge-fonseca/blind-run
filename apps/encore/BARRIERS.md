# Encore: planted accessibility barriers

> **These barriers are intentionally planted for the Blind Run demo.** Encore is a fictional booking app built to be tested by Blind Run. For mouse users it works flawlessly; for a blind keyboard user it is broken on purpose, in six real, common ways. Each one is ordinary code (no feature flags, no `?fixed=1` toggles). The baseline commit is tagged `encore-baseline`; fixes are made by editing the code.

The demo task: *Book 2 seats in row F for Friday's show* and see **"You're going! Order #ENC-4821 · Row F · Seats 14–15"**. Row F on Friday has exactly one pair left, F14–F15.

| ID | WCAG 2.2 criterion | Where | Why it blocks a blind user |
|---|---|---|---|
| B1 | 2.1.1 Keyboard (A), 4.1.2 Name, Role, Value (A) | [`src/components/SeatMap.tsx:101`](src/components/SeatMap.tsx#L101) | Every seat is a `<div>` with only an `onClick`. It has no role, no `tabIndex` and no key handling, so Tab skips the whole seat map and a screen reader never announces a seat. A blind user cannot pick a seat at all. |
| B2 | 4.1.2 Name, Role, Value (A) | [`src/components/BookingSummary.tsx:24`](src/components/BookingSummary.tsx#L24) | The ticket quantity − and + are icon-only `<button>`s (an SVG and nothing else). They are focusable, but a screen reader just says "button", so the user has to guess which one adds a ticket. The current count is not announced when it changes. |
| B3 | 2.1.1 Keyboard (A) | [`src/components/DateCarousel.tsx:68`](src/components/DateCarousel.tsx#L68) | The date picker is a horizontally scrolling strip of `<div>` cards with click and drag handlers; the prev/next arrows are `<div>`s too. None of it is focusable, so with Tab the user jumps straight from the hero to the quantity stepper and can never choose a night. This is where the blind Kane run fails first. |
| B4 | 2.4.3 Focus Order (A), 4.1.2 Name, Role, Value (A) | [`src/components/CheckoutModal.tsx:62`](src/components/CheckoutModal.tsx#L62) | Checkout opens a plain overlay: no `role="dialog"`, no `aria-modal`, focus is not moved into it or trapped, and Escape does nothing. Focus stays on the Checkout button behind the overlay. The close button ([`src/components/CheckoutModal.tsx:106`](src/components/CheckoutModal.tsx#L106)) is an unlabeled × icon. |
| B5 | 1.3.1 Info and Relationships (A), 3.3.2 Labels or Instructions (A) | [`src/components/CheckoutModal.tsx:148`](src/components/CheckoutModal.tsx#L148) | Card number, expiry and CVC have a placeholder and no `<label>` or accessible name. Placeholders vanish once you type and are not reliably announced, so a screen-reader user hears "edit text" three times. (Name and email do have proper labels, by comparison.) |
| B6 | 1.4.3 Contrast (Minimum) (AA) | [`src/components/SeatMap.tsx:155`](src/components/SeatMap.tsx#L155) | Tier prices in the seat legend are `#4f4b63` on the near-black page, about 2.3:1 (needs 4.5:1). It does not stop a blind user; it is there for `kane-cli explore` / axe-core to find. |

B1 and B3 stop the task outright (nothing to Tab to). B2, B4 and B5 make it confusing or slow once B1 and B3 are fixed. B6 is a visual-contrast finding for the automated audit, not for the blind run.

Planted-barrier comments in the source start with `PLANTED BARRIER`. `data-testid`s are stable test hooks and deliberately carry no accessibility meaning.
