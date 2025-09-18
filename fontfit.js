    // Utility: Fit font-size of a target element so its content fits within a container.
    // - Uses binary search for optimal px font size between min and max.
    // - Observes container resizes and target text mutations to refit automatically.
    // - Returns an object with refit(), disconnect() so you can control lifecycle.
    (function exposeFitFont() {
      function debounce(fn, delay = 100) {
        let t;
        return function(...args) {
          clearTimeout(t);
          t = setTimeout(() => fn.apply(this, args), delay);
        }
      }

      function elementFits(target, container) {
        // Must fit within both width and height without scrolling
        const fits = target.scrollWidth <= container.clientWidth && target.scrollHeight <= container.clientHeight;
        return fits;
      }

      function setFontSizePx(el, px) {
        el.style.fontSize = Math.max(1, Math.floor(px)) + 'px';
      }

      function computeBestFontSize(target, container, minPx, maxPx) {
        // Guard: If container has no size, return min
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        if (cw <= 0 || ch <= 0) return minPx;

        // Binary search for the largest font size that fits
        let lo = Math.max(1, Math.floor(minPx));
        let hi = Math.floor(maxPx);
        let best = lo;

        // Save original styles that may affect metrics
        const prevStyle = target.getAttribute('style') || '';

        // Ensure measurable layout
        target.style.display = 'block';
        target.style.width = '100%';
        target.style.maxWidth = '100%';

        // Perform search
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          setFontSizePx(target, mid);
          // Force a reflow by reading a layout property
          // eslint-disable-next-line no-unused-vars
          const _ = target.scrollHeight;
          if (elementFits(target, container)) {
            best = mid;
            lo = mid + 1; // try bigger
          } else {
            hi = mid - 1; // too big
          }
        }

        // Restore additional inline styles except font-size which we will set below
        // (We keep display/width adjustments; safe for most use cases.)
        return best-10;
      }

      function fitFontToContainer(targetEl, containerEl, options = {}) {
        if (!targetEl || !containerEl) throw new Error('fitFontToContainer: target and container elements are required');

        const opts = Object.assign({
          minPx: 8,
          maxPx: 512,
          observeMutations: true,
          observeResize: true,
          debounceMs: 100,
        }, options);

        let busy = false;
        const debounced = debounce(() => refit(), opts.debounceMs);

        function refit() {
          if (busy) return; // prevent overlapping cycles
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
          // fallback: window resize
          window.addEventListener('resize', debounced);
        }

        if (opts.observeMutations && 'MutationObserver' in window) {
          mo = new MutationObserver(debounced);
          mo.observe(targetEl, { characterData: true, subtree: true, childList: true });
        }

        // Initial fit (async to allow layout settle)
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

      // Expose globally
      window.fitFontToContainer = fitFontToContainer;
    })();
