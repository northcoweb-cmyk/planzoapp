/**
 * Application wiring.
 *
 * One place that constructs the repositories and services and hands them
 * their dependencies, so nothing has to reach for a global. Tests build a
 * context over an in-memory database and get the same object graph the
 * server runs on.
 */

import type { Database } from '../store/db.js';
import { db } from '../store/db.js';
import { CatalogRepository } from '../store/repositories/catalogRepo.js';
import { EventRepository } from '../store/repositories/eventRepo.js';
import { WalletRepository } from '../store/repositories/walletRepo.js';
import { BetRepository } from '../store/repositories/betRepo.js';
import { MediaRepository } from '../store/repositories/mediaRepo.js';
import { ProfileRepository } from '../store/repositories/profileRepo.js';
import { MetaRepository } from '../store/repositories/metaRepo.js';
import { provider as resolveProvider } from '../providers/index.js';
import type { SportsDataProvider } from '../providers/SportsDataProvider.js';
import { RefreshManager } from './refreshManager.js';
import { MediaService } from './mediaService.js';
import { SportsService } from './sportsService.js';
import { WalletService } from './walletService.js';
import { BetService } from './betService.js';
import { SettlementService } from './settlementService.js';
import { ActivityService } from './activityService.js';

export interface AppContext {
  database: Database;
  provider: SportsDataProvider;
  refresh: RefreshManager;
  repositories: {
    catalog: CatalogRepository;
    events: EventRepository;
    wallets: WalletRepository;
    bets: BetRepository;
    media: MediaRepository;
    profiles: ProfileRepository;
    meta: MetaRepository;
  };
  sports: SportsService;
  wallet: WalletService;
  betting: BetService;
  settlement: SettlementService;
  activity: ActivityService;
  media: MediaService;
}

export function createContext(database: Database, dataProvider?: SportsDataProvider): AppContext {
  const sportsProvider = dataProvider ?? resolveProvider(database);

  const catalog = new CatalogRepository(database);
  const events = new EventRepository(database);
  const wallets = new WalletRepository(database);
  const bets = new BetRepository(database);
  const media = new MediaRepository(database);
  const profiles = new ProfileRepository(database);
  const meta = new MetaRepository(database);

  const refresh = new RefreshManager(meta);
  const mediaService = new MediaService(media);
  const sports = new SportsService(sportsProvider, refresh, catalog, events, mediaService);
  const wallet = new WalletService(profiles, wallets, bets);
  const betting = new BetService(database, events, bets, wallets, wallet);
  const settlement = new SettlementService(database, events, bets, wallets, catalog, sportsProvider);
  const activity = new ActivityService(wallet, betting);

  return {
    database,
    provider: sportsProvider,
    refresh,
    repositories: { catalog, events, wallets, bets, media, profiles, meta },
    sports,
    wallet,
    betting,
    settlement,
    activity,
    media: mediaService,
  };
}

let shared: AppContext | null = null;

export function context(): AppContext {
  if (!shared) shared = createContext(db());
  return shared;
}

export function resetContext(): void {
  shared = null;
}
