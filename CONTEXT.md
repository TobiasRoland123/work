# Wørk

Wørk tells Charlie Tango who is in the Copenhagen office today. Colleagues announce
their own exceptions in a Slack channel in ordinary language; the app interprets those
announcements and shows the resulting presence on a shared week overview and directory.

## Language

### Attendance

**Declaration**:
An announcement a person makes about their own attendance, in their own words.
One Declaration can cover several days or several intervals. Only top-level channel
messages are Declarations; thread replies never are, even in the person's own thread.
_Avoid_: Status update, message, post

**Resolved Status**:
What a person's attendance is judged to be at a given moment, derived from their
Declarations plus the workday defaults. Never stored; computed when attendance is read.
_Avoid_: Current status, state

**Workday Default**:
The attendance assumed for a person who has made no Declaration for today. Weekdays
only, from 09:00 Europe/Copenhagen.
_Avoid_: Fallback, implicit status

**Correction**:
A Declaration a person makes to replace the status Slack import read from one of their
own Declarations, for one day or the whole announcement. The imported Declaration is
kept, and the error is recorded for quality review.
_Avoid_: Override, fix, edit

**Echo**:
A message the Wørk bot posts in the attendance channel to announce a Declaration a person
made about themselves in the app. It carries the person's name and photo, and Slack marks
it as coming from an app. Only exceptions are echoed: being in the office is not. A status
an admin sets for a colleague is never echoed, and neither is a Correction. An Echo is
never itself a Declaration and is never read back as one.
The person chooses for each Declaration whether it is echoed; it is, unless they opt out.

An Echo is posted at 08:00 Europe/Copenhagen on the weekday its Declaration applies,
or at once when the Declaration is made later that same day. It is never posted ahead of
its day, so a Declaration removed before then is never echoed. A Declaration covering
several days gets one Echo, on its first day, naming the whole range. The Echo shows the
status, its dates, any arrival or leaving time, and the person's note word for word. If
its Declaration is removed after the Echo is posted, the Echo stays in the channel, crossed
out and marked as cancelled. When a newer Declaration replaces only some of its days, the
Echo is edited to cross out those days and keeps the rest; replacing every day cancels it.
A newer exception gets its own Echo on its own day.
An Echo that still cannot be posted by the end of its day is given up. Only the person is
told it was not posted.
_Avoid_: Mirror, relay, cross-post, notification

**Learned Shorthand**:
A whole-message phrase that Slack import reads without AI because enough earlier
Declarations with exactly that wording were read the same way. Its dates resolve from each
new Declaration's own time. A correction or a conflicting reading blocks it for good.
_Avoid_: Learned rule, cached answer, alias

**Pinned Colleague**:
A colleague one person has chosen to keep an eye on in the Week page side panel. Private
to the person who pinned them, stored per person, never a symmetric relationship, and
never pinning yourself.
_Avoid_: Favourite, follow, watchlist, buddy

### Local Sandbox

The Local Sandbox replaces the Slack workspace during local development. It runs only
outside production builds, and nothing in it contacts Slack.

**Sandbox Profile**:
A seeded person who exists only in a local database. No Slack account corresponds to
one, and none can sign in to the real workspace.
_Avoid_: Test user, fake user, dummy profile

**Author**:
The Sandbox Profile a Sandbox Message is attributed to. Chosen per message.
_Avoid_: Sender, poster, from-user

**Signed-in Profile**:
The Sandbox Profile whose session the browser currently holds, and therefore whose
`/profile` page and manual status form are shown. Independent of Author.
_Avoid_: Current user, active profile, me

**Sandbox Message**:
Text entered in the Local Sandbox on behalf of an Author, which enters the same intake
path a Slack message would. It is a genuine inbox row, not a simulation of one.
_Avoid_: Fake message, test message, mock event

**Sandbox Echo**:
An Echo shown on the Local Sandbox page instead of in Slack, looking and changing as it
would in the attendance channel. The day's Sandbox Echoes can be posted on demand instead
of waiting for 08:00.
_Avoid_: Fake echo, preview, mock post

### Appearance

**Palette**:
A named set of interface colours chosen on the profile page's Appearance settings. Every
Palette exists in a light and a dark variant, so it is independent of the Mode. The
original look is the Palette called `default`. Stored in the browser, not per person.
_Avoid_: Theme (that word is used for light/dark in the code), skin, colour scheme

**Mode**:
Light or dark, toggled in the page header or on the profile page. Applies to every Palette.
_Avoid_: Theme, appearance

## Flagged ambiguities

**"Profile" unqualified** — in the Local Sandbox this is ambiguous between the person a
message comes from and the person you are signed in as. These vary independently. Always
say **Author** or **Signed-in Profile**.

## Example dialogue

**Dev**: I typed "hjemmefra i morgen" into the sandbox and today's column didn't change.

**Domain expert**: Nothing should. That Declaration is for tomorrow, so today's
Resolved Status for that person still comes from the Workday Default — in the office
from 09:00. Look at tomorrow instead.

**Dev**: Right. And if I want to see it as them rather than as myself?

**Domain expert**: Then change the Signed-in Profile. The Author is already them — that's
who the Declaration belongs to. Signing in as them only changes whose `/profile` you see.

**Dev**: So I could stage Declarations for the whole office without signing in as anyone else.

**Domain expert**: That's the point. Author per Sandbox Message, Signed-in Profile once.
