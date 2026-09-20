/**
 * KOVR Sports — client entry point.
 *
 * Renders the shell once, then swaps views into it. One delegated click
 * listener per surface, so a re-render never leaks handlers.
 */

import { h, raw, render, qs } from './dom.js';
import type { RawHtml } from './dom.js';
import { brandMark, icon } from './icons.js';
import { money } from './format.js';
import { api, ApiError } from './api.js';
import { store, toast, onToasts } from './store.js';
import type { Toast } from './store.js';
import { betslipMarkup, placeBet, clearPendingChanges } from './betslip.js';
import { renderHome, homeSkeleton } from './views/home.js';
import { renderSports, renderLeague, sportsSkeleton, toggleShowAll } from './views/sports.js';
import { renderEvent, eventSkeleton } from './views/event.js';
import { renderBets, betsSkeleton, setBetsTab } from './views/bets.js';
import { renderWallet, renderActivity, walletSkeleton } from './views/wallet.js';
import { renderProfile, profileSkeleton } from './views/profile.js';
import { renderAdmin } from './views/admin.js';
import { preferences, setPreference } from './preferences.js';
import { startSettlementWatch } from './settlementWatch.js';

/* ───────────────────────────── navigation ──────────────────────────── */

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/sports', label: 'Sports', icon: 'sports' },
  { path: '/betslip', label: 'Slip', icon: 'slip' },
  { path: '/bets', label: 'Bets', icon: 'bets' },
  { path: '/wallet', label: 'Wallet', icon: 'wallet' },
  { path: '/profile', label: 'You', icon: 'profile' },
];

function currentPath(): string {
  return window.location.pathname;
}

function isActive(path: string): boolean {
  const here = currentPath();
  if (path === '/') return here === '/';
  if (path === '/sports') return here === '/sports' || here.startsWith('/league/');
  return here.startsWith(path);
}

