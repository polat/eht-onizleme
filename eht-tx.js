/* EHT inner-page interactions: self-check, price switches, comparison picker, review/contact forms.
   Every block is optional and only runs when its markup is on the page. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const EASE_OUT = 'cubic-bezier(.23, 1, .32, 1)';

  // Self-check: questions unlock one by one. The page defines window.EHT_VERDICT(answers) -> [cls, title, html].
  // The answer never says "suitable", only where to look next.
  const check = $('#check');
  if (check) {
    const qs = $$('.q', check);
    const bar = $('.progress span', check), cnt = $('.cnt', check);
    const box = $('.res-box', check);
    const update = () => {
      const a = Object.fromEntries(new FormData(check));
      const n = Object.keys(a).length;
      if (cnt) cnt.textContent = n;
      if (bar) bar.style.width = (n / qs.length) * 100 + '%';
      qs.forEach((q, i) => q.classList.toggle('is-locked', i > n));
      if (n === qs.length && window.EHT_VERDICT) {
        const [cls, title, text] = window.EHT_VERDICT(a);
        box.className = 'res-box ' + cls;
        $('b', box).textContent = title;
        $('p', box).innerHTML = text;
        check.classList.add('is-done');
      } else check.classList.remove('is-done');
    };
    check.addEventListener('change', () => {
      update();
      const next = qs.find(q => !q.querySelector('input:checked'));
      if (next && innerWidth <= 640) next.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'nearest' });
    });
    check.addEventListener('reset', () => setTimeout(update));
  }

  // Animated text swap used by the price switches.
  const swap = (el, text) => {
    if (!el || el.textContent === text) return;
    if (reduce.matches) { el.textContent = text; return; }
    el.getAnimations().forEach(x => x.cancel());
    const out = el.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(3px)', transform: 'translateY(-5px)' }], { duration: 140, easing: 'ease-in', fill: 'forwards' });
    out.onfinish = () => { el.textContent = text; el.animate([{ opacity: 0, filter: 'blur(3px)', transform: 'translateY(5px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 300, easing: EASE_OUT }); out.cancel(); };
  };

  // Segmented switches: the navy pill slides to the pressed option.
  const initSeg = (seg, onChange) => {
    const btns = $$('button', seg), pill = $('.pill', seg);
    const place = (btn, instant) => {
      if (!btn || !btn.offsetWidth || !pill) return;
      if (instant) pill.style.transition = 'none';
      seg.style.setProperty('--x', btn.offsetLeft + 'px');
      seg.style.setProperty('--w', btn.offsetWidth + 'px');
      if (instant) { pill.offsetWidth; pill.style.transition = ''; }
    };
    btns.forEach(btn => btn.addEventListener('click', () => {
      btns.forEach(b => b.setAttribute('aria-pressed', b === btn));
      place(btn);
      onChange(btn.dataset.v);
    }));
    const placeCurrent = () => place($('[aria-pressed="true"]', seg), true);
    placeCurrent();
    document.fonts?.ready.then(placeCurrent);
    addEventListener('resize', placeCurrent);
  };

  // Prices: any [data-prices] block. [data-p] holds a GBP per-eye figure (or a fixed figure with data-fixed),
  // [data-unit-label] shows "per eye" / "both eyes". EUR uses a placeholder rate until Veon sets euro prices.
  const RATE = 1.15;
  $$('[data-prices]').forEach(block => {
    const state = { unit: 'eye', cur: 'gbp' };
    const fmt = v => (state.cur === 'eur' ? '€' : '£') + Math.round(v).toLocaleString('en-GB');
    const conv = gbp => state.cur === 'eur' ? Math.round(gbp * RATE / 5) * 5 : gbp;
    const render = () => {
      $$('[data-p]', block).forEach(el => {
        const k = state.unit === 'both' && !el.hasAttribute('data-fixed') ? 2 : 1;
        swap(el, fmt(conv(+el.dataset.p) * k));
      });
      $$('[data-unit-label]', block).forEach(el => swap(el, state.unit === 'both' ? 'both eyes' : 'per eye'));
      $$('[data-p2]', block).forEach(el => {
        const eye = +el.dataset.p2;
        swap(el, state.unit === 'both' ? fmt(conv(eye)) + ' per eye' : fmt(conv(eye) * 2) + ' for both eyes');
      });
    };
    $$('.seg[data-seg]', block).forEach(seg => initSeg(seg, v => { state[seg.dataset.seg] = v; render(); }));
  });

  // Comparison table on phones: this treatment beside one alternative at a time.
  $$('.cmp-pick .seg').forEach(seg => {
    const table = seg.closest('section')?.querySelector('table.cmp');
    if (table) initSeg(seg, v => { table.dataset.vs = v; });
  });

  // Draw diagrams and price bars when they come into view.
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: .35 });
  $$('.diagram, .vs').forEach(el => io.observe(el));

  // Review and contact forms (preview: nothing is sent).
  $$('form.rform').forEach(form => {
    const f = form.elements, err = $('.qerr', form), submit = $('button[type="submit"]', form);
    const label = $('.lbl', submit)?.textContent || 'Send';
    const up = $('.upload', form);
    if (up && f.rx) f.rx.addEventListener('change', () => {
      const file = f.rx.files[0];
      up.classList.toggle('has-file', !!file);
      $('.up-l', up).textContent = file ? file.name : up.dataset.empty || 'Add a photo of your prescription';
    });
    const need = [...form.querySelectorAll('[data-required]')];
    const problems = () => need.filter(el => el.type === 'checkbox' ? !el.checked
      : el.type === 'tel' ? el.value.replace(/\D/g, '').length < 7 : !el.value.trim());
    const mark = (bad, nudge) => {
      need.forEach(el => (el.type === 'checkbox' ? el.closest('.consent') : el).classList.toggle('is-invalid', bad.includes(el)));
      const names = bad.filter(el => el.type !== 'checkbox').map(el => el.dataset.required);
      const parts = [names.length && 'add ' + names.join(' and '), bad.some(el => el.type === 'checkbox') && 'tick the box to agree we may contact you'].filter(Boolean);
      if (parts.length) $('p', err).textContent = 'Please ' + parts.join(', and ') + '.';
      err.classList.toggle('is-shown', parts.length > 0);
      if (!nudge || reduce.matches) return;
      bad.map(el => el.type === 'checkbox' ? $('i', el.closest('.consent')) : el).forEach(el => { el.classList.remove('nudge'); el.offsetWidth; el.classList.add('nudge'); });
    };
    form.addEventListener('animationend', e => e.target.classList.remove('nudge'));
    form.addEventListener('input', () => { if (err.classList.contains('is-shown')) mark(problems().filter(el => (el.type === 'checkbox' ? el.closest('.consent') : el).classList.contains('is-invalid'))); });
    const morph = change => {
      const start = form.offsetHeight; change(); const end = form.offsetHeight;
      if (reduce.matches || start === end) return;
      form.style.overflow = 'hidden';
      form.animate({ height: [start + 'px', end + 'px'] }, { duration: 420, easing: EASE_OUT }).onfinish = () => { form.style.overflow = ''; };
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      const bad = problems();
      if (bad.length) { mark(bad, true); bad[0].focus({ preventScroll: true }); return; }
      submit.classList.add('is-loading');
      $('.lbl', submit).textContent = 'Sending…';
      const nm = f.name?.value.trim();
      setTimeout(() => { const n = $('.qdone-name', form); if (n) n.textContent = nm ? ', ' + nm : ''; morph(() => form.classList.add('is-sent')); }, 1100);
    });
    $('[data-reset]', form)?.addEventListener('click', () => { submit.classList.remove('is-loading'); $('.lbl', submit).textContent = label; morph(() => form.classList.remove('is-sent')); need[0]?.focus({ preventScroll: true }); });
  });
})();
