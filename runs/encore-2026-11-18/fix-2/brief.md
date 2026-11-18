# Blind Run fix brief · attempt 2

Kane CLI ran this task as a blind user: keyboard only (Tab, Shift+Tab, Enter, Space, arrow keys), mouse disabled, screen black.

**Task:** Book 2 seats in row F for Friday's show.
At checkout use the name Alex Rivera, the email alex@example.com and the test card 4242 4242 4242 4242 with expiry 12/30 and CVC 123.
**Must end with:** You're going! Order #ENC-4821 · Row F · Seats 14–15

## Kane verdict (result 310, stuck.max_steps)

**Keyboard run loops without reaching checkout**

> Maximum steps exceeded (64/60)

Root cause: The agent did not establish where keyboard focus was or confirm that each key press changed the page. It repeatedly sent Space and Enter while remaining at the starting address, so it never completed the required booking or verification.

Kane's suggestion: Update the run to inspect screen-reader text and keyboard focus after every Tab or activation. Stop repeated key presses when the state does not change, then navigate deliberately through show selection, row F seats 14–15, checkout, and the confirmation text.

## What Kane did

- 2. [done] navigate: Navigate to http://127.0.0.1:4310/
- 3. [done] press_key: PRIMARY: press the Tab key to begin keyboard navigation
- 4. [done] wait: queued plan (8 steps): press_key "encore"; press_key "encore"; press_key "encore
- 5. [done] press_key: Press Tab
- 6. [done] press_key: Press Tab
- 7. [done] press_key: Press Tab
- 8. [done] press_key: Press Tab
- 9. [done] press_key: Press Tab
- 10. [done] press_key: Press Tab
- 11. [done] press_key: Press Tab
- 12. [done] press_key: Press Tab
- 13. [done] wait: queued plan (3 steps): press_key "Scroll dates right"; press_key "Scroll dates r
- 14. [done] press_key: Press Tab
- 15. [done] press_key: Press Tab
- 16. [done] press_key: Press Tab
- 17. [done] press_key: PRIMARY: press Shift+Tab to return to the Friday show selector
- 18. [done] press_key: PRIMARY: press Shift+Tab to return to Friday's show selector
- 19. [done] wait: queued plan (3 steps): press_key "Wednesday 19 Nov, 8:00 PM, Few left"; press_ke
- 20. [done] press_key: Press ArrowRight
- 21. [done] press_key: Press ArrowRight
- 22. [done] press_key: Press Space
- 23. [done] press_key: PRIMARY: press the Tab key to enter the seat map
- 24. [done] wait: queued plan (8 steps): press_key "Row A, Seat 4, Front Stage, Left, $189.00, ava
- 25. [done] press_key: Press ArrowDown
- 26. [done] press_key: Press ArrowDown
- 27. [done] press_key: Press ArrowDown
- 28. [done] press_key: Press ArrowDown
- 29. [done] press_key: Press ArrowDown
- 30. [done] press_key: Press ArrowRight
- 31. [done] press_key: Press ArrowRight
- 32. [done] press_key: Press ArrowRight
- 33. [done] wait: queued plan (8 steps): press_key "Row F, Seat 7, Orchestra, Center, $129.00, una
- 34. [done] press_key: Press ArrowRight
- 35. [done] press_key: Press ArrowRight
- 36. [done] press_key: Press ArrowRight
- 37. [done] press_key: Press ArrowRight
- 38. [done] press_key: Press ArrowRight
- 39. [done] press_key: Press ArrowRight
- 40. [done] press_key: Press ArrowRight
- 41. [done] press_key: Press Space
- 42. [done] wait: queued plan (2 steps): press_key "Row F, Seat 14, Orchestra, Center, $129.00, se
- 43. [done] press_key: Press ArrowRight
- 44. [done] press_key: Press Space
- 45. [done] wait: queued plan (3 steps): press_key "Row F, Seat 15, Orchestra, Center, $129.00, se
- 46. [done] press_key: Press Tab
- 47. [done] press_key: Press Tab
- 48. [done] press_key: Press Space
- 49. [done] wait: queued plan (4 steps): press_key "Add a ticket"; press_key "Add a ticket"; press
- 50. [done] press_key: Press Shift+Tab
- 51. [done] press_key: Press Shift+Tab
- 52. [done] press_key: Press ArrowLeft
- 53. [done] press_key: Press Space
- 54. [done] wait: queued plan (4 steps): press_key "Row F, Seat 14, Orchestra, Center, $129.00, se
- 55. [done] press_key: Press Tab
- 56. [done] press_key: Press Tab
- 57. [done] press_key: Press Tab
- 58. [done] press_key: Press Enter
- 59. [done] press_key: PRIMARY: press Shift+Tab to return focus to the seat map
- 60. [done] wait: queued plan (4 steps): press_key "Add a ticket"; press_key "Add a ticket"; press
- 61. [done] press_key: Press Shift+Tab
- 62. [done] press_key: Press Shift+Tab
- 63. [done] press_key: Press ArrowRight
- 64. [done] press_key: Press Space
- 65. [failed] wait: Waiting after keyboard navigation reached the action limit

