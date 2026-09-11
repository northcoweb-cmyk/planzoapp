// @ts-nocheck
/* AUTO-GENERATED from planzo/engine/hosting.js — edit the source, then run scripts-port.mjs */
/**
 * Planzo-created events, organizations and role-based permissions
 * (spec §21–25, §35–39).
 *
 * The permission model is the important part and it is enforced here, not
 * in the UI. Every check goes through can(), so a frontend that forgets to
 * hide a button still cannot perform the action.
 */

const ROLES = ['owner', 'admin', 'event_manager', 'moderator', 'check_in', 'member'];

/** What each role may do. Deliberately explicit rather than hierarchical. */
const GRANTS = {
  owner:        ['event.delete','event.edit','event.publish','payment.edit','ownership.transfer',
                 'staff.manage','ticket.issue','ticket.cancel','ticket.checkin','attendees.view','org.edit'],
  admin:        ['event.edit','event.publish','staff.manage','ticket.issue','ticket.cancel',
                 'ticket.checkin','attendees.view'],
  event_manager:['event.edit','ticket.issue','ticket.checkin','attendees.view'],
  moderator:    ['event.edit','attendees.view'],
  // Door staff can admit people and see who has arrived. Nothing else —
  // not deleting the event, not payment settings, not the org (spec §25).
  check_in:     ['ticket.checkin','attendees.view'],
  member:       [],
};

function roleOf(event, org, userId) {
  if (!userId) return null;
  if (event && event.ownerId === userId) return 'owner';
  const staff = (event?.staff || []).find(s => s.id === userId);
  if (staff) return staff.role;
  const member = (org?.members || []).find(m => m.id === userId);
  return member ? member.role : null;
}

/** The single authorization gate. */
function can(action, { event, org, userId }) {
  const role = roleOf(event, org, userId);
  if (!role) return false;
  return (GRANTS[role] || []).includes(action);
}

function createEvent({ id, ownerId, ownerName, orgId, title, description, startsAt, endsAt,
                       venue, address, capacity, visibility, heroUrl, ticketTypes }) {
  if (!title) throw new Error('title_required');
  if (!startsAt) throw new Error('start_required');
  return {
    id, orgId: orgId || null, ownerId, ownerName,
    title, description: description || '',
    startsAt, endsAt: endsAt || null,
    venue: venue || null, address: address || null,
    capacity: Number.isInteger(capacity) && capacity > 0 ? capacity : null,
    visibility: ['private', 'link', 'public'].includes(visibility) ? visibility : 'link',
    heroUrl: heroUrl || null,
    ticketTypes: (ticketTypes && ticketTypes.length ? ticketTypes : [{ name: 'General Admission', price: 0 }])
      .slice(0, 6)
      .map((t, i) => ({ id: `tt${i}`, name: String(t.name || 'General Admission').slice(0, 40),
                        price: Math.max(0, Number(t.price) || 0), quantity: t.quantity || null })),
    staff: [], rsvps: [], updates: [],
    createdAt: new Date().toISOString(),
  };
}

function addStaff(event, { id, name, role }) {
  if (!ROLES.includes(role) || role === 'owner') throw new Error('invalid_role');
  const existing = event.staff.find(s => s.id === id);
  if (existing) { existing.role = role; return event; }
  event.staff.push({ id, name, role, addedAt: new Date().toISOString() });
  return event;
}

function rsvp(event, { id, name, status }) {
  const valid = ['going', 'maybe', 'not_going'];
  if (!valid.includes(status)) throw new Error('invalid_status');
  if (status === 'going' && event.capacity) {
    const going = event.rsvps.filter(r => r.status === 'going' && r.id !== id).length;
    if (going >= event.capacity) return { ok: false, reason: 'at_capacity' };
  }
  const existing = event.rsvps.find(r => r.id === id);
  if (existing) { existing.status = status; existing.at = new Date().toISOString(); }
  else event.rsvps.push({ id, name, status, at: new Date().toISOString() });
  return { ok: true, event };
}

function counts(event) {
  const by = s => (event.rsvps || []).filter(r => r.status === s).length;
  return {
    going: by('going'), maybe: by('maybe'), notGoing: by('not_going'),
    capacity: event.capacity,
    spotsLeft: event.capacity ? Math.max(0, event.capacity - by('going')) : null,
  };
}

/** What a non-staff viewer is allowed to see. No attendee list by default. */
function publicView(event, { userId } = {}) {
  const isStaff = can('attendees.view', { event, userId });
  return {
    id: event.id, title: event.title, description: event.description,
    startsAt: event.startsAt, endsAt: event.endsAt,
    venue: event.venue, address: event.address, heroUrl: event.heroUrl,
    visibility: event.visibility, ownerName: event.ownerName,
    ticketTypes: event.ticketTypes, capacity: event.capacity,
    counts: counts(event),
    updates: event.updates,
    myRsvp: userId ? (event.rsvps.find(r => r.id === userId)?.status || null) : null,
    attendees: isStaff ? event.rsvps : undefined,
    staff: isStaff ? event.staff : undefined,
    myRole: roleOf(event, null, userId),
  };
}

function createOrg({ id, ownerId, ownerName, name, description, logoUrl }) {
  if (!name) throw new Error('name_required');
  return {
    id, name, description: description || '', logoUrl: logoUrl || null,
    verified: false,
    members: [{ id: ownerId, name: ownerName, role: 'owner', joinedAt: new Date().toISOString() }],
    eventIds: [], createdAt: new Date().toISOString(),
  };
}

export { createEvent, addStaff, rsvp, counts, publicView, createOrg, can, roleOf, ROLES, GRANTS };
export default { createEvent, addStaff, rsvp, counts, publicView, createOrg, can, roleOf, ROLES, GRANTS };