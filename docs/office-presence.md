# Office presence

The Week page (`/today`) shows where every colleague is from Monday to Friday. Each row is a person and each column a weekday; one announcement covering several days is drawn as a single bar, with a note when it starts before or ends after the visible week. Days where nobody announced anything show the Workday Default with a dashed outline, so assumed office days are distinguishable from announced ones. Saturdays and Sundays open the coming week, and `?week=YYYY-MM-DD` selects another week.

Each column header shows how many people are in the office that day and selects the day for the side panel, which groups colleagues into in office, working elsewhere, out, and no status. Search and the in-office filter apply to the selected day. Selecting a person opens a sheet with contact information, their current status, the week day by day, and source Slack links. The signed-in person is pinned to the top. Small screens stack each person's name above their week and move the day panel below the board.

Days other than today are resolved at 09:00 Copenhagen time, the start of the workday, so a planned late arrival shows as `IN_LATE` and an early departure shows as in office with its leaving note. Today is resolved live once the workday has started. `lib/status/week.ts` builds the week on top of the resolver described below.

## Planning ahead

People announce days ahead from the same status form, in Slack, or straight from the board. On the board, the signed-in person's own cells from today onward are buttons: clicking one opens the form with that day selected, and clicking a multi-day bar selects its remaining days. The form's "When" section offers the weekdays of the viewed week and the week after as toggles, so non-adjacent days (home on Monday and Thursday) take one save. "Longer period" switches to from/to dates and is the default for vacation and leave. In late and leaving early always use individual days, and the chosen time applies to each of them.

`planStatusAction` validates the plan on the server (`lib/status/plan.ts`): no past days, at most a year ahead, and a time that has not already passed when today is included. Picked days become one Declaration per run of consecutive days, where a gap of only Saturday and Sunday keeps the run going, so a Friday-to-Tuesday plan stays one bar. Timed statuses become one Declaration per day, with the time stored as that date's Copenhagen wall clock.

Planning a day again adds a newer Declaration, which wins. The signed-in person's sheet lists "Your upcoming announcements" across all weeks. App-made ones can be removed, which restores whatever the day showed before; Slack-made ones link to their message, since the Slack message is their source.

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

React and React DOM are aligned to the 19.2 release line with corresponding types. The existing date picker has an older React peer range; its calendar opening and date selection were checked in the browser.

Focused tests cover clock boundaries, winter and summer offsets, explicit overrides, manual timing, weekends, date rollover, and Slack shorthand. UI checks use temporary sample profiles without writing attendance or bypassing the production authentication rules. The temporary fixture route is removed after verification.