function navigate(path: string, replace = false): void {
  if (path === '/betslip') {
    store.openSlip();
    return;
  }
  if (currentPath() === path) {
    void route();
    return;
  }
  if (replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  void route();
}

/* ─────────────────────────────── shell ─────────────────────────────── */

function headerMarkup(): RawHtml {
  const wallet = store.get().wallet;
  return h`
    <header class="app-header">
      <button class="brand" type="button" data-nav="/">
        ${brandMark(26)} KOVR
      </button>
      <button class="balance-chip" type="button" data-nav="/wallet">
        <span class="balance-chip__label">Demo balance</span>
        <span class="balance-chip__value num">${wallet ? money(wallet.balanceCents) : '—'}</span>
      </button>
    </header>`;
}

function bottomNavMarkup(): RawHtml {
  const state = store.get();
  return h`
    <nav class="bottom-nav" aria-label="Primary">
      ${NAV.map((item) => {
        const badge =
          item.path === '/betslip' && state.slip.length > 0
            ? h`<span class="nav-item__badge">${state.slip.length}</span>`
            : item.path === '/bets' && state.openBetCount > 0
              ? h`<span class="nav-item__badge">${state.openBetCount}</span>`
              : raw('');
        return h`
          <button class="nav-item" type="button" data-nav="${item.path}"
            ${isActive(item.path) ? raw('aria-current="page"') : raw('')}>
            ${icon(item.icon, 21)}
            <span>${item.label}</span>
            ${badge}
          </button>`;
      })}
    </nav>`;
}

function sidebarMarkup(): RawHtml {
  const state = store.get();
  return h`
    <aside class="sidebar">
      <div class="sidebar__group">
        <p class="sidebar__heading">Menu</p>
        ${NAV.filter((item) => item.path !== '/betslip').map(
          (item) => h`
            <button class="sidebar__item" type="button" data-nav="${item.path}"
              ${isActive(item.path) ? raw('aria-current="page"') : raw('')}>
              ${icon(item.icon, 17)} <span>${item.label}</span>
              ${item.path === '/bets' && state.openBetCount > 0 ? h`<span class="pill">${state.openBetCount}</span>` : raw('')}
            </button>`,
        )}
        <button class="sidebar__item" type="button" data-nav="/activity"
          ${isActive('/activity') ? raw('aria-current="page"') : raw('')}>
          ${icon('activity', 17)} <span>Activity</span>
        </button>
        ${
          state.config?.adminEnabled
            ? h`<button class="sidebar__item" type="button" data-nav="/admin"
                 ${isActive('/admin') ? raw('aria-current="page"') : raw('')}>
                 ${icon('tools', 17)} <span>Developer</span>
               </button>`
            : raw('')
        }
      </div>
      <div class="sidebar__group">
        <p class="sidebar__heading">About</p>
        <p class="dim" style="font-size:11.5px;padding:0 10px;line-height:1.5">
          KOVR is a sportsbook simulator. Real sports data and real odds; every balance and payout is a
          demo value.
        </p>
      </div>
    </aside>`;
}

function shellMarkup(): RawHtml {
  return h`
    ${headerMarkup()}
    ${sidebarMarkup()}
    <main class="app-main" id="view"></main>
    <div class="slip-panel" id="slip-panel"></div>
    ${bottomNavMarkup()}
    <div class="toast-stack" id="toasts" aria-live="polite"></div>
    <div id="slip-sheet"></div>`;
}

/* ─────────────────────────────── routing ───────────────────────────── */

async function route(): Promise<void> {
  const view = qs('#view');
  if (!view) return;

  const path = currentPath();
  const show = (content: RawHtml): void => render(view, content);

  try {
    if (path === '/') {
      show(homeSkeleton());
      show(await renderHome());
    } else if (path === '/sports') {
      show(sportsSkeleton());
      show(await renderSports());
    } else if (path.startsWith('/league/')) {
      show(sportsSkeleton());
      show(await renderLeague(decodeURIComponent(path.slice('/league/'.length))));
    } else if (path.startsWith('/event/')) {
      show(eventSkeleton());
      show(await renderEvent(decodeURIComponent(path.slice('/event/'.length))));
    } else if (path === '/bets') {
      show(betsSkeleton());
      show(await renderBets());
    } else if (path === '/wallet') {
      show(walletSkeleton());
      show(await renderWallet());
    } else if (path === '/activity') {
      show(walletSkeleton());
      show(await renderActivity());
    } else if (path === '/profile') {
      show(profileSkeleton());
      show(await renderProfile());
    } else if (path === '/admin') {
      show(await renderAdmin());
    } else {
      show(h`<div class="view">
        <div class="empty">${icon('empty', 30)}
        <p class="empty__title">Page not found</p>
        <p class="empty__body">That address is not part of KOVR.</p>
        <button class="btn btn--sm" type="button" data-nav="/">Go home</button></div>
      </div>`);
    }
  } catch (error) {
    show(h`<div class="view">
      <div class="banner banner--error">${icon('alert', 16)}
        <div><p class="banner__title">Could not load this view</p>
        <p>${error instanceof ApiError ? error.message : 'Something went wrong.'}</p></div>
      </div>
      <button class="btn btn--sm" type="button" data-retry>Try again</button>
    </div>`);
  }

  refreshChrome();
  window.scrollTo({ top: 0 });
}

/** Re-render the parts of the shell that depend on state. */
function refreshChrome(): void {
  const header = qs('.app-header');
  const nav = qs('.bottom-nav');
  const sidebar = qs('.sidebar');
  if (header) header.outerHTML = headerMarkup().value;
  if (nav) nav.outerHTML = bottomNavMarkup().value;
  if (sidebar) sidebar.outerHTML = sidebarMarkup().value;
  renderSlip();
}

function renderSlip(): void {
  const state = store.get();
  const panel = qs('#slip-panel');
  const sheet = qs('#slip-sheet');

  // Desktop shows the slip permanently in its own column; mobile as a sheet.
  if (panel) render(panel, betslipMarkup());
  if (!sheet) return;

  if (state.slipOpen) {
    render(sheet, h`<div class="slip-backdrop" data-close-slip></div>${betslipMarkup()}`);
    document.body.style.overflow = 'hidden';
  } else {
    sheet.innerHTML = '';
    document.body.style.overflow = '';
  }
}

/* ───────────────────────────── interaction ─────────────────────────── */

function wireEvents(root: HTMLElement): void {
  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const nav = target.closest('[data-nav]');
    if (nav instanceof HTMLElement) {
      navigate(nav.dataset['nav'] ?? '/');
      return;
    }

    const league = target.closest('[data-open-league]');
    if (league instanceof HTMLElement) {
      navigate(`/league/${encodeURIComponent(league.dataset['openLeague'] ?? '')}`);
      return;
    }

    const eventOpen = target.closest('[data-open-event]');
    if (eventOpen instanceof HTMLElement) {
      navigate(`/event/${encodeURIComponent(eventOpen.dataset['openEvent'] ?? '')}`);
      return;
    }

    if (target.closest('[data-back]')) {
      window.history.back();
      return;
    }

    if (target.closest('[data-retry]')) {
      void route();
      return;
    }

    const odds = target.closest('[data-odds-button]');
    if (odds instanceof HTMLElement) {
      handleOddsTap(odds);
      return;
    }

    if (target.closest('[data-toggle-all]')) {
      toggleShowAll();
      void route();
      return;
    }

    const refreshLeague = target.closest('[data-refresh-league]');
    if (refreshLeague instanceof HTMLElement) {
      void handleRefreshLeague(refreshLeague.dataset['refreshLeague'] ?? '');
      return;
    }

    const betsTab = target.closest('[data-bets-tab]');
    if (betsTab instanceof HTMLElement) {
      setBetsTab(betsTab.dataset['betsTab'] === 'settled' ? 'settled' : 'open');
      void route();
      return;
    }

    void handleSlipClick(target);
    void handleWalletClick(target);
    void handleAdminClick(target);
  });

  root.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.dataset['stakeInput'] !== undefined) {
      store.setStake(target.value);
      return;
    }
    if (target.dataset['prefStake'] !== undefined) {
      setPreference('defaultStake', target.value.trim());
    }
  });

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const key = target.dataset['pref'];
    if (key === 'autoAcceptImprovedOdds' || key === 'notifyOnSettlement') {
      setPreference(key, target.checked);
      toast(target.checked ? 'Preference on' : 'Preference off', 'success');
    }
  });
}

