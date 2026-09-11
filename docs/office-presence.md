# Office presence

The Today page combines the Copenhagen office model from the WØRK CT Office project with the existing employee directory and status form. It loads the Three.js scene separately from the people list. Characters are keyed by employee ID and exist only while the resolved status is `IN_OFFICE`. Character movement is illustrative, not physical location tracking.

The people panel supports search, attendance filters, selection, contact information, status details, and source Slack links. Selecting an in-office colleague highlights their character. Small screens stack the map above the list. Reduced-motion settings and hidden browser tabs stop the animation; WebGL failures leave the list available.

## Attendance rules

All dates and clocks use Europe/Copenhagen, including daylight saving time.

- An exact announcement such as “in at 7” starts `IN_OFFICE` at 07:00. Before 09:00 it is not classified as a late arrival.
- Exact later arrivals keep `IN_LATE` until their arrival time, then become `IN_OFFICE`.
- Approximate arrivals do not become confirmed attendance at the nominal clock time.
- On weekdays, a person with no declaration for today defaults to `IN_OFFICE` from 09:00. There is no weekend default. Explicit weekend attendance still applies.
- Today's explicit statuses, including working from home, illness, leave, and future arrivals, take precedence over the default. A declaration for a later date does not suppress today's default.
- Exact manual departure times show office presence from 09:00 until departure, including a departure note, then `LEAVING_EARLY`.
- Description-only declarations remain visible without assuming office presence.

Defaults and timed transitions are resolved when reading attendance, not inserted into the status table. The original announcements remain intact. The browser listens for the existing status broadcast, refreshes after a successful manual update, and polls every 15 seconds while visible. Timed transitions therefore appear within one polling interval without a scheduled database job. A failed refresh retains the previous data and displays a reconnecting indicator.

`lib/status/active.ts` contains the resolver. Both the directory and individual-user services use it. `lib/slack/shorthand.ts` and the extraction prompt define early-arrival parsing. `IN_OFFICE` already existed in the database enum; the status form now exposes it.

## Dependencies and verification

The Next.js 15 App Router renderer requires the React 19-compatible Fiber 9 integration. React and React DOM are aligned to the 19.2 release line with corresponding types. The existing date picker has an older React peer range; its calendar opening and date selection were checked in the browser.

Focused tests cover clock boundaries, winter and summer offsets, explicit overrides, manual timing, weekends, date rollover, and Slack shorthand. UI checks use temporary sample profiles without writing attendance or bypassing the production authentication rules. The temporary fixture route is removed after verification.
