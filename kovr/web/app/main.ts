/**
 * KOVR — client entry point.
 *
 * Renders the shell once, then swaps views into it. One delegated listener
 * per surface, so a re-render never leaks handlers.
 */

import { h, raw, render, qs } from './dom.js';
import type { RawHtml } from './dom.js';
import { brandMark, icon } from './icons.js';
import { money } from './format.js';
import { api, ApiError } from './api.js';
import { store, toast, onToasts } from './store.js';
import type { Toast } from './store.js';
import { betslipMarkup, placeBet, clearPendingChanges } from './betslip.js';
import { ledger } from './ledgerClient.js';
import { preferences, setPreference, selfExclusionStatus, setExclusion } from './preferences.js';
import { startSettlementWatch, runSettlement } from './settlementWatch.js';
import { parseAmountToCents, MoneyError } from '../../src/core/money.js';
import { LedgerError } from '../../src/ledger/ledger.js';
import { renderHome, homeSkeleton, setLeagueFilter } from './views/home.js';
import { renderSports, renderLeague, sportsSkeleton } from './views/sports.js';
import { renderEvent, eventSkeleton } from './views/event.js';
import { renderBets, betsSkeleton, setBetsTab } from './views/bets.js';
import { renderWallet, renderActivity, walletSkeleton } from './views/wallet.js';
import { renderAccount, accountSkeleton } from './views/account.js';
import { renderRewards, rewardsSkeleton } from './views/rewards.js';
import { renderPromotions, promotionsSkeleton } from './views/promotions.js';
import { renderHelp } from './views/help.js';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/bets', label: 'My Bets', icon: 'bets' },
  { path: '/sports', label: 'Sports', icon: 'sports' },
  { path: '/rewards', label: 'Rewards', icon: 'rewards' },
  { path: '/account', label: 'Account', icon: 'profile' },
];

const currentPath = (): string => window.location.pathname;

function isActive(path: string): boolean {
  const here = currentPath();
  if (path === '/') return here === '/';
  if (path === '/sports') return here === '/sports' || here.startsWith('/league/');
  if (path === '/account') {
    return here === '/account' || here === '/wallet' || here === '/activity' || here === '/profile';
  }
  return here.startsWith(path);
}

function navigate(path: string): void {
  if (path === '/betslip') {
    store.openSlip();
    return;
  }
  if (currentPath() === path) {
    void route();
    return;
  }
  window.history.pushState({}, '', path);
  void route();
}

/* ─────────────────────────────── shell ─────────────────────────────── */

function headerMarkup(): RawHtml {
  const wallet = store.get().wallet;
  return h`
    <header class="app-header">
      <button class="brand" type="button" data-brand aria-label="KOVR home">
        ${brandMark(28)} <span class="brand__word">KOVR</span>
      </button>
      <button class="balance-chip" type="button" data-nav="/wallet">
        <span class="balance-chip__label">Balance</span>
        <span class="balance-chip__value num" data-balance>${wallet ? money(wallet.balanceCents) : '—'}</span>
      </button>
    </header>`;
}

function bottomNavMarkup(): RawHtml {
  const state = store.get();
  return h`
    <nav class="bottom-nav" aria-label="Primary">
      ${NAV.map((item) => {
        const badge =
          item.path === '/bets' && state.openBetCount > 0
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

/**
 * Floating access to the betslip. The slip is not a nav tab (five tabs is
 * the limit), so this is how it stays reachable everywhere on mobile — a
 * single tap opens it as a sheet. Hidden until there is something in it.
 */
function slipFabMarkup(): RawHtml {
  const count = store.get().slip.length;
  if (count === 0) return raw('');
  return h`
    <button class="slip-fab" type="button" data-nav="/betslip" aria-label="Open betslip, ${count} selections">
      ${icon('slip', 19)}
      <span class="slip-fab__count">${count}</span>
    </button>`;
}

function sidebarMarkup(): RawHtml {
  const state = store.get();
  return h`
    <aside class="sidebar">
      <div class="sidebar__group">
        ${NAV.map(
          (item) => h`
            <button class="sidebar__item" type="button" data-nav="${item.path}"
              ${isActive(item.path) ? raw('aria-current="page"') : raw('')}>
              ${icon(item.icon, 17)} <span>${item.label}</span>
              ${item.path === '/bets' && state.openBetCount > 0 ? h`<span class="pill">${state.openBetCount}</span>` : raw('')}
            </button>`,
        )}
      </div>
      <div class="sidebar__group">
        <p class="sidebar__label">More</p>
        <button class="sidebar__item" type="button" data-nav="/promotions"
          ${isActive('/promotions') ? raw('aria-current="page"') : raw('')}>
          ${icon('tag', 17)} <span>Promotions</span>
        </button>
        <button class="sidebar__item" type="button" data-nav="/wallet"
          ${isActive('/wallet') ? raw('aria-current="page"') : raw('')}>
          ${icon('wallet', 17)} <span>Wallet</span>
        </button>
        <button class="sidebar__item" type="button" data-nav="/activity"
          ${isActive('/activity') ? raw('aria-current="page"') : raw('')}>
          ${icon('activity', 17)} <span>Activity</span>
        </button>
      </div>
    </aside>`;
}

function shellMarkup(): RawHtml {
  return h`
    ${headerMarkup()}
    ${sidebarMarkup()}
    <main class="app-main" id="view"></main>
    <div class="slip-panel" id="slip-panel"></div>
    <div id="slip-fab">${slipFabMarkup()}</div>
    ${bottomNavMarkup()}
    <div class="toast-stack" id="toasts" aria-live="polite"></div>
    <div id="sheet"></div>`;
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
    } else if (path === '/account' || path === '/profile') {
      show(accountSkeleton());
      show(await renderAccount());
    } else if (path === '/rewards') {
      show(rewardsSkeleton());
      show(await renderRewards());
    } else if (path === '/promotions') {
      show(promotionsSkeleton());
      show(await renderPromotions());
    } else if (path === '/help') {
      show(renderHelp());
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
      <button class="btn btn--sm" type="button" data-reload>Try again</button>
    </div>`);
  }

  refreshChrome();
  window.scrollTo({ top: 0 });
}

