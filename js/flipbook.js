$(function () {
  // 1. 초기 설정 및 변수 선언
  const cfg = window.FLIPBOOK_CONFIG;
  const info = cfg.bookInfo;
  const $book = $("#book");
  const $viewport = $("#book-viewport");
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  const $slider = $("#page-slider");
  const $tooltip = $("#slider-tooltip");
  const $label = $("#page-label-spread");
  const $track = $("#thumb-track");
  const $scrollbar = $("#thumb-scrollbar");
  const $scrollContainer = $("#thumb-scroll-container");

  let isSoundEnabled = true;
  let isAnimEnabled = true;
  let imgRatio = 1.414;
  let resizeTimer;
  let isBarDragging = false;
  let barStartX;
  let uiHideTimer;

  function toggleSound(enabled) {
    isSoundEnabled = (enabled !== undefined) ? enabled : !isSoundEnabled;
    const icon = isSoundEnabled ? "🔊" : "🔇";
    $("#btnSound, #m-btnSound").text(icon);
  }

  // 기본 동작 방지
  $(document).on('dragstart', 'img', e => e.preventDefault());
  $track.on('contextmenu', e => e.preventDefault());

  if (info.title) document.title = info.title;
  $slider.attr("max", info.totalPages);

  // 2. 모바일 UI 토글 및 전체화면 로직
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;

  $viewport.on("touchstart", function (e) {
    const touch = e.originalEvent.touches[0];
    touchStartX = touch.pageX;
    touchStartY = touch.pageY;
    touchStartTime = Date.now();
    if ($(e.target).closest("button, .slider-container, #thumb-panel").length) {
      clearTimeout(uiHideTimer);
    }
  });

  $viewport.on("touchend", function (e) {
    const touch = e.originalEvent.changedTouches[0];
    const distX = Math.abs(touch.pageX - touchStartX);
    const distY = Math.abs(touch.pageY - touchStartY);
    const duration = Date.now() - touchStartTime;

    // 단순 클릭(탭) 판단
    if (distX < 10 && distY < 10 && duration < 300) {
      if (window.isZoomed && window.isZoomed()) return;
      if ($(e.target).closest("#mobile-header, button, #thumb-panel, .modal-content, .slider-container").length) return;

      if (isMobile) {
        const $mobileUI = $("#mobile-header, #ui-footer");
        const isActive = $mobileUI.hasClass("active");

        if (isActive) {
          $mobileUI.removeClass("active");
          $("#thumb-panel").removeClass("open");
          clearTimeout(uiHideTimer);
        } else {
          $mobileUI.addClass("active");
          clearTimeout(uiHideTimer);
          uiHideTimer = setTimeout(() => {
            if (!$("#thumb-panel").hasClass("open")) $mobileUI.removeClass("active");
          }, 5000);
        }
      }
    }
  });

  // 3. 기능 함수
  function updateTopProgressBar(page) {
    const total = info.totalPages;
    const percent = ((page - 1) / (total - 1)) * 100;
    $("#top-progress-fill").css("width", percent + "%");
  }

  function loadPageImage(page) {
    if (page < 1 || page > info.totalPages) return;
    const $page = $book.find(".p" + page);
    if ($page.length && !$page.data("loaded")) {
      const num = String(page).padStart(3, "0");
      const imgUrl = `${info.basePath}page-${num}.${info.imageType}`;
      const img = new Image();
      img.src = imgUrl;
      $(img).css({ width: "100%", height: "100%", objectFit: "contain", opacity: "0", transition: "opacity 0.3s" });
      img.onload = function() {
        $page.empty().append(img);
        setTimeout(() => img.style.opacity = "1", 10);
        $page.data("loaded", true);
      };
    }
  }

// [교정] updateBookSize 함수 내부 로직 수정
function updateBookSize() {
  // 뷰포트 크기를 기준으로 하되, UI 영역을 제외한 가용 높이 계산
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const vW = winW * 0.92; // 좌우 4%씩 여유
  const vH = winH - (isMobile ? 120 : 160); // 모바일/PC UI 높이 제외
  
  const isDouble = winW >= 1024 || winW > winH;
  const mode = isDouble ? "double" : "single";
  const targetRatio = isDouble ? imgRatio * 2 : imgRatio;

  let w, h;
  if (vW / vH > targetRatio) {
      h = vH; w = h * targetRatio;
  } else {
      w = vW; h = w / targetRatio;
  }

  const finalW = Math.floor(w);
  const finalH = Math.floor(h);

  if ($book.data("done")) {
      if ($book.turn("display") !== mode) $book.turn("display", mode);
      $book.turn("size", finalW, finalH);
      
      // 중앙 정렬 좌표 강제 적용
      $book.css({
          marginLeft: -(finalW / 2) + "px",
          marginTop: -(finalH / 2) + "px"
      });
      $book.turn("center");
  } else {
      $book.css({ width: finalW, height: finalH });
  }
}

  function buildThumbnails() {
    $track.empty();
    for (let i = 1; i <= info.totalPages; i += 2) {
      const label = (i + 1 <= info.totalPages) ? `${i}-${i + 1}` : `${i}`;
      const thumb = $(`
        <div class="thumb-item" data-page="${i}">
          <div class="thumb-img-container">
            <img src="${info.thumbPath}page-${String(i).padStart(3, '0')}.${info.thumbType}" loading="lazy" />
            <div class="thumb-overlay">${label}P</div>
          </div>
        </div>`);
      thumb.on("click", (e) => {
        e.stopPropagation();
        $book.turn("page", i);
        if (isMobile) $("#thumb-panel").removeClass("open");
      });
      $track.append(thumb);
    }
    setTimeout(updateScrollbarPosition, 500);
  }

  function syncThumbnailScroll() {
    const page = $book.turn("page");
    const spreadStart = (page % 2 === 0) ? page - 1 : page;
    const $activeThumb = $(`.thumb-item[data-page="${spreadStart}"]`);
    if ($activeThumb.length) {
      $(".thumb-item").removeClass("active");
      $activeThumb.addClass("active");
      const scrollPos = $activeThumb.position().left + $track.scrollLeft() - ($track.width() / 2) + ($activeThumb.width() / 2);
      $track.stop().animate({ scrollLeft: scrollPos }, 300);
    }
  }

  function updateScrollbarPosition() {
    const maxScroll = $track[0].scrollWidth - $track[0].clientWidth;
    if (maxScroll <= 0) { $scrollbar.hide(); return; }
    $scrollbar.show();
    const currentPercent = $track.scrollLeft() / maxScroll;
    const maxBarLeft = $scrollContainer.width() - $scrollbar.width();
    $scrollbar.css("left", (currentPercent * maxBarLeft) + "px");
  }

  function toggleFullScreen() {
    const doc = document.documentElement;
    const isFS = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
    if (!isFS) {
      if (doc.requestFullscreen) doc.requestFullscreen();
      else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen();
      else if (doc.msRequestFullscreen) doc.msRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
    }
  }

  function handleFSChange() {
    const isFS = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
    $("#m-btnFull").text(isFS ? "❌" : "⛶");
    setTimeout(updateBookSize, 200);
  }

  // 4. 초기화
  for (let i = 1; i <= info.totalPages; i++) $book.append($('<div />', { class: 'page p' + i }));

  const coverImg = new Image();
  coverImg.src = `${info.basePath}page-001.${info.imageType}`;
  coverImg.onload = function () {
    imgRatio = coverImg.width / coverImg.height;
    updateBookSize();

    $book.turn({
      pages: info.totalPages,
      elevation: cfg.flip.elevation,
      duration: cfg.flip.duration,
      gradients: cfg.flip.gradients,
      autoCenter: cfg.flip.autoCenter,
      acceleration: !isMobile,
      when: {
        turning: (e, page, view) => {
          if (window.isZoomed && window.isZoomed()) { e.preventDefault(); return; }
          view.forEach(p => loadPageImage(p));
        },
        turned: (e, page, view) => {
          view.forEach(p => { if (p > 0) loadPageImage(p); });
          for(let i = page - 2; i <= page + 2; i++) if(i > 0 && i <= info.totalPages) loadPageImage(i);
          
          $label.text(`${page} / ${info.totalPages}`);
          $("#m-page-label").text(`${page} / ${info.totalPages}`);
          $slider.val(page);
          syncThumbnailScroll();

          if (isSoundEnabled) {
            const audio = document.getElementById("audio-flip");
            if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
          }
          updateTopProgressBar(page);
        }
      }
    });

    $book.data("done", true);
    $("#loading-overlay").fadeOut(300);
    [1, 2, 3].forEach(p => loadPageImage(p));
    buildThumbnails();
    setTimeout(() => $book.turn("center"), 100);
  };

  // 5. 이벤트 핸들러
  $("#btnSound, #m-btnSound").on("click", e => { e.stopPropagation(); toggleSound(); });
  $("#btnAnim").on("click", function(e) {
    e.stopPropagation();
    isAnimEnabled = !isAnimEnabled;
    $(this).text(isAnimEnabled ? "✨" : "⚡");
    $book.turn("options", { duration: isAnimEnabled ? cfg.flip.duration : 200, gradients: isAnimEnabled });
  });
  $("#m-btnFull").on("click", e => { e.stopPropagation(); toggleFullScreen(); });
  document.addEventListener("fullscreenchange", handleFSChange);
  document.addEventListener("webkitfullscreenchange", handleFSChange);
  
  $("#m-btnHelp, #btnHelp").on("click", e => { e.stopPropagation(); $("#help-modal").addClass("open"); });
  $("#btnCloseHelp, .modal-overlay").on("click", e => { if (e.target.id === "btnCloseHelp" || $(e.target).hasClass("modal-overlay")) $(".modal-overlay").removeClass("open"); });

  $("#thumb-toggle, #m-btnThumb").on("click", e => { e.stopPropagation(); $("#thumb-panel").toggleClass("open"); });
  $("#btnPrev").on("click", () => $book.turn("previous"));
  $("#btnNext").on("click", () => $book.turn("next"));

  $slider.on("input", function () {
    const val = $(this).val();
    $tooltip.text(val + "P").css("left", (val / info.totalPages * 100) + "%").addClass("show");
  }).on("change", function () {
    $book.turn("page", $(this).val());
    setTimeout(() => $tooltip.removeClass("show"), 500);
  });

  $track.on("scroll", updateScrollbarPosition);
  $scrollbar.on("mousedown", function(e) {
    isBarDragging = true;
    barStartX = e.pageX - $scrollbar.position().left;
    $("body").addClass("dragging");
    e.preventDefault();
  });

  $(document).on("mousemove", function(e) {
    if (!isBarDragging) return;
    const containerWidth = $scrollContainer.width(), barWidth = $scrollbar.width();
    let newLeft = Math.max(0, Math.min(e.pageX - barStartX, containerWidth - barWidth));
    $scrollbar.css("left", newLeft + "px");
    const scrollPercent = newLeft / (containerWidth - barWidth);
    $track.scrollLeft(scrollPercent * ($track[0].scrollWidth - $track[0].clientWidth));
  }).on("mouseup", () => { isBarDragging = false; $("body").removeClass("dragging"); });

  $(window).on("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateBookSize, 150);
  });

  $(document).on("keydown", (e) => {
    if ((window.isZoomed && window.isZoomed()) || e.target.tagName === "INPUT") return;
    if (e.keyCode === 37) $book.turn("previous");
    else if (e.keyCode === 39) $book.turn("next");
  });
});
