import 'dotenv/config';
import { pool } from '../db';
import { syncDirectory } from '../lib/slack/directory';
import { withSlackSyncLock } from '../lib/slack/sync';

withSlackSyncLock(() => syncDirectory())
  .then(result => console.log('Slack directory synced', result))
  .catch(() => { console.error('Slack directory sync failed. Check installation, credentials, and migration.'); process.exitCode = 1; })
  .finally(() => pool.end());
