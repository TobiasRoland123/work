# Office presence

The Week page (`/today`) shows where every colleague is from Monday to Friday. Each row is a person and each column a weekday; one announcement covering several days is drawn as a single bar, with a note when it starts before or ends after the visible week. Days where nobody announced anything show the Workday Default with a dashed outline, so assumed office days are distinguishable from announced ones. Saturdays and Sundays open the coming week, and `?week=YYYY-MM-DD` selects another week.

Each column header shows how many people are in the office that day and selects the day used to group the table and to fill the side panel. Each daily announcement has its own heading and visible colleague count, such as Home, At client, Sick or Away; recorded notes have a separate Note group. Groups start expanded and can be collapsed independently in the table by clicking their headings or using Enter or Space. Counts remain visible, and collapse choices are retained while searching or selecting another day in the current view. The table marks group counts as “shown” or “hidden”; its week view also states the grouping date and visibility rule, while column totals count the full directory. Search filters the table and its group counts. Today shows announced attendance exceptions and notes throughout their calendar day. Week keeps colleagues with an exception on any displayed day, so a row can appear under In office or No status for the selected day when its exception is on another day; the side panel is unaffected by search and shows the signed-in person's pinned colleagues. Selecting a person opens a sheet with contact information, their current status, the week day by day, and source Slack links. Directory order is preserved within each group, with the signed-in person first in their group. Small screens stack each person's name above their week and move the day panel below the board.

The board and day-by-day person details retain the latest announcement for each Copenhagen calendar date, including its timing, comment and Slack link. For example, an arrival at 09:30 stays visible as `In late · from 09:30` for the whole day, and a departure stays visible as `Leaving early` before and after its clock time. Companion office-return intervals from the same Slack announcement do not hide its exception. A newer announcement or correction replaces the earlier declaration, and declarations do not carry into the next day.

Office totals and the person's Right now status still use resolved presence. Today's presence is live, so an arrival at 09:30 counts as in office from 09:30 even while the late announcement stays visible. Other days use 09:00 Copenhagen time, the start of the workday, for office counts. Ordinary office attendance and workday defaults remain omitted from exception rows. `lib/status/week.ts` supplies both the daily declaration and resolved presence.

## Pinned colleagues

The side panel shows the signed-in person's pinned colleagues, a short list of the people they work with most, so they can see at a glance whether those people are in. Each row shows the status for the selected day, with its note and arrival time, and rows are ordered In office, In late, then the other statuses in the usual order, keeping pin order within a status. People with no status yet come last. The footer counts how many pinned colleagues are in the office, and how many of them arrive later. Today's counts follow resolved presence, so they match the header; a day shown from the Workday Default is marked as assumed for screen readers.

**Edit** reveals a remove button on every row, and **Add a colleague…** searches the directory by name or role. Pressing Enter pins the first match. Pins are private, saved per person in `pinned_colleagues`, loaded with the page and not refreshed by the live poll. They update immediately and roll back with a toast if saving fails. `pinService` refuses to pin yourself, unknown people and deactivated people, and pinning someone twice does nothing. Deactivated people drop out of the list but stay pinned, so they return if reactivated. Deleting a user removes their pins and any pins of them.

The panel can be hidden with the side-panel button beside the Today and Week switch, which gives the board the full width. The choice is remembered per browser in the `week-panel` cookie, which the server reads so the page loads in the right layout without a flash. The panel is open until it is closed.

## Installing the app and push notifications

WØRK is an installable PWA. `app/manifest.ts` serves the web app manifest (starts at `/today`, standalone display, icons in `public/icons/`), and `public/sw.js`, registered on every page, makes browsers offer installation and shows push messages. The service worker caches nothing, so attendance is always read fresh. On iPhone and iPad, push only works once the app has been added to the Home Screen. The manifest and service worker are excluded from the login redirect in `middleware.ts`, because browsers fetch them without a session.

