# Employee stats

`/employee-stats` shows how people have worked: an overview of everyone, and a page for each individual. It is restricted. The admin chooses who can see it.

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

There are two roles.

- **Admin.** Tobias Roland, identified by Slack team `T02HKL21R` and Slack user `U05NP1NF3QB` (the same identity as the initial [message reviewer](message-quality.md#access)). The admin always has access and is the only one who can change who else has it. The identity is set in code (`lib/auth/admin-identity.ts`), not in the database, so nobody can be promoted to admin through the app.
- **Viewer.** Anyone the admin has granted access to. A viewer can read the stats but cannot see or change the access list.

The admin manages access on **Stats access** (`/employee-stats/access`, under **More** in the navigation, or **Manage access** on the stats page). The page lists every active workspace member, with the people who can view the stats first. **Grant access** and **Revoke** take effect immediately; the person sees the page on their next load. Use the search box to find someone by name or email. A grant records who gave it and when.

Every request checks the live database. A session alone grants nothing. The page, the access list and both actions each repeat the check, so hiding a link is never the only protection, and a person who loses access is turned away on their next request. People without access get a "not found" page, and neither navigation link is shown to them. A grant only counts while the person is an active member of `SLACK_TEAM_ID`; a deactivated person has no access, and a grant left behind applies again if they are reactivated. The admin cannot be granted or revoked.

If `SLACK_TEAM_ID` is unset, or names a workspace other than the admin's, nobody is an admin and the page is open only to granted viewers.

### Local sandbox

The sandbox workspace (`T_LOCAL`, nonproduction builds only) has no real admin. Anna Attendee (`U_LOCAL_ANNA`) stands in so the controls can be tried: sign in as Anna, grant Mads or Freja, then sign in as them to see the page. A production build pointed at `T_LOCAL` has no admin.

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

The feature adds the `employee_stats_access` table (`db/0047_employee_stats_access.sql`). Apply it before deploying, in the same way as other migrations (`pnpm db:migrate` against the intended database). It has row level security enabled like the other tables and cascades when a user is deleted.