function handleOddsTap(button: HTMLElement): void {
  const data = button.dataset;
  const price = Number(data['price']);
  if (!Number.isFinite(price)) return;

  const lineRaw = data['line'] ?? '';
  const action = store.toggleLeg({
    eventId: data['eventId'] ?? '',
    eventName: data['eventName'] ?? '',
    eventStartTime: data['eventStart'] ?? '',
    leagueShortName: data['league'] ?? '',
    marketKey: data['marketKey'] ?? '',
    marketName: data['marketName'] ?? '',
    selectionId: data['selectionId'] ?? '',
    selectionName: data['selectionName'] ?? '',
    line: lineRaw === '' ? null : Number(lineRaw),
    price,
  });

  clearPendingChanges();
  button.setAttribute('aria-pressed', action === 'removed' ? 'false' : 'true');

  // A replaced pick means the other side of the same line is no longer on.
  if (action === 'replaced') {
    for (const other of document.querySelectorAll('[data-odds-button]')) {
      if (other instanceof HTMLElement && other !== button) {
        other.setAttribute('aria-pressed', store.isSelected(other.dataset['selectionId'] ?? '') ? 'true' : 'false');
      }
    }
  }

  if (action !== 'removed' && window.matchMedia('(max-width: 1079px)').matches) store.openSlip();
  renderSlip();
  const nav = qs('.bottom-nav');
  if (nav) nav.outerHTML = bottomNavMarkup().value;
}

async function handleRefreshLeague(leagueId: string): Promise<void> {
  try {
    const result = await api.refreshLeague(leagueId);
    toast(
      result.source === 'live' ? 'Odds refreshed' : `Showing cached data — ${result.error ?? 'provider unavailable'}`,
      result.source === 'live' ? 'success' : 'info',
    );
  } catch (error) {
    toast(error instanceof ApiError ? error.message : 'Could not refresh.', 'error');
  }
  void route();
}

async function handleSlipClick(target: Element): Promise<void> {
  const remove = target.closest('[data-remove-leg]');
  if (remove instanceof HTMLElement) {
    store.removeLeg(remove.dataset['removeLeg'] ?? '');
    clearPendingChanges();
    refreshChrome();
    return;
  }

  if (target.closest('[data-clear-slip]')) {
    store.clearSlip();
    clearPendingChanges();
    refreshChrome();
    return;
  }

  if (target.closest('[data-close-slip]')) {
    store.closeSlip();
    renderSlip();
    return;
  }

  const quick = target.closest('[data-quick-stake]');
  if (quick instanceof HTMLElement) {
    store.setStake(quick.dataset['quickStake'] ?? '');
    renderSlip();
    return;
  }

  if (target.closest('[data-reject-odds]')) {
    clearPendingChanges();
    renderSlip();
    return;
  }

  if (target.closest('[data-accept-odds]')) {
    if (await placeBet(true)) {
      refreshChrome();
      void route();
    } else {
      renderSlip();
    }
    return;
  }

  if (target.closest('[data-place-bet]')) {
    renderSlip();
    if (await placeBet(false)) {
      refreshChrome();
      void route();
    } else {
      renderSlip();
    }
  }
}

