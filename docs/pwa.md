# Install WØRK on your phone

WØRK can be installed from its HTTPS production address as a standalone app. The
manifest gives it a stable identity and covers every path on the same host,
including `/today`, `/contact`, `/profile`, and `/login`. The normal launch page is
`/today`; an expired session still redirects to sign-in.

## Android

1. Open WØRK in Chrome at the production address.
2. Open Chrome's menu and choose **Install app**.
3. Launch WØRK from its home-screen icon.

If an older home-screen shortcut still displays the title/domain toolbar, remove
that shortcut and install again after this release is deployed. A shortcut made
before the manifest existed may continue opening as a browser window.

## iPhone and iPad

Open WØRK in Safari, choose **Share**, then **Add to Home Screen**. If Safari offers
**Open as Web App**, leave it enabled. Launch the new home-screen icon. The app
provides an Apple touch icon and standalone web app metadata.

## Phone invitation

Until a person closes it once, WØRK shows a QR code on desktop browsers that
opens `/today` on the same host, with short install steps. It waits until the
person has had WØRK in view for 30 seconds, counting across in-app navigation
but not while the tab is hidden, and never opens over another dialog such as
the status drawer. A full reload restarts the wait. Closing it any way
sets `users.phone_invite_dismissed_at`, so it never appears again for that
person on any computer. It is never shown on phone-sized or touch screens or
inside the installed app, and those visits don't count as a dismissal.

## What changes after installation

- The installed app uses standalone display, removing the regular browser
  title/address toolbar during navigation within WØRK's host.
- Android receives 192 px and 512 px icons plus a separate maskable icon that
  keeps the mark inside the central safe zone. Apple receives a 180 px touch
  icon. The manifest also supplies the app name and splash background.
- Supported launchers can offer shortcuts to My profile and Find a colleague.
- The viewport supports display cutouts and keeps pinch zoom available.
- After one connected production visit registers the service worker, a failed
  full-page launch or navigation displays a WØRK offline screen with a retry
  button. You still need a connection to view current statuses or save changes.

The operating system's clock, battery indicators, and home gesture area remain.
Authentication on another origin, such as Slack, may temporarily show browser
controls. A site cannot hide those controls on another site's behalf.

## Cache and update behavior

`public/sw.js` is registered only in production. It precaches only
`public/offline.html`, which contains no user information. Authenticated pages,
API responses, status changes, React Server Component requests, images, and app
bundles are never added to Cache Storage by this worker. Existing browser/Next.js
caching continues to work normally.

The service worker passes successful network responses through, including HTTP
errors. Only a failed same-origin GET document navigation receives the offline
screen. API/auth routes, cross-origin requests, and mutations are untouched.

Updates are checked without the browser's worker script cache. New workers wait
for older app windows to close, so an update does not force a reload while a form
is open. When changing the offline document, increment `OFFLINE_CACHE` in
`public/sw.js` to replace its precached copy. Activation removes only old
`work-offline-*` caches.

## Verification after deployment

Use a real phone to confirm the browser's install prompt, launcher icon, splash
screen, sign-in return, safe areas in portrait and landscape, and launch without
the address toolbar. These depend on the browser and operating system and cannot
be fully verified by desktop emulation.

To check offline launch, visit once while connected, close the app, enable airplane
mode, and reopen the installed icon. The offline screen should appear. Restore
the connection and choose **Try again**. Status changes must not be queued or
reported as saved while offline.

Local development intentionally does not register the worker. Use a production
build on localhost or an HTTPS preview for service worker testing. The manifest,
worker, icons, and offline document must be accessible without signing in.
