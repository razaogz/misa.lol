(function () {
  "use strict";

  var wall = document.getElementById("wall");
  if (!wall) return;

  var mobile = window.matchMedia("(max-width: 640px)");
  var status = document.getElementById("wall-status");
  var activeIndex = 0;
  var dragStart = null;
  var dragging = false;
  var suppressClick = false;

  // ── theme/carousel sync ──────────────────────────────────
  // Wall cards carry the same data-set-theme values as the theme
  // swatches, so selector and carousel stay matched through that
  // shared data — never by hardcoded indexes.
  function themeOfItem(item) {
    return item.getAttribute("data-set-theme");
  }

  function indexOfTheme(theme) {
    var list = items();
    for (var i = 0; i < list.length; i++) {
      if (themeOfItem(list[i]) === theme) return i;
    }
    return -1;
  }

  function heroTheme() {
    var phone = document.getElementById("hero-phone");
    return phone ? phone.dataset.theme : null;
  }

  function applyTheme(theme) {
    // Reuse the existing selector: clicking its swatch runs v2's own
    // handler (themePicked + setTheme + radio sync + explore link).
    var sw = document.querySelector('.swatches [data-set-theme="' + theme + '"]');
    if (sw) sw.click();
  }

  // Move a card to the front (the CSS 3D transition animates the
  // custom properties, same as swiping) and select its theme, so
  // the displayed phone and the selected theme can never mismatch.
  function goTo(index, announce) {
    var list = items();
    if (!list.length) return;
    activeIndex = ((index % list.length) + list.length) % list.length;
    update(announce);
    if (mobile.matches) {
      var theme = themeOfItem(list[activeIndex]);
      if (theme && theme !== heroTheme()) applyTheme(theme);
    }
  }

  // Bring the card matching the currently selected theme to front.
  function syncToTheme(announce) {
    if (!mobile.matches) return;
    var i = indexOfTheme(heroTheme());
    if (i >= 0 && i !== activeIndex) {
      activeIndex = i;
      update(announce);
    }
  }

  function items() {
    return Array.prototype.slice.call(wall.querySelectorAll(".wall__item"));
  }

  function circularOffset(index, count) {
    var offset = index - activeIndex;
    if (offset > count / 2) offset -= count;
    if (offset < -count / 2) offset += count;
    return offset;
  }

  function setStatus(list, announce) {
    if (!status || !list.length || !mobile.matches) return;
    var label = list[activeIndex].getAttribute("aria-label") || "Example page";
    status.textContent = (announce ? "Showing " : "") + (activeIndex + 1) + " of " + list.length + ": " + label;
  }

  function update(announce) {
    var list = items();
    if (activeIndex >= list.length) activeIndex = 0;
    wall.classList.toggle("is-carousel", mobile.matches);

    if (!mobile.matches) {
      wall.removeAttribute("aria-roledescription");
      wall.removeAttribute("aria-describedby");
      wall.style.removeProperty("--drag-x");
      list.forEach(function (item) {
        ["--cx", "--cy", "--cz", "--cry", "--cs", "--co", "--cz-index"].forEach(function (property) {
          item.style.removeProperty(property);
        });
        item.classList.remove("is-carousel-active");
        item.removeAttribute("aria-hidden");
        item.tabIndex = 0;
      });
      return;
    }

    wall.setAttribute("aria-roledescription", "carousel");
    wall.setAttribute("aria-describedby", "wall-hint");

    list.forEach(function (item, index) {
      var offset = circularOffset(index, list.length);
      var distance = Math.abs(offset);
      var direction = offset < 0 ? -1 : 1;
      var x = 0;
      var z = -440;
      var rotate = 0;
      var scale = .52;
      var opacity = 0;
      var layer = 0;

      if (distance === 0) {
        z = 90;
        scale = 1;
        opacity = 1;
        layer = 5;
      } else if (distance === 1) {
        x = direction * 148;
        z = -170;
        rotate = direction * -58;
        scale = .82;
        opacity = .62;
        layer = 4;
      } else if (distance === 2) {
        x = direction * 72;
        z = -350;
        rotate = direction * -76;
        scale = .65;
        opacity = .18;
        layer = 2;
      }

      item.style.setProperty("--cx", x + "px");
      item.style.setProperty("--cy", distance === 1 ? "9px" : "0px");
      item.style.setProperty("--cz", z + "px");
      item.style.setProperty("--cry", rotate + "deg");
      item.style.setProperty("--cs", String(scale));
      item.style.setProperty("--co", String(opacity));
      item.style.setProperty("--cz-index", String(layer));

      var isActive = distance === 0;
      item.classList.toggle("is-carousel-active", isActive);
      item.tabIndex = isActive ? 0 : -1;
      if (isActive) item.removeAttribute("aria-hidden");
      else item.setAttribute("aria-hidden", "true");
    });

    setStatus(list, announce);
  }

  function orbit(step, announce) {
    goTo(activeIndex + step, announce);
  }

  wall.addEventListener("click", function (event) {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  }, true);

  // Tapping a card brings it to the front with the same 3D motion.
  // (The card's own handler applies its theme first, and goTo
  // re-selects the front card's theme, so the two always match.)
  // After a real drag the capture listener above swallows the click.
  wall.addEventListener("click", function (event) {
    if (!mobile.matches) return;
    var target = event.target;
    var item = target && target.closest ? target.closest(".wall__item") : null;
    if (!item || !wall.contains(item)) return;
    var index = items().indexOf(item);
    if (index >= 0 && index !== activeIndex) goTo(index, true);
  });

  wall.addEventListener("keydown", function (event) {
    if (!mobile.matches || !/^(ArrowLeft|ArrowRight|Home|End)$/.test(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") goTo(0, true);
    else if (event.key === "End") goTo(items().length - 1, true);
    else goTo(activeIndex + (event.key === "ArrowRight" ? 1 : -1), true);
    var active = wall.querySelector(".is-carousel-active");
    if (active) active.focus();
  });

  wall.addEventListener("pointerdown", function (event) {
    if (!mobile.matches || event.button !== 0) return;
    dragStart = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
    dragging = false;
  });

  wall.addEventListener("pointermove", function (event) {
    if (!dragStart || event.pointerId !== dragStart.id) return;
    var dx = event.clientX - dragStart.x;
    var dy = event.clientY - dragStart.y;

    if (!dragging) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        dragStart = null;
        return;
      }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
      dragging = true;
      wall.classList.add("is-dragging");
      try { wall.setPointerCapture(event.pointerId); } catch (_) {}
    }

    event.preventDefault();
    wall.style.setProperty("--drag-x", Math.max(-76, Math.min(76, dx * .38)) + "px");
  }, { passive: false });

  function finishDrag(event, cancelled) {
    if (!dragStart || event.pointerId !== dragStart.id) return;
    var dx = event.clientX - dragStart.x;
    var elapsed = Math.max(1, performance.now() - dragStart.time);
    var wasDragging = dragging;
    dragStart = null;
    dragging = false;
    wall.classList.remove("is-dragging");
    wall.style.removeProperty("--drag-x");
    if (!wasDragging) return;

    if (!cancelled && (Math.abs(dx) > 42 || Math.abs(dx) / elapsed > .45)) orbit(dx < 0 ? 1 : -1, true);
    else update(false);

    suppressClick = true;
    window.setTimeout(function () { suppressClick = false; }, 900);
  }

  wall.addEventListener("pointerup", function (event) { finishDrag(event, false); });
  wall.addEventListener("pointercancel", function (event) { finishDrag(event, true); });

  function onViewportChange() {
    update(false);
    syncToTheme(false); // a resized-in carousel follows the selection
  }
  if (mobile.addEventListener) mobile.addEventListener("change", onViewportChange);
  else mobile.addListener(onViewportChange);

  new MutationObserver(function () {
    window.requestAnimationFrame(function () {
      update(false);
      syncToTheme(false);
    });
  }).observe(wall, { childList: true });

  // Every theme selection — swatch tap, radio arrow keys, preset
  // links — funnels through v2's setTheme(), which stamps
  // #hero-phone's data-theme. Follow that stamp and the selector
  // and carousel can never drift apart. This only ever moves the
  // carousel, never re-applies the theme, so it cannot loop.
  var heroPhone = document.getElementById("hero-phone");
  if (heroPhone && window.MutationObserver) {
    new MutationObserver(function () { syncToTheme(true); })
      .observe(heroPhone, { attributes: true, attributeFilter: ["data-theme"] });
  }

  update(false);
  syncToTheme(false);
})();

