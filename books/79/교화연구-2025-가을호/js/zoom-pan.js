$(function () {
  const cfg = window.FLIPBOOK_CONFIG.zoom;
  const $book = $("#book");
  const $viewport = $("#book-viewport");
  
  let zoomLevel = 1, offsetX = 0, offsetY = 0;
  let isDragging = false, startX = 0, startY = 0;
  let initialPinchDist = null;
  let initialZoom = 1; // 핀치 시작 시점의 배율 저장

  // 더블 탭 정밀 판정 변수
  let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
  let touchMoved = false; 
  let touchStartX = 0, touchStartY = 0;

  window.isZoomed = () => zoomLevel > 1;

  function applyTransform() {
    const isZoomed = zoomLevel > 1;
    // 확대 중에는 turn.js의 페이지 넘김 기능을 끔
    $book.turn("disable", isZoomed);
    
    // 확대 상태에서만 터치 액션을 비활성화하여 기본 브라우저 줌과 충돌 방지
    $viewport.css("touch-action", isZoomed ? "none" : "pan-y");

    if (isZoomed) {
      // [정밀 경계선 가이드라인]
      // 확대된 책의 크기와 현재 뷰포트 크기를 비교하여 이동 범위를 계산합니다.
      const bookW = $book.width() * zoomLevel;
      const bookH = $book.height() * zoomLevel;
      const viewW = $viewport.width();
      const viewH = $viewport.height();

      // 책이 화면보다 클 때만 이동 허용 (여백 방지)
      const limitX = Math.max(0, (bookW - viewW) / 2);
      const limitY = Math.max(0, (bookH - viewH) / 2);

      offsetX = Math.max(-limitX, Math.min(limitX, offsetX));
      offsetY = Math.max(-limitY, Math.min(limitY, offsetY));
    } else {
      offsetX = 0; offsetY = 0;
    }
    
    $book.css({
      "transform": `translate(${offsetX}px, ${offsetY}px) scale(${zoomLevel})`,
      "transition": (isDragging || initialPinchDist) ? "none" : "transform 0.3s ease-out",
      "cursor": isZoomed ? (isDragging ? "grabbing" : "grab") : "default"
    });
  }

  // [터치/마우스 시작]
  $viewport.on("touchstart mousedown", (e) => {
    const touches = e.originalEvent.touches;
    const ev = touches ? touches[0] : e;

    touchStartX = ev.pageX;
    touchStartY = ev.pageY;
    touchMoved = false;

    // 1. 핀치 줌 초기화 (손가락 2개)
    if (touches && touches.length === 2) {
      isDragging = false; 
      initialPinchDist = Math.hypot(
        touches[0].pageX - touches[1].pageX,
        touches[0].pageY - touches[1].pageY
      );
      initialZoom = zoomLevel; // 현재 배율 기준점 고정
      return;
    }

    // 2. 드래그 초기화
    if (zoomLevel > 1) {
      isDragging = true;
      startX = ev.pageX - offsetX; 
      startY = ev.pageY - offsetY;
    }
  });

  // [터치/마우스 이동]
  $(window).on("touchmove mousemove", (e) => {
    const isZoomed = zoomLevel > 1;
    if (!isZoomed && !initialPinchDist) {return;}
    const touches = e.originalEvent.touches;
    const ev = touches ? touches[0] : e;

    if (Math.hypot(ev.pageX - touchStartX, ev.pageY - touchStartY) > 5) {
      touchMoved = true; 
    }

    // 1. 부드러운 핀치 줌 실행
    if (touches && touches.length === 2 && initialPinchDist) {
      const currentDist = Math.hypot(
        touches[0].pageX - touches[1].pageX,
        touches[0].pageY - touches[1].pageY
      );
      const zoomFactor = currentDist / initialPinchDist;
      zoomLevel = Math.min(Math.max(1, initialZoom * zoomFactor), cfg.max);
      applyTransform();
      if (e.cancelable) e.preventDefault();
      return;
    }

    // 2. 화면 이동 (경계선 제한 적용)
    if (isZoomed && isDragging && (!touches || touches.length === 1)) {
      offsetX = ev.pageX - startX; 
      offsetY = ev.pageY - startY;
      applyTransform();
      if (e.cancelable) e.preventDefault();
    }
  });

  // [터치/마우스 종료]
  $(window).on("touchend mouseup", (e) => {
    if (touchMoved) {
      isDragging = false;
      initialPinchDist = null;
      return;
    }

    // 더블 탭 로직
    const now = Date.now();
    const ev = e.originalEvent.changedTouches ? e.originalEvent.changedTouches[0] : e;
    const dist = Math.hypot(ev.pageX - lastTapX, ev.pageY - lastTapY);
    const timeDiff = now - lastTapTime;

    if (timeDiff > 30 && timeDiff < 300 && dist < 20) {
      if (zoomLevel > 1) {
        zoomLevel = 1; offsetX = 0; offsetY = 0;
      } else {
        zoomLevel = cfg.max;

// 2. 탭한 지점(ev.pageX, ev.pageY)을 중심으로 위치 계산
    // 뷰포트 중앙 좌표
    const viewCenterX = $viewport.width() / 2;
    const viewCenterY = $viewport.height() / 2;

    // 중앙에서 탭 지점까지의 거리에 비례하여 오프셋 설정
    offsetX = (viewCenterX - ev.pageX) * (zoomLevel - 1);
    offsetY = (viewCenterY - ev.pageY) * (zoomLevel - 1);

      }
      applyTransform();
      lastTapTime = 0; 
    } else {
      lastTapTime = now;
      lastTapX = ev.pageX;
      lastTapY = ev.pageY;
    }

    isDragging = false;
    initialPinchDist = null;
  });

  // 버튼 컨트롤
  $("#btnZoomOut").on("click", () => { zoomLevel = 1; applyTransform(); });
  $("#btnZoomIn").on("click", () => { zoomLevel = Math.min(zoomLevel + 0.5, cfg.max); applyTransform(); });
});