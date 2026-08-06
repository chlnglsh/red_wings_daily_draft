import './app/index.css';
import './app/App.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { redditPlatform } from './redditPlatform';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App platform={redditPlatform} />
  </StrictMode>
);
