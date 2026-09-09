import { NextRequest, NextResponse } from 'next/server';
import {
  createInstallationState,
  installationCallbackPath,
  installationConfig,
  installationCookie,
  installationScopes,
  validInstallationTicket,
} from '@/lib/slack/installation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

export async function GET(request: NextRequest) {
  try {
    const config = installationConfig();
    if (!validInstallationTicket(request.nextUrl.searchParams.get('ticket') ?? '', config.secret))
      return new NextResponse('Ask the deployment operator for a fresh Slack installation link.', {
        status: 403,
        headers,
      });
    const { state, cookie } = createInstallationState(config.secret);
    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.search = new URLSearchParams({
      client_id: config.clientId,
      scope: installationScopes.join(','),
      team: config.teamId,
      redirect_uri: `${config.origin}${installationCallbackPath}`,
      state,
    }).toString();
    const response = NextResponse.redirect(url, { status: 302, headers });
    response.cookies.set(installationCookie, cookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return response;
  } catch {
    return new NextResponse('Slack installation is not configured.', { status: 503, headers });
  }
}
