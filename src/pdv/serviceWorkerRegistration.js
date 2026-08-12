import { countPendingSales } from './offlineStore';

export function registerPdvServiceWorker({ onUpdate, onSyncRequest, onSyncComplete } = {}) {
  if (!('serviceWorker' in navigator) || window.location.hostname !== 'pdv.cesca.digital') {
    return () => {};
  }
  let registration;
  const messageHandler = event => {
    if (event.data?.type === 'CESCA_PDV_SYNC') onSyncRequest?.();
    if (event.data?.type === 'CESCA_PDV_SYNC_COMPLETE') onSyncComplete?.(event.data);
  };
  navigator.serviceWorker.addEventListener('message', messageHandler);
  const register = () => {
    navigator.serviceWorker.register('/service-worker.js').then(nextRegistration => {
      registration = nextRegistration;
      if (registration.waiting) onUpdate?.(() => activateWaitingWorker(registration));
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            onUpdate?.(() => activateWaitingWorker(registration));
          }
        });
      });
    }).catch(error => console.warn('Service worker do PDV não registrado:', error));
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
  return () => navigator.serviceWorker.removeEventListener('message', messageHandler);
}

async function activateWaitingWorker(registration) {
  if (!registration?.waiting) return false;
  if (await countPendingSales()) return false;
  const activated = new Promise(resolve => {
    const timeout = setTimeout(() => resolve(), 3000);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  await activated;
  return true;
}
