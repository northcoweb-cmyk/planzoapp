import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ParticipantView from './screens/ParticipantView';
import EventView from './screens/EventView';

// The app itself has no router (everything else is tab state, one path).
// /p/<code> and /e/<id> are the two real exceptions — shareable links
// someone else opens cold, with no local state at all — so they're
// handled directly here rather than pulling in a routing library for
// two routes.
const participantMatch = window.location.pathname.match(/^\/p\/([A-Za-z0-9_-]+)/);
const eventMatch = window.location.pathname.match(/^\/e\/([A-Za-z0-9_-]+)/);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {participantMatch ? <ParticipantView code={participantMatch[1]} />
      : eventMatch ? <EventView id={eventMatch[1]} />
      : <App />}
  </StrictMode>,
);
