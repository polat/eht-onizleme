// Shared behaviour for Eye Health Turkey inner pages (treatment landings, corporate pages).
// Every block checks for its elements first, so a page only gets what it uses.
(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const EASE_OUT = 'cubic-bezier(.23, 1, .32, 1)';
  const root = document.documentElement;

  // Header compacts after the first screen of scrolling; two thresholds so it never flickers.
  const header = $('header.site');
  if (header) {
    let compact = false, ticking = false;
    const onScroll = () => {
      ticking = false;
      if (!compact && scrollY > 140) { compact = true; header.classList.add('is-compact'); }
      else if (compact && scrollY < 60) { compact = false; header.classList.remove('is-compact'); }
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  // Dropdowns: hover intent for mouse, click/Enter for touch and keyboard, Esc or outside click closes.
  const dds = $$('[data-dd]');
  const setDD = (dd, open) => {
    dd.classList.toggle('is-open', open);
    $('button', dd).setAttribute('aria-expanded', open);
    if (!open) dd.hoverOpened = false;
  };
  const closeOthers = keep => dds.forEach(dd => dd !== keep && dd.classList.contains('is-open') && setDD(dd, false));
  dds.forEach(dd => {
    const btn = $('button', dd);
    let timer;
    btn.addEventListener('click', () => {
      if (dd.hoverOpened) { dd.hoverOpened = false; return; }
      const open = !dd.classList.contains('is-open');
      closeOthers(dd);
      setDD(dd, open);
    });
    dd.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(timer);
      if (dd.classList.contains('is-open')) return;
      timer = setTimeout(() => { closeOthers(dd); setDD(dd, true); dd.hoverOpened = true; }, 80);
    });
    dd.addEventListener('pointerleave', e => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(timer);
      timer = setTimeout(() => setDD(dd, false), 180);
    });
    dd.addEventListener('focusout', e => { if (!dd.contains(e.relatedTarget)) setDD(dd, false); });
    dd.addEventListener('click', e => { if (e.target.closest('.dd a')) setDD(dd, false); });
  });
  document.addEventListener('click', e => { if (!e.target.closest('[data-dd]')) closeOthers(null); });

  // Mobile menu
  const burger = $('.burger'), mnav = $('#mnav');
  let menuOpen = false;
  const setMenu = (open, restoreFocus) => {
    if (!mnav) return;
    menuOpen = open;
    if (open) mnav.style.setProperty('--mnav-top', header.getBoundingClientRect().bottom + 'px');
    mnav.classList.toggle('is-open', open);
    mnav.inert = !open;
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    root.classList.toggle('menu-open', open);
    if (!open && restoreFocus) burger.focus();
  };
  if (burger && mnav) {
    $$('.mnav-panel > *').forEach((el, i) => el.style.setProperty('--i', i));
    burger.addEventListener('click', () => setMenu(!menuOpen));
    mnav.addEventListener('click', e => { if (e.target === mnav || e.target.closest('a')) setMenu(false); });
    matchMedia('(min-width: 1101px)').addEventListener('change', e => { if (e.matches && menuOpen) setMenu(false); });
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = dds.find(dd => dd.classList.contains('is-open'));
    if (open) { setDD(open, false); $('button', open).focus(); }
    if (menuOpen) setMenu(false, true);
  });

  // Scroll reveal: single blocks fade up; groups stagger their children.
  const reveal = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    const el = en.target;
    el.classList.add('is-in');
    if (el.dataset.group !== undefined) [...el.children].forEach(c => c.classList.add('is-in'));
    reveal.unobserve(el);
  }), { rootMargin: '0px 0px -8% 0px', threshold: .12 });
  $$('.sec-head, [data-reveal], .final .box').forEach(el => { el.classList.add('reveal'); reveal.observe(el); });
  $$('[data-stagger], .tgrid, .docs, ol.tl').forEach(group => {
    group.dataset.group = '';
    [...group.children].forEach((c, i) => { c.classList.add('reveal'); c.style.setProperty('--i', Math.min(i, 6)); });
    reveal.observe(group);
  });

  // Lazy images fade in when they arrive instead of popping in.
  $$('img[loading="lazy"]').forEach(img => {
    if (img.complete && img.naturalWidth) return;
    img.classList.add('lazy-fade');
    const done = () => img.classList.add('is-loaded');
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });

  // Mobile swipe rows: a small position bar under each row.
  $$('.tgrid, .docs, .wi-grid').forEach(row => {
    const bar = document.createElement('div');
    bar.className = 'swipe-bar';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span></span>';
    row.after(bar);
    const thumb = bar.firstChild;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = row.scrollWidth - row.clientWidth;
      const w = bar.clientWidth * Math.min(1, row.clientWidth / row.scrollWidth);
      thumb.style.setProperty('--w', w + 'px');
      thumb.style.setProperty('--x', (max > 0 ? Math.abs(row.scrollLeft) / max : 0) * (bar.clientWidth - w) + 'px');
    };
    row.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    addEventListener('resize', update);
    update();
  });

  // Accordions (FAQ, "what if", risks): open and close with a height animation.
  $$('.faq-grid details, details.acc').forEach(d => {
    const sum = $('summary', d), answer = sum.nextElementSibling;
    let anim = null;
    sum.addEventListener('click', e => {
      if (reduce.matches || !answer) return;
      e.preventDefault();
      const start = d.offsetHeight;
      const closing = d.open && !d.classList.contains('is-closing');
      if (anim) anim.cancel();
      answer.getAnimations().forEach(a => a.cancel());
      let end;
      if (closing) {
        d.classList.add('is-closing');
        const cs = getComputedStyle(d);
        end = sum.offsetHeight + ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((t, k) => t + parseFloat(cs[k]), 0);
        answer.animate({ opacity: [1, 0] }, { duration: 160, easing: 'ease-out', fill: 'forwards' });
      } else {
        d.classList.remove('is-closing');
        d.open = true;
        end = d.offsetHeight;
        answer.animate({ opacity: [0, 1], transform: ['translateY(-6px)', 'none'] }, { duration: 360, delay: 60, easing: EASE_OUT, fill: 'backwards' });
      }
      d.style.overflow = 'hidden';
      anim = d.animate({ height: [start + 'px', end + 'px'] }, { duration: closing ? 260 : 360, easing: EASE_OUT });
      anim.onfinish = () => {
        if (closing) { d.open = false; d.classList.remove('is-closing'); answer.getAnimations().forEach(a => a.cancel()); }
        d.style.overflow = '';
        anim = null;
      };
    });
  });

  // Video dialog (placeholder until filming). Triggers carry their own title, subtitle and cover.
  const dlg = $('#vdlg');
  if (dlg) {
    $$('[data-video]').forEach(btn => btn.addEventListener('click', () => {
      $('.vframe img', dlg).src = btn.dataset.img || '';
      $('.vcap b', dlg).textContent = btn.dataset.title || '';
      $('.vcap small', dlg).textContent = btn.dataset.sub || '';
      dlg.showModal();
      root.classList.add('dlg-open');
    }));
    const closeDlg = () => {
      if (!dlg.open || dlg.classList.contains('is-closing')) return;
      const finish = () => { dlg.classList.remove('is-closing'); dlg.close(); root.classList.remove('dlg-open'); };
      if (reduce.matches) return finish();
      dlg.classList.add('is-closing');
      dlg.addEventListener('animationend', finish, { once: true });
    };
    $('.vclose', dlg).addEventListener('click', closeDlg);
    dlg.addEventListener('click', e => { if (e.target === dlg) closeDlg(); });
    dlg.addEventListener('cancel', e => { e.preventDefault(); closeDlg(); });
  }

  // In-page jump bar: underline follows the section in view; on phones the active chip scrolls into sight.
  const jump = $('.jump');
  if (jump) {
    const links = new Map($$('a[href^="#"]', jump).map(a => [a.getAttribute('href').slice(1), a]));
    const strip = $('.jump-links', jump);
    const spy = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(a => a.classList.remove('is-active'));
      const a = links.get(en.target.id);
      if (!a) return;
      a.classList.add('is-active');
      if (strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: a.offsetLeft - 16, behavior: reduce.matches ? 'auto' : 'smooth' });
    }), { rootMargin: '-40% 0px -55% 0px' });
    links.forEach((a, id) => { const sec = document.getElementById(id); if (sec) spy.observe(sec); });
    // Shadow and CTA appear once the bar is stuck under the header.
    const sentinel = document.createElement('div');
    jump.before(sentinel);
    // The sentinel counts as gone once it slides under the sticky header, not the top of the window.
    const stickTop = parseFloat(getComputedStyle(jump).top) || 0;
    new IntersectionObserver(([en]) => jump.classList.toggle('is-stuck', !en.isIntersecting && en.boundingClientRect.top < stickTop + 1),
      { rootMargin: `-${stickTop + 1}px 0px 0px 0px` }).observe(sentinel);
  }

  // Floating WhatsApp (desktop) and the bottom action bar (phones) appear once the hero CTAs are gone,
  // and step aside while the closing form is on screen.
  const anchor = $('[data-wa-anchor]');
  const wa = $('.wa-float'), mbar = $('.mbar');
  if (anchor) {
    let pastHero = false, formInView = false;
    const sync = () => {
      wa?.classList.toggle('is-shown', pastHero && !formInView);
      mbar?.classList.toggle('is-shown', pastHero && !formInView);
    };
    new IntersectionObserver(([en]) => { pastHero = !en.isIntersecting && en.boundingClientRect.top < 0; sync(); }).observe(anchor);
    const form = $('#review');
    if (form) new IntersectionObserver(([en]) => { formInView = en.isIntersecting; sync(); }, { threshold: .2 }).observe(form);
  }
})();
