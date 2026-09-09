import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listSlackUsers, validateSlackBotTeam } from '@/lib/slack/client';

export async function GET() {
  const session = await auth();
  if (session?.provider !== 'slack' || !session.userId)
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    await validateSlackBotTeam();
    const members = await listSlackUsers();
    return NextResponse.json(
      members
        .filter((member) => !member.deleted && !member.is_bot)
        .map((member) => ({
          id: member.id,
          name: member.profile?.real_name ?? member.real_name,
          email: member.profile?.email,
          image: member.profile?.image_512,
        }))
    );
  } catch {
    return NextResponse.json({ error: 'Slack directory unavailable' }, { status: 502 });
  }
}
