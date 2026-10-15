/**
 * Palletvoid Global Animated Page Transitions
 * Handles:
 * 1. Initial Visit & Refresh entrance reveal
 * 2. Page Exit (smooth logo overlay animation before navigation)
 * 3. Page Arrival (smooth reveal of newly loaded content)
 * 4. Browser Back/Forward (pageshow / bfcache) protection
 * 5. prefers-reduced-motion accessibility
 */
(function() {
  'use strict';

  function getPreloader() {
    return document.getElementById('pv-page-preloader');
  }

  function hidePreloader() {
    var preloader = getPreloader();
    if (!preloader) return;
    preloader.classList.remove('pv-preloader-entering');
    preloader.classList.add('pv-preloader-hidden');
    preloader.setAttribute('aria-hidden', 'true');
  }

  function showPreloader() {
    var preloader = getPreloader();
    if (!preloader) return;
    preloader.classList.remove('pv-preloader-hidden');
    preloader.classList.add('pv-preloader-entering');
    preloader.setAttribute('aria-hidden', 'false');
  }

  // 1. Initial Visit & Refresh: smooth reveal once document is ready
  if (document.readyState === 'complete') {
    // Already loaded
    setTimeout(hidePreloader, 150);
  } else {
    window.addEventListener('load', function() {
      // Small pause to allow styles and fonts to paint seamlessly
      setTimeout(hidePreloader, 200);
    });
  }

  // Safety fallback: Never keep screen blocked if an asset hangs
  setTimeout(hidePreloader, 2500);

  // 2. bfcache / Back & Forward button handling
  window.addEventListener('pageshow', function(event) {
    hidePreloader();
  });

  // 3. Page Exit: Intercept internal navigation clicks
  document.addEventListener('click', function(e) {
    // Find closest <a> tag
    var link = e.target.closest('a');
    if (!link) return;

    var href = link.getAttribute('href');
    if (!href) return;

    // Ignore special links
    if (
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:') ||
      link.hasAttribute('download') ||
      link.getAttribute('target') === '_blank' ||
      e.ctrlKey || e.metaKey || e.shiftKey || e.altKey ||
      e.defaultPrevented
    ) {
      return;
    }

    // Check if internal domain
    try {
      var url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) {
        // External link - let browser handle normally
        return;
      }

      // If same page anchor navigation
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) {
        return;
      }

      // Check prefers-reduced-motion
      var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var transitionDuration = prefersReducedMotion ? 60 : 380;

      // Intercept and animate exit
      e.preventDefault();
      showPreloader();

      setTimeout(function() {
        window.location.href = link.href;
      }, transitionDuration);
    } catch (err) {
      // Fallback: normal browser navigation
    }
  });

  // 4. Mobile Menu Drawer Interactivity
  function initMobileMenu() {
    var menuBtn = document.getElementById('pv-mobile-menu-btn');
    var nav = document.getElementById('pv-nav');
    if (!menuBtn || !nav) return;

    menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var expanded = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', !expanded);
      menuBtn.classList.toggle('active');
      nav.classList.toggle('active');
      document.body.classList.toggle('pv-menu-open');
    });

    // Close when clicking any nav link
    nav.querySelectorAll('.pv-nav-link').forEach(function(link) {
      link.addEventListener('click', function() {
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.classList.remove('active');
        nav.classList.remove('active');
        document.body.classList.remove('pv-menu-open');
      });
    });

    // Close when clicking outside
    document.addEventListener('click', function(e) {
      if (!nav.contains(e.target) && !menuBtn.contains(e.target) && nav.classList.contains('active')) {
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.classList.remove('active');
        nav.classList.remove('active');
        document.body.classList.remove('pv-menu-open');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
  } else {
    initMobileMenu();
  }

  // Expose global helpers if needed
  window.PVTransition = {
    show: showPreloader,
    hide: hidePreloader
  };
})();
