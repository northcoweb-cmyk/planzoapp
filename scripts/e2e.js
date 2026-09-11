'use strict';
/**
 * End-to-end walk of the real growth loop, against a running server:
 * create a plan → share the link → 6 friends join and answer → status →
 * generate the final plan. No mocks; this is the actual HTTP surface.
 */
require('../lib/env');
const BASE = process.env.E2E_BASE || 'http://localhost:4111';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const assert = require('assert');

const call = async (path, { method = 'GET', body, session } = {}) => {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type':'application/json', ...(session ? { 'X-Planzo-Session': session } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

(async () => {
console.log('\nE2E — the full loop\n');

let creator, code, friends = [];

await t('a visitor joins the waitlist', async () => {
  const r = await call('/waitlist', { method:'POST',
    body: { name:'Ryan Stillwell', email:`ryan+${Date.now()}@umd.edu`, college:'UMD' } });
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.position > 0);
});

await t('a duplicate email does not create a second row', async () => {
  const email = `dupe+${Date.now()}@umd.edu`;
  const a = await call('/waitlist', { method:'POST', body: { name:'A', email } });
  const b = await call('/waitlist', { method:'POST', body: { name:'A', email } });
  assert.strictEqual(b.body.alreadyOnList, true);
  assert.strictEqual(a.body.position, b.body.position);
});

await t('a bad email is rejected', async () => {
  const r = await call('/waitlist', { method:'POST', body: { name:'X', email:'not-an-email' } });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.body.error, 'invalid_email');
});

await t('the creator gets a session', async () => {
  const r = await call('/session', { method:'POST', body: { name:'Ryan' } });
  assert.strictEqual(r.status, 200);
  creator = r.body.session;
});

await t('creating a plan returns a shareable link', async () => {
  const r = await call('/plans', { method:'POST', session: creator,
    body: { idea:'7 of us want dinner saturday, nothing crazy expensive',
            origin: { lat: 38.9869, lon: -76.9426, label:'UMD' } } });
  assert.strictEqual(r.status, 200);
  code = r.body.plan.code;
  assert.ok(/^[a-z2-9]{8}$/.test(code), 'plan code should be an opaque short code');
  assert.ok(r.body.shareUrl.endsWith('/p/' + code));
});

await t('the intent parser read "7 of us" off the idea', async () => {
  const r = await call('/plans/' + code);
  assert.strictEqual(r.body.plan.intent.groupSize, 7);
  assert.strictEqual(r.body.plan.intent.needsFood, true);
});

await t('creating a plan without a session is refused', async () => {
  const r = await call('/plans', { method:'POST', body: { idea:'hi' } });
  assert.strictEqual(r.status, 401);
});

await t('6 friends join from the link with just a name', async () => {
  const names = ['Jake','Mike','Sarah','Alex','Chris','Josh'];
  for (const n of names){
    const s = await call('/session', { method:'POST', body: { name: n } });
    const j = await call(`/plans/${code}/join`, { method:'POST', session: s.body.session, body:{} });
    assert.strictEqual(j.status, 200);
    friends.push({ name: n, session: s.body.session });
  }
  const p = await call('/plans/' + code);
  assert.strictEqual(p.body.plan.participants.length, 7);
});

await t('everyone is asked availability first', async () => {
  const q = await call(`/plans/${code}/question`, { session: friends[0].session });
  assert.strictEqual(q.body.question.id, 'availability');
});

await t('all 7 answer through an adaptive sequence', async () => {
  const all = [{ name:'Ryan', session: creator }, ...friends];
  // Five want pizza, two want burgers — the spec's worked example.
  const foodPick = ['Pizza','Pizza','Pizza','Pizza','Pizza','Burgers','Burgers'];
  for (let i = 0; i < all.length; i++){
    const who = all[i];
    for (let step = 0; step < 9; step++){
      const q = await call(`/plans/${code}/question`, { session: who.session });
      if (q.body.done) break;
      const opts = q.body.question.options;
      let choice = opts[0];
      if (q.body.question.id === 'food')    choice = foodPick[i];
      if (q.body.question.id === 'budget')  choice = i === 3 ? 'Under $25' : 'Under $50';
      if (q.body.question.id === 'dietary') choice = i === 5 ? ['Vegetarian'] : ['No restrictions'];
      const a = await call(`/plans/${code}/answer`, { method:'POST', session: who.session,
        body: { questionId: q.body.question.id, value: choice } });
      assert.strictEqual(a.status, 200, `answer rejected: ${JSON.stringify(a.body)}`);
    }
  }
});

await t('the group status shows 7/7 and the pizza lean', async () => {
  const r = await call(`/plans/${code}/status`);
  assert.strictEqual(r.body.total, 7);
  assert.strictEqual(r.body.confirmed, 7);
  assert.strictEqual(r.body.leaning.food, 'Pizza');
  assert.strictEqual(r.body.readyToPlan, true);
});

await t("the tightest budget ($25) governs, not the average", async () => {
  const r = await call(`/plans/${code}/generate`, { method:'POST', session: creator });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.finalPlan.constraints.budgetCeiling, 25);
});

