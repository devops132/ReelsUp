export function setupGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  const onError = (message, source, lineno, colno, error) => {
    // eslint-disable-next-line no-console
    console.error('[window.onerror]', { message, source, lineno, colno, error });
  };
  const onUnhandledRejection = (event) => {
    // eslint-disable-next-line no-console
    console.error('[unhandledrejection]', event.reason || event);
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
}


