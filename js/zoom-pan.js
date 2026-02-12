$(function () {
  const cfg = window.FLIPBOOK_CONFIG.zoom;
  const $book = $("#book");
  const $viewport = $("#book-viewport");
  
  let zoomLevel = 1;
  let offsetX = 0, offsetY = 0;
  let isDragging = false;
  let startX = 0, startY = 0;
  let initialPinchDist = null, initialZoom = 1;

  window.isZoomed = () => zoomLevel > 1.05;

  function applyTransform(withTransition = false) {
    const zoomed = window.isZoomed();
    if ($book.data("done")) $book.turn("disable", zoomed);
    $viewport.css("touch-action", zoomed ? "none" : "pan-y");

    if (zoomed) {
      const bookW = $book.width() * zoomLevel, bookH = $book.height() * zoomLevel;
      const viewW = $viewport.width(), viewH = $viewport.height();
      const limitX = Math.max(0, (bookW - viewW) / 2) / zoomLevel;
      const limitY = Math.max(0, (bookH - viewH) / 2) / zoomLevel;
      offsetX = Math.max(-limitX, Math.min(limitX, offsetX));
      offsetY = Math.max(-limitY, Math.min(limitY, offsetY));
    } else {
      offsetX = 0; offsetY = 0;
    }
    
    const zoomIcon = zoomed ? "⟲" : "🔍"; 
    $("#btnZoomIn, #m-btnZoom").html(zoomIcon);

    $book.css({
      "transform": `scale(${zoomLevel}) translate(${offsetX}px, ${offsetY}px)`,
      "transition": (withTransition && !initialPinchDist) ? "transform 0.3s ease-out" : "none",
      "cursor": zoomed ? (isDragging ? "grabbing" : "grab") : "default"
    });
  }

  function resetZoom(withTransition = true) {
    zoomLevel = 1; offsetX = 0; offsetY = 0;
    applyTransform(withTransition);
  }

  $viewport.on("wheel", function (e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.originalEvent.deltaY > 0 ? -0.2 : 0.2;
      zoomLevel = Math.min(Math.max(1, zoomLevel + delta), cfg.max);
      applyTransform(true);
    } else if (!window.isZoomed()) {
        // 확대가 아닐 때만 휠로 페이지 이동
        if (e.originalEvent.deltaY > 0) $book.turn("next");
        else $book.turn("previous");
    }
  });

  $viewport.on("touchstart mousedown", (e) => {
    const touches = e.originalEvent.touches;
    if (touches && touches.length === 2) {
      isDragging = false;
      initialPinchDist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
      initialZoom = zoomLevel;
      return;
    }
    if (zoomLevel > 1) {
      const ev = touches ? touches[0] : e;
      isDragging = true;
      startX = ev.pageX - (offsetX * zoomLevel); 
      startY = ev.pageY - (offsetY * zoomLevel);
    }
  });

  document.getElementById('book-viewport').addEventListener('touchmove', (e) => {
    const touches = e.touches;
    if (touches.length === 2 && initialPinchDist) {
      e.preventDefault();
      const currentDist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
      zoomLevel = Math.min(Math.max(1, initialZoom * (currentDist / initialPinchDist)), cfg.max);
      applyTransform();
    } else if (zoomLevel > 1 && isDragging && touches.length === 1) {
      e.preventDefault();
      offsetX = (touches[0].pageX - startX) / zoomLevel; 
      offsetY = (touches[0].pageY - startY) / zoomLevel;
      applyTransform();
    }
  }, { passive: false });

  $(window).on("mousemove", (e) => {
    if (zoomLevel > 1 && isDragging && !e.originalEvent.touches) {
      offsetX = (e.pageX - startX) / zoomLevel; 
      offsetY = (e.pageY - startY) / zoomLevel;
      applyTransform();
    }
  }).on("mouseup touchend", () => {
    isDragging = false; initialPinchDist = null;
    if (zoomLevel < 1.05 && zoomLevel > 1) resetZoom(true);
  });

  $("#btnZoomIn, #m-btnZoom").on("click", e => {
    e.stopPropagation();
    if (zoomLevel > 1) resetZoom(true);
    else { zoomLevel = cfg.max; applyTransform(true); }
  });

  $viewport.on("dblclick", () => {
    if (zoomLevel > 1) resetZoom(true);
    else { zoomLevel = cfg.max; applyTransform(true); }
  });
});
