/** Shared foreground transitions for React previews and canonical public HTML. */
export function mountPortfolioScene(root, { animation = 'Fade', onActive = () => {} } = {}) {
  const scroller = root.querySelector('.profile-composition');
  const viewport = scroller && getComputedStyle(scroller).overflowY === 'auto' ? scroller : null;
  const sections = [...root.querySelectorAll('[data-portfolio-section]')];
  const images = [...root.querySelectorAll('.profile-project > img')];
  const failedImage = event => { event.currentTarget.style.display = 'none'; };
  images.forEach(image => { image.addEventListener('error', failedImage); if (image.complete && !image.naturalWidth) image.style.display = 'none'; });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const entriesByNode = new Map();
  let activeId = '';
  const groups = sections.flatMap(section => {
    const nodes = [...section.querySelectorAll('.portfolio-first-frame > .profile-header, .portfolio-first-frame > .profile-media-row, .portfolio-first-frame > .socials, .profile-first-identity > *, .portfolio-section-content > h2, .portfolio-section-content > section > *, .portfolio-showcase > *')];
    nodes.forEach((node, index) => {
      node.dataset.portfolioReveal = '';
      node.style.setProperty('--reveal-delay', `${Math.min(index, 4) * 75}ms`);
    });
    return nodes;
  });
  const update = () => {
    root.dataset.portfolioAnimation = reduced.matches ? 'None' : animation;
    let current = sections[0], best = -1;
    sections.forEach(section => {
      const entry = entriesByNode.get(section);
      if (!entry) return;
      const visible = entry.intersectionRect.height;
      const viewportHeight = entry.rootBounds?.height || innerHeight;
      const score = visible / Math.min(viewportHeight, entry.boundingClientRect.height || 1);
      if (score > best) { best = score; current = section; }
      const focused = section.contains(document.activeElement);
      section.dataset.portfolioPhase = focused || visible >= Math.min(viewportHeight, entry.boundingClientRect.height) * .12 ? 'visible' : entry.isIntersecting ? 'edge' : 'away';
    });
    const next = current?.dataset.portfolioSection || 'hero';
    if (next !== activeId) { activeId = next; onActive(next); }
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entriesByNode.set(entry.target, entry));
    update();
  }, { root: viewport, threshold: Array.from({ length: 41 }, (_, i) => i / 40) });
  sections.forEach(section => { section.dataset.portfolioPhase = "away"; observer.observe(section); });
  root.addEventListener('focusin', update);
  root.addEventListener('focusout', update);
  reduced.addEventListener('change', update);
  update();
  return () => {
    observer.disconnect();
    images.forEach(image => image.removeEventListener("error", failedImage));
    root.removeEventListener('focusin', update);
    root.removeEventListener('focusout', update);
    reduced.removeEventListener('change', update);
    delete root.dataset.portfolioAnimation;
    sections.forEach(section => delete section.dataset.portfolioPhase);
    groups.forEach(node => { delete node.dataset.portfolioReveal; node.style.removeProperty('--reveal-delay'); });
  };
}
