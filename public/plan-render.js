/**
 * Shared final-plan renderer, used by both the participant page and the app
 * so the two can never drift apart.
 *
 * Every figure it renders is marked as an estimate, and anything the backend
 * could not verify renders as an honest gap rather than a plausible blank.
 */
(function(){
  const esc = s => String(s == null ? '' : s)
    .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const PRICE = { PRICE_LEVEL_FREE:'Free', PRICE_LEVEL_INEXPENSIVE:'$',
    PRICE_LEVEL_MODERATE:'$$', PRICE_LEVEL_EXPENSIVE:'$$$', PRICE_LEVEL_VERY_EXPENSIVE:'$$$$' };

  function stop(item){
    if (item.kind === 'travel' || item.kind === 'return'){
      const opts = (item.transport || []).slice(0, 3);
      return `
        <div class="tl-item">
          <div class="tl-time">${esc(item.time)}</div>
          <div style="font-weight:600;font-size:15px">${esc(item.title)}</div>
          ${item.detail ? `<div class="tiny muted">${esc(item.detail)}</div>` : ''}
          ${opts.length ? `<div class="stack g8" style="margin-top:9px">${opts.map(o => `
            <div class="between" style="font-size:13.5px">
              <span>${esc(o.mode)} · ${o.minutes} min</span>
              <span class="muted">${o.costPerPerson > 0
                ? '~$' + o.costPerPerson.toFixed(2) + '/person'
                : 'Free'}${o.estimate ? ' <span class="tiny">est.</span>' : ''}</span>
            </div>`).join('')}</div>` : ''}
        </div>`;
    }

    if (item.unresolved){
      return `
        <div class="tl-item">
          <div class="tl-time">${esc(item.time)}</div>
          <div style="font-weight:600;font-size:15px">${esc(item.title)}</div>
          <div class="notice" style="margin-top:9px">${esc(item.unresolvedMessage)}</div>
        </div>`;
    }

    const p = item.place || {};
    return `
      <div class="tl-item">
        <div class="tl-time">${esc(item.time)}</div>
        <div style="font-weight:600;font-size:15px">${esc(item.title)}</div>
        ${p.name ? `
          <div class="card" style="margin-top:9px;padding:14px">
            <div class="between" style="align-items:flex-start">
              <div class="stack g8" style="min-width:0">
                <strong style="font-size:15px">${esc(p.name)}</strong>
                ${p.address ? `<span class="tiny muted">${esc(p.address)}</span>` : ''}
                <div class="row" style="gap:8px">
                  ${p.rating ? `<span class="badge">★ ${p.rating}${p.ratingCount ? ` (${p.ratingCount})` : ''}</span>` : ''}
                  ${PRICE[p.priceLevel] ? `<span class="badge">${PRICE[p.priceLevel]}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="row" style="margin-top:12px;gap:8px">
              ${p.mapsUrl ? `<a class="btn btn-ghost" style="min-height:40px;font-size:14px" target="_blank" rel="noopener" href="${esc(p.mapsUrl)}">Directions</a>` : ''}
              ${p.website ? `<a class="btn btn-ghost" style="min-height:40px;font-size:14px" target="_blank" rel="noopener" href="${esc(p.website)}">Book / website</a>` : ''}
            </div>
          </div>` : ''}
        ${(item.alternatives || []).length ? `
          <details style="margin-top:9px">
            <summary class="tiny muted" style="cursor:pointer">${item.alternatives.length} other options</summary>
            <div class="stack g8" style="margin-top:8px">
              ${item.alternatives.map(a => `<div class="between" style="font-size:13.5px">
                <span>${esc(a.name)}</span>
                ${a.rating ? `<span class="muted tiny">★ ${a.rating}</span>` : ''}
              </div>`).join('')}
            </div>
          </details>` : ''}
      </div>`;
  }

  function finalPlan(fp){
    if (!fp) return '';
    const w = fp.weather || {};
    return `
    <div class="stack g24 rise">
      <div class="card glass stack g16">
        <div class="stack g8">
          <span class="eyebrow">Your plan is ready</span>
          <h2>${esc(fp.title)}</h2>
          <p class="muted">${esc(fp.window)} · ${fp.groupSize} ${fp.groupSize === 1 ? 'person' : 'people'}${fp.confirmed ? ` · ${fp.confirmed} confirmed` : ''}</p>
        </div>
        <div class="row" style="gap:8px">
          <span class="badge brand">~$${fp.cost.perPerson}/person <span class="tiny">est.</span></span>
          ${w.available ? `<span class="badge">${esc(w.summary)} · ${w.highF}°/${w.lowF}° · ${w.precipChance}% rain</span>`
                        : `<span class="badge warn">Weather unavailable</span>`}
        </div>
      </div>

      ${(fp.caveats || []).length ? `<div class="stack g8">
        ${fp.caveats.map(c => `<div class="notice">${esc(c)}</div>`).join('')}
      </div>` : ''}

      <div class="card">
        <div class="tl">${fp.itinerary.map(stop).join('')}</div>
      </div>

      <div class="card stack g12">
        <div class="between"><strong>What it costs</strong><span class="badge">Estimate</span></div>
        ${fp.cost.lines.length ? fp.cost.lines.map(l => `
          <div class="between" style="font-size:14.5px">
            <div class="stack" style="gap:2px;min-width:0">
              <span>${esc(l.label)}</span>
              ${l.basis ? `<span class="tiny muted">${esc(l.basis)}</span>` : ''}
            </div>
            <strong>$${l.perPerson.toFixed(2)}</strong>
          </div>`).join('')
          : `<p class="muted tiny">Nothing in this plan costs money.</p>`}
        <div class="between" style="border-top:1px solid var(--line);padding-top:12px">
          <strong>Per person</strong>
          <strong style="font-size:20px" class="gradient-text">~$${fp.cost.perPerson}</strong>
        </div>
        <p class="tiny muted">${esc(fp.cost.note)}</p>
      </div>

      ${(fp.sources || []).length ? `<p class="tiny muted" style="text-align:center">
        Live data from ${esc([...new Set(fp.sources.map(s => s.provider))].join(', '))} ·
        checked ${new Date(fp.generatedAt).toLocaleString()}
      </p>` : ''}
    </div>`;
  }

  window.PlanzoRender = { finalPlan, esc };
})();