await t("the one vegetarian's constraint survives into the final plan", async () => {
  const r = await call('/plans/' + code);
  assert.ok(r.body.plan.finalPlan.constraints.dietary.includes('Vegetarian'));
  assert.ok(r.body.plan.finalPlan.caveats.some(c => /Vegetarian/.test(c)));
});

await t('every cost on the plan is labelled an estimate', async () => {
  const r = await call('/plans/' + code);
  assert.strictEqual(r.body.plan.finalPlan.cost.isEstimate, true);
  assert.ok(/estimate/i.test(r.body.plan.finalPlan.cost.note));
});

await t('a friend cannot generate the plan — only the creator', async () => {
  const r = await call(`/plans/${code}/generate`, { method:'POST', session: friends[0].session });
  assert.strictEqual(r.status, 403);
});

await t('a stranger cannot answer on the plan', async () => {
  const s = await call('/session', { method:'POST', body: { name:'Randomer' } });
  const r = await call(`/plans/${code}/answer`, { method:'POST', session: s.body.session,
    body: { questionId:'budget', value:'Flexible' } });
  assert.strictEqual(r.status, 403);
});

await t('the public plan payload leaks no participant ids or sessions', async () => {
  const raw = JSON.stringify((await call('/plans/' + code)).body);
  assert.ok(!raw.includes('creatorId'));
  assert.ok(!raw.includes('"id"') || !/"id":"p/.test(raw));
  assert.ok(!raw.includes(creator.slice(0, 20)));
});

await t('weather comes back from a real provider', async () => {
  const r = await call('/weather?lat=38.9869&lon=-76.9426');
  assert.strictEqual(r.body.available, true, 'expected live Open-Meteo data');
  assert.ok(typeof r.body.highF === 'number');
});

await t('venue search reports unavailable rather than inventing places', async () => {
  const r = await call('/discover?q=pizza&lat=38.98&lon=-76.94');
  assert.strictEqual(r.body.available, false);
  assert.strictEqual(r.body.reason, 'places_not_configured');
  assert.strictEqual(r.body.places, undefined);
});

await t('events report unavailable, with no fabricated concerts', async () => {
  const r = await call('/events/external');
  assert.strictEqual(r.body.available, false);
});

await t('the admin cost report is locked without the key', async () => {
  assert.strictEqual((await call('/admin/cost')).status, 403);
});

await t('waitlist submissions are rate limited', async () => {
  let limited = false;
  for (let i = 0; i < 9; i++){
    const r = await call('/waitlist', { method:'POST', body: { name:'S', email:`spam${i}.${Date.now()}@x.com` } });
    if (r.status === 429) { limited = true; break; }
  }
  assert.ok(limited, 'expected a 429 within 9 rapid signups');
});

await t('a missing plan 404s cleanly', async () => {
  assert.strictEqual((await call('/plans/zzzzzzzz')).status, 404);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
})();
