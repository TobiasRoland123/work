import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeInstallationCode,
  installationConfig,
  installationCookie,
  validInstallationState,
} from '@/lib/slack/installation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const reply = (message: string, status: number) => {
    const response = new NextResponse(message, {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
    response.cookies.set(installationCookie, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  };
  try {
    const config = installationConfig();
    const params = request.nextUrl.searchParams;
    if (
      !validInstallationState(
        params.get('state') ?? '',
        request.cookies.get(installationCookie)?.value ?? '',
        config.secret
      )
    )
      return reply(
        'Installation session missing or expired. Start again using a fresh setup link in this browser.',
        403
      );
    if (params.has('error'))
      return reply(
        'Slack installation was not approved. Start again when approval is available.',
        400
      );
    const code = params.get('code');
    if (!code)
      return reply(
        'Slack did not provide an installation code. Start again using a fresh setup link.',
        400
      );
    await exchangeInstallationCode(code, config);
    return reply(
      'Slack installation verified. The deployment operator must copy the Bot User OAuth Token from Slack app settings, OAuth & Permissions, into SLACK_BOT_TOKEN in Vercel Production and redeploy. Website sign-in is ready to test after that configuration.',
      200
    );
  } catch {
    return reply(
      'Slack installation could not be verified. Check the workspace and app configuration, then start again with a fresh setup link.',
      502
    );
  }
}
