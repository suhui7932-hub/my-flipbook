$(function () {
  // ==========================================================================
  // 1. 초기 설정 및 변수 선언
  // ==========================================================================
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
  let uiHideTimer; // 타이머 변수 선언

  // flipbook.js 상단 변수 선언부 근처에 추가
  function toggleSound(enabled) {
    isSoundEnabled = (enabled !== undefined) ? enabled : !isSoundEnabled;
    const icon = isSoundEnabled ? "🔊" : "🔇";
    $("#btnSound, #m-btnSound").text(icon);
  }
  // 이미지 및 링크 드래그 기본 동작 방지
    $(document).on('dragstart', 'img', function(event) {
        event.preventDefault();
    });

    // (선택 사항) 섬네일 트랙 내에서 우클릭 방지하고 싶을 경우
    $track.on('contextmenu', function(e) { e.preventDefault(); });
  if (info.title) document.title = info.title;
  $slider.attr("max", info.totalPages);

  // ==========================================================================
  // 2. 모바일 UI 토글 로직 (터치 반응성 및 스와이프 구분 강화)
  // ==========================================================================
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  $viewport.on("touchstart", function (e) {
      const touch = e.originalEvent.touches[0];
      touchStartX = touch.pageX;
      touchStartY = touch.pageY;
      touchStartTime = Date.now();
      
      // 슬라이더나 버튼 조작 시 자동 숨김 타이머 중단
      if ($(e.target).closest("button, .slider-container, #thumb-panel").length) {
          clearTimeout(uiHideTimer);
      }
  });

  $viewport.on("touchend", function (e) {
      const touch = e.originalEvent.changedTouches[0];
      const distX = Math.abs(touch.pageX - touchStartX);
      const distY = Math.abs(touch.pageY - touchStartY);
      const duration = Date.now() - touchStartTime;

      // 1. 단순 클릭(탭) 판단 조건: 
      // 움직임이 적고(10px 미만), 터치 시간이 짧을 때(300ms 미만)
      if (distX < 10 && distY < 10 && duration < 300) {
          
          // 확대 중이거나 UI 요소를 직접 클릭했을 때는 무시
          if (window.isZoomed && window.isZoomed()) return;
          if ($(e.target).closest("#mobile-header, button, #thumb-panel, .modal-content, .slider-container").length) return;

          if (isMobile) {
              const $mobileUI = $("#mobile-header, #ui-footer");
              const isActive = $mobileUI.hasClass("active");

              if (isActive) {
                  // 닫기 로직
                  $mobileUI.removeClass("active");
                  $("#thumb-panel").removeClass("open");
                  clearTimeout(uiHideTimer);
              } else {
                  // 열기 로직
                  $mobileUI.addClass("active");
                  
                  // 열린 후 다시 자동 숨김 타이머 작동 (선택 사항)
                  clearTimeout(uiHideTimer);
                  uiHideTimer = setTimeout(() => {
                      if (!$("#thumb-panel").hasClass("open")) {
                          $mobileUI.removeClass("active");
                      }
                  }, 5000); // 5초 후 자동 숨김
              }
          }
      }
  });

  // 슬라이더 조작 시 부모 뷰포트로 이벤트 전달 방지 (기존 유지)
  $slider.on("mousedown touchstart", function(e) {
      e.stopPropagation();
      clearTimeout(uiHideTimer); 
  });

  // 페이지 이동 후 자동 숨김 로직 (사용자 편의에 따라 유지 또는 삭제 가능)
  $book.bind("turned", function(event, page, view) {
    if (isMobile && $(".mobile-ui").hasClass("active")) {
        clearTimeout(uiHideTimer); // [추가] 타이머 중복 실행 방지
        uiHideTimer = setTimeout(() => {
            // 목차 패널이 열려있지 않을 때만 자동으로 숨김
            if (!$("#thumb-panel").hasClass("open")) {
                $(".mobile-ui, #ui-footer").removeClass("active");
                $("#thumb-panel").removeClass("open");
            }
        }, 3000); 
    }
    // ... (상단 진행바 업데이트 등 기존 로직 유지)
  });
// 페이지 이동 시 상단 진행바 업데이트 함수
function updateTopProgressBar(page) {
    const total = window.FLIPBOOK_CONFIG.bookInfo.totalPages;
    // 첫 페이지는 0%, 마지막 페이지는 100%가 되도록 계산
    const percent = ((page - 1) / (total - 1)) * 100;
    $("#top-progress-fill").css("width", percent + "%");
}
  // ==========================================================================
  // 3. 기능 함수
  // ==========================================================================
function loadPageImage(page) {
    if (page < 1 || page > info.totalPages) return;
    const $page = $book.find(".p" + page);
    if ($page.length && !$page.data("loaded")) {
        const num = String(page).padStart(3, "0");
        const imgUrl = `${info.basePath}page-${num}.${info.imageType}`;
        
        // 미리 로드 후 투명하게 나타나게 하면 더 부드럽습니다.
        const img = new Image();
        img.src = imgUrl;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        img.style.opacity = "0"; // 초기 투명
        img.style.transition = "opacity 0.3s";

        img.onload = function() {
            $page.empty().append(img);
            img.style.opacity = "1"; // 로드 완료 시 표시
            $page.data("loaded", true);
        };
    }
}
$('img').on('dragstart', function() { return false; });

function updateBookSize() {
  const vW = $viewport.width();
  const vH = $viewport.height();
  // Safari 및 삼성 인터넷의 가변 UI를 대응하기 위해 inner 수치 활용
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  
  // [1] 모바일 1페이지 고정 로직 강화
  // 스마트폰(isMobile)이거나 화면이 세로로 길면(winW < winH) 무조건 1페이지(single)
  // 가로 모드이면서 폭이 충분히 넓은(1100px 이상) 태블릿/PC 환경에서만 2페이지
  let mode = "single";
  if (winW > winH && winW >= 1100) {
      mode = "double";
  } else {
      mode = "single"; // 세로 모드 및 일반 스마트폰은 무조건 1페이지
  }

  const isDouble = (mode === "double");
  const targetRatio = isDouble ? imgRatio * 2 : imgRatio;

  // [2] 여백 설정: 모바일일 때는 화면 끝까지 꽉 차게(0.99)
  const paddingFactor = (winW < winH) ? 0.99 : 0.94; 
  const viewW = vW * paddingFactor;
  const viewH = vH * paddingFactor;

  let w, h;
  if (viewW / viewH > targetRatio) {
      h = viewH; w = h * targetRatio;
  } else {
      w = viewW; h = w / targetRatio;
  }

  const finalW = Math.floor(w);
  const finalH = Math.floor(h);

  // [3] turn.js 적용 및 물리적 중앙 정렬 강제 (삼성/사파리 공통)
  if ($book.data("done")) {
      if ($book.turn("display") !== mode) {
          $book.turn("display", mode);
      }
      $book.turn("size", finalW, finalH);
      
      // CSS를 이용해 화면 정중앙에 강제 배치
      $book.css({
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: -(finalW / 2) + 'px',
          marginTop: -(finalH / 2) + 'px',
          transition: 'none'
      });
      
      $book.turn("center"); 
  } else {
      $book.css({
          width: finalW, height: finalH,
          position: 'absolute', left: '50%', top: '50%',
          marginLeft: -(finalW / 2) + 'px', marginTop: -(finalH / 2) + 'px'
      });
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
    setTimeout(() => {
      const scrollWidth = $track[0].scrollWidth;
      const visibleWidth = $track.outerWidth();
      if (scrollWidth > visibleWidth) {
        let barWidth = (visibleWidth / scrollWidth) * $scrollContainer.width();
        $scrollbar.css("width", Math.max(30, barWidth) + "px").show();
      } else {
        $scrollbar.hide();
      }
    }, 500);
  }

  function syncThumbnailScroll() {
    const page = $book.turn("page");
    const spreadStart = (page % 2 === 0) ? page - 1 : page;
    const $activeThumb = $(`.thumb-item[data-page="${spreadStart}"]`);
    if ($activeThumb.length) {
      $(".thumb-item").removeClass("active");
      $activeThumb.addClass("active");
      const scrollPos = $activeThumb.position().left + $track.scrollLeft() - ($track.width() / 2) + ($activeThumb.width() / 2);
      $track.stop().animate({ scrollLeft: scrollPos }, {
        duration: 300, step: updateScrollbarPosition
      });
    }
  }

  function updateScrollbarPosition() {
    if (isMobile) return;
    const maxScroll = $track[0].scrollWidth - $track[0].clientWidth;
    if (maxScroll <= 0) return;
    const currentPercent = $track.scrollLeft() / maxScroll;
    const maxBarLeft = $scrollContainer.width() - $scrollbar.width();
    $scrollbar.css("left", (currentPercent * maxBarLeft) + "px");
  }

  // ==========================================================================
  // 4. 플립북 초기화 및 로드
  // ==========================================================================
  for (let i = 1; i <= info.totalPages; i++) {
    $book.append($('<div />', { class: 'page p' + i }));
  }

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
        // 페이지가 넘어가는 중일 때
        turning: (e, page, view) => {
            if (window.isZoomed && window.isZoomed()) { 
                e.preventDefault(); 
                return; 
            }
            // 현재 전환되는 페이지들 미리 로드
            view.forEach(p => loadPageImage(p));
        },
        // 페이지 이동이 완료되었을 때
        turned: (e, page, view) => {
            // [중요] 점프 이동 시 누락된 이미지를 확실히 로드하기 위해 view 활용
            clearTimeout(uiHideTimer);
            view.forEach(p => {
                if (p > 0) loadPageImage(p); 
            });

            // UI 업데이트 (라벨 및 슬라이더)
            $label.text(`${page} / ${info.totalPages}`);
            $("#m-page-label").text(`${page} / ${info.totalPages}`);
            $slider.val(page);
            
            // 목차 스크롤 동기화
            syncThumbnailScroll();

            // 효과음 재생
            if (isSoundEnabled) {
                const audio = document.getElementById("audio-flip");
                if (audio) { 
                    audio.currentTime = 0; 
                    audio.play().catch(() => {}); 
                }
            }
            updateTopProgressBar(page); // 상단 진행바 업데이트 호출
        }
    }
});