async function handleWalletClick(target: Element): Promise<void> {
  const deposit = target.closest('[data-deposit]');
  if (deposit instanceof HTMLElement) {
    await moveMoney('deposit', Number(deposit.dataset['deposit']));
    return;
  }

  const withdraw = target.closest('[data-withdraw]');
  if (withdraw instanceof HTMLElement) {
    await moveMoney('withdraw', Number(withdraw.dataset['withdraw']));
    return;
  }

  if (target.closest('[data-withdraw-all]')) {
    await moveMoney('withdraw', store.get().wallet?.balanceCents ?? 0);
    return;
  }

  if (target.closest('[data-deposit-custom]')) {
    const input = qs<HTMLInputElement>('[data-custom-amount]');
    const value = Number(input?.value ?? '');
    if (!Number.isFinite(value) || value <= 0) {
      toast('Enter an amount to deposit.', 'error');
      return;
    }
    await moveMoney('deposit', Math.round(value * 100));
  }
}

async function moveMoney(kind: 'deposit' | 'withdraw', amountCents: number): Promise<void> {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    toast('Enter a valid amount.', 'error');
    return;
  }
  try {
    const result = kind === 'deposit' ? await api.deposit(amountCents) : await api.withdraw(amountCents);
    store.setWallet(result.data.wallet);
    toast(
      kind === 'deposit' ? `${money(amountCents)} added to your demo balance` : `${money(amountCents)} withdrawn`,
      'success',
    );
    void route();
  } catch (error) {
    toast(error instanceof ApiError ? error.message : 'That did not work.', 'error');
  }
}

async function handleAdminClick(target: Element): Promise<void> {
  const button = target.closest('[data-admin]');
  if (!(button instanceof HTMLElement)) return;

  const action = button.dataset['admin'];
  try {
    if (action === 'catalog') await api.admin.refreshCatalog();
    else if (action === 'refresh') await api.admin.refresh();
    else if (action === 'settle') await api.admin.settle();
    else if (action === 'cache') await api.admin.clearCache();
    else if (action === 'reset') {
      if (!window.confirm('Reset the demo account? Bets, settlements and the ledger are cleared.')) return;
      await api.admin.reset();
      store.clearSlip();
    }
    toast('Done.', 'success');
    void route();
  } catch (error) {
    toast(error instanceof ApiError ? error.message : 'That action failed.', 'error');
  }
}

/* ─────────────────────────────── toasts ────────────────────────────── */

function renderToasts(items: Toast[]): void {
  const stack = qs('#toasts');
  if (!stack) return;
  render(
    stack,
    h`${items.map(
      (item) => h`<div class="toast toast--${item.kind}">
        ${icon(item.kind === 'error' ? 'alert' : 'check', 17)}
        <span>${item.message}</span>
      </div>`,
    )}`,
  );
}

/* ──────────────────────────────── boot ─────────────────────────────── */

async function boot(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  render(app, shellMarkup());
  wireEvents(app);
  onToasts(renderToasts);

  window.addEventListener('popstate', () => void route());

  // The header balance is the one piece of chrome that changes on its own.
  let lastBalance: number | null = null;
  store.subscribe((state) => {
    const balance = state.wallet?.balanceCents ?? null;
    if (balance === lastBalance) return;
    lastBalance = balance;
    const chip = qs('.balance-chip__value');
    if (chip) chip.textContent = balance === null ? '—' : money(balance);
  });

  try {
    const [config, wallet] = await Promise.all([api.config(), api.wallet()]);
    store.setConfig(config);
    store.setWallet(wallet.data);
  } catch {
    // The shell still renders; the view will report the failure properly.
  }

  // A default stake fills an empty slip, and never overwrites a typed one.
  const defaultStake = preferences().defaultStake;
  if (defaultStake !== '' && store.get().stakeInput === '') store.setStake(defaultStake);

  await route();
  startSettlementWatch();

  // Keep the balance and open-bet badge current without a full reload.
  window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    void api
      .wallet()
      .then((result) => store.setWallet(result.data))
      .catch(() => undefined);
  }, 30_000);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}

void boot();
