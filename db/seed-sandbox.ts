import { assertSandbox } from '../lib/sandbox/enabled';
import { seedSandboxProfiles } from '../lib/sandbox/profiles';

// Seeds the checked-in Sandbox Profiles into the local database. Idempotent.
const seed = async () => {
  assertSandbox();
  if (!['127.0.0.1', 'localhost'].includes(process.env.PGHOST ?? ''))
    throw new Error('Sandbox fixtures are only seeded into a local database (PGHOST=127.0.0.1).');
  const result = await seedSandboxProfiles();
  console.info(
    `Seeded ${result.profiles} Sandbox Profiles` +
      (result.seededStatuses.length
        ? ` and a FROM_HOME Declaration for ${result.seededStatuses.join(', ')}`
        : '')
  );
};

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error during sandbox seeding:', error);
    process.exit(1);
  });
