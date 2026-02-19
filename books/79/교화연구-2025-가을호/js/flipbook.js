$(function () {
  // 1. 설정 및 기본 변수 초기화
  const cfg = window.FLIPBOOK_CONFIG;
  const $book = $("#book");
  const $viewport = $("#book-viewport");
  const $footer = $("#ui-footer");
  
  const info = (cfg && cfg.bookInfo) ? cfg.bookInfo : { totalPages: 108, title: "플립북", imageType: "webp", thumbType: "webp" };
  const TOTAL_PAGES = parseInt(info.totalPages); 
  const imgExt = info.imageType;
  const thumbExt = info.thumbType;

  const $slider = $("#page-slider");
  const $track = $("#thumb-track");
  const $scrollbar = $("#thumb-scrollbar");
  const $scrollContainer = $("#thumb-scroll-container");
  const audio = document.getElementById("audio-flip");

  if (info.title) document.title = info.title;
  $slider.attr("max", TOTAL_PAGES);
  $(".total-pages-text").text(TOTAL_PAGES);

  let imgRatio = 1.414;
  let isSoundEnabled = true;
  let isAnimEnabled = true;
  let lastWidth = $(window).width();
  let resizeTimer;
  let hideTimer; // 자동 숨김을 위한 타이머 변수

  // --- 2. 핵심 기능 함수 ---

  // [추가] 푸터 자동 숨김 함수 (3초 설정)
  function startHideTimer() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      // 목차가 열려있거나 줌 상태일 때는 숨기지 않음 (방어 로직)
      if (!$("#thumb-panel").hasClass("open") && !(window.isZoomed && window.isZoomed())) {
        $footer.addClass("hidden");
      }
    }, 3000); 
  }

  function setScreenHeight() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  window.addEventListener('resize', setScreenHeight);
  window.addEventListener('orientationchange', setScreenHeight);
  setScreenHeight();

  function clearUnusedPages(currentPage) {
    const range = 10; 
    $(".page").each(function() {
      const pMatch = $(this).attr("class").match(/p(\d+)/);
      if (pMatch) {
        const pNum = parseInt(pMatch[1]);
        if (Math.abs(pNum - currentPage) > range) {
          $(this).empty(); 
          $(this).data("loaded", false);
        }
      }
    });
  }

  function loadPageImage(page) {
    if (!page || isNaN(page) || page < 1 || page > TOTAL_PAGES) return;
    setTimeout(() => {
      const $page = $book.find(".p" + page);
      if ($page.length && !$page.data("loaded")) {
        const num = String(page).padStart(3, "0");
        const imgUrl = `spreads/page-${num}.${imgExt}`;
        $page.html(`<img src="${imgUrl}" style="width:100%; height:100%; object-fit:contain; display:block;" />`);
        $page.data("loaded", true);
      }
    }, 1);
  }

  function getDisplayMode() {
    const windowWidth = $(window).width();
    const windowHeight = $(window).height();
    return (windowWidth >= 1024 || windowHeight <= windowWidth) ? "double" : "single";
  }

  function updateBookSize() {
    const currentWidth = $(window).width();
    if (Math.abs(currentWidth - lastWidth) < 10 && $book.data("done")) return;
    lastWidth = currentWidth;
    const vW = $viewport.width() * 0.94;
    const vH = $viewport.height() * 0.94;
    const mode = getDisplayMode();
    const targetRatio = (mode === "double") ? imgRatio * 2 : imgRatio;
    let w, h;
    if (vW / vH > targetRatio) { h = vH; w = h * targetRatio; }
    else { w = vW; h = w / targetRatio; }
    
    if ($book.data("done")) {
      if ($book.turn("display") !== mode) $book.turn("display", mode);
      $book.turn("size", Math.floor(w), Math.floor(h));
    } else {
      $book.css({ width: Math.floor(w), height: Math.floor(h) });
    }
  }

  function updateTooltip(page) {
    const $tooltip = $("#slider-tooltip");
    const val = parseInt(page);
    const percent = (val - 1) / (TOTAL_PAGES - 1); 
    $tooltip.text(val + "P").css("left", (percent * 100) + "%");
  }

  function buildThumbnails() {
    $track.empty();
    for (let i = 1; i <= TOTAL_PAGES; i += 2) {
      const nextP = (i + 1 <= TOTAL_PAGES) ? i + 1 : i;
      const label = (i === nextP) ? `${i}P` : `${i}-${nextP}`;
      const thumb = $(`
        <div class="thumb-item" data-page="${i}">
          <div class="thumb-img-container">
            <img src="thumbs/page-${String(i).padStart(3, '0')}.${thumbExt}" loading="lazy" />
            <div class="thumb-overlay">${label}</div>
          </div>
        </div>
      `);
      thumb.on("touchstart click", function(e) {
        e.stopPropagation();
        $book.turn("page", parseInt($(this).attr("data-page")));
        $("#thumb-panel").removeClass("open");
        startHideTimer(); // 페이지 이동 후 타이머 시작
      });
      $track.append(thumb);
    }
  }

  // --- 3. 초기화 및 Turn.js 설정 ---

  for (let i = 1; i <= TOTAL_PAGES; i++) { $book.append($('<div />', { class: 'page p' + i })); }
  
  const firstImg = new Image();
  firstImg.src = `spreads/page-001.${imgExt}`; 
  firstImg.onload = function() {
    imgRatio = firstImg.width / firstImg.height;
    updateBookSize();
    $book.turn({
      pages: TOTAL_PAGES,
      display: getDisplayMode(),
      duration: cfg.flip.duration,
      acceleration: true,
      gradients: true,
      elevation: 50,
      when: {
        missing: (e, pages) => pages.forEach(p => loadPageImage(p)),
        turning: (e, page, view) => {
          if (window.isZoomed && window.isZoomed()) e.preventDefault();
          view.forEach(p => loadPageImage(p));
        },
        turned: (e, page) => {
          clearUnusedPages(page); 
          $("#page-input, #page-slider").val(page); 
          $("#page-label-spread").text(page + " / " + TOTAL_PAGES);
          updateTooltip(page);

          // [핵심] 페이지 이동 시 푸터 노출 및 자동 숨김 타이머 작동
          $footer.removeClass("hidden");
          startHideTimer();

          const $thumbs = $(".thumb-item");
          $thumbs.removeClass("active");
          const spreadStart = (page % 2 === 0) ? page - 1 : page;
          const $activeThumb = $thumbs.filter(`[data-page="${spreadStart}"]`).addClass("active");

          if (isSoundEnabled && audio) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
          }

          if ($activeThumb.length) {
            const scrollPos = $activeThumb.position().left + $track.scrollLeft() - ($track.width() / 2) + ($activeThumb.width() / 2);
            $track.stop().animate({ scrollLeft: scrollPos }, {
              duration: 300,
              step: function() {
                const maxScroll = $track[0].scrollWidth - $track[0].clientWidth;
                const currentPercent = maxScroll > 0 ? $track.scrollLeft() / maxScroll : 0;
                const maxBarLeft = $scrollContainer.width() - $scrollbar.width();
                $scrollbar.css("left", (currentPercent * maxBarLeft) + "px");
              }
            });
          }
          const currentDuration = isAnimEnabled ? (cfg.flip.duration || 800) : 180;
          $book.turn("options", { duration: currentDuration });
        }
      }
    });
    $book.data("done", true);
    $("#loading-overlay").fadeOut(400);
    loadPageImage(1);
    buildThumbnails();
  };

  // --- 4. 이벤트 제어 ---

  // [핵심] 화면 중앙 터치 시 푸터 토글 로직
  $("#book-viewport").on("touchstart click", function(e) {
    if ((window.isZoomed && window.isZoomed()) || $("#thumb-panel").hasClass("open")) return;
    
    if ($footer.hasClass("hidden")) {
      $footer.removeClass("hidden");
      startHideTimer(); // 나타난 후 타이머 시작
    } else {
      $footer.addClass("hidden");
      clearTimeout(hideTimer); // 사라질 때 타이머 중지
    }
  });

  // 목차 외부 클릭 시 닫기
  $(document).on("touchstart click", function(e) {
    const $thumbPanel = $("#thumb-panel");
    const $thumbToggle = $("#thumb-toggle");
    if ($thumbPanel.hasClass("open")) {
      if (!$thumbPanel.is(e.target) && $thumbPanel.has(e.target).length === 0 &&
          !$thumbToggle.is(e.target) && $thumbToggle.has(e.target).length === 0) {
        $thumbPanel.removeClass("open");
        startHideTimer(); // 목차 닫히면 다시 타이머 작동
      }
    }
  });

  // UI 요소 조작 시 타이머 방어 및 충돌 방지
  const uiElements = "#ui-footer, #thumb-panel, #help-modal";
  $(uiElements).on("touchstart mousedown click", function(e) {
    e.stopPropagation();
    clearTimeout(hideTimer); // UI 조작 중에는 안 숨김
  });

  // UI 조작 끝나면 다시 타이머 시작
  $(uiElements).on("touchend mouseup", function() {
    startHideTimer();
  });

  const btnElements = "#btnPrev, #btnNext, #thumb-toggle, .util-btn, #page-slider, #page-input";
  $(btnElements).on("touchstart click", function(e) {
    if (e.type === 'touchstart') {
      $(this).data('touched', true);
    } else if (e.type === 'click' && $(this).data('touched')) {
      $(this).data('touched', false);
      e.preventDefault();
      return;
    }
  });

  // [추가] 입력창 클릭 시 숫자를 전체 선택하여 바로 수정 가능하게 함
  $("#page-input").on("focus", function() {
    $(this).select(); // 입력창에 포커스가 가면 텍스트 전체 선택
  });

  $("#page-input").on("keydown", function(e) {
    if (e.key === "Enter") {
        let page = parseInt($(this).val());
        const TOTAL_PAGES = parseInt($(".total-pages-text").first().text()) || 108;

        if (!isNaN(page) && page >= 1 && page <= TOTAL_PAGES) {
            $book.turn("page", page);
            $(this).blur(); // 키보드 닫기
            if (typeof startHideTimer === "function") startHideTimer();
        } else {
            alert("1쪽부터 " + TOTAL_PAGES + "쪽 사이의 숫자를 입력해 주세요.");
            $(this).val($book.turn("page"));
        }
    }
});

  $("#thumb-toggle").off("click touchstart").on("touchstart click", function(e) {
    e.preventDefault(); e.stopPropagation();
    const now = Date.now();
    if (now - ($(this).data('lastClick') || 0) < 300) return;
    $(this).data('lastClick', now);
    
    $("#thumb-panel").toggleClass("open");
    if (!$("#thumb-panel").hasClass("open")) startHideTimer();
  });

  $("#btnPrev").on("click", () => $book.turn("previous"));
  $("#btnNext").on("click", () => $book.turn("next"));
  $("#btnSound").on("click", function() { 
    isSoundEnabled = !isSoundEnabled; 
    $(this).text(isSoundEnabled ? "🔊" : "🔇"); 
  });
  $("#btnAnim").on("click", function() { 
    isAnimEnabled = !isAnimEnabled; 
    const targetDuration = isAnimEnabled ? (cfg.flip.duration || 800) : 180;
    $book.turn("options", { duration: targetDuration, gradients: isAnimEnabled }); 
    $(this).text(isAnimEnabled ? "✨" : "⚡");
  });

  $("#btnHelp").on("click", () => $("#help-modal").addClass("open"));
  $("#btnCloseHelp, #help-modal").on("click", function(e) {
    if (e.target !== this && e.target.id !== "btnCloseHelp") return;
    $("#help-modal").removeClass("open");
    startHideTimer();
  });

  // --- 5. 드래그 및 리사이즈 ---

  $slider.on("input", function() { 
    $("#slider-tooltip").addClass("show"); 
    updateTooltip($(this).val()); 
  });
  
  $slider.on("change", function() { 
    $book.turn("page", $(this).val()); 
    setTimeout(() => $("#slider-tooltip").removeClass("show"), 1000); 
  });

  let isBarDragging = false;
  let barStartX;

  $scrollbar.on("mousedown touchstart", function(e) {
    isBarDragging = true;
    const clientX = (e.pageX || (e.originalEvent.touches ? e.originalEvent.touches[0].pageX : 0));
    barStartX = clientX - $scrollbar.position().left;
    $scrollbar.addClass("dragging");
    e.preventDefault();
  });

  $(window).on("mousemove touchmove", function(e) {
    if (!isBarDragging) return;
    const clientX = (e.pageX || (e.originalEvent.touches ? e.originalEvent.touches[0].pageX : 0));
    let moveX = clientX - barStartX;
    const maxLeft = $scrollContainer.width() - $scrollbar.width();
    moveX = Math.max(0, Math.min(maxLeft, moveX));
    $scrollbar.css("left", moveX + "px");
    const scrollPercent = moveX / maxLeft;
    const targetScroll = scrollPercent * ($track[0].scrollWidth - $track[0].clientWidth);
    $track.scrollLeft(targetScroll);
  });

  $(window).on("mouseup touchend", function() {
    isBarDragging = false;
    $scrollbar.removeClass("dragging");
  });

  // [추가] 키보드 방향키 제어
  $(window).on("keydown", function(e) {
    // 입력창(input)에 포커스가 있는 경우에는 페이지가 넘어가지 않도록 방어 로직 추가
    if ($("input").is(":focus")) return;

    if (e.key === "ArrowLeft") {
      $book.turn("previous");
    } else if (e.key === "ArrowRight") {
      $book.turn("next");
    }
  });

  $viewport.on("wheel", function(e) {
    if (window.isZoomed && window.isZoomed()) return;
    if (e.originalEvent.deltaY > 0) $book.turn("next");
    else $book.turn("previous");
    e.preventDefault();
  });
