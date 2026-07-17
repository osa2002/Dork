import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './lib/i18n';
import App from './App.tsx';
import { ResilienceBoundary } from './components/ResilienceBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ResilienceBoundary>
      <App />
    </ResilienceBoundary>
  </StrictMode>,
);
