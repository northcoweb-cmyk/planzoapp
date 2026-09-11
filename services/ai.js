'use strict';
/**
 * AI gateway. The ONLY place Planzo talks to a language model.
 *
 * Rules enforced here, not left to callers:
 *   - every call is metered by lib/cost before and after
 *   - cheap model by default; the smart model must be asked for explicitly
 *   - hard token ceilings on input and output
 *   - a ceiling hit or a missing key returns {ok:false}, never a guess
 *   - JSON responses are parsed and validated; a malformed reply is a failure,
 *     not something to paper over
 *
 * The model is used for language, never for facts. Nothing here is allowed
 * to originate an address, a price, a time or an availability.
 */
const cost = require('../lib/cost');
const cache = require('../lib/cache');
const { hash } = require('../lib/ids');

/**
 * Provider is selected by which key is present. OpenAI is the default because
 * gpt-4.1-nano does intent extraction as well as anything larger at a third
 * the price — measured, not assumed.
 */
const OPENAI_KEY    = process.env.OPENAI_API_KEY || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const PROVIDER = process.env.PLANZO_AI_PROVIDER
  || (OPENAI_KEY ? 'openai' : ANTHROPIC_KEY ? 'anthropic' : 'none');

const KEY   = PROVIDER === 'openai' ? OPENAI_KEY : ANTHROPIC_KEY;
const CHEAP = process.env.PLANZO_AI_MODEL_CHEAP
  || (PROVIDER === 'openai' ? 'gpt-4.1-nano' : 'claude-haiku-4-5-20251001');
const SMART = process.env.PLANZO_AI_MODEL_SMART
  || (PROVIDER === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-5');

const MAX_INPUT_CHARS = 12000;   // ~3k tokens. Structured context only.
const MAX_OUTPUT_TOKENS = 900;

const enabled = () => Boolean(KEY);

/**
 * @returns {{ok:true, data:any, usd:number, cached:boolean}
 *          |{ok:false, reason:string, detail?:string}}
 */
async function ask({ system, prompt, tier = 'cheap', planId, maxTokens = MAX_OUTPUT_TOKENS, cacheTtl = 0 }) {
  if (!enabled()) return { ok: false, reason: 'ai_disabled' };
  if (typeof prompt !== 'string' || !prompt.trim()) return { ok: false, reason: 'empty_prompt' };
  if (prompt.length > MAX_INPUT_CHARS) prompt = prompt.slice(0, MAX_INPUT_CHARS);

  const model = tier === 'smart' ? SMART : CHEAP;

  if (cacheTtl > 0) {
    const key = `ai:${hash(model + '|' + (system || '') + '|' + prompt).slice(0, 32)}`;
    const hit = await require('../lib/store').get(`cache:${key}`);
    if (hit && hit.v !== undefined) return { ok: true, data: hit.v, usd: 0, cached: true };
  }

  // Pre-flight estimate: assume the full output allowance is used, so we can
  // never approve a call whose worst case would breach a ceiling.
  const estIn  = Math.ceil((system || '').length / 4 + prompt.length / 4);
  const estimate = cost.estimateAiCost(model, estIn, maxTokens);

  const permit = await cost.reserve('ai', estimate, { planId });
  if (!permit.ok) {
    console.warn(`[ai] blocked: ${permit.reason} (spent ${permit.spent} of ${permit.ceiling})`);
    return { ok: false, reason: permit.reason, detail: `spent $${permit.spent} of $${permit.ceiling}` };
  }

  const spec = PROVIDER === 'openai'
    ? {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
        body: {
          model, max_tokens: maxTokens,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt },
          ],
        },
      }
    : {
        url: 'https://api.anthropic.com/v1/messages',
        headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
        body: { model, max_tokens: maxTokens, system: system || undefined,
                messages: [{ role: 'user', content: prompt }] },
      };

  let res, body;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    res = await fetch(spec.url, {
      method: 'POST', signal: controller.signal,
      headers: spec.headers, body: JSON.stringify(spec.body),
    });
    body = await res.json();
  } catch (e) {
    await cost.record('ai', estimate * 0.1, { planId, detail: 'network_error' });
    return { ok: false, reason: 'provider_unreachable', detail: e.message };
  } finally { clearTimeout(timer); }

  if (!res.ok) {
    await cost.record('ai', 0, { planId, detail: `http_${res.status}` });
    return { ok: false, reason: 'provider_error',
             detail: body?.error?.type || body?.error?.message || String(res.status) };
  }

  // Both providers report real usage; bill on that, not on the estimate.
  const usage = body.usage || {};
  const inTok  = usage.prompt_tokens ?? usage.input_tokens ?? estIn;
  const outTok = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const actual = cost.estimateAiCost(model, inTok, outTok);
  await cost.record('ai', actual, { planId, detail: model });

  const text = PROVIDER === 'openai'
    ? (body.choices?.[0]?.message?.content || '').trim()
    : (body.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
  if (!text) return { ok: false, reason: 'empty_response' };

  return { ok: true, data: text, usd: actual, cached: false, model, provider: PROVIDER };
}

/** Same as ask(), but the reply must parse as JSON or the call fails. */
async function askJson(opts) {
  const r = await ask({
    ...opts,
    system: (opts.system || '') + '\n\nReply with a single JSON object and nothing else. No prose, no code fences.',
  });
  if (!r.ok) return r;
  const raw = String(r.data).replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return { ...r, data: JSON.parse(raw) };
  } catch {
    return { ok: false, reason: 'invalid_json', detail: raw.slice(0, 200) };
  }
}

module.exports = { ask, askJson, enabled, CHEAP, SMART, PROVIDER, cache };
