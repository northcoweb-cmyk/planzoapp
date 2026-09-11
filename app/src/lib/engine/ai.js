// @ts-nocheck
/**
 * AI gateway for the browser.
 *
 * Normal build: proxied through the Planzo server, which holds the OpenAI
 * key in its own env and meters spend — nothing billable touches the
 * client. Single-file download build: no server to call, so it falls back
 * to a key the user pastes into Settings. Everything the app does still
 * works without AI; the deterministic engine covers planning, and chat
 * falls back to a scripted reply that says AI is off.
 */
import { config, spendGuard, hasServer } from '../config';

export const CHEAP = 'gpt-4.1-nano';
export const SMART = 'gpt-4o-mini';
export const enabled = () => hasServer || Boolean(config.get().openai);

async function askViaServer({ system, prompt, tier, maxTokens }) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(`${config.get().serverUrl}/api/ai/chat`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, prompt, tier, maxTokens }),
    });
    const body = await res.json();
    if (!res.ok || !body.ok) return { ok: false, reason: body?.reason || 'provider_error' };
    return { ok: true, data: body.data };
  } catch (e) {
    return { ok: false, reason: 'provider_unreachable', detail: e.message };
  } finally { clearTimeout(timer); }
}

export async function ask({ system, prompt, tier = 'cheap', maxTokens = 500 }) {
  if (!enabled()) return { ok: false, reason: 'ai_disabled' };

  if (hasServer) return askViaServer({ system, prompt, tier, maxTokens });

  if (!spendGuard('openai')) return { ok: false, reason: 'daily_cap_reached' };
  const model = tier === 'smart' ? SMART : CHEAP;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.get().openai}` },
      body: JSON.stringify({
        model, max_tokens: maxTokens,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
      }),
    });
    const body = await res.json();
    if (!res.ok) return { ok: false, reason: 'provider_error', detail: body?.error?.message };
    const text = (body.choices?.[0]?.message?.content || '').trim();
    return text ? { ok: true, data: text, model } : { ok: false, reason: 'empty_response' };
  } catch (e) {
    return { ok: false, reason: 'provider_unreachable', detail: e.message };
  } finally { clearTimeout(timer); }
}

export async function askJson(opts) {
  const r = await ask({ ...opts, system: (opts.system || '') + '\nReply with one JSON object and nothing else.' });
  if (!r.ok) return r;
  const raw = String(r.data).replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return { ...r, data: JSON.parse(raw) }; }
  catch { return { ok: false, reason: 'invalid_json' }; }
}
export default { ask, askJson, enabled, CHEAP, SMART };
