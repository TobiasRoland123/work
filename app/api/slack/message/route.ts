import { auth } from '@/auth';
import { getSlackPermalink, validateSlackBotTeam } from '@/lib/slack/client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const session = await auth();
  if (session?.provider !== 'slack' || !session.userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [team, channel, ts, extra] = (new URL(request.url).searchParams.get('key') ?? '').split(
    ':'
  );
  if (
    !team ||
    !channel ||
    extra ||
    team !== process.env.SLACK_TEAM_ID ||
    channel !== process.env.SLACK_CHANNEL_ID ||
    !/^\d{10,}\.[0-9]{6}$/.test(ts ?? '')
  )
    return NextResponse.json({ error: 'Unknown source message' }, { status: 404 });
  try {
    await validateSlackBotTeam();
    return NextResponse.redirect(await getSlackPermalink(channel, ts));
  } catch {
    return NextResponse.json(
      { error: 'Slack message link is currently unavailable' },
      { status: 503 }
    );
  }
}
