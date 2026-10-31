# Employee stats

`/employee-stats` shows how people have worked: an overview of everyone, and a page for each individual. It is restricted to managers and admins. Admins manage application roles.

## Pages

- **Overview** (`/employee-stats`). Where people were over a chosen period, how that changed over time, how it splits across the weekdays, and a sortable table with one row per employee. Pick **7 days**, **30 days** (the default), **90 days**, **6 months**, **1 year** or **All time**.
- **Employees** (`/employee-stats/people`). Search everyone by name or email; matching ignores case and accents. Choose a person to open their page.
- **A person** (`/employee-stats/people/<id>`). That person's attendance over time, where they were, which weekdays they are in the office and a day-by-day calendar of their last year. Choose how to see them:
  - **{Name} only** shows just that person.
  - **Against the norm** (the default) draws the norm next to them: a dashed line on the trend, a tick on each weekday bar, the gap to the norm on the figures and where they stand among colleagues.

The search also works from the profile, and the period and comparison are kept as you move around. The period and comparison are in the address, so a page can be linked to.

### History

Nothing is thrown away, so the stats get richer as the history grows. They are worked out from the recorded announcements when the page is opened. **All time** starts at the earliest day anyone is on record, and reaches back at most five years (`MAX_HISTORY_DAYS` in `lib/employee-stats/stats.ts`) so one stray date cannot make a page unbounded. Charts group days to fit the period: by day for up to two weeks, by week up to about a year, and by month beyond that.

A person is counted from the day they joined or first announced something, whichever is earlier. Without that, the Workday Default would count a new colleague as in the office on all the days before they were here. The first and last week of a view can be partial, so charts show shares rather than totals.

### The norm

The norm is everyone else: all other active employees, pooled over the same workdays as the person. It is recalculated for every point on the chart, so it follows the team as it changes and becomes more representative as people and history are added. A colleague only counts on the days they are on record. The person is never part of their own norm.

- A shaded band on the office share trend shows the middle half of colleagues (25th to 75th percentile) once at least four colleagues were working in that period.
- The rank ("Ahead of 60% of colleagues") needs at least three colleagues to compare with.
- **{Name} only** does not load colleagues at all. The norm is left out of the page.
- Former employees (deactivated in Slack) are left out of the norm and the history, so it describes the current team.

## Access

Employee statistics are available to the **Admin** and **Manager** application roles. **Employee** accounts cannot open the overview, directory, or individual statistics. Admins also have message review and AI costs, and can manage roles at **More → Roles** (`/admin/roles`). Managers cannot change roles.

Samuel Tobias Roland Uyet's verified Slack identity (`T02HKL21R` / `U05NP1NF3QB`) bootstraps the first admin. After that, the stored role determines access, including for additional admins. Admins cannot change their own role. The old `/employee-stats/access` link redirects admins to Roles.

Every request checks the active mapped account and current role in the configured workspace. Removing a role takes effect on the next request. The navigation hides restricted pages, and the server checks again before returning data or applying changes.

### Local sandbox

Anna Attendee is created as the local sandbox admin. Other profiles start as employees. Sign in as Anna and assign **Manager** to Mads or Freja to try stats access, or **Admin** to try role management, message review and AI costs. Reseeding does not overwrite roles you have changed.

See [Application access](access-control.md) for the full hierarchy and migration steps.

## What the numbers mean

The stats count people who are active members of `SLACK_TEAM_ID` with a Slack account. Each past workday is read the way the Week page reads it at 09:00 Copenhagen time, so a day with no announcement counts as in the office. Today is included once it has started. Weekends are left out. Today is read live; the days before it are read at the start of the workday.

| Group         | Statuses                          |
| ------------- | --------------------------------- |
| In office     | In office, in late, leaving early |
| Home & remote | From home, remote                 |
| At client     | At client                         |
| Sick          | Sick, child sick                  |
| Vacation      | Vacation                          |
| Other absence | On leave, away                    |

Everything is counted in person-days: one person on one workday. A day without an attendance status, such as one covered only by a note, is shown as **No status**.

- **Office share** is office days divided by days in the office, at home or at a client. Absences and days without a status are left out. It shows `N/A` when nobody worked in the period.
- **In office per day** is office person-days divided by workdays in the period.
- **Absence** is sick, vacation and other absence days as a share of all person-days.
- **By weekday** shows the office share on each weekday, with the average headcount in the table.
- **Gap to the norm** is in percentage points: someone at 70% where the norm is 55% is +15 points.

Sick days are sensitive, so grant access only to people who need it.

## Migration

The original feature added `employee_stats_access` in migration `0047`. Migration `0048_application_roles.sql` replaces those grants with application roles. Existing viewers become managers; the verified initial admin becomes an admin; all other accounts become employees. The old grant table is retained for history and is no longer used for authorization. See [Application access](access-control.md#migration).
