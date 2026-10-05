/* HouseDAW — optional sound packs. The app is fully self-contained and ships NO samples; this loader exists so that
   properly licensed audio files can be dropped into /packs later without touching the architecture.
   If packs/manifest.json exists it is read and every listed file is decoded and added to the browser (category/sub as given). */
(function () {
  const HD = (globalThis.HD = globalThis.HD || {});
  HD.Packs = {
    load: async () => {
      if (location.protocol === 'file:') return 0;
      let man; try { const r = await fetch('packs/manifest.json', { cache: 'no-cache' }); if (!r.ok) return 0; man = await r.json(); } catch (e) { return 0; }
      let n = 0;
      for (const s of man.sounds || []) {
        try {
          const ab = await (await fetch('packs/' + s.file)).arrayBuffer(), buf = await HD.Import.decode(ab, s.file), id = 'pack_' + HD.hash((man.name || 'pack') + s.file).toString(36);
          const it = HD.Lib.addImport(id, s.name || s.file.replace(/\.[^.]+$/, ''), buf, HD.Import.analyze(buf));
          it.cat = s.cat || 'MY SOUNDS'; it.sub = s.sub || 'Pack'; it.user = false; it.tags = ['pack', (man.name || '').toLowerCase()]; n++;
        } catch (e) { console.warn('pack sound failed', s.file, e); }
      }
      if (n) console.info('HouseDAW: loaded', n, 'sounds from pack', man.name);
      return n;
    },
  };
})();
