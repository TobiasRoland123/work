import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

/**
 * Sets up Supabase Realtime subscriptions and relays changes through a callback.
 *
 * @param {(msg: string) => void} broadcastFn - Function to call when an update is received.
 */
export function listenToStatusChanges(broadcastFn: (msg: string) => void) {
  const channel = supabase
    .channel('status-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'status' }, (payload) => {
      const message = JSON.stringify({
        type: 'STATUS_UPDATE',
        payload,
      });
      broadcastFn(message);
    })
    .subscribe();

  // Optionally return a cleanup function
  return () => {
    supabase.removeChannel(channel);
  };
}
