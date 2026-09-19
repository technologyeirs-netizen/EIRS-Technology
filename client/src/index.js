import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Register the service worker so the app can be installed and works
// offline. This registers a service worker in production only, and
// updates the cache in the background whenever a new version is deployed.
// Pass a config with onUpdate/onSuccess callbacks if you want to show the
// user an "update available" prompt.
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    // A new version has been downloaded and is waiting to activate.
    // Activate it immediately and reload so the user always gets the
    // latest build without manually clearing cache.
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  },
});
