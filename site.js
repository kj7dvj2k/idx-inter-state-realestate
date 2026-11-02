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

  // Search filters, Listing Status: one button per status family instead of
  // one per raw MLS value. The family's first value keeps its button (renamed
  // where needed); the others are hidden and follow it on every click, so the
  // search still asks for all of them. Hold and the sold values are hidden
  // outright (sold listings live on /sold-listing). Measured 2026-11-01: only
  // Active, Pending, Contingent, Active Under Contract and Coming Soon return
  // anything on this site; the rest are kept in a family in case a feed starts
  // sending them.
  var STATUS_FAMILIES = {
    "Active": ["Back on Market", "Back+on+Market", "reactivated", "Price Changed", "Offer Show"],
    "Coming Soon": ["Coming+Soon"],
    "Active Under Contract": ["Contingent", "Pending", "Offer Bump"]
  };
  var STATUS_HIDDEN = ["Hold", "Sold", "[Sold]"];
  var STATUS_LABELS = { "Active Under Contract": "Under Contract" };

  function statusButtons() {
    document.querySelectorAll(".select-button-group-wrap").forEach(function (w) {
      var t = w.querySelector(".select-button-group-label");
      if (!t || t.textContent.trim() !== "Listing Status") return;
      w.querySelectorAll(".select-button-group-item").forEach(function (it) {
        var l = it.querySelector(".label");
        if (!l) return;
        var v = it.getAttribute("data-isg-status") || l.textContent.trim();
        if (it.getAttribute("data-isg-status") !== v) it.setAttribute("data-isg-status", v);
        var member = STATUS_HIDDEN.indexOf(v) > -1 || Object.keys(STATUS_FAMILIES).some(function (k) {
          return STATUS_FAMILIES[k].indexOf(v) > -1;
        });
        if (member && it.style.display !== "none") it.style.display = "none";
        if (STATUS_FAMILIES[v] && !it.hasAttribute("data-isg-lead")) it.setAttribute("data-isg-lead", "");
        if (STATUS_LABELS[v] && l.textContent !== STATUS_LABELS[v]) l.textContent = STATUS_LABELS[v];
      });
    });
  }

  // Lofty re-runs the search on every click, so the hidden values are
  // clicked one at a time, each after the last has registered.
  function followLead(lead) {
    var list = lead.parentElement;
    var family = STATUS_FAMILIES[lead.getAttribute("data-isg-status")] || [];
    var i = 0;
    (function next() {
      var on = lead.classList.contains("active");
      while (i < family.length) {
        var x = list.querySelector('[data-isg-status="' + family[i++] + '"]');
        if (x && x.classList.contains("active") !== on) {
          x.click();
          var n = 0;
          (function wait() {
            if (x.classList.contains("active") === on || n++ > 20) setTimeout(next, 150);
            else setTimeout(wait, 50);
          })();
          return;
        }
      }
    })();
  }

  document.addEventListener("click", function (e) {
    var lead = e.isTrusted && e.target.closest && e.target.closest(".select-button-group-item[data-isg-lead]");
    if (lead) setTimeout(function () { followLead(lead); }, 150);
  }, true);

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

    // 6. Listing Status buttons in the search filters (see above).
    statusButtons();

    // 7. Sold listing pages (/sold-listing/detail/...).
    //    "SOLD DATE : 10/23/2026" -> "Sold 10/23/2026" (site.css shows it as
    //    the white status square), and when Lofty has no estimate for the
    //    property it prints "?": html.isg-noest lets site.css hide those spots.
    document.querySelectorAll(".listing-detail-sold .sold-date").forEach(function (s) {
      var t = s.textContent.replace(/^\s*SOLD DATE\s*:\s*/i, "Sold ");
      if (t !== s.textContent) s.textContent = t;
    });
    var est = q(".listing-detail-sold .est-price-container .value");
    var noEst = !!est && est.textContent.trim() === "?";
    if (document.documentElement.classList.contains("isg-noest") !== noEst) {
      document.documentElement.classList.toggle("isg-noest", noEst);
    }

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