function refreshChrome(): void {
  const header = qs('.app-header');
  const nav = qs('.bottom-nav');
  const sidebar = qs('.sidebar');
  const fab = qs('#slip-fab');
  if (header) header.outerHTML = headerMarkup().value;
  if (nav) nav.outerHTML = bottomNavMarkup().value;
  if (sidebar) sidebar.outerHTML = sidebarMarkup().value;
  if (fab) render(fab, slipFabMarkup());
  renderSlip();
}

function renderSlip(): void {
  const state = store.get();
  const panel = qs('#slip-panel');
  const sheet = qs('#sheet');

  if (panel) render(panel, betslipMarkup());
  if (!sheet) return;

  if (state.slipOpen) {
    render(sheet, h`<div class="sheet-backdrop" data-close-slip></div>${betslipMarkup()}`);
    document.body.classList.add('is-locked');
  } else if (!sheet.querySelector('.balance-sheet') && !sheet.querySelector('.exclusion-sheet')) {
    sheet.innerHTML = '';
    document.body.classList.remove('is-locked');
  }
}

/* ───────────────────────── the hidden control ──────────────────────── */

let brandTaps = 0;
let brandTimer: number | null = null;

/**
 * Five taps on the wordmark opens the balance control. It is the only way
 * to set a balance directly, and deliberately not discoverable by accident.
 */
function handleBrandTap(): void {
  brandTaps++;
  if (brandTimer !== null) window.clearTimeout(brandTimer);
  brandTimer = window.setTimeout(() => {
    brandTaps = 0;
  }, 2500);

  if (brandTaps >= 5) {
    brandTaps = 0;
    if (brandTimer !== null) window.clearTimeout(brandTimer);
    void openBalanceSheet();
    return;
  }
  if (brandTaps === 1) navigate('/');
}

async function openBalanceSheet(): Promise<void> {
  const sheet = qs('#sheet');
  if (!sheet) return;

  const wallet = await (await ledger()).wallet();
  const current = (wallet.balanceCents / 100).toFixed(2);

  render(
    sheet,
    h`
      <div class="sheet-backdrop" data-close-balance></div>
      <div class="slip balance-sheet">
        <div class="slip__grip"></div>
        <header class="slip__head">
          <h2 class="slip__title">Set balance</h2>
          <button class="slip-leg__remove" type="button" data-close-balance aria-label="Close"
            style="margin-left:auto">${icon('close', 14)}</button>
        </header>
        <div class="slip__foot">
          <div class="stake-field stake-field--large">
            <span class="stake-field__prefix">$</span>
            <input type="text" inputmode="decimal" value="${current}" data-balance-input
              aria-label="Balance" autocomplete="off" />
          </div>
          <div class="btn-grid btn-grid--four">
            ${[100, 1000, 10000, 50000].map(
              (amount) => h`<button class="btn btn--sm" type="button" data-balance-preset="${String(amount)}">
                $${amount >= 1000 ? `${amount / 1000}k` : amount}
              </button>`,
            )}
          </div>
          <button class="btn btn--primary btn--block btn--lg" type="button" data-balance-apply>Update balance</button>
        </div>
      </div>`,
  );
  document.body.classList.add('is-locked');
}

