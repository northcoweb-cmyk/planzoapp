/** Static help content. No live chat, no fake support queue. */

import { h } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { icon } from '../icons.js';

const FAQ: Array<[string, string]> = [
  ['How does the balance work?', 'Every balance, stake and payout in KOVR is simulated. No real money moves at any point.'],
  ['Why did my bet not settle yet?', 'A bet settles only once a confirmed result is available from the sports data provider — never just because the scheduled time has passed.'],
  ['Can I change my balance directly?', 'Yes, through the hidden control: tap the KOVR wordmark five times.'],
  ['Where is my data stored?', 'On this device only, in your browser’s local storage. Nothing is sent to a server for your account.'],
  ['How do I stop betting for a while?', 'Account → Responsible gaming → Take a break sets a cool-off that blocks betting and deposits until it lapses.'],
];

export function renderHelp(): RawHtml {
  return h`
    <div class="view">
      <button class="back-link" type="button" data-back>${icon('back', 15)} Back</button>
      <header class="view-header fade-up"><h1 class="view-title">Help center</h1></header>
      <div class="card fade-up">
        ${FAQ.map(
          ([q, a]) => h`
            <div class="row" style="flex-direction:column;align-items:flex-start;gap:4px">
              <span class="row__title">${q}</span>
              <span class="row__meta">${a}</span>
            </div>`,
        )}
      </div>
      <p class="dim">Problem gambling resources: National Council on Problem Gambling, 1-800-522-4700.</p>
    </div>`;
}
