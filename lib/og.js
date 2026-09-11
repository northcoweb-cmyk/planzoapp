'use strict';
/**
 * Injects real Open Graph / Twitter Card meta tags into the static app
 * shell for /p/<code> and /e/<id> links, so sharing one in iMessage,
 * Slack, etc. shows the actual plan/event title instead of Planzo's
 * generic tag — this is what makes a link "look super sweet" when someone
 * receives it, before they even open it.
 *
 * Deliberately Render-only for now (wired from server.js, not the Vercel
 * function) — this session hit two real Vercel routing regressions from
 * rewrites that looked safe and weren't, so this stays off Vercel's path
 * until it can be tested against a real deployment rather than guessed at.
 */
const escape = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function inject(html, { title, description, url }) {
  const tags = `
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${escape(url)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}">`;
  return html
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace('</head>', `${tags}\n</head>`);
}

function planMeta(plan, publicUrl) {
  return {
    title: `${plan.title} — Planzo`,
    description: `You're invited: "${plan.idea}". Join and answer a couple quick questions.`,
    url: `${publicUrl}/p/${plan.code || plan.id}`,
  };
}

function eventMeta(event, publicUrl) {
  return {
    title: `${event.title} — Planzo`,
    description: event.description || `Hosted on Planzo${event.venue ? ` at ${event.venue}` : ''}. RSVP and claim a free ticket.`,
    url: `${publicUrl}/e/${event.id}`,
  };
}

module.exports = { inject, planMeta, eventMeta };
