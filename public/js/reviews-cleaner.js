/**
 * Palletvoid — Google Reviews Widget Sanitizer & Cleaner
 * Removes SociableKIT promotional links/branding without affecting customer reviews
 */
(function() {
  'use strict';

  var hideBrandingCSS = [
    '.sk_branding,',
    '.tutorial_link,',
    '.--custom-branding,',
    'a[href*="sociablekit.com"],',
    'a[href*="sociablekit"] {',
    '  display: none !important;',
    '  visibility: hidden !important;',
    '  height: 0 !important;',
    '  max-height: 0 !important;',
    '  overflow: hidden !important;',
    '  margin: 0 !important;',
    '  padding: 0 !important;',
    '  opacity: 0 !important;',
    '  pointer-events: none !important;',
    '  font-size: 0 !important;',
    '  line-height: 0 !important;',
    '}'
  ].join('\n');

  function cleanBranding() {
    // 1. Process regular DOM
    document.querySelectorAll('.sk_branding, .tutorial_link, .--custom-branding, a[href*="sociablekit"]').forEach(function(el) {
      try { el.remove(); } catch (e) { el.style.display = 'none'; }
    });

    document.querySelectorAll('.pv-google-reviews-wrap a, .sk-ww-google-reviews a').forEach(function(a) {
      var text = (a.textContent || '').trim();
      if (/Embed Google Reviews|SociableKIT/i.test(text) || (a.href && a.href.indexOf('sociablekit.com') !== -1)) {
        var parent = a.closest('.sk_branding') || a;
        try { parent.remove(); } catch (e) { parent.style.display = 'none'; }
      }
    });

    // 2. Process Shadow DOM if attached by SociableKIT
    var widget = document.querySelector('.sk-ww-google-reviews');
    if (widget && widget.shadowRoot) {
      var root = widget.shadowRoot;

      // Inject style into shadow root to immediately prevent branding display
      if (!root.querySelector('#pv-sk-hide-style')) {
        var style = document.createElement('style');
        style.id = 'pv-sk-hide-style';
        style.textContent = hideBrandingCSS;
        root.prepend(style);
      }

      // Remove branding elements and links from shadow root
      root.querySelectorAll('.sk_branding, .tutorial_link, .--custom-branding, a[href*="sociablekit"]').forEach(function(el) {
        try { el.remove(); } catch (e) { el.style.display = 'none'; }
      });

      root.querySelectorAll('a').forEach(function(a) {
        var text = (a.textContent || '').trim();
        if (/Embed Google Reviews|SociableKIT/i.test(text) || (a.href && a.href.indexOf('sociablekit.com') !== -1)) {
          var parent = a.closest('.sk_branding') || a;
          try { parent.remove(); } catch (e) { parent.style.display = 'none'; }
        }
      });

      // Observe shadow root mutations
      if (!root._pvObserved) {
        root._pvObserved = true;
        var shadowObserver = new MutationObserver(cleanBranding);
        shadowObserver.observe(root, { childList: true, subtree: true });
      }
    }
  }

  // Expose global review scroller for navigation buttons
  window.scrollReviews = function(direction) {
    var track = document.getElementById('pv-reviews-track');
    if (!track) {
      track = document.querySelector('.pv-reviews-horizontal-track') || document.querySelector('.pv-google-reviews-wrap');
    }
    if (track) {
      var scrollAmount = (track.clientWidth > 600 ? 340 : 290) * direction;
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Enable drag-to-scroll on desktop mouse devices for natural swiping
  function initDragScroll() {
    var track = document.getElementById('pv-reviews-track');
    if (!track || track._pvDragInit) return;
    track._pvDragInit = true;

    var isDown = false;
    var startX;
    var scrollLeft;

    track.addEventListener('mousedown', function(e) {
      isDown = true;
      track.style.cursor = 'grabbing';
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
    });

    track.addEventListener('mouseleave', function() {
      isDown = false;
      track.style.cursor = 'grab';
    });

    track.addEventListener('mouseup', function() {
      isDown = false;
      track.style.cursor = 'grab';
    });

    track.addEventListener('mousemove', function(e) {
      if (!isDown) return;
      e.preventDefault();
      var x = e.pageX - track.offsetLeft;
      var walk = (x - startX) * 1.5;
      track.scrollLeft = scrollLeft - walk;
    });
  }

  // Initial sweeps
  cleanBranding();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      cleanBranding();
      initDragScroll();
    });
  } else {
    initDragScroll();
  }
  window.addEventListener('load', function() {
    cleanBranding();
    initDragScroll();
  });

  // Periodic sweep for first 8 seconds while widget finishes hydration
  var sweeps = 0;
  var interval = setInterval(function() {
    cleanBranding();
    initDragScroll();
    sweeps++;
    if (sweeps > 40) clearInterval(interval);
  }, 200);

  // MutationObserver on container
  var container = document.querySelector('.pv-google-reviews-wrap');
  if (container) {
    var observer = new MutationObserver(cleanBranding);
    observer.observe(container, { childList: true, subtree: true });
  }
})();

