    // Utility: Fit font-size of a target element so its content fits within a container.
    // - Uses binary search for optimal px font size between min and max.
    // - Observes container resizes and target text mutations to refit automatically.
    // - Returns an object with refit(), disconnect() so you can control lifecycle.
(function exposeFitFont() {
  function debounce(fn, delay = 100) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  function setFontSizePx(el, px) {
    el.style.fontSize = Math.max(1, Math.floor(px)) + 'px';
  }

  function makeMeasureBox(container) {
    // Create an offscreen measurement box with same width as container content box
    const rect = container.getBoundingClientRect();
    const box = document.createElement('div');
    box.style.position = 'absolute';
    box.style.left = '-99999px';
    box.style.top = '0';
    box.style.width = Math.max(0, Math.floor(rect.width)) + 'px';
    box.style.pointerEvents = 'none';
    box.style.visibility = 'hidden';
    box.style.overflow = 'visible';
    document.body.appendChild(box);
    return box;
  }

  function cloneForMeasure(target, measureBox) {
    const clone = target.cloneNode(true);
    // Reset layout-affecting styles that could differ
    clone.style.margin = '0';
    clone.style.padding = '0';
    clone.style.border = '0';
    clone.style.whiteSpace = 'normal';
    clone.style.wordBreak = 'break-word';
    clone.style.overflow = 'visible';
    clone.style.display = 'block';
    clone.style.maxWidth = '100%';
    clone.style.width = '100%';
    measureBox.appendChild(clone);
    return clone;
  }

  function computeBestFontSize(target, container, minPx, maxPx) {
    // Guard: container must have size
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw <= 0 || ch <= 0) return minPx;

    const measureBox = makeMeasureBox(container);
    const probe = cloneForMeasure(target, measureBox);

    let lo = Math.max(1, Math.floor(minPx));
    let hi = Math.floor(maxPx);
    let best = lo;

    // Binary search using height overflow only; width is fixed by measureBox
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      setFontSizePx(probe, mid);
      // Force reflow
      const h = probe.scrollHeight;
      if (h <= ch) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    // Cleanup
    measureBox.remove();
    return best;
  }

  function fitFontToContainer(targetEl, containerEl, options = {}) {
    if (!targetEl || !containerEl) throw new Error('fitFontToContainer: target and container elements are required');

    const opts = Object.assign({
      minPx: 8,
      maxPx: 512,
      observeMutations: true,
      observeResize: true,
      debounceMs: 100,
      refitOnFontLoad: true
    }, options);

    let busy = false;
    const debounced = debounce(() => refit(), opts.debounceMs);

    function refit() {
      if (busy) return;
      busy = true;
      try {
        const best = computeBestFontSize(targetEl, containerEl, opts.minPx, opts.maxPx);
        setFontSizePx(targetEl, best);
        targetEl.dataset.fittedFontPx = String(best);
      } finally {
        busy = false;
      }
    }

    // Observers
    let ro, mo;
    if (opts.observeResize && 'ResizeObserver' in window) {
      ro = new ResizeObserver(debounced);
      ro.observe(containerEl);
    } else {
      window.addEventListener('resize', debounced);
    }

    if (opts.observeMutations && 'MutationObserver' in window) {
      mo = new MutationObserver(debounced);
      mo.observe(targetEl, { characterData: true, subtree: true, childList: true });
    }

    // Font load refit
    if (opts.refitOnFontLoad && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(debounced).catch(() => {});
    }

    // Initial fit after layout
    requestAnimationFrame(() => refit());

    return {
      refit,
      disconnect() {
        if (ro) ro.disconnect();
        if (mo) mo.disconnect();
        window.removeEventListener('resize', debounced);
      }
    };
  }

  window.fitFontToContainer = fitFontToContainer;
})();
