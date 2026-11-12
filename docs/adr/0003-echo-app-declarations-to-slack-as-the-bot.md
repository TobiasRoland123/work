---
status: accepted
---

# Declarations made in the app are echoed to the attendance channel by the bot

Colleagues who set their status in Wørk are invisible to everyone who only reads the
attendance channel in Slack. Wørk will post an Echo of those Declarations in that same
channel, sent by the WORK 2.0 bot under the person's name and photo. Slack labels the
message as coming from an app, so it reads as Wørk announcing on the person's behalf.

Only exceptions a person declares about themselves are echoed, and each one is echoed
unless they untick "Post in #wørk" when saving it. A status an admin sets for a colleague
is not echoed, because an Echo under the colleague's name would claim they announced it.
Corrections are not echoed, because the person's own Slack message is already in the
channel and colleagues read it correctly. Being in the office is not echoed, because Wørk
assumes it on every workday anyway.

## Considered options

Posting as the person was rejected. Each colleague would have to approve the app
separately, Wørk would have to store a personal Slack key for every one of them, and the
message would look like an ordinary human message, so Slack import would read it back as
a second Declaration whose AI reading could replace the one the person chose. Posting in
a separate channel or a direct message was rejected because colleagues already watch the
attendance channel, and a second place splits their attention. Posting as soon as a
Declaration is saved was rejected in favour of posting on its day, so the channel shows
who is away today instead of plans made weeks ahead.

## Consequences

This reverses the statement in `docs/slack-setup.md` that Wørk never posts messages. The
bot needs the `chat:write` and `chat:write.customize` scopes, which a workspace admin
must approve before anything can be posted. Slack import already ignores bot messages, so
an Echo does not become a Declaration, but deleting or editing an Echo in Slack must not
change the Declaration it announces.

An Echo is posted at 08:00 Europe/Copenhagen on the weekday its Declaration applies,
before the 09:00 Workday Default, or at once when the Declaration is made later that day.
This needs a second scheduled job next to the nightly directory sync. A Declaration
covering several days gets one Echo on its first day naming the whole range, so a
two-week holiday does not post ten near-identical messages. A Declaration removed before
its day is never posted.

The Echo shows the status, its dates, any arrival or leaving time, and the person's note
word for word. Anyone who can read the channel sees the note, including people who cannot
sign in to Wørk; the opt-out is how a person keeps a plan or note out of Slack.

Wørk has to remember which Echo belongs to which Declaration, because Echoes are edited
after posting. When a newer Declaration replaces some of its days, the Echo crosses out
those days. When the Declaration is removed, or every day is replaced, the Echo is crossed
out and marked cancelled instead of being deleted, so replies and reactions stay and
readers can see the plan changed.

Saving a Declaration never fails because of Slack. If an Echo cannot be posted, Wørk keeps
retrying until the end of that day and then gives up, and the person's upcoming
announcements show "Not posted in #wørk" beside it so they can announce it themselves.

The Local Sandbox shows Sandbox Echoes on its own page instead of contacting Slack, with a
button that posts the day's Echoes on demand. The actual Slack calls must be verified on
the preview deployment, as ADR 0001 requires for all Slack code.