function closeBalanceSheet(): void {
  const sheet = qs('#sheet');
  if (sheet) sheet.innerHTML = '';
  document.body.classList.remove('is-locked');
  renderSlip();
}

async function applyBalance(): Promise<void> {
  const input = qs<HTMLInputElement>('[data-balance-input]');
  if (!input) return;
  try {
    const cents = parseAmountToCents(input.value);
    const wallet = await (await ledger()).adjustBalance(cents);
    store.setWallet(wallet);
    closeBalanceSheet();
    refreshChrome();
    toast(`Balance set to ${money(wallet.balanceCents)}`, 'success');
    void route();
  } catch (error) {
    toast(error instanceof MoneyError || error instanceof LedgerError ? error.message : 'Enter a valid amount.', 'error');
  }
}

/* ─────────────────────── responsible-gaming sheet ───────────────────── */

const EXCLUSION_OPTIONS: Array<[label: string, hours: number]> = [
  ['24 hours', 24],
  ['7 days', 24 * 7],
  ['30 days', 24 * 30],
  ['90 days', 24 * 90],
];

function openExclusionSheet(): void {
  const sheet = qs('#sheet');
  if (!sheet) return;

  const active = selfExclusionStatus();
  render(
    sheet,
    h`
      <div class="sheet-backdrop" data-close-exclusion></div>
      <div class="slip exclusion-sheet">
        <div class="slip__grip"></div>
        <header class="slip__head">
          <h2 class="slip__title">Take a break</h2>
          <button class="slip-leg__remove" type="button" data-close-exclusion aria-label="Close"
            style="margin-left:auto">${icon('close', 14)}</button>
        </header>
        <div class="slip__foot">
          ${
            active.active
              ? h`<p class="muted">Already paused until ${active.until ? new Date(active.until).toLocaleString() : ''}.
                   This cannot be shortened once set.</p>`
              : h`
                <p class="muted">Betting and deposits will be blocked on this device until the period ends.
                  This cannot be undone early.</p>
                <div class="btn-grid" style="grid-template-columns:1fr 1fr">
                  ${EXCLUSION_OPTIONS.map(
                    ([label, hours]) => h`
                      <button class="btn" type="button" data-exclusion-confirm="${String(hours)}">${label}</button>`,
                  )}
                </div>`
          }
        </div>
      </div>`,
  );
  document.body.classList.add('is-locked');
}

function closeExclusionSheet(): void {
  const sheet = qs('#sheet');
  if (sheet) sheet.innerHTML = '';
  document.body.classList.remove('is-locked');
  renderSlip();
}

/* ───────────────────────────── interaction ─────────────────────────── */

function wireEvents(root: HTMLElement): void {
  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('[data-brand]')) {
      handleBrandTap();
      return;
    }

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
    if (eventOpen instanceof HTMLElement && !target.closest('[data-odds-button]')) {
      navigate(`/event/${encodeURIComponent(eventOpen.dataset['openEvent'] ?? '')}`);
      return;
    }

    if (target.closest('[data-back]')) {
      window.history.back();
      return;
    }
    if (target.closest('[data-reload]')) {
      void route();
      return;
    }

    const odds = target.closest('[data-odds-button]');
    if (odds instanceof HTMLElement) {
      handleOddsTap(odds);
      return;
    }

    const filter = target.closest('[data-league-filter]');
    if (filter instanceof HTMLElement) {
      setLeagueFilter(filter.dataset['leagueFilter'] || null);
      void route();
      return;
    }

    const betsTab = target.closest('[data-bets-tab]');
    if (betsTab instanceof HTMLElement) {
      const value = betsTab.dataset['betsTab'];
      setBetsTab(value === 'settled' ? 'settled' : value === 'all' ? 'all' : 'open');
      void route();
      return;
    }

    void handleSlipClick(target);
    void handleWalletClick(target);
    void handleBalanceSheetClick(target);
    handleExclusionSheetClick(target);
  });

  root.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset['stakeInput'] !== undefined) {
      store.setStake(target.value);
      return;
    }
    if (target.dataset['prefStake'] !== undefined) setPreference('defaultStake', target.value.trim());
  });

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const key = target.dataset['pref'];
    if (key === 'autoAcceptImprovedOdds' || key === 'notifyOnSettlement') {
      setPreference(key, target.checked);
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
  button.classList.remove('odds-button--pop');
  void button.offsetWidth;
  if (action !== 'removed') button.classList.add('odds-button--pop');

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
    renderSlip();
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
  if (deposit instanceof HTMLElement) return moveMoney('deposit', Number(deposit.dataset['deposit']));

  const withdraw = target.closest('[data-withdraw]');
  if (withdraw instanceof HTMLElement) return moveMoney('withdraw', Number(withdraw.dataset['withdraw']));

  if (target.closest('[data-withdraw-all]')) {
    return moveMoney('withdraw', store.get().wallet?.balanceCents ?? 0);
  }

  if (target.closest('[data-deposit-custom]')) {
    const input = qs<HTMLInputElement>('[data-custom-amount]');
    const value = Number(input?.value ?? '');
    if (!Number.isFinite(value) || value <= 0) {
      toast('Enter an amount.', 'error');
      return;
    }
    return moveMoney('deposit', Math.round(value * 100));
  }

  if (target.closest('[data-reset-account]')) {
    if (!window.confirm('Reset this account? Bets and history on this device are cleared.')) return;
    const wallet = await (await ledger()).reset();
    store.setWallet(wallet);
    store.clearSlip();
    await store.refreshCounts();
    await store.refreshRewards();
    toast('Account reset', 'success');
    void route();
    return;
  }

  if (target.closest('[data-claim-welcome-boost]')) {
    setPreference('welcomeBoostState', 'claimed');
    toast('Boost claimed — make a deposit from Wallet to apply it', 'success');
    void route();
    return;
  }

  const stakeCap = target.closest('[data-stake-cap]');
  if (stakeCap instanceof HTMLElement) {
    setPreference('maxStakeCents', Number(stakeCap.dataset['stakeCap'] ?? '0'));
    toast('Stake limit updated', 'success');
    void route();
    return;
  }
}

