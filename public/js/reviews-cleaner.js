/**
 * Palletvoid — Horizontal Swipable Google Reviews Controller
 * Powers smooth navigation buttons, touch swipe, and mouse drag-to-scroll
 */
(function() {
  'use strict';

  // Expose global review scroller for navigation buttons
  window.scrollReviews = function(direction) {
    var track = document.getElementById('pv-reviews-track');
    if (!track) {
      track = document.querySelector('.pv-reviews-horizontal-track');
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
      track.classList.add('is-dragging');
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
    });

    track.addEventListener('mouseleave', function() {
      isDown = false;
      track.classList.remove('is-dragging');
    });

    track.addEventListener('mouseup', function() {
      isDown = false;
      track.classList.remove('is-dragging');
    });

    track.addEventListener('mousemove', function(e) {
      if (!isDown) return;
      e.preventDefault();
      var x = e.pageX - track.offsetLeft;
      var walk = (x - startX) * 1.5;
      track.scrollLeft = scrollLeft - walk;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDragScroll);
  } else {
    initDragScroll();
  }
  window.addEventListener('load', initDragScroll);
})();
