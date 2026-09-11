import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ParticipantView from './screens/ParticipantView';

// The app itself has no router (everything else is tab state, one path).
// /p/<code> is the one real exception — a shareable link someone else
// opens cold, with no local state at all — so it's handled directly here
// rather than pulling in a routing library for one route.
const participantMatch = window.location.pathname.match(/^\/p\/([A-Za-z0-9_-]+)/);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {participantMatch ? <ParticipantView code={participantMatch[1]} /> : <App />}
  </StrictMode>,
);