async function moveMoney(kind: 'deposit' | 'withdraw', amountCents: number): Promise<void> {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    toast('Enter a valid amount.', 'error');
    return;
  }
  // A cool-off blocks adding funds too — only withdrawing stays open, since
  // that only ever reduces what is at risk.
  if (kind === 'deposit') {
    const exclusion = selfExclusionStatus();
    if (exclusion.active) {
      toast('Deposits are paused for the length of your cool-off.', 'error');
      return;
    }
  }
  try {
    const book = await ledger();
    const wallet = kind === 'deposit' ? await book.deposit(amountCents) : await book.withdraw(amountCents);
    store.setWallet(wallet);
    toast(kind === 'deposit' ? `${money(amountCents)} added` : `${money(amountCents)} withdrawn`, 'success');

    if (kind === 'deposit' && preferences().welcomeBoostState === 'claimed') {
      const bonusCents = Math.min(Math.round(amountCents * 0.2), 20_000);
      if (bonusCents > 0) {
        const boosted = await book.deposit(bonusCents);
        store.setWallet(boosted);
        toast(`Welcome boost applied — ${money(bonusCents)} extra`, 'success');
      }
      setPreference('welcomeBoostState', 'used');
    }

    void store.refreshRewards();
    void route();
  } catch (error) {
    toast(error instanceof LedgerError ? error.message : 'That did not work.', 'error');
  }
}

async function handleBalanceSheetClick(target: Element): Promise<void> {
  if (target.closest('[data-close-balance]')) {
    closeBalanceSheet();
    return;
  }
  const preset = target.closest('[data-balance-preset]');
  if (preset instanceof HTMLElement) {
    const input = qs<HTMLInputElement>('[data-balance-input]');
    if (input) input.value = Number(preset.dataset['balancePreset'] ?? '0').toFixed(2);
    return;
  }
  if (target.closest('[data-balance-apply]')) await applyBalance();
}

function handleExclusionSheetClick(target: Element): void {
  if (target.closest('[data-open-exclusion]')) {
    openExclusionSheet();
    return;
  }
  if (target.closest('[data-close-exclusion]')) {
    closeExclusionSheet();
    return;
  }
  const confirm = target.closest('[data-exclusion-confirm]');
  if (confirm instanceof HTMLElement) {
    const hours = Number(confirm.dataset['exclusionConfirm'] ?? '0');
    if (hours > 0) {
      setExclusion(hours);
      closeExclusionSheet();
      toast('Cool-off started', 'success');
      void route();
    }
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
    const chip = qs('[data-balance]');
    if (chip) {
      chip.textContent = balance === null ? '—' : money(balance);
      chip.classList.remove('balance-chip__value--bump');
      void chip.offsetWidth;
      chip.classList.add('balance-chip__value--bump');
    }
  });

  await store.refreshWallet();
  await store.refreshCounts();
  await store.refreshRewards();

  const defaultStake = preferences().defaultStake;
  if (defaultStake !== '' && store.get().stakeInput === '') store.setStake(defaultStake);

  api
    .config()
    .then((config) => store.setConfig(config))
    .catch(() => undefined);

  await route();
  startSettlementWatch();
  void runSettlement(false);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}

void boot();
