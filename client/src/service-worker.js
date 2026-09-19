/* eslint-disable no-restricted-globals */

// This service worker is built on the Workbox libraries, following the
// pattern used by Create React App's official PWA template.
// It precaches the app shell (produced by the build), then applies
// runtime caching strategies for images and API calls, and serves an
// offline fallback page for navigation requests when there is no
// network connection.

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';

clientsClaim();

// self.__WB_MANIFEST is injected by workbox-webpack-plugin (InjectManifest)
// at build time with the list of files produced by the build process.
precacheAndRoute(self.__WB_MANIFEST);

// The app shell is a single-page app, so route all navigation requests to
// index.html, falling back to a bundled offline page if the network
// (and the cache) both fail.
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  ({ request, url }) => {
    if (request.mode !== 'navigate') return false;
    if (url.pathname.startsWith('/_')) return false;
    if (url.pathname.match(fileExtensionRegexp)) return false;
    return true;
  },
  async (params) => {
    try {
      const handler = createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html');
      return await handler(params);
    } catch (error) {
      return caches.match(process.env.PUBLIC_URL + '/offline.html');
    }
  }
);

// Cache images with a cache-first strategy since they rarely change.
registerRoute(
  ({ request, url }) =>
    request.destination === 'image' || /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// Cache Google Fonts / other same-origin static assets (CSS, JS chunks)
// with stale-while-revalidate for fast loads with background refresh.
registerRoute(
  ({ request }) => request.destination === 'style' || request.destination === 'script',
  new StaleWhileRevalidate({ cacheName: 'static-resources' })
);

// Runtime cache for API calls to the backend (GET requests only). This lets
// previously-seen data show up quickly while offline, while still trying
// the network first so the user always gets fresh data when online.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && /\/api\//.test(url.pathname),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
);

// Allow the web app to trigger skipWaiting() via
// registration.waiting.postMessage({type: 'SKIP_WAITING'})
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
