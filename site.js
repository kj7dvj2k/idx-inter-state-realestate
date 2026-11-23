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

/* ISG water-name lookup (shared by idx.inter-state.realestate and northernwi.realestate).
   Turns an MLS "Body of Water" value ("Long", "NOKOMIS", "Big Sand Lake (600011978)")
   into the water's real DNR name and WBIC, using the listing's own coordinates:
   the nearest DNR water within 2.5 km whose name matches once type words are set aside.
   Data: one tile per 0.5 degree cell, {n:[names], p:[[nameIndex, wbic, latE4, lngE4]]},
   built from the WDNR 24K hydro geodatabase (build_names.py).
   Written with no backslashes: the AgentFire Scripts & Metas box strips them. */
(function (W) {
  if (W.ISGWaterName) return;
  var TILE = 0.5, MAXKM = 2.5, EDGE = 0.05;
  var DROP = { lake: 1, lakes: 1, lac: 1, river: 1, creek: 1, flowage: 1, pond: 1, the: 1, of: 1,
    chain: 1, brook: 1, slough: 1, reservoir: 1, bay: 1, spring: 1, springs: 1, impoundment: 1 };
  var TYPES = ['lake', 'river', 'creek', 'flowage', 'pond', 'brook', 'slough', 'bay', 'reservoir', 'chain'];
  var cache = {};

  function words(s) {
    var out = '', i, c;
    s = String(s || '').toLowerCase();
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      out += (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ? c : ' ';
    }
    return out.split(' ').filter(function (w) { return w; });
  }
  function core(s) {
    s = String(s || '').split('(')[0];          // "(Rusk Twp.)", "(600011978)", "(Flambeau)"
    var ws = words(s).filter(function (w) { return !(w.length >= 5 && !isNaN(Number(w))); });
    var kept = ws.filter(function (w) { return !DROP[w]; });
    if (!kept.length) kept = ws.filter(function (w) { return w !== 'lake' && w !== 'lakes' && w !== 'the' && w !== 'of'; });
    return kept.map(function (w) { return w === 'saint' ? 'st' : w; }).sort().join(' ');
  }
  function typeOf(s) {
    var ws = words(s);
    for (var i = 0; i < TYPES.length; i++) if (ws.indexOf(TYPES[i]) >= 0) return TYPES[i];
    return '';
  }
  function km(a, b, c, d) {
    var x = (d - b) * Math.cos((a + c) * Math.PI / 360) * 111.32, y = (c - a) * 110.57;
    return Math.sqrt(x * x + y * y);
  }
  function tile(base, ty, tx) {
    var k = ty + '_' + tx;
    if (!cache[k]) {
      cache[k] = fetch(base + k + '.json').then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return cache[k];
  }

  // Proper case for a feed value with no DNR match ("CAMP TWELVE" -> "Camp Twelve").
  function proper(s) {
    s = String(s || '').split('(')[0].trim();
    if (s.toLowerCase() !== s && s.toUpperCase() !== s) return s;
    return s.toLowerCase().split(' ').map(function (w) {
      return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    }).join(' ');
  }

  // The name to show. A feed value that already carries a water word is the agent's own
  // full name and is kept ("St. Croix River", "Lake Altoona"), in proper case. A bare
  // value takes DNR's name ("NOKOMIS" -> "Lake Nokomis"); with no DNR match, the type
  // from the waterfront description, else Lake.
  function display(rawName, front, hit) {
    var r = proper(rawName);
    if (typeOf(r)) return r;
    if (hit) return hit.name;
    var f = String(front || '').toLowerCase();
    return r + (f.indexOf('river') >= 0 ? ' River' : f.indexOf('creek') >= 0 || f.indexOf('stream') >= 0 ? ' Creek' :
      f.indexOf('flowage') >= 0 ? ' Flowage' : f.indexOf('pond') >= 0 ? ' Pond' : ' Lake');
  }

  // resolve(base, raw, front, lat, lng) -> Promise of {name, wbic, dnr:true|false}
  function resolve(base, rawName, front, lat, lng) {
    var alts = String(rawName || '').split('/').map(core).filter(function (x) { return x; });
    var want = alts[0], wantType = typeOf(rawName) || typeOf(front);
    var fallback = { name: display(rawName, front, null), wbic: 0, dnr: false };
    if (!want || !isFinite(lat) || !isFinite(lng)) return Promise.resolve(fallback);
    // The listing's own tile, plus a neighbour only when the listing sits near that edge.
    var ys = [Math.floor(lat / TILE)], xs = [Math.floor(lng / TILE)], jobs = [];
    if (lat - ys[0] * TILE < EDGE) ys.push(ys[0] - 1);
    if ((ys[0] + 1) * TILE - lat < EDGE) ys.push(ys[0] + 1);
    if (lng - xs[0] * TILE < EDGE) xs.push(xs[0] - 1);
    if ((xs[0] + 1) * TILE - lng < EDGE) xs.push(xs[0] + 1);
    ys.forEach(function (y) { xs.forEach(function (x) { jobs.push(tile(base, y, x)); }); });
    return Promise.all(jobs).then(function (tiles) {
      var best = null, bestTyped = null;
      tiles.forEach(function (t) {
        if (!t) return;
        var ok = t.n.map(function (n) { return alts.indexOf(core(n)) >= 0; });
        t.p.forEach(function (p) {
          if (!ok[p[0]]) return;
          var d = km(lat, lng, p[2] / 1e4, p[3] / 1e4);
          if (d > MAXKM) return;
          var hit = { name: t.n[p[0]], wbic: p[1], d: d };
          if (!best || d < best.d) best = hit;
          if (wantType && typeOf(hit.name) === wantType && (!bestTyped || d < bestTyped.d)) bestTyped = hit;
        });
      });
      var h = bestTyped && (!best || bestTyped.d < best.d + 1) ? bestTyped : best;
      return h ? { name: display(rawName, front, h), wbic: h.wbic, dnr: true } : fallback;
    });
  }

  W.ISGWaterName = { resolve: resolve, core: core, proper: proper, typeOf: typeOf };
})(window);

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

    // 8. Area breadcrumb on every listing, active and sold, under the
    //    beds/baths/acres circles: WI > Bayfield County > Port Wing / 54865
    //    (a slash before the ZIP: a ZIP and a town do not nest). Each links to Lofty's
    //    own area results page (/WI/Bayfield-County, /WI/Port-Wing, /WI/54865).
    //    The arrows are their own spans so a link's hover underline stops at
    //    the word. The state has no page of its own, so it is plain text.
    var after = q(".listing-detail .detail-info-left > .detail-info-header") ||
      q(".listing-detail-sold .md-sold-detail .detail-info > .count-sold-date") ||
      q(".listing-detail-sold .md-sold-detail .detail-info > .count");
    if (after && !after.parentElement.querySelector(":scope > .isg-crumbs")) {
      var cityEl = Array.prototype.find.call(
        document.querySelectorAll(".detail-info-header .city, .md-sold-detail h1.address .city"),
        function (e) { return e.textContent.trim(); });
      var m = cityEl && cityEl.textContent.trim().match(/^(.+?),\s*([A-Z]{2})\s*(\d{5})?/);
      if (m) {
        var county = "";
        document.querySelectorAll(".info-content").forEach(function (r) {
          var t = r.querySelector(".info-title"), d = r.querySelector(".info-data");
          if (!county && t && d && t.textContent.trim().toLowerCase() === "county") county = d.textContent.trim();
        });
        if (county && !/county$/i.test(county)) county += " County";
        var st = m[2];
        var slug = function (s) { return "/" + st + "/" + encodeURIComponent(s.trim().replace(/\s+/g, "-")).replace(/%2D/g, "-"); };
        var crumbs = document.createElement("nav");
        crumbs.className = "isg-crumbs";
        crumbs.setAttribute("aria-label", "Area");
        var part = function (label, href, cls) {
          var el = document.createElement(href ? "a" : "span");
          if (href) el.href = href;
          if (cls) el.className = cls;
          el.textContent = label;
          crumbs.appendChild(el);
        };
        var sep = function () { part("›", "", "sep"); };
        part(st, "");
        if (county) { sep(); part(county, slug(county)); }
        sep(); part(m[1].trim(), slug(m[1]));
        if (m[3]) { part("/", "", "sep"); part(m[3], "/" + st + "/" + m[3], "zip"); }
        after.parentElement.insertBefore(crumbs, after.nextSibling);
      }
    }

    // 9. Sold listings on phones: Lofty puts "Listed by / Bought with" in its
    //    own box above the listing; show a copy in the listing column (under
    //    the breadcrumb, as on active listings) and hide the original box.
    var soldCol = q(".listing-detail-sold .md-sold-detail .detail-info");
    var soldMls = q(".listing-detail-sold .md-sold-detail > .mg-container > .mls-provided-container .mls-provided");
    if (soldCol && soldMls) {
      var copyLine = soldCol.querySelector(":scope > .isg-provided");
      if (!copyLine) {
        copyLine = document.createElement("div");
        copyLine.className = "mls-provided-container standard isg-provided";
        copyLine.appendChild(document.createElement("div")).className = "mls-provided";
        soldCol.appendChild(copyLine);
      }
      var copyText = copyLine.querySelector(".mls-provided");
      if (copyText.innerHTML !== soldMls.innerHTML) copyText.innerHTML = soldMls.innerHTML;
      var box = soldMls.closest(".mg-container");
      if (box && box.style.display !== "none") box.style.display = "none";
    }

    // 7. Sold listing pages (/sold-listing/detail/...).
    //    "SOLD DATE : 10/23/2026" -> "Sold 10/23/2026" (site.css shows it as
    //    the white status square), and when Lofty has no estimate for the
    //    property it prints "?": html.isg-noest lets site.css hide those spots.
    document.querySelectorAll(".listing-detail-sold .sold-date").forEach(function (s) {
      var t = s.textContent.replace(/^\s*SOLD DATE\s*:\s*/i, "Sold ");
      if (t !== s.textContent) s.textContent = t;
    });
    // 7b. Card tags: "Sold on 11/03/2026" -> "Sold 11/3/26", as on the
    //     northernwi.realestate cards.
    document.querySelectorAll(".house-status .status-text").forEach(function (t) {
      var m = t.textContent.trim().match(/^Sold on (\d{1,2})\/(\d{1,2})\/\d{2}(\d{2})$/i);
      if (!m) return;
      var y = "Sold " + Number(m[1]) + "/" + Number(m[2]) + "/" + m[3];
      if (t.textContent !== y) t.textContent = y;
    });
    var est = q(".listing-detail-sold .est-price-container .value");
    var noEst = !!est && est.textContent.trim() === "?";
    if (document.documentElement.classList.contains("isg-noest") !== noEst) {
      document.documentElement.classList.toggle("isg-noest", noEst);
    }

    // 10. Search results: "Switch to sold listings" beside the sort button
    //     ("Switch to listings for sale" on sold results). The visitor's
    //     filters come along: Lofty serves sold results at the same address
    //     with /sold-listing in front, and reads the same condition.
    //     Desktop: the sort button's row; phones and tablets (body.mobile):
    //     the headline row, where Lofty puts the sort button there.
    var sortBox = q(".md-search .search-choose > .search-sort, .md-search .search-result-header > .search-sort");
    if (sortBox) {
      var sw = sortBox.parentNode.querySelector(":scope > .isg-soldswitch");
      if (!sw) {
        sw = document.createElement("a");
        sw.className = "isg-soldswitch";
        sw.addEventListener("click", function () { sw.href = soldSwitchHref(); });
        sortBox.parentNode.insertBefore(sw, sortBox.nextSibling);
      }
      var swText = isSoldSearch() ? "Switch to listings for sale" : "Switch to sold listings";
      if (sw.textContent !== swText) sw.textContent = swText;
      var swHref = soldSwitchHref();
      if (sw.getAttribute("href") !== swHref) sw.setAttribute("href", swHref);
    }

    // 19. Search results scoped to one water body (the link from a listing's
    //     water line, or any search with Water Body set): a breadcrumb above
    //     the headline, "WI › Washburn County", with the water's name on its
    //     own line under it (owner 2026-11-22: a lake is not filed under one
    //     town or county). The county links to that county's search under
    //     both feed spellings; the water links to its guide on
    //     northernwi.realestate when it has one (Wisconsin only), else stays
    //     plain text. Area pages keep Lofty's own crumbs.
    searchWaterCrumbs();

    // 20. Search Filters panel: only filters proven to work on every MLS
    //     feed stay visible (audit 2026-11-22). Allow-list, so a filter
    //     Lofty adds later stays hidden until it is tested.
    hideFilters();

    // 22. Footer lettermark is never wider than the eXp and ISG logos above
    //     it (owner 2026-11-22): its size is fitted to the logos' span.
    document.querySelectorAll(".md-footer").forEach(function (f) {
      var imgs = f.querySelectorAll(".site-logo img"), mark = f.querySelector(".left-content .menu-label");
      if (!imgs.length || !mark) return;
      var span = imgs[imgs.length - 1].getBoundingClientRect().right - imgs[0].getBoundingClientRect().left;
      if (span < 50) return;
      var cs = getComputedStyle(mark), size = parseFloat(cs.fontSize);
      var w = mark.getBoundingClientRect().width - parseFloat(cs.letterSpacing || 0);
      if (!w || (w <= span && w > span - 2)) return;
      var fit = Math.min(16, Math.floor(size * span / w * 10) / 10);
      if (Math.abs(fit - size) >= 0.1) mark.style.setProperty("font-size", fit + "px", "important");
    });

    // 21. Every map opens on the satellite view (owner 2026-11-22). Lofty's
    //     map-type button reads "hybrid" while the road map shows; it is
    //     pressed once per map, so a visitor can switch back.
    document.querySelectorAll(".map-type.hybrid:not([data-isg-sat])").forEach(function (b) {
      b.setAttribute("data-isg-sat", "1");
      b.click();
    });
    //     Map view (the map fills the page): the scroll wheel zooms without
    //     holding Ctrl (owner 2026-11-22). Lofty's map only zooms on a
    //     Ctrl+wheel, so a plain wheel over it is passed on with Ctrl set.
    //     Mixed view keeps Ctrl, so the page still scrolls there.
    if (!window.__isgWheel) {
      window.__isgWheel = 1;
      document.addEventListener("wheel", function (e) {
        if (e.ctrlKey || e.__isg) return;
        if (!(e.target.closest && e.target.closest(".md-search .map-box"))) return;
        if (!document.querySelector(".md-search .search-result-drawer.big-map")) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        var w = new WheelEvent("wheel", { bubbles: true, cancelable: true,
          clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
          deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, ctrlKey: true });
        w.__isg = 1;
        e.target.dispatchEvent(w);
      }, { capture: true, passive: false });
    }
    //     Listing pages embed a Google map in an iframe (/maps?...&output=embed);
    //     t=h is Google's satellite-with-labels view.
    document.querySelectorAll('iframe[src*="/maps?"]:not([data-isg-sat])').forEach(function (f) {
      f.setAttribute("data-isg-sat", "1");
      try {
        var u = new URL(f.src, location.href);
        if (u.searchParams.get("output") === "embed" && !u.searchParams.get("t")) {
          u.searchParams.set("t", "h");
          f.src = u.toString();
        }
      } catch (e) {}
    });

    // 11. Search results for one Wisconsin town, county or ZIP: a button
    //     opposite the headline to the same place's page on
    //     northernwi.realestate.
    var head = q(".md-search .search-result-header");
    //     A search over more than one place has no single page to point to,
    //     so it gets no button (owner 2026-11-22).
    var place = head && placeCount() <= 1 && (searchPlace() || waterPlace());
    var cta = head && head.querySelector(":scope > .isg-nwire");
    if (head && place) {
      if (!cta) {
        cta = document.createElement("a");
        cta.className = "isg-nwire";
        cta.appendChild(document.createElement("span")).className = "isg-nwire-text";
        var mark = cta.appendChild(document.createElement("span"));
        mark.className = "isg-nwire-mark";
        mark.textContent = "northernwi.realestate";
        head.appendChild(cta);
      }
      var ctaHref = place.href || NWIRE + place.path + location.search;
      if (cta.getAttribute("href") !== ctaHref) cta.setAttribute("href", ctaHref);
      var ctaText = "View " + place.name + " on";
      var ctaSpan = cta.querySelector(".isg-nwire-text");
      if (ctaSpan.textContent !== ctaText) ctaSpan.textContent = ctaText;
    } else if (cta) {
      cta.remove();
    }

    // 13. Listing pages, active and sold: "View this listing on
    //     NORTHERNWI.REALESTATE" at the right end of the area breadcrumb row
    //     (under it on phones). Both sites run the same Lofty listing ids
    //     and paths (/listing-detail/<id>/<slug>, /sold-listing/detail/...),
    //     checked 2026-11-09 on the current northernwi.realestate and on the
    //     new site, so the link keeps working when the domain moves.
    //     Wisconsin listings only: the new site carries WI and nothing else,
    //     so a Minnesota listing gets no button and keeps its own share links.
    var crumbRow = q(".isg-crumbs");
    var listingHref = nwireListingHref();
    if (crumbRow && listingHref && !crumbRow.querySelector(".isg-nwire")) {
      var view = document.createElement("a");
      view.className = "isg-nwire isg-nwire-listing";
      view.href = listingHref;
      view.appendChild(document.createElement("span")).className = "isg-nwire-text";
      view.firstChild.textContent = "View this listing on";
      var vMark = view.appendChild(document.createElement("span"));
      vMark.className = "isg-nwire-mark";
      vMark.textContent = "northernwi.realestate";
      crumbRow.appendChild(view);
    }

    // 18. Listing pages, active and sold: a second line under the area
    //     breadcrumb, the water body's name, underlined, linking to every
    //     listing on the same water in the same county.
    //     Scoped to the county because one name ("Long") covers dozens of
    //     lakes. Feeds spell counties two ways ("Washburn" and "Washburn
    //     County"), so the search asks for both. No line when the listing
    //     names no water, names it "Unnamed" or the like, or is the only
    //     listing on it.
    if (crumbRow) waterLine(crumbRow);

    // 14. Share menus hand out the northernwi.realestate address, never this
    //     site's: Lofty writes this site's address into every share link
    //     (X, Facebook, email, LinkedIn), in the page and in the sticky bar.
    if (listingHref) {
      document.querySelectorAll("a.share-item").forEach(function (a) {
        var h = a.getAttribute("href") || "";
        var n = h.replace(OWN_HOST, NWIRE);
        if (n !== h) a.setAttribute("href", n);
      });
    }

    // 15. "Listed by" lines: some feeds put a bullet between the agent and
    //     the brokerage ("Ethan Trowbridge • eXp Realty LLC") and the spaces
    //     around it all but vanish. The bullet gets its own span, spaced in
    //     site.css. Lofty may re-render the line; this re-applies.
    document.querySelectorAll(".mls-provided").forEach(function (p) {
      if (p.querySelector(".isg-dot") || p.innerHTML.indexOf("•") < 0) return;
      p.innerHTML = p.innerHTML.replace(/(\s|&nbsp;)*•(\s|&nbsp;)*/g, '<span class="isg-dot">•</span>');
    });

    // 16. Search and area result cards: one MLS feed's line arrives glued
    //     together ("Listed by Ethan TrowbridgeofeXp Realty LLC"). Put the
    //     spaces back around "of" (name ends lower case, brokerage starts
    //     with a capital or "eXp"), only when the line has no " of " already.
    document.querySelectorAll(".house-provided, .mls-provided").forEach(function (p) {
      p.childNodes.forEach(function (n) {
        if (n.nodeType !== 3 || / of /.test(n.nodeValue)) return;
        var t = n.nodeValue.replace(/([a-z.])of(?=[A-Z]|e[A-Z])/, "$1 of ");
        if (t !== n.nodeValue) n.nodeValue = t;
      });
    });

    // 17. Sign-up popup (Lofty's registration step): our wording, and, on a
    //     page that has a northernwi.realestate twin (Wisconsin listings,
    //     Wisconsin area results, the main search, the home page), a way to
    //     view it there without an account. Pages with no twin (a Minnesota
    //     listing, profile pages) get no such link. Opening any page with
    //     ?isPopup=0 skips the popup altogether (Lofty's own rule).
    //     The popup has several views (create account, sign in, the second
    //     registration step); the wording is set on the create-account view
    //     only, and the "Just looking?" panel shows on every view.
    document.querySelectorAll(".pop.sign-log .pop-form").forEach(function (s) {
      var first = s.querySelector(".step1");
      if (first && first.offsetParent !== null) {
        var h2 = first.querySelector("hgroup h2 p, hgroup h2");
        var h3 = first.querySelector("hgroup h3 p, hgroup h3");
        if (h2 && h2.textContent !== POP_TITLE) h2.textContent = POP_TITLE;
        if (h3 && h3.textContent !== POP_TEXT) h3.textContent = POP_TEXT;
      }
      var second = s.querySelector(".step2");
      if (second && second.offsetParent !== null) {
        var t2 = second.querySelector("hgroup h2 p, hgroup h2");
        var d2 = second.querySelector("hgroup h3 p, hgroup h3");
        if (t2 && t2.textContent !== "One More Step") t2.textContent = "One More Step";
        var dt = "Add your name and phone to finish your account.";
        if (d2 && d2.textContent !== dt) d2.textContent = dt;
      }
      var twin = nwireEquivalent();
      var alt = s.querySelector(".isg-pop-nwire");
      if (twin && !alt) {
        alt = document.createElement("div");
        alt.className = "isg-pop-nwire";
        alt.innerHTML = '<p class="isg-pop-head">Just looking?</p><p class="isg-pop-sub">No account needed on our public site.</p><a class="isg-nwire" rel="noopener"><span class="isg-nwire-text"></span><span class="isg-nwire-mark">northernwi.realestate</span></a>';
        s.appendChild(alt);
      }
      if (alt && !twin) alt.remove();
      var ok = s.querySelector('input[type=submit][value="OK"]');
      if (ok && s.classList.contains("login")) ok.value = "Sign In";
      if (alt && twin) {
        var a = alt.querySelector("a");
        if (a.getAttribute("href") !== twin.href) a.setAttribute("href", twin.href);
        var tx = twin.label;
        var sp = a.querySelector(".isg-nwire-text");
        if (sp.textContent !== tx) sp.textContent = tx;
      }
    });

    // 12. No shouted "FREE" anywhere on the site (Lofty writes it into the
    //     sold pages' estimate box, its popup form and the bottom bar):
    //     "Request a FREE Analysis" -> "Request a Market Analysis",
    //     "Contact us for a FREE valuation!" -> "...for a market analysis."
    //     On phones the sold page's bottom bar becomes the active listings'
    //     white Call | Tour pill: a Call link (the agent's own number, from
    //     the page) beside the request.
    if (document.body && document.body.textContent.indexOf("FREE") > -1) {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      var tn;
      while ((tn = walker.nextNode())) {
        if (!/\bFREE\b/.test(tn.nodeValue) || /^(SCRIPT|STYLE)$/.test(tn.parentNode.nodeName)) continue;
        tn.nodeValue = tn.nodeValue
          .replace(/\bFREE Analysis\b/g, "Market Analysis")
          .replace(/\bfor a FREE valuation!/g, "for a market analysis.")
          .replace(/\bFREE\s+/g, "");
      }
    }
    var reqBox = q("body.mobile.listing-detail-sold .request-box > .mg-container");
    var tel = q('.listing-detail-sold a[href^="tel:"]');
    if (reqBox && tel && !reqBox.querySelector(".isg-call")) {
      var call = document.createElement("a");
      call.className = "isg-call";
      call.href = tel.getAttribute("href");
      call.innerHTML = '<span class="iconfont icon-phone-solid"></span><span class="name">Call</span>';
      reqBox.insertBefore(call, reqBox.firstChild);
    }

  }

  // northernwi.realestate still runs Lofty, whose area pages are /WI/{Place}.
  // When the domain moves to the new site (pages at /wi/{place}/, lower case),
  // change the path built at the end of searchPlace below.
  var NWIRE = "https://northernwi.realestate";
  var OWN_HOST = /https?:\/\/(www\.)?idx\.inter-state\.realestate/gi;

  var POP_TITLE = "Create Your Account";
  var POP_TEXT = "Get new listings the moment they hit the market, save homes and searches, and see what nearby homes sold for.";

  function isListingPage() {
    return /^\/(listing-detail|sold-listing\/detail)\/\d+/.test(location.pathname);
  }

  // The listing's state, read from the area breadcrumb site.js builds
  // ("WI > Ashland County > Ashland / 54806"), or from the address line.
  function listingState() {
    var c = q(".isg-crumbs");
    if (c && c.firstChild) return c.firstChild.textContent.trim();
    var city = q(".detail-info-header .city, .md-sold-detail h1.address .city");
    var m = city && city.textContent.match(/,\s*([A-Z]{2})\b/);
    return m ? m[1] : "";
  }

  // The same Wisconsin listing on northernwi.realestate, or "".
  function nwireListingHref() {
    return isListingPage() && listingState() === "WI" ? NWIRE + location.pathname : "";
  }

  // This page's twin on northernwi.realestate, or null when there is none.
  function nwireEquivalent() {
    var p = location.pathname;
    if (isListingPage()) {
      var h = nwireListingHref();
      return h ? { href: h, label: "View this listing on" } : null;
    }
    if (p === "/" || p === "") return { href: NWIRE + "/", label: "Visit" };
    // Searches keep their filters: the query string (condition, sort,
    // page, map) carries over as-is, since both sites read the same Lofty
    // parameters. A search scoped outside Wisconsin has no twin.
    var place = searchPlace();
    if (place) return { href: NWIRE + place.path + location.search, label: "Browse " + place.name + " homes on" };
    if (/^\/(sold-listing|listing)\/?$/.test(p)) {
      var c = new URLSearchParams(location.search).get("condition") || "";
      if (/,\s*(?!WI\b)[A-Z]{2}\b/.test(c)) return null;
      return { href: NWIRE + p + location.search, label: c && c !== "{}" ? "View this search on" : "Browse homes on" };
    }
    return null;
  }

  // Phones share through the device's own share sheet; hand it the
  // northernwi.realestate address too.
  if (navigator.share && !navigator.share.__isg) {
    var nativeShare = navigator.share.bind(navigator);
    var isgShare = function (d) {
      var href = nwireListingHref();
      if (href && d && typeof d === "object") {
        d = Object.assign({}, d);
        if (d.url) d.url = href;
        if (d.text) d.text = String(d.text).replace(OWN_HOST, NWIRE);
      }
      return nativeShare(d);
    };
    isgShare.__isg = true;
    try { navigator.share = isgShare; } catch (e) { /* read-only in some browsers */ }
  }

  // Same-water line (step 18). One count request per listing page, kept for
  // the page's life; Lofty re-renders the page, so the line is re-inserted
  // from the stored result rather than fetched again. Fails silent.
  var waterCache = {};
  // The white northernwi.realestate button sits beside the breadcrumb when
  // there is room ("isg-tuck": the water line tucks under the breadcrumb);
  // otherwise it goes below the water line on its own row. Measured from
  // widths, since the water line itself forces a new row.
  function waterTuck(crumbs) {
    var nw = crumbs.querySelector(":scope > .isg-nwire");
    var parts = crumbs.querySelectorAll(":scope > :not(.isg-nwire):not(.isg-water)");
    var fits = false;
    if (nw && parts.length && window.innerWidth >= 768) {
      var used = parts[parts.length - 1].getBoundingClientRect().right - parts[0].getBoundingClientRect().left;
      fits = used + nw.getBoundingClientRect().width + 24 <= crumbs.clientWidth;
    }
    if (crumbs.classList.contains("isg-tuck") !== fits) crumbs.classList.toggle("isg-tuck", fits);
  }

  // Water names and northernwi.realestate water guides. The lookup module
  // (ISGWaterName, prepended to this file) turns the feed's Body of Water
  // value into DNR's own name using the listing's coordinates; WATER_DATA
  // holds its tiles and water-pages.json (WBIC -> guide path and name), in the
  // public data repo, pinned to a commit.
  var WATER_DATA = "https://cdn.jsdelivr.net/gh/kj7dvj2k/northernwi-realestate@e27adf40d00017d898dcdcc5bc844f2f1d444564/water-names/";
  var waterPages = null;
  function loadWaterPages() {
    if (!waterPages) {
      waterPages = fetch(WATER_DATA + "water-pages.json")
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    }
    return waterPages;
  }
  // {name, page} for a feed value at a point: page is the guide's full
  // northernwi.realestate address when the water has one, else "".
  // A guide's own title wins over DNR's name, so the two sites agree.
  function waterInfo(body, front, lat, lng) {
    return Promise.all([
      window.ISGWaterName.resolve(WATER_DATA + "tiles/", body, front, lat, lng),
      loadWaterPages()
    ]).then(function (r) {
      var pg = r[0].wbic && r[1][r[0].wbic];
      return { name: pg ? pg[1] : r[0].name, page: pg ? NWIRE + pg[0] : "" };
    });
  }
  var JUNK_WATER = /^(unnamed|un-named|none|n\/?a|other|unknown|no|not applicable|-+|[\d\s#-]+|lake|pond|river|creek)(\s+(lake|river|creek|pond|stream))?$/i;

  // The listing's own coordinates, from the page's structured data.
  function listingPoint() {
    var out = null;
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
      if (out) return;
      var m = s.textContent.match(/"latitude"\s*:\s*"?(-?[\d.]+)"?\s*,\s*"longitude"\s*:\s*"?(-?[\d.]+)/);
      if (m) out = [Number(m[1]), Number(m[2])];
    });
    return out;
  }

  function waterLine(crumbs) {
    if (crumbs.querySelector(":scope > .isg-water")) { waterTuck(crumbs); return; }
    var key = location.pathname;
    var w = waterCache[key];
    if (w === undefined) {
      var body = "", county = "", front = "";
      document.querySelectorAll(".info-content").forEach(function (r) {
        var t = r.querySelector(".info-title"), d = r.querySelector(".info-data");
        if (!t || !d) return;
        var k = t.textContent.trim().toLowerCase();
        if (k === "body of water" && !body) body = d.textContent.trim();
        if (k === "county" && !county) county = d.textContent.trim();
        if (k === "waterfront description" && !front) front = d.textContent.trim();
      });
      var st = listingState();
      if (!body || !county || !st ||
          JUNK_WATER.test(body)) {
        if (body || county) waterCache[key] = null;   // rows rendered, nothing to link
        return;
      }
      var base = county.replace(/\s+county$/i, "").trim();
      var cond = { location: { county: [base + ", " + st, base + " County, " + st] }, waterbody: [body] };
      var qs = "listingSource=all%20listings&condition=" + encodeURIComponent(JSON.stringify(cond));
      var pt = listingPoint() || [NaN, NaN];
      waterCache[key] = null;
      Promise.all([
        fetch("/api-site/search/realTimeListings?page=1&pageSize=1&" + qs)
          .then(function (r) { return r.ok ? r.json() : null; }),
        waterInfo(body, front, pt[0], pt[1])
      ]).then(function (r) {
        var n = r[0] && Number(r[0].counts);
        var own = /^\/listing-detail\//.test(key) ? 1 : 0;   // an active listing counts itself
        if (!n || n - own < 1) return;
        waterCache[key] = { href: "/listing?" + qs + "&page=1", name: r[1].name };
        schedule();
      }).catch(function () {});
      return;
    }
    if (!w) return;
    var line = document.createElement("div");
    line.className = "isg-water";
    var a = line.appendChild(document.createElement("a"));
    a.href = w.href;
    a.textContent = w.name;
    crumbs.appendChild(line);
    waterTuck(crumbs);
  }

  // Search-page water breadcrumb (step 19). Built from the search's own
  // condition: every Water Body value gets its own line under the
  // breadcrumb, once per county searched (one name, "Long", is many lakes),
  // each linking to its northernwi.realestate guide when it has one. Water
  // Body searches lead back to the guides, which search the verified shape,
  // never the other way (owner 2026-11-22).
  var scrumbCache = {};
  function waterKey(c) {
    var wb = (c && (c.waterbody || c.waterBody)) || [];
    var cs = (c && c.location && c.location.county) || [];
    return JSON.stringify([wb, cs]);
  }
  function countyBases(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (v) {
      var m = String(v).match(/^(.+?)(\s+County)?,\s*([A-Z]{2})$/);
      if (!m) return;
      var k = m[1].trim() + "|" + m[3];
      if (!seen[k]) { seen[k] = 1; out.push({ base: m[1].trim(), st: m[3] }); }
    });
    return out;
  }
  function searchWaterCrumbs() {
    var head = q(".md-search .search-result-header");
    if (!head || q(".md-search .crumbs")) return;
    var col = head.parentNode, have = col.querySelector(":scope > .isg-scrumbs");
    var c;
    try { c = JSON.parse(new URLSearchParams(location.search).get("condition") || "{}"); } catch (e) { return; }
    var key = location.pathname + "|" + waterKey(c);
    // The crumb lines up with the results header, whose left padding
    // changes between List and Mixed views.
    function alignCrumb(n) { var p = getComputedStyle(head).paddingLeft; if (n.style.paddingLeft !== p) n.style.paddingLeft = p; }
    if (have && have.getAttribute("data-k") === key) { alignCrumb(have); return; }
    if (have) have.remove();
    var wb = ((c && (c.waterbody || c.waterBody)) || []).filter(function (v) { return !JUNK_WATER.test(v); });
    if (!wb.length) return;
    var counties = countyBases(c.location && c.location.county);
    var w = scrumbCache[key];
    if (w === undefined) {
      scrumbCache[key] = null;
      var jobs = [];
      wb.forEach(function (v) {
        (counties.length ? counties : [null]).forEach(function (ct) {
          var loc = ct ? { county: [ct.base + ", " + ct.st, ct.base + " County, " + ct.st] } : (c.location || {});
          jobs.push(fetch("/api-site/search/realTimeListings?page=1&pageSize=20&listingSource=all%20listings&condition=" +
              encodeURIComponent(JSON.stringify({ location: loc, waterbody: [v] })))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) {
              // Prefer a Wisconsin listing: with no county in the search the
              // first result can sit across the line in Minnesota.
              var ls = (j && j.listings) || [];
              var l = ls.filter(function (x) { return x.state === "WI"; })[0] || ls[0];
              if (ct && !l) return null;          // nothing on that water in that county
              return waterInfo(v, "", l ? Number(l.latitude) : NaN, l ? Number(l.longitude) : NaN)
                .then(function (info) { info.st = ct ? ct.st : (l && l.state) || ""; return info; });
            }).catch(function () { return null; }));
        });
      });
      Promise.all(jobs).then(function (r) {
        var seen = {}, lines = [];
        r.forEach(function (x) {
          if (!x) return;
          var k = x.page || x.name;
          if (seen[k]) return;
          seen[k] = 1; lines.push(x);
        });
        scrumbCache[key] = { lines: lines };
        schedule();
      });
      return;
    }
    if (!w || !w.lines.length) return;
    var nav = document.createElement("nav");
    nav.className = "isg-crumbs isg-scrumbs";
    nav.setAttribute("aria-label", "Area");
    nav.setAttribute("data-k", key);
    var sold = isSoldSearch() ? "/sold-listing" : "/listing";
    function countyLink(ct) {
      var a = document.createElement("a");
      a.href = sold + "?listingSource=all%20listings&condition=" + encodeURIComponent(JSON.stringify(
        { location: { county: [ct.base + ", " + ct.st, ct.base + " County, " + ct.st] } }));
      a.textContent = ct.base + " County";
      return a;
    }
    if (counties.length) {
      var st = document.createElement("span"); st.textContent = counties[0].st; nav.appendChild(st);
      var sep = document.createElement("span"); sep.className = "sep"; sep.textContent = "›"; nav.appendChild(sep);
      if (counties.length === 1) nav.appendChild(countyLink(counties[0]));
      else {
        // Several counties share one crumb slot, stacked, none ranked over another.
        var slot = document.createElement("span"); slot.className = "isg-stack";
        counties.forEach(function (ct) { slot.appendChild(countyLink(ct)); });
        nav.appendChild(slot);
      }
    }
    w.lines.forEach(function (x) {
      var line = document.createElement("div");
      line.className = "isg-water";
      var link = x.st === "WI" && x.page;
      var el = line.appendChild(document.createElement(link ? "a" : "span"));
      if (link) el.href = x.page;
      el.textContent = x.name;
      nav.appendChild(line);
    });
    alignCrumb(nav);
    col.insertBefore(nav, head);
  }

  function isSoldSearch() { return /^\/sold-listing(\/|$)/.test(location.pathname); }

  function soldSwitchHref() {
    var path = location.pathname;
    var qs = new URLSearchParams(location.search);
    ["listingSource", "page", "sort", "listingSort"].forEach(function (k) { qs.delete(k); });
    var c = qs.get("condition");
    if (c) {
      try {
        var o = JSON.parse(c);
        delete o.listingstatus; // for-sale status choices mean nothing on sold results
        qs.set("condition", JSON.stringify(o));
      } catch (e) { /* leave it as Lofty wrote it */ }
    }
    if (isSoldSearch()) path = path.replace(/^\/sold-listing/, "") || "/listing";
    else path = "/sold-listing" + (path === "/listing" ? "" : path);
    var s = qs.toString();
    return path + (s ? "?" + s : "");
  }

  // The place a search is scoped to: Lofty's breadcrumb ("WI > Ashland" ->
  // { name: "Ashland", path: "/WI/Ashland" }; ZIPs alike), or, on pages Lofty
  // gives no breadcrumb (county results), the address itself
  // (/WI/Douglas-County -> "Douglas County").
  var FILTER_KEEP = {
    "Price": 1, "Beds": 1, "Baths": 1, "Listing Status": 1, "Property Type": 1,
    "Days On Site": 1, "SqFt": 1, "Lot Size": 1, "Water Front Y/N": 1,
    "Water Body": 1, "Keyword": 1
  };
  var FILTER_LABELS = ".title_mid, label.select-text > span, .select-button-group-label, .checkbox-li span.label";
  function hideFilters() {
    document.querySelectorAll(".section-box").forEach(function (box) {
      var shown = 0, seen = 0;
      box.querySelectorAll(FILTER_LABELS).forEach(function (l) {
        var w = l;
        while (w.parentElement && w.parentElement !== box && !w.parentElement.classList.contains("section")) w = w.parentElement;
        if (w === l && l.closest(".checkbox-li")) w = l.closest(".checkbox-li");
        seen++;
        var keep = !!FILTER_KEEP[l.textContent.trim()];
        if (keep) shown++;
        var want = keep ? "" : "none";
        if (w.style.display !== want) w.style.display = want;
      });
      var boxWant = seen && !shown ? "none" : "";
      if (box.style.display !== boxWant) box.style.display = boxWant;
    });
  }

  // A search on one water whose guide exists on northernwi.realestate: the
  // button points at that guide (owner 2026-11-22: steer Water Body searches
  // back to the guides). Read off the water crumb this file builds.
  function waterPlace() {
    var lines = document.querySelectorAll(".md-search .isg-scrumbs > .isg-water");
    if (lines.length !== 1) return null;
    var a = lines[0].querySelector("a[href]");
    return a ? { name: a.textContent.trim(), href: a.getAttribute("href") } : null;
  }

  // Distinct places a search covers, from the location chips and the URL
  // condition. One county under both feed spellings counts once.
  function placeCount() {
    var seen = {};
    function add(kind, v) {
      var s = String(v).trim().toLowerCase();
      if (kind === "county") s = s.replace(/\s+county(?=,|$)/, "");
      if (s) seen[kind + "|" + s] = 1;
    }
    document.querySelectorAll(".md-search .ai-tag-item").forEach(function (t) {
      var m = t.textContent.trim().match(/^(City|County|Zip[^:]*|Postal[^:]*)\s*:\s*(.+)$/i);
      if (m) add(/^c(ity)$/i.test(m[1]) ? "city" : /^county$/i.test(m[1]) ? "county" : "zip", m[2]);
    });
    try {
      var loc = JSON.parse(new URLSearchParams(location.search).get("condition") || "{}").location || {};
      (loc.city || []).forEach(function (v) { add("city", v); });
      (loc.county || []).forEach(function (v) { add("county", v); });
      (loc.zipCode || loc.zip || []).forEach(function (v) { add("zip", v); });
    } catch (e) {}
    return Object.keys(seen).length;
  }

  function searchPlace() {
    var crumbs = Array.prototype.map.call(
      document.querySelectorAll(".md-search .crumbs .crumb_inner"),
      function (c) { return c.textContent.trim(); });
    var name = crumbs.length >= 2 && crumbs[0] === "WI" ? crumbs[crumbs.length - 1] : "";
    if (!name) {
      var m = location.pathname.match(/^(?:\/sold-listing)?\/WI\/([^\/]+)\/?$/);
      if (m) name = decodeURIComponent(m[1]).replace(/-/g, " ");
    }
    if (!name) return null;
    return { name: name, path: "/WI/" + name.replace(/\s+/g, "-") };
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
