// @ts-nocheck
/* AUTO-GENERATED from planzo/engine/calendar.js — edit the source, then run scripts-port.mjs */
/**
 * Calendar export (spec §27). Generates real RFC 5545 .ics so a plan lands
 * in Apple Calendar, Google Calendar or Outlook with one tap.
 */

const pad = n => String(n).padStart(2, '0');

function stamp(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T`
    + `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** RFC 5545 requires escaping and 75-octet line folding. */
const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;')
  .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/**
 * RFC 5545 folds at 75 OCTETS, not characters. An em dash is three bytes, so
 * counting characters overruns the limit on any line with real punctuation in
 * it — and a multi-byte character must never be split across the fold.
 */
// TextEncoder, not Buffer: this module runs in the browser too, inlined into
// the standalone build.
const OCTETS = new TextEncoder();
const byteLen = s => OCTETS.encode(s).length;

function fold(line) {
  if (byteLen(line) <= 75) return line;
  const out = [];
  let cur = '', limit = 75;
  for (const ch of line) {                       // iterate code points, not units
    if (byteLen(cur + ch) > limit) {
      out.push(cur);
      cur = ' ' + ch;                            // continuation lines start with a space
      limit = 75;
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out.join('\r\n');
}

/** Parse "6:00 PM" against a base date into a real Date. */
function timeOn(baseDate, label) {
  const m = String(label || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  const d = new Date(baseDate);
  if (!m) return d;
  let h = parseInt(m[1], 10) % 12;
  if (/PM/i.test(m[3])) h += 12;
  d.setHours(h, parseInt(m[2], 10), 0, 0);
  return d;
}

/**
 * One VEVENT per plan stop, so the day appears as a real schedule rather
 * than a single opaque block.
 */
function planToIcs(plan, finalPlan) {
  const base = finalPlan?.date || plan.date || new Date().toISOString().slice(0, 10);
  const baseDate = new Date(base + 'T12:00:00');
  const now = stamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planzo//Planning//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(finalPlan?.title || plan.title || 'Planzo plan')}`,
  ];

  const stops = (finalPlan?.itinerary || []).filter(i => i.kind !== 'travel');
  stops.forEach((stop, idx) => {
    const start = timeOn(baseDate, stop.time);
    const next = stops[idx + 1];
    const end = next ? timeOn(baseDate, next.time)
                     : new Date(start.getTime() + (stop.durationMinutes || 90) * 60000);
    const place = stop.place;
    const desc = [
      stop.unresolved ? stop.unresolvedMessage : null,
      place?.rating ? `Rating ${place.rating}` : null,
      finalPlan?.cost ? `Estimated ~$${finalPlan.cost.perPerson}/person for the day` : null,
      'Planned with Planzo. All costs are estimates.',
    ].filter(Boolean).join('\n');

    lines.push('BEGIN:VEVENT',
      `UID:${plan.id}-${idx}@planzo`,
      `DTSTAMP:${now}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
      fold(`SUMMARY:${esc(place?.name ? `${stop.title} — ${place.name}` : stop.title)}`),
      place?.address ? fold(`LOCATION:${esc(place.address)}`) : null,
      fold(`DESCRIPTION:${esc(desc)}`),
      'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY',
      fold(`DESCRIPTION:${esc(stop.title)} in 30 minutes`), 'END:VALARM',
      'END:VEVENT');
  });

  return lines.filter(Boolean).join('\r\n') + '\r\n' + 'END:VCALENDAR';
}

function eventToIcs(event) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + 3 * 3600e3);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planzo//Events//EN',
    'BEGIN:VEVENT', `UID:${event.id}@planzo`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    fold(`SUMMARY:${esc(event.title)}`),
    event.address ? fold(`LOCATION:${esc(event.address)}`) : null,
    fold(`DESCRIPTION:${esc(event.description)}`),
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY',
    fold(`DESCRIPTION:${esc(event.title)} starts in an hour`), 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

/** Reminders the app surfaces itself (spec §28). */
function remindersFor(plan, finalPlan) {
  const out = [];
  const base = finalPlan?.date || plan.date;
  if (!base || !finalPlan?.itinerary?.length) return out;
  const first = finalPlan.itinerary[0];
  const leave = timeOn(new Date(base + 'T12:00:00'), first.time);

  out.push({ id: `${plan.id}:leave`, at: new Date(leave.getTime() - 25 * 60000).toISOString(),
             text: 'Leave in 25 minutes', kind: 'departure' });

  const dinner = finalPlan.itinerary.find(i => i.kind === 'food' && i.place);
  if (dinner) {
    out.push({ id: `${plan.id}:food`, at: timeOn(new Date(base + 'T12:00:00'), dinner.time).toISOString(),
               text: `${dinner.place.name} at ${dinner.time}`, kind: 'reservation' });
  }
  const waiting = (plan.participants || []).filter(p => !p.answers?.availability).map(p => p.name);
  if (waiting.length) {
    out.push({ id: `${plan.id}:nudge`, at: new Date().toISOString(),
               text: `${waiting.join(', ')} ${waiting.length === 1 ? "hasn't" : "haven't"} responded yet`,
               kind: 'nudge', people: waiting });
  }
  return out;
}

export { planToIcs, eventToIcs, remindersFor, timeOn, stamp };
export default { planToIcs, eventToIcs, remindersFor, timeOn, stamp };