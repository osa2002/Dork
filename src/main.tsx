import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './lib/i18n';
import App from './App.tsx';
import { ResilienceBoundary } from './components/ResilienceBoundary';
import { ClientLogger } from './lib/clientLogger';
import './index.css';

// Register global error handlers for early startup & runtime uncaught issue tracking
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    ClientLogger.error('Global Unhandled Window Error:', event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    ClientLogger.error('Global Unhandled Promise Rejection:', event.reason);
  });

  ClientLogger.info('DorkQ Enterprise Application initialized successfully.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ResilienceBoundary>
      <App />
    </ResilienceBoundary>
  </StrictMode>,
);
