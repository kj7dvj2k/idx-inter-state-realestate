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

    // 11. Search results for one Wisconsin town, county or ZIP: a button
    //     opposite the headline to the same place's page on
    //     northernwi.realestate.
    var head = q(".md-search .search-result-header");
    var place = head && searchPlace();
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
      var ctaHref = NWIRE + place.path;
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

    // 16. No "free" in the sign-up popup's title ("Create Your Free Account").
    document.querySelectorAll("h1, h2, h3, .title, [class*=title]").forEach(function (h) {
      if (h.children.length || !/\bFree Account\b/.test(h.textContent)) return;
      h.textContent = h.textContent.replace(/\bFree Account\b/, "Account");
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

  // The same listing on northernwi.realestate, or "" off a listing page.
  function nwireListingHref() {
    return /^\/(listing-detail|sold-listing\/detail)\/\d+/.test(location.pathname)
      ? NWIRE + location.pathname : "";
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