// [추가] 키보드 단축키 통합 제어
  $(window).on("keydown", function(e) {
    // 입력창(input)에 포커스가 있는 경우에는 동작 방지
    if ($("input").is(":focus")) return;

    switch (e.key) {
      case "ArrowLeft":
        $book.turn("previous");
        break;
      case "ArrowRight":
      case " ": // Space바
        e.preventDefault(); // 스페이스바의 기본 스크롤 동작 방지
        $book.turn("next");
        break;
      case "Home":
        e.preventDefault();
        $book.turn("page", 1);
        break;
      case "End":
        e.preventDefault();
        $book.turn("page", TOTAL_PAGES);
        break;
    }
  });
  // 도움말 버튼 이벤트 수정
$("#btnHelp").on("click", function() {
  const winWidth = $(window).width();
  const $helpModal = $("#help-modal");
  
  // 초소형 화면일 경우 특정 섹션 숨기기 또는 요약된 내용 보여주기
  if (winWidth <= 365) {
      $helpModal.find(".pc-only-help").hide(); // PC 설명 숨김
      $helpModal.find(".info-box").hide();    // 팁 박스 숨김 (공간 확보)
      $helpModal.find("h2").text("📱 이용 안내");
  } else {
      $helpModal.find(".pc-only-help").show();
      $helpModal.find(".info-box").show();
      $helpModal.find("h2").text("📖 플립북 이용 안내");
  }

  $helpModal.addClass("open");
});
  $(window).on("resize", function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateBookSize, 200);
  });
});