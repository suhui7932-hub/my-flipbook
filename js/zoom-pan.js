$(function () {
  const cfg = window.FLIPBOOK_CONFIG.zoom;
  const $book = $("#book");
  const $viewport = $("#book-viewport");
  
  let zoomLevel = 1;
  let offsetX = 0, offsetY = 0;
  let isDragging = false;
  let startX = 0, startY = 0;
  let initialPinchDist = null;
  let initialZoom = 1;

  // 확대 상태를 전역에서 참조 가능하게 함
  window.isZoomed = () => zoomLevel > 1;

  /**
   * 화면 변환 적용 함수
   * @param {boolean} withTransition 애니메이션 효과 여부
   */
function applyTransform(withTransition = false) {
    const zoomed = zoomLevel > 1;
    
    if ($book.data("done")) {
        $book.turn("disable", zoomed);
    }
    
    $viewport.css("touch-action", zoomed ? "none" : "pan-y");

    if (zoomed) {
        const bookW = $book.width() * zoomLevel;
        const bookH = $book.height() * zoomLevel;
        const viewW = $viewport.width();
        const viewH = $viewport.height();

        const limitX = Math.max(0, (bookW - viewW) / 2) / zoomLevel;
        const limitY = Math.max(0, (bookH - viewH) / 2) / zoomLevel;

        offsetX = Math.max(-limitX, Math.min(limitX, offsetX));
        offsetY = Math.max(-limitY, Math.min(limitY, offsetY));
    } else {
        offsetX = 0; 
        offsetY = 0;
    }
    
    // --- 아이콘 및 텍스트 토글 로직 추가 ---
    const zoomIcon = zoomed ? "⟲" : "🔍"; 
    const zoomText = zoomed ? "축소" : "확대";
    $("#btnZoomIn, #m-btnZoom").html(zoomIcon).attr("title", zoomText);
    // ------------------------------------

    $book.css({
        "transform": `scale(${zoomLevel}) translate(${offsetX}px, ${offsetY}px)`,
        "transition": (withTransition && !initialPinchDist) ? "transform 0.3s ease-out" : "none",
        "will-change": zoomed ? "transform" : "auto",
        "cursor": zoomed ? (isDragging ? "grabbing" : "grab") : "default"
    });
}
  /**
   * 확대/축소 초기화 함수
   */
  function resetZoom(withTransition = true) {
    zoomLevel = 1;
    offsetX = 0;
    offsetY = 0;
    applyTransform(withTransition);
  }

  // [터치/마우스 시작]
  $viewport.on("touchstart mousedown", (e) => {
    const touches = e.originalEvent.touches;
    const ev = touches ? touches[0] : e;

    // 1. 핀치 줌 초기화 (손가락 2개)
    if (touches && touches.length === 2) {
      isDragging = false; 
      initialPinchDist = Math.hypot(
        touches[0].pageX - touches[1].pageX,
        touches[0].pageY - touches[1].pageY
      );
      initialZoom = zoomLevel; 
      return;
    }

    // 2. 드래그 초기화 (확대된 상태에서 손가락 1개 또는 마우스)
    if (zoomLevel > 1) {
      isDragging = true;
      startX = ev.pageX - (offsetX * zoomLevel); 
      startY = ev.pageY - (offsetY * zoomLevel);
    }
  });

// 기존 $(window).on("touchmove mousemove", ...) 코드를 아래로 교체
const viewport = document.getElementById('book-viewport');

// 1. 모바일 터치 이동 및 핀치 줌 처리 (네이티브)
viewport.addEventListener('touchmove', (e) => {
    const touches = e.touches;
    
    // 확대 상태이거나 손가락이 2개일 때 브라우저 스크롤 간섭 차단
    if (window.isZoomed() || (touches && touches.length === 2)) {
        if (e.cancelable) e.preventDefault(); 
    }

    const ev = touches[0];

    // 핀치 줌 로직
    if (touches.length === 2 && initialPinchDist) {
        const currentDist = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
        );
        const zoomFactor = currentDist / initialPinchDist;
        zoomLevel = Math.min(Math.max(1, initialZoom * zoomFactor), cfg.max);
        applyTransform();
        return;
    }

    // 드래그 이동 로직
    if (zoomLevel > 1 && isDragging && touches.length === 1) {
        offsetX = (ev.pageX - startX) / zoomLevel; 
        offsetY = (ev.pageY - startY) / zoomLevel;
        applyTransform();
    }
}, { passive: false });

// 2. PC 마우스 이동 처리 (기존 jQuery 유지)
$(window).on("mousemove", (e) => {
    if (zoomLevel > 1 && isDragging && !e.originalEvent.touches) {
        offsetX = (e.pageX - startX) / zoomLevel; 
        offsetY = (e.pageY - startY) / zoomLevel;
        applyTransform();
    }
});

  // [터치/마우스 종료]
  $(window).on("touchend mouseup", () => {
    isDragging = false;
    initialPinchDist = null;
    
    // 배율이 1에 너무 가까우면 자동 초기화
    if (zoomLevel < 1.05 && zoomLevel > 1) {
        resetZoom(true);
    }
  });

  // [PC 더블 클릭]
  $viewport.on("dblclick", (e) => {
    if (zoomLevel > 1) {
      resetZoom(true);
    } else {
      zoomLevel = cfg.max || 2.5;
      applyTransform(true);
    }
  });

  // 하단 툴바의 버튼 컨트롤 연결
  $("#btnZoomIn").on("click", function(e) {
    e.stopPropagation();
    zoomLevel = Math.min(zoomLevel + (cfg.step || 0.5), cfg.max);
    applyTransform(true);
  });

  // 돋보기 버튼을 한 번 더 누르거나 초기화가 필요할 때 사용 (확대/축소 토글 방식용)
  $("#btnZoomOut").on("click", function(e) {
    e.stopPropagation();
    resetZoom(true);
  });

  // 리사이즈 시 초기화 (레이아웃 깨짐 방지)
  $(window).on("resize", () => {
    resetZoom(false);
  });
});