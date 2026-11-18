# Blind Run fix brief · attempt 1

Kane CLI ran this task as a blind user: keyboard only (Tab, Shift+Tab, Enter, Space, arrow keys), mouse disabled, screen black.

**Task:** Book 2 seats in row F for Friday's show.
At checkout use the name Alex Rivera, the email alex@example.com and the test card 4242 4242 4242 4242 with expiry 12/30 and CVC 123.
**Must end with:** You're going! Order #ENC-4821 · Row F · Seats 14–15

## Kane verdict (result 740, assertion_error.confirmed_product_bug)

**Friday show and seat controls are skipped in keyboard navigation**

> Tab skips Friday and all seats, leaving only quantity controls; keyboard-only booking cannot be completed.

Root cause: The booking controls for the Friday show and individual seats are not reachable when moving through the page with the Tab key. The keyboard reaches only the quantity controls.

Kane's suggestion: Make the Friday show option and every available seat reachable by Tab, with a clear keyboard focus indicator. Retest the full booking flow using only Tab, Shift+Tab, Enter, Space, and arrow keys.

## What Kane did

- 2. [done] navigate: Navigate to http://127.0.0.1:4310/
- 3. [done] press_key: PRIMARY: press the Tab key
- 4. [done] press_key: PRIMARY: press the Tab key
- 5. [done] press_key: PRIMARY: press the Tab key
- 6. [done] press_key: PRIMARY: press the Tab key
- 7. [done] press_key: PRIMARY: press the Tab key
- 8. [done] press_key: PRIMARY: press the Tab key
- 9. [done] press_key: PRIMARY: press the Tab key
- 10. [done] press_key: PRIMARY: press the Tab key
- 11. [done] press_key: PRIMARY: press the Tab key
- 12. [failed] wait: Waiting after checking keyboard-accessible controls

## What the screen reader said

- 11.5s "Aurora Vale · Neon Tides Tour · Encore, document"
- 23.1s "encore, link"
- 30.9s "Discover, link"
- 38.7s "Venues, link"
- 45.0s "Artists, link"
- 51.4s "My tickets, link"
- 59.3s "Get tickets, link"
- 65.7s "Watch the trailer, link"
- 71.7s "WED 19 Nov 8:00 PM Few left THU 20 Nov 8:00 PM Selling fast FRI OPENING 21 Nov 8:00 PM Selling fast SAT 22 Nov 8:00 PM Sold out SUN 23 Nov 7:00 PM Available…, clickable"
- 78.7s "button"