// 초기 배치 안정화를 위한 센터링
setTimeout(() => { 
    $book.turn("center"); 
}, 100);

    $("#m-btnHelp").on("click", function(e) {
        e.stopPropagation();
        $("#help-modal").addClass("open");
    });

    $("#m-btnThumb").on("click", function(e) {
        e.stopPropagation();
        $("#thumb-panel").toggleClass("open");
    });

    $book.data("done", true);
    $("#loading-overlay").fadeOut(300);
    [1, 2, 3].forEach(p => loadPageImage(p));
    buildThumbnails();
  };

  // ==========================================================================
  // 5. 공통 UI 핸들러
  // ==========================================================================
// 이 코드 하나로 PC와 모바일 소리 버튼을 모두 제어합니다.
  $("#btnSound, #m-btnSound").on("click", function(e) {
    e.stopPropagation();
    toggleSound();
  });
  $("#btnAnim").on("click", function (e) {
    e.stopPropagation();
    isAnimEnabled = !isAnimEnabled;
    $(this).text(isAnimEnabled ? "✨" : "⚡");
    $book.turn("options", { 
        duration: isAnimEnabled ? cfg.flip.duration : 200, gradients: isAnimEnabled
    });
  });

  $("#thumb-toggle").on("click", (e) => {
    e.stopPropagation();
    $("#thumb-panel").toggleClass("open");
  });

  $("#btnPrev").on("click", () => $book.turn("previous"));
  $("#btnNext").on("click", () => $book.turn("next"));

  $("#btnHelp").on("click", () => $("#help-modal").addClass("open"));
  $("#btnCloseHelp, .modal-overlay").on("click", (e) => {
    if (e.target.id === "btnCloseHelp" || $(e.target).hasClass("modal-overlay")) {
      $(".modal-overlay").removeClass("open");
    }
  });

  $slider.on("input", function () {
    const val = $(this).val();
    $tooltip.text(val + "P").css("left", (val / info.totalPages * 100) + "%").addClass("show");
  }).on("change", function () {
    $book.turn("page", $(this).val());
    setTimeout(() => $tooltip.removeClass("show"), 500);
  });

  $viewport.on("wheel", function (e) {
    if (window.isZoomed && window.isZoomed()) return;
    if (e.originalEvent.deltaY > 0) $book.turn("next");
    else $book.turn("previous");
    e.preventDefault();
  });

  $(document).on("keydown", (e) => {
    if (window.isZoomed && window.isZoomed() || e.target.tagName === "INPUT") return;
    switch (e.keyCode) {
      case 37: $book.turn("previous"); break;
      case 39: $book.turn("next"); break;
      case 38: $book.turn("page", 1); break;
      case 40: $book.turn("page", info.totalPages); break;
    }
  });

  // 섬네일 드래그 로직 생략 (기존 코드 유지)
  // ==========================================================================
  // 6. 섬네일 드래그 및 스크롤 로직
  // ==========================================================================
  
  // 트랙 자체의 스크롤 변화 감지하여 커스텀 스크롤바 위치 동기화
  $track.on("scroll", updateScrollbarPosition);

  // 스크롤바 드래그 로직 (PC)
  $scrollbar.on("mousedown", function(e) {
      isBarDragging = true;
      barStartX = e.pageX - $scrollbar.position().left;
      $("body").addClass("dragging"); // 드래그 중 커서 유지용
      e.preventDefault();
  });

  $(document).on("mousemove", function(e) {
      if (!isBarDragging) return;
      
      const containerWidth = $scrollContainer.width();
      const barWidth = $scrollbar.width();
      let newLeft = e.pageX - barStartX;
      
      // 범위 제한
      newLeft = Math.max(0, Math.min(newLeft, containerWidth - barWidth));
      $scrollbar.css("left", newLeft + "px");
      
      // 트랙 스크롤 연동
      const scrollPercent = newLeft / (containerWidth - barWidth);
      const scrollTarget = scrollPercent * ($track[0].scrollWidth - $track[0].clientWidth);
      $track.scrollLeft(scrollTarget);
  }).on("mouseup", function() {
      if (isBarDragging) {
          isBarDragging = false;
          $("body").removeClass("dragging");
      }
  });

  // 터치 스크롤 지원 (모바일)
  $track.on("touchstart", function() {
      clearTimeout(uiHideTimer); // 스크롤 중에는 UI 숨기기 방지
  });
  $(window).on("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateBookSize, 150);
  });
});
