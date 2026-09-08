import { config } from 'dotenv';
import {
  installationConfig,
  installationPath,
  signInstallationValue,
} from '../lib/slack/installation';

// Use a private environment file supplied by the deployment operator.
// Do not pass credentials in command-line arguments.
config({ path: process.env.SLACK_INSTALL_ENV_FILE ?? '.env.local' });
try {
  const settings = installationConfig();
  const expires = String(Date.now() + 15 * 60_000);
  const signature = signInstallationValue('ticket', expires, settings.secret);
  const url = new URL(installationPath, settings.origin);
  url.searchParams.set('ticket', `${expires}.${signature}`);
  process.stdout.write(`${url.toString()}\n`);
} catch {
  console.error(
    'Set AUTH_URL, AUTH_SECRET, AUTH_SLACK_ID, AUTH_SLACK_SECRET and SLACK_TEAM_ID in a private environment file.'
  );
  process.exitCode = 1;
}
