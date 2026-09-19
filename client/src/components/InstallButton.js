import React, { useEffect, useState } from 'react';
import { FaDownload } from 'react-icons/fa';
import '../styles/InstallButton.css';

const InstallButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // If the app is already installed and running in standalone mode,
    // never show the install button.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    const handleBeforeInstallPrompt = (event) => {
      // Prevent the default mini-infobar from appearing automatically,
      // so we can show our own floating button instead.
      event.preventDefault();
      setDeferredPrompt(event);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    // The prompt can only be used once, so clear it either way.
    setDeferredPrompt(null);
  };

  // Nothing to show if the browser hasn't fired beforeinstallprompt yet
  // (e.g. already installed, unsupported browser, or criteria not met).
  if (!isVisible) return null;

  return (
    <button
      className="install-app-button"
      onClick={handleInstallClick}
      title="Install App"
      aria-label="Install App"
    >
      <FaDownload />
    </button>
  );
};

export default InstallButton;