// Background video: ensure playback on all viewports including mobile.
// Handles tab visibility changes robustly so the video resumes correctly
// when the user returns — no frozen frames, no duplicate loops.
(function () {
  "use strict";
  var video = document.querySelector(".landing-hero-stack__video");
  if (!video) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { video.pause(); return; }
  if (navigator.connection && navigator.connection.saveData) return;

  var resuming = false; // guard against duplicate play() calls

  function play() {
    if (resuming) return;
    if (!video.paused) return;
    resuming = true;
    video.play().catch(function () {}).finally(function () { resuming = false; });
  }

  // Ensure autoplay fires even if the browser blocked it initially.
  video.addEventListener("canplay", play, { once: true });
  play();

  // Core handler: pause when hidden, resume when visible.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      video.pause();
    } else {
      play();
    }
  });

  // Some browsers throttle background tabs and the video can stall even
  // without a visibilitychange event (e.g. returning via Alt-Tab on
  // desktop). Listening to window focus catches those cases.
  window.addEventListener("focus", function () {
    if (!document.hidden) play();
  });

  // If the video ends up paused for any reason while the page is visible
  // (browser power-saving, etc.), resume it.
  video.addEventListener("pause", function () {
    if (!document.hidden) {
      // Small delay so we don't fight the browser's own pause logic
      setTimeout(function () {
        if (video.paused && !document.hidden) play();
      }, 200);
    }
  });
})();

// When desktop and mobile forms coexist, navbar Claim uses the visible form.
(function () {
  var inputs = Array.prototype.slice.call(document.querySelectorAll(".claim__input"));
  if (!inputs.length) return;

  function activeInput() {
    return inputs.filter(function (input) { return input.offsetParent !== null; })[0] || inputs[0];
  }

  document.querySelectorAll("[data-claim]").forEach(function (link) {
    link.addEventListener("click", function () {
      var input = activeInput();
      var value = (input && input.value || "").trim()
        .replace(/^https?:\/\//i, "")
        .replace(/^(www\.)?misa\.lol\//i, "")
        .replace(/^@/, "")
        .replace(/[\/?#].*$/, "");
      var base = (link.getAttribute("href") || "/signup").split("?")[0];
      link.setAttribute("href", value && /^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(value)
        ? base + "?username=" + encodeURIComponent(value)
        : base);
    });
  });
})();
