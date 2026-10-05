/* Stone Decor — interactions & animations */
(function () {
  const doc = document.documentElement;
  doc.classList.add('js');

  const header = document.querySelector('.site-header');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header shadow on scroll ---------- */
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const toggle = document.querySelector('.menu-toggle');
  const setMenu = (open) => {
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setMenu(!header.classList.contains('menu-open')));
  document.querySelectorAll('.main-nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

  /* ---------- Search panel ---------- */
  const searchPanel = document.querySelector('.search-panel');
  const searchInput = searchPanel.querySelector('input');
  const setSearch = (open) => {
    header.classList.toggle('search-open', open);
    searchPanel.setAttribute('aria-hidden', String(!open));
    if (open) setTimeout(() => searchInput.focus(), 200);
  };
  document.querySelector('.search-btn').addEventListener('click', () => setSearch(!header.classList.contains('search-open')));
  searchPanel.querySelector('.search-close').addEventListener('click', () => setSearch(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setSearch(false); setMenu(false); } });

  /* ---------- Active nav link by section ---------- */
  const links = [...document.querySelectorAll('.main-nav a:not(.btn)')]
    .filter((l) => l.getAttribute('href').startsWith('#')); // only on-page anchors (home page)
  const sections = links
    .map((l) => document.querySelector(l.getAttribute('href') === '#top' ? '.hero' : l.getAttribute('href')))
    .filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const idx = sections.indexOf(entry.target);
      links.forEach((l, i) => l.classList.toggle('active', i === idx));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in-view'));
  }

  /* ---------- Hero parallax ---------- */
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg && !reduceMotion) {
    heroBg.addEventListener('animationend', () => heroBg.classList.add('settled'));
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, window.innerHeight);
        heroBg.style.setProperty('--parallax', (y * 0.18).toFixed(1) + 'px');
        ticking = false;
      });
    }, { passive: true });
  }
  /* ---------- Contact section: image wipe-in ---------- */
  const contactMedia = document.querySelector('.contact-media');
  if (contactMedia) {
    if ('IntersectionObserver' in window && !reduceMotion) {
      const mo = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { contactMedia.classList.add('in-view'); mo.disconnect(); }
      }, { threshold: 0.2 });
      mo.observe(contactMedia.parentElement); // observe the section: a fully clipped element never reports as intersecting
    } else contactMedia.classList.add('in-view');
  }

  /* ---------- Contact form ---------- */
  const form = document.getElementById('contact-form');
  if (form) {
    const status = form.querySelector('.form-status');
    const select = form.querySelector('select');
    const syncSelect = () => select.classList.toggle('has-value', !!select.value);
    select.addEventListener('change', syncSelect);
    syncSelect();

    form.querySelectorAll('input, textarea').forEach((el) =>
      el.addEventListener('input', () => el.closest('.field').classList.remove('invalid')));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let firstBad = null;
      form.querySelectorAll('[required]').forEach((el) => {
        const field = el.closest('.field');
        field.classList.remove('invalid');
        if (!el.value.trim() || (el.type === 'email' && !el.checkValidity())) {
          void field.offsetWidth; // restart shake animation
          field.classList.add('invalid');
          firstBad = firstBad || el;
        }
      });
      if (firstBad) {
        status.className = 'form-status err';
        status.textContent = 'Please fill in the required fields marked with *.';
        firstBad.focus();
        return;
      }

      const d = Object.fromEntries(new FormData(form));
      const name = `${d.firstName} ${d.lastName}`.trim();
      const subject = `Website enquiry${d.projectType ? ' – ' + d.projectType : ''} – ${name}`;
      const body = [
        `Name: ${name}`,
        `Email: ${d.email}`,
        d.phone ? `Phone: ${d.phone}` : '',
        d.projectType ? `Project type: ${d.projectType}` : '',
        '',
        d.message,
      ].filter((l, i) => l !== '' || i === 4).join('\n');

      window.location.href = `mailto:info@stonedecor.net?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.className = 'form-status ok';
      status.textContent = 'Thank you! Your email app is opening with your message ready to send.';
      form.reset();
      syncSelect();
    });
  }
  /* ---------- Footer ---------- */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const footer = document.querySelector('.site-footer');
  if (footer) {
    if ('IntersectionObserver' in window && !reduceMotion) {
      const fo = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { footer.classList.add('in-view'); fo.disconnect(); }
      }, { threshold: 0.15 });
      fo.observe(footer);
    } else footer.classList.add('in-view');
  }

  const news = document.getElementById('news-form');
  if (news) {
    const input = news.querySelector('input');
    const nStatus = document.querySelector('.news-status');
    news.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.value.trim() || !input.checkValidity()) {
        news.classList.remove('invalid'); void news.offsetWidth; news.classList.add('invalid');
        nStatus.textContent = 'Please enter a valid email address.';
        input.focus();
        return;
      }
      const body = `Please add ${input.value.trim()} to the Stone Decor newsletter.`;
      window.location.href = `mailto:info@stonedecor.net?subject=${encodeURIComponent('Newsletter sign-up')}&body=${encodeURIComponent(body)}`;
      nStatus.textContent = 'Thanks! Your email app is opening to confirm your sign-up.';
      news.reset();
    });
  }
  /* ---------- Legal pages: table-of-contents highlight ---------- */
  const tocLinks = [...document.querySelectorAll('.legal-toc a')];
  if (tocLinks.length) {
    const map = new Map(tocLinks.map((a) => [document.querySelector(a.getAttribute('href')), a]));
    const tocObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        tocLinks.forEach((a) => a.classList.remove('active'));
        map.get(entry.target)?.classList.add('active');
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    map.forEach((_, sec) => sec && tocObs.observe(sec));
  }
  /* ---------- Scroll-to-top button (added on every page) ---------- */
  const toTop = document.createElement('button');
  toTop.type = 'button';
  toTop.className = 'to-top';
  toTop.setAttribute('aria-label', 'Scroll to top');
  toTop.innerHTML =
    '<svg class="to-top-ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="ring-track" cx="32" cy="32" r="30"/><circle class="ring-fill" cx="32" cy="32" r="30" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg>' +
    '<svg class="to-top-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  document.body.appendChild(toTop);
  const ring = toTop.querySelector('.ring-fill');

  let topTicking = false;
  const updateToTop = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    ring.setAttribute('stroke-dashoffset', String(100 - pct * 100));
    toTop.classList.toggle('show', window.scrollY > 500);
    topTicking = false;
  };
  window.addEventListener('scroll', () => {
    if (!topTicking) { topTicking = true; requestAnimationFrame(updateToTop); }
  }, { passive: true });
  window.addEventListener('resize', updateToTop);
  updateToTop();

  toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    const target = document.querySelector('.logo');
    if (target) setTimeout(() => target.focus({ preventScroll: true }), reduceMotion ? 0 : 600);
  });
})();