## What the screen reader said

- 11.4s "Aurora Vale · Neon Tides Tour · Encore, document"
- 24.7s "encore, link"
- 35.9s "Discover, link"
- 37.2s "Venues, link"
- 38.4s "Artists, link"
- 39.6s "My tickets, link"
- 40.9s "Get tickets, link"
- 42.1s "Watch the trailer, link"
- 43.3s "Scroll dates left, button"
- 44.6s "Scroll dates right, button"
- 53.4s "Wednesday 19 Nov, 8:00 PM, Few left, radio button, not checked"
- 54.7s "Remove a ticket, button, unavailable"
- 55.9s "Add a ticket, button"
- 64.6s "Remove a ticket, button, unavailable"
- 72.9s "Wednesday 19 Nov, 8:00 PM, Few left, radio button, not checked"
- 82.5s "Thursday 20 Nov, 8:00 PM, Selling fast, radio button, checked"
- 83.8s "Friday 21 Nov, 8:00 PM, Opening night, Selling fast, radio button, checked"
- 93.1s "Row A, Seat 4, Front Stage, Left, $189.00, available, cell"
- 104.9s "Row B, Seat 4, Front Stage, Left, $189.00, unavailable, cell, unavailable"
- 106.3s "Row C, Seat 4, Front Stage, Left, $189.00, available, cell"
- 107.4s "Row D, Seat 4, Orchestra, Left, $129.00, unavailable, cell, unavailable"
- 108.8s "Row E, Seat 4, Orchestra, Left, $129.00, unavailable, cell, unavailable"
- 109.9s "Row F, Seat 4, Orchestra, Left, $129.00, unavailable, cell, unavailable"
- 111.3s "Row F, Seat 5, Orchestra, Left, $129.00, unavailable, cell, unavailable"
- 112.4s "Row F, Seat 6, Orchestra, Left, $129.00, unavailable, cell, unavailable"
- 113.7s "Row F, Seat 7, Orchestra, Center, $129.00, unavailable, cell, unavailable"
- 125.9s "Row F, Seat 8, Orchestra, Center, $129.00, unavailable, cell, unavailable"
- 127.2s "Row F, Seat 9, Orchestra, Center, $129.00, unavailable, cell, unavailable"
- 128.5s "Row F, Seat 10, Orchestra, Center, $129.00, unavailable, cell, unavailable"
- 129.8s "Row F, Seat 11, Orchestra, Center, $129.00, unavailable, cell, unavailable"
- 131.1s "Row F, Seat 12, Orchestra, Center, $129.00, unavailable, cell, unavailable"
- 132.4s "Row F, Seat 13, Orchestra, Center, $129.00, unavailable, cell, unavailable"
- 133.7s "Row F, Seat 14, Orchestra, Center, $129.00, available, cell"
- 135.2s (live) "Row F, Seat 14 selected. All 1 seat chosen. Checkout is ready."
- 143.7s "Row F, Seat 15, Orchestra, Center, $129.00, available, cell"
- 145.1s (live) "Row F, Seat 15 selected. Replaced seat F14. All 1 seat chosen. Checkout is ready."
- 156.2s "Remove a ticket, button, unavailable"
- 157.4s "Add a ticket, button"
- 158.9s (live) "2 tickets"
- 169.6s "Remove a ticket, button"
- 170.9s "Row F, Seat 15, Orchestra, Center, $129.00, selected, cell, selected"
- 172.2s "Row F, Seat 14, Orchestra, Center, $129.00, available, cell"
- 173.6s (live) "Row F, Seat 14 selected. All 2 seats chosen. Checkout is ready."
- 184.8s "Remove a ticket, button"
- 186.1s "Add a ticket, button"
- 187.4s "Remove seat F15, button"
- 200.9s "Add a ticket, button"
- 212.6s "Remove a ticket, button"
- 213.7s "Row F, Seat 14, Orchestra, Center, $129.00, selected, cell, selected"
- 215.1s "Row F, Seat 15, Orchestra, Center, $129.00, available, cell"
- 216.5s (live) "Row F, Seat 15 selected. All 2 seats chosen. Checkout is ready."

## Earlier attempts in this loop

- Attempt 1: changed apps/encore/src/App.tsx, apps/encore/src/components/BookingSummary.tsx, apps/encore/src/components/CheckoutModal.tsx, apps/encore/src/components/Confirmation.tsx, apps/encore/src/components/DateCarousel.tsx, apps/encore/src/components/SeatMap.tsx, apps/encore/src/index.css; Kane's blind rerun failed: Maximum steps exceeded (64/60)
