import React from 'react';
/** Historical defaults are assumptions until source coverage has been verified. */
export function HistoryCoverageNotice() {
  return (
    <p
      role="note"
      className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      Historical Slack coverage may be incomplete. Office totals include Workday Defaults, which are
      assumptions, not evidence of attendance. Missing, unavailable, or unimported announcements can
      change these totals. Ask an administrator for the monthly import coverage report before using
      historical comparisons.
    </p>
  );
}
