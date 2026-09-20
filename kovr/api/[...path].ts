/**
 * Vercel serverless entry.
 *
 * Every /api/* request lands here. The same router the standalone server
 * uses handles it, so there is one implementation of the API regardless of
 * where KOVR is deployed.
 *
 * The provider key is read from the host's environment inside this function
 * and never reaches the browser.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { context } from '../dist/src/runtime/context.js';
import { sportsRoutes } from '../dist/src/http/routes/sports.js';
import { sendJson } from '../dist/src/http/router.js';

// Built once per serverless instance and reused across warm invocations,
// so the in-process cache actually earns its keep.
const router = sportsRoutes(context());

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', `https://${request.headers.host ?? 'localhost'}`);

  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'same-origin');

  if (request.method !== 'GET' && request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  if (await router.handle(request, response, url)) return;
  sendJson(response, 404, { error: 'No such endpoint.', code: 'NOT_FOUND' });
}
