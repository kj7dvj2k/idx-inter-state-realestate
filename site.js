/* ==========================================================================
   idx.inter-state.realestate - cosmetic scripts for the ISG Lofty site
   Loaded by one short line at the end of Lofty's Script box
   (CMS > Settings > Tools > Custom Style & Script > Script).
   The lead-capture script stays in Lofty itself, not here.

   Everything here is cosmetic: if this file fails to load, the page still
   works and simply looks like Lofty's default in these spots.
   Styling lives in site.css; the Market trends chart is the exception
   (a canvas), so its colours are set here.
   ========================================================================== */

(function () {
  function q(sel) { return document.querySelector(sel); }

  // The scrolling bar stays hidden until the in-page PREV / NEXT row has
  // scrolled off the top of the screen (pages opened from a search only).
  function holdBanner() {
    var row = q(".isg-prevnext");
    document.documentElement.classList.toggle("isg-banner-hold",
      !!row && row.getBoundingClientRect().top + 40 > 0);
  }
  window.addEventListener("scroll", holdBanner, { passive: true });

  // Runs as soon as this file loads, then again whenever Lofty adds or
  // replaces part of the page (it renders the listing in stages and again
  // when the visitor moves between listings). Every step only acts when its
  // work is missing, so repeat runs cost nothing. A slow 1-second check stays
  // as a backstop.
  function tick() {

    // 1. Share button beside Save (desktop and tablet).
    //    Copies Lofty's own share button from the sticky banner, including
    //    its share menu; site.css positions the menu under the icon.
    var buttons = q(".detail-info-header .tour-btn-container");
    var share = q(".save-share-tour .item.share");
    if (buttons && share && !buttons.querySelector(".share")) {
      var copy = share.cloneNode(true);
      copy.className = "btn-item share";
      var label = document.createElement("span");
      label.className = "btn-text";
      label.textContent = "Share";
      copy.insertBefore(label, copy.querySelector(".popper"));
      buttons.appendChild(copy);
    }

    // 2a. "Listed by" at the top of the header on every listing. Lofty puts
    //     it at the top or at the very bottom depending on the MLS; when it
    //     is at the bottom, show a copy at the top and hide the original
    //     (and its section, when that line is all the section holds).
    var left = q(".detail-info-left");
    var bottom = q(".md-mls .mls-provided-container");
    var bottomText = bottom && bottom.querySelector(".mls-provided");
    if (left && bottomText) {
      var topLine = left.querySelector(":scope > .isg-provided");
      if (!topLine) {
        topLine = document.createElement("div");
        topLine.className = "mls-provided-container standard isg-provided";
        topLine.appendChild(document.createElement("div")).className = "mls-provided";
        left.insertBefore(topLine, left.firstChild);
      }
      var provided = topLine.querySelector(".mls-provided");
      if (provided.innerHTML !== bottomText.innerHTML) provided.innerHTML = bottomText.innerHTML;
      if (bottom.style.display !== "none") bottom.style.display = "none";
      var section = bottom.closest(".md-mls");
      if (section && section.style.display !== "none" && !section.innerText.trim()) section.style.display = "none";
    }

    // 2b. "Updated <date> - N days on market" moved onto the "Listed by" line.
    //     Lofty's own "Updated:" block is hidden from the first paint by
    //     site.css; its text is copied here.
    var block = q(".key-info.on-site");
    var listedBy = q(".detail-info-left > .mls-provided-container");
    var date = block && block.querySelector(".day-site");
    var days = block && block.querySelector(".tiny-site");
    if (date && days && listedBy) {
      var line = listedBy.querySelector(".isg-updated");
      if (!line) {
        document.querySelectorAll(".isg-updated").forEach(function (old) { old.remove(); });
        line = listedBy.appendChild(document.createElement("div"));
      }
      line.className = "isg-updated";
      var text = "Updated " + date.textContent.trim().split(" ")[0] +
        " · " + days.textContent.replace(/^\s*ON MARKET:\s*/i, "").trim();
      if (line.textContent !== text) line.textContent = text; // only write on change, or the page watcher would loop
      if (block.style.display !== "none") block.style.display = "none";
    }

    // 3. Tidy Lofty's own wording: "$ 240,000" -> "$240,000", the similar-
    //    homes subtitle ("Townhouses", "River Falls,WI"), and "(In 54806)".
    document.querySelectorAll(".price-number").forEach(function (p) {
      p.childNodes.forEach(function (n) {
        if (n.nodeType === 3 && /\$\s+/.test(n.textContent)) {
          n.textContent = n.textContent.replace(/\$\s+/, "$");
        }
      });
    });
    document.querySelectorAll(".md-house-listing h3.sub-title").forEach(function (h) {
      var t = h.textContent
        .replace(/similar (\S+)/, function (m, w) { return "similar " + w.toLowerCase(); })
        .replace(/,(?=[A-Za-z])/g, ", ");
      if (t !== h.textContent) h.textContent = t;
    });
    document.querySelectorAll(".md-market-trends .zipcode").forEach(function (z) {
      if (z.textContent.indexOf("(In ") > -1) z.textContent = z.textContent.replace("(In ", "(in ");
    });

    // 4. Market trends chart in the site's colours. It is an ECharts canvas,
    //    so CSS cannot reach it; restyle the instance, and re-apply whenever
    //    Lofty redraws it (the Average/Median dropdown).
    var chartEl = q(".md-market-trends .echart");
    var inst = chartEl && window.echarts && window.echarts.getInstanceByDom(chartEl);
    if (inst && !inst.__isg) {
      inst.__isg = true;
      var ax = {
        axisLabel: { color: "#333", fontSize: 11, fontFamily: "Roboto, sans-serif" },
        splitArea: { show: false }, splitLine: { show: false },
        axisLine: { show: false }, axisTick: { show: false }
      };
      var style = {
        textStyle: { fontFamily: "Roboto, sans-serif" },
        grid: [{ left: 4, right: 4, top: 10, bottom: 4, containLabel: true }],
        xAxis: [ax],
        yAxis: [Object.assign({}, ax, { splitLine: { show: true, lineStyle: { color: "#e6e6e6" } } }), ax],
        series: [
          { barWidth: 14, itemStyle: { color: "#c4c4c4", borderColor: "#c4c4c4", borderRadius: 0, barBorderRadius: 0 } },
          { symbol: "circle", symbolSize: 6, itemStyle: { color: "#111", borderColor: "#111", borderWidth: 2 }, lineStyle: { color: "#111", width: 2 } }
        ],
        axisPointer: [{ lineStyle: { color: "#111", type: "dashed" } }]
      };
      var lofty = inst.setOption.bind(inst);
      inst.setOption = function (o) {
        var r = lofty.apply(null, arguments);
        if (o !== style) lofty(style);
        return r;
      };
      lofty(style);
    }

    // 5. In-page PREV / NEXT. Lofty deletes its own pair the moment the
    //    scrolling bar appears (about 50px down), so keep a copy it cannot
    //    remove; site.css hides Lofty's and places this one.
    var exL = q(".extral-banner-left a.btn"), exR = q(".extral-banner-right a.btn");
    if ((exL || exR) && !q(".isg-prevnext")) {
      var host = (exL || exR).closest(".mg-container");
      var row = document.createElement("div");
      row.className = "isg-prevnext";
      [exL, exR].forEach(function (a) {
        var slot = document.createElement("span");
        if (a) {
          var c = document.createElement("a");
          c.className = "btn";
          c.href = a.getAttribute("href");
          c.innerHTML = a.innerHTML;
          slot.appendChild(c);
        }
        row.appendChild(slot);
      });
      host.insertBefore(row, host.firstChild);
    }
    holdBanner();

  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; tick(); });
  }

  tick();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", tick);
  setInterval(tick, 1000);
})();
