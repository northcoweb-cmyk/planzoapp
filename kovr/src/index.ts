/**
 * KOVR Sports — entry point.
 *
 * A sportsbook simulator. Real sports data, real odds, simulated money only.
 * No real funds are held, moved, or requested anywhere in this application.
 */

import { config, loadEnvFiles } from './config/env.js';
import { createContext } from './runtime/context.js';
import { createKovrServer } from './http/server.js';

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function main(): Promise<void> {
  loadEnvFiles();
  const settings = config();

  const context = createContext();
  const server = createKovrServer(context);
  server.listen(settings.port, settings.host, () => {
    log('');
    log('  KOVR SPORTS — sportsbook simulator');
    log(`  http://${settings.host}:${settings.port}`);
    log('');
    const keyHint =
      process.env['KOVR_IN_CONTAINER'] === '1'
        ? 'set KOVR_ODDS_API_KEY in this host\'s environment'
        : 'set KOVR_ODDS_API_KEY in kovr/.env.local';
    log(settings.oddsApiKey ? '  Sports data: connected' : `  Sports data: NOT configured — ${keyHint}`);
    log('');
  });

  const shutdown = (signal: string): void => {
    log(`\n[kovr] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
    // Do not hang on a keep-alive connection that never closes.
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  process.stderr.write(`[kovr] failed to start: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
