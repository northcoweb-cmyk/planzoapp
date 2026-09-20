/**
 * A small HTTP router.
 *
 * KOVR has no runtime dependencies, so routing, body parsing and JSON
 * responses are handled here. Everything is deliberately explicit: there is
 * no middleware chain that could let a handler run without its guard.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { redactSecrets } from '../config/env.js';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  params: Record<string, string>;
  /** Parsed JSON body; `null` for GET or an empty body. */
  body: unknown;
}

export type Handler = (context: RequestContext) => Promise<unknown> | unknown;

interface Route {
  method: Method;
  segments: string[];
  handler: Handler;
}

/** Thrown by handlers to produce a specific status without a stack trace. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'ERROR',
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const MAX_BODY_BYTES = 64 * 1024;

export class Router {
  private readonly routes: Route[] = [];

  add(method: Method, pattern: string, handler: Handler): this {
    this.routes.push({ method, segments: pattern.split('/').filter(Boolean), handler });
    return this;
  }

  get(pattern: string, handler: Handler): this {
    return this.add('GET', pattern, handler);
  }

  post(pattern: string, handler: Handler): this {
    return this.add('POST', pattern, handler);
  }

  private match(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
    const parts = pathname.split('/').filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== parts.length) continue;

      const params: Record<string, string> = {};
      let matched = true;
      for (const [index, segment] of route.segments.entries()) {
        const value = parts[index] ?? '';
        if (segment.startsWith(':')) {
          params[segment.slice(1)] = decodeURIComponent(value);
        } else if (segment !== value) {
          matched = false;
          break;
        }
      }
      if (matched) return { route, params };
    }
    return null;
  }

  /** Returns true when a route handled the request. */
  async handle(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
    const found = this.match(request.method ?? 'GET', url.pathname);
    if (!found) return false;

    try {
      const body = await readJsonBody(request);
      const payload = await found.route.handler({ request, response, url, params: found.params, body });
      if (!response.writableEnded) {
        // A handler may set `response.statusCode` to answer with a body and a
        // non-200 status — the odds-change reply is a 409 that carries the
        // new prices, not an error. Anything it left alone answers 200.
        sendJson(response, response.statusCode || 200, payload ?? { ok: true });
      }
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
      } else {
        // Redact before anything reaches the client or the log.
        const message = redactSecrets(error instanceof Error ? error.message : String(error));
        process.stderr.write(`[kovr] unhandled error on ${url.pathname}: ${message}\n`);
        sendJson(response, 500, { error: 'Something went wrong handling that request.', code: 'INTERNAL' });
      }
    }
    return true;
  }
}

export function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  // A handler that set its own cache policy keeps it; everything else is
  // uncacheable by default, which is the safe way round.
  if (!response.getHeader('cache-control')) response.setHeader('cache-control', 'no-store');
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('content-length', Buffer.byteLength(body));
  response.writeHead(status);
  response.end(body);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return null;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.', 'BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  if (size === 0) return null;

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON.', 'INVALID_JSON');
  }
}

/* ─────────────────────────── input helpers ─────────────────────────── */

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'Expected a JSON object.', 'INVALID_BODY');
  }
  return body as Record<string, unknown>;
}

export function requireString(body: unknown, field: string): string {
  const value = asRecord(body)[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `"${field}" is required.`, 'INVALID_FIELD');
  }
  return value;
}

export function optionalString(body: unknown, field: string): string | null {
  const value = asRecord(body)[field];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function requireNumber(body: unknown, field: string): number {
  const value = asRecord(body)[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpError(400, `"${field}" must be a number.`, 'INVALID_FIELD');
  }
  return value;
}

export function optionalBoolean(body: unknown, field: string): boolean {
  return asRecord(body)[field] === true;
}

export function requireArray(body: unknown, field: string): unknown[] {
  const value = asRecord(body)[field];
  if (!Array.isArray(value)) throw new HttpError(400, `"${field}" must be an array.`, 'INVALID_FIELD');
  return value;
}

export function fieldOf(item: unknown, field: string): unknown {
  if (typeof item !== 'object' || item === null) {
    throw new HttpError(400, 'Expected an object.', 'INVALID_BODY');
  }
  return (item as Record<string, unknown>)[field];
}
