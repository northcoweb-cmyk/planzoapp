/**
 * KOVR Sports — entry point.
 *
 * A sportsbook simulator. Real sports data, real odds, simulated money only.
 * No real funds are held, moved, or requested anywhere in this application.
 */

import { config, loadEnvFiles } from './config/env.js';
import { db } from './store/db.js';
import { createContext } from './services/context.js';
import { createKovrServer } from './http/server.js';
import { RefreshScheduler } from './services/scheduler.js';

// node:sqlite is still flagged experimental; the warning is expected and
// says nothing useful to an operator, so it is filtered rather than shown.
const emitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning, ...rest: unknown[]): void => {
  const text = typeof warning === 'string' ? warning : warning.message;
  if (text.includes('SQLite is an experimental feature')) return;
  (emitWarning as (...args: unknown[]) => void)(warning, ...rest);
};

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function main(): Promise<void> {
  loadEnvFiles();
  const settings = config();

  const context = createContext(db());
  context.wallet.ensureDemoAccount();

  const scheduler = new RefreshScheduler(context, {
    onError: (message) => process.stderr.write(`[kovr] refresh: ${message}\n`),
  });

  const server = createKovrServer(context);
  server.listen(settings.port, settings.host, () => {
    log('');
    log('  KOVR SPORTS — sportsbook simulator');
    log(`  http://${settings.host}:${settings.port}`);
    log('');
    log(
      settings.oddsApiKey
        ? '  Sports data provider: configured'
        : '  Sports data provider: NOT configured — set KOVR_ODDS_API_KEY in kovr/.env.local',
    );
    log(`  Developer tools:      ${settings.adminEnabled ? 'enabled at /admin' : 'disabled'}`);
    log('  Money:                simulated. No real funds are involved.');
    log('');
    scheduler.start();
  });

  const shutdown = (signal: string): void => {
    log(`\n[kovr] ${signal} received, shutting down`);
    scheduler.stop();
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
