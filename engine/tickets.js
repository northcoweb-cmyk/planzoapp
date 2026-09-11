'use strict';
/**
 * Planzo-issued tickets. Only for events created inside Planzo — a
 * third-party Ticketmaster purchase never gets a Planzo ticket (spec §50).
 *
 * Security model:
 *   - The token is 32 random bytes. Only its HMAC hash is stored, so a
 *     database leak does not yield working tickets.
 *   - The animation on the ticket is presentation. The server is the only
 *     authority on validity.
 *   - Check-in is a single atomic claim. Two door staff scanning the same
 *     ticket at the same instant: exactly one gets ENTRY GRANTED, the other
 *     gets ALREADY USED. This is enforced by SET NX on a claim key, which
 *     Redis executes atomically — it is not a read-then-write race.
 */
const store = require('../lib/store');
const { token, hash } = require('../lib/ids');

const STATUS = {
  CREATED: 'CREATED', ACTIVE: 'ACTIVE', TRANSFERRED: 'TRANSFERRED',
  CANCELLED: 'CANCELLED', REFUNDED: 'REFUNDED', CHECKED_IN: 'CHECKED_IN', INVALIDATED: 'INVALIDATED',
};

const RESULT = {
  GRANTED: 'ENTRY_GRANTED', ALREADY_USED: 'ALREADY_USED', INVALID: 'INVALID_TICKET',
  WRONG_EVENT: 'INVALID_EVENT', CANCELLED: 'TICKET_CANCELLED', EXPIRED: 'TICKET_EXPIRED',
  FORBIDDEN: 'NOT_AUTHORIZED',
};

async function issue({ eventId, attendeeName, attendeeId, ticketType = 'General Admission' }) {
  const raw = token(32);
  const id = token(12);
  const ticket = {
    id, eventId, attendeeName, attendeeId: attendeeId || null, ticketType,
    tokenHash: hash(raw),
    status: STATUS.ACTIVE,
    issuedAt: new Date().toISOString(),
    checkedInAt: null, checkedInBy: null, invalidatedAt: null,
  };
  await store.set(`ticket:${id}`, ticket);
  await store.set(`ticket_by_hash:${ticket.tokenHash}`, id);
  await store.push(`event_tickets:${eventId}`, id, 5000);
  // The raw token is returned exactly once, to be embedded in the holder's
  // ticket. It is never recoverable from the database afterwards.
  return { ticket: redact(ticket), credential: `${id}.${raw}` };
}

function redact(t) {
  const { tokenHash, ...rest } = t;
  return rest;
}

/**
 * Validate and atomically check in.
 * @param credential  "<ticketId>.<rawToken>" from the scanned QR
 * @param eventId     the event the scanner is working
 * @param staff       {id, name} — already authorized by the caller
 */
async function checkIn(credential, eventId, staff) {
  if (typeof credential !== 'string' || !credential.includes('.')) {
    return { result: RESULT.INVALID };
  }
  const [id, raw] = credential.split('.');
  const ticket = await store.get(`ticket:${id}`);
  if (!ticket) return { result: RESULT.INVALID };

  // Constant-shape comparison against the stored HMAC.
  if (ticket.tokenHash !== hash(raw)) return { result: RESULT.INVALID };
  if (ticket.eventId !== eventId)     return { result: RESULT.WRONG_EVENT };

  if (ticket.status === STATUS.CANCELLED || ticket.status === STATUS.REFUNDED)
    return { result: RESULT.CANCELLED };
  if (ticket.status === STATUS.INVALIDATED || ticket.status === STATUS.TRANSFERRED)
    return { result: RESULT.INVALID };
  if (ticket.status === STATUS.CHECKED_IN)
    return { result: RESULT.ALREADY_USED, checkedInAt: ticket.checkedInAt, attendeeName: ticket.attendeeName };

  const event = await store.get(`event:${eventId}`);
  if (event?.endsAt && new Date(event.endsAt).getTime() < Date.now() - 6 * 3600e3)
    return { result: RESULT.EXPIRED };

  // ── THE ATOMIC CLAIM ────────────────────────────────────────────────
  // Whoever creates this key first owns the check-in. Everyone else loses,
  // and loses deterministically, even at the exact same millisecond.
  const at = new Date().toISOString();
  const won = await store.setIfAbsent(`ticket_claim:${id}`, { at, staff: staff?.id || null });
  if (!won) {
    const claim = await store.get(`ticket_claim:${id}`);
    return { result: RESULT.ALREADY_USED, checkedInAt: claim?.at || ticket.checkedInAt, attendeeName: ticket.attendeeName };
  }

  ticket.status = STATUS.CHECKED_IN;
  ticket.checkedInAt = at;
  ticket.checkedInBy = staff?.id || null;
  await store.set(`ticket:${id}`, ticket);
  await store.push(`check_ins:${eventId}`, {
    ticketId: id, at, staffId: staff?.id || null, staffName: staff?.name || null, attendeeName: ticket.attendeeName,
  }, 5000);

  return { result: RESULT.GRANTED, attendeeName: ticket.attendeeName, ticketType: ticket.ticketType, checkedInAt: at };
}

async function get(id) {
  const t = await store.get(`ticket:${id}`);
  return t ? redact(t) : null;
}

async function cancel(id) {
  const t = await store.get(`ticket:${id}`);
  if (!t) return null;
  if (t.status === STATUS.CHECKED_IN) return { error: 'already_checked_in' };
  t.status = STATUS.CANCELLED;
  t.invalidatedAt = new Date().toISOString();
  await store.set(`ticket:${id}`, t);
  return redact(t);
}

async function stats(eventId) {
  const ids = (await store.get(`event_tickets:${eventId}`)) || [];
  const checkIns = (await store.get(`check_ins:${eventId}`)) || [];
  let active = 0, checkedIn = 0, cancelled = 0;
  for (const id of ids) {
    const t = await store.get(`ticket:${id}`);
    if (!t) continue;
    if (t.status === STATUS.CHECKED_IN) checkedIn++;
    else if (t.status === STATUS.ACTIVE) active++;
    else cancelled++;
  }
  return { issued: ids.length, active, checkedIn, cancelled, remaining: active, recentCheckIns: checkIns.slice(-25).reverse() };
}

module.exports = { issue, checkIn, get, cancel, stats, STATUS, RESULT };