The Profile page has a **Notifications** section. **Turn on for this device** asks the browser for permission and saves its push subscription in `push_subscriptions` (one row per browser, so signing in as someone else on the same browser moves it). Below it, each kind is opted into or out of per person in `notification_preferences`; with no row a kind is on, but nothing is sent until a device is subscribed.

- **Pinned colleague arrived** is sent when a Declaration moves a pinned colleague into the office at that moment. Resolved Status is never stored, so `notifyArrival` compares it before and after the new Declarations are written, whether they come from the status form or from Slack import. The Workday Default alone is never an arrival.
- **Pinned colleagues in today** is a summary sent at 09:00 Copenhagen time on weekdays, listing pinned colleagues who are in the office and who arrive later. Vercel cron calls `/api/notifications/pinned-digest` at 07:00 and 08:00 UTC; only the run that lands in the 09:00 Copenhagen hour sends, so summer and winter time both work. The endpoint requires `CRON_SECRET`, like the other cron routes.

Push needs a VAPID key pair: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (a `mailto:` address). Create one with `npx web-push generate-vapid-keys`. Without them the Profile page says notifications are not set up and nothing is sent. A failed push never blocks saving a status, and devices whose subscription the push service reports as gone are deleted.

## Status emojis

Attendance labels show an automatic emoji in the board, selected-day list and person details. The text label remains visible, and screen readers read that label without repeating the decorative emoji. Manual declarations and existing attendance get a suitable default, such as 🏠 for working from home.

Slack import keeps the first recognized emoji that matches each declared status, including known Slack shortcodes. For example, “Vacation today and tomorrow 🌴” keeps 🌴 beside Vacation. Unrelated emojis and custom Slack emojis do not replace the default. Notes without an attendance status have no automatic emoji. The choice is automatic; there is no emoji picker yet.

## Planning ahead

People announce days ahead from the same status form, in Slack, or straight from the board. On the board, the signed-in person's own cells from today onward are buttons: clicking one opens the form with that day selected, and clicking a multi-day bar selects its remaining days. The form's "When" section offers the weekdays of the viewed week and the week after as toggles, so non-adjacent days (home on Monday and Thursday) take one save. "Longer period" switches to from/to dates and is the default for vacation and leave. In late and leaving early always use individual days, and the chosen time applies to each of them.

`planStatusAction` validates the plan on the server (`lib/status/plan.ts`): no past days, at most a year ahead, and a time that has not already passed when today is included. Picked days become one Declaration per run of consecutive days, where a gap of only Saturday and Sunday keeps the run going, so a Friday-to-Tuesday plan stays one bar. Timed statuses become one Declaration per day, with the time stored as that date's Copenhagen wall clock.

Planning a day again adds a newer Declaration, which wins. The signed-in person's sheet lists "Your upcoming announcements" across all weeks. App-made ones can be removed, which restores whatever the day showed before; Slack-made ones link to their message, since the Slack message is their source.

## Correcting an imported status

When Slack import got your attendance wrong, open your own sheet and choose **Wrong status?** under the day. Pick the status it should have been and save. For an announcement covering several days, choose whether the correction applies only to that day or to the whole announcement. Past days in the viewed week can be corrected too. The option appears only on your own days whose status came from Slack, and the server rejects corrections of anyone else's Declaration or of app-made ones.

Saving adds a correction as a newer user Declaration for the chosen days, so it wins in every attendance view. The imported Declaration stays untouched and keeps its Slack link, and the correction appears under "Your upcoming announcements", where removing it brings back the imported status. A sick correction drops the imported note, as planning does, and the import's "time unspecified" notes are dropped because they describe the old reading. Editing the Slack message later replaces the import with a newer Declaration, which wins over the correction.

Each distinct correction is also recorded in `status_corrections` for quality review: the imported status and note, the corrected status, the affected dates, the Slack message key, the exact message revision when the inbox still identifies it, the correcting person and the correction time. The record links to both the imported Declaration and the correction Declaration and outlives either of them. Saving the same correction again records nothing new. If the correction still applies, it changes nothing. If you removed it or announced something newer for those days since, it is applied again. A failed save keeps your selection in the form and shows the reason.

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
