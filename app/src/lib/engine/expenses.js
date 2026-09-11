// @ts-nocheck
/* AUTO-GENERATED from planzo/engine/expenses.js — edit the source, then run scripts-port.mjs */
/**
 * Expense splitting and settle-up (spec §26).
 *
 * Planzo calculates and instructs. It never claims a payment happened —
 * only a payment provider can say that, and none is connected.
 */

/** Split a bill, distributing the rounding remainder rather than losing it. */
function split(amountCents, people) {
  const n = Math.max(1, people.length);
  const base = Math.floor(amountCents / n);
  let remainder = amountCents - base * n;
  return people.map(p => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { id: p.id, name: p.name, cents: base + extra };
  });
}

function addExpense(ledger, { id, label, amountCents, paidBy, participants, at }) {
  if (!(amountCents > 0)) throw new Error('amount_required');
  if (!participants?.length) throw new Error('participants_required');
  const shares = split(Math.round(amountCents), participants);
  return [...(ledger || []), {
    id, label: label || 'Expense', amountCents: Math.round(amountCents),
    paidBy, shares, at: at || new Date().toISOString(),
  }];
}

/** Net position per person: positive = owed to them, negative = they owe. */
function balances(ledger, people) {
  const net = new Map(people.map(p => [p.id, 0]));
  for (const e of ledger || []) {
    if (net.has(e.paidBy)) net.set(e.paidBy, net.get(e.paidBy) + e.amountCents);
    for (const s of e.shares) if (net.has(s.id)) net.set(s.id, net.get(s.id) - s.cents);
  }
  return people.map(p => ({ id: p.id, name: p.name, cents: net.get(p.id) || 0 }));
}

/**
 * Minimal set of transfers that settles everyone.
 * Greedy largest-creditor / largest-debtor — for group sizes Planzo sees this
 * gives the minimum or one above it, and is instantly explainable.
 */
function settleUp(ledger, people) {
  const owed = balances(ledger, people).filter(b => b.cents !== 0);
  const creditors = owed.filter(b => b.cents > 0).sort((a, b) => b.cents - a.cents);
  const debtors = owed.filter(b => b.cents < 0).sort((a, b) => a.cents - b.cents);
  const transfers = [];
  let ci = 0, di = 0;
  const c = creditors.map(x => ({ ...x })), d = debtors.map(x => ({ ...x }));
  while (ci < c.length && di < d.length) {
    const amount = Math.min(c[ci].cents, -d[di].cents);
    if (amount > 0) {
      transfers.push({ from: d[di].name, fromId: d[di].id, to: c[ci].name, toId: c[ci].id, cents: amount });
      c[ci].cents -= amount;
      d[di].cents += amount;
    }
    if (c[ci].cents === 0) ci++;
    if (d[di].cents === 0) di++;
  }
  return transfers;
}

const usd = cents => `$${(cents / 100).toFixed(2)}`;

/** Seed a ledger from a generated plan's estimated costs. */
function fromPlan(finalPlan, people) {
  if (!finalPlan?.cost?.lines?.length) return [];
  let ledger = [];
  for (const line of finalPlan.cost.lines) {
    ledger = addExpense(ledger, {
      id: 'est_' + line.label.toLowerCase().replace(/\W+/g, '_'),
      label: line.label + ' (estimated)',
      amountCents: Math.round(line.perPerson * 100 * people.length),
      paidBy: null, participants: people,
    });
  }
  return ledger;
}

export { split, addExpense, balances, settleUp, usd, fromPlan };
export default { split, addExpense, balances, settleUp, usd, fromPlan };