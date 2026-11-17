import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { demoBackend } from './data/demoBackend';
import { firebaseBackend } from './data/firebaseBackend';
import { firebaseKonfiguriert } from './firebase-config';
import './styles/theme.css';

const backend =
  import.meta.env.VITE_DATA_MODE === 'demo' ? demoBackend() : firebaseKonfiguriert ? firebaseBackend() : null;

if (import.meta.env.PROD) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App backend={backend} />
  </StrictMode>,
);
