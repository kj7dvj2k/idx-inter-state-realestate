/* ==========================================================================
   idx.inter-state.realestate - cosmetic scripts for the ISG Lofty site
   Loaded by one short line at the end of Lofty's Script box
   (CMS > Settings > Tools > Custom Style & Script > Script).
   The lead-capture script stays in Lofty itself, not here.

   Everything here is cosmetic: if this file fails to load, the page still
   works and simply looks like Lofty's default in these two spots.
   Styling for both lives in site.css.
   ========================================================================== */

(function () {
  function q(sel) { return document.querySelector(sel); }

  // Re-run every second: Lofty re-renders parts of the listing page as it
  // loads and when the visitor moves between listings.
  setInterval(function () {

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

    // 2. "Updated <date> - N days on market" moved onto the "Listed by" line.
    //    Lofty's own "Updated:" block is hidden once its text is copied.
    var block = q(".key-info.on-site");
    var listedBy = q(".mls-provided-container");
    var date = block && block.querySelector(".day-site");
    var days = block && block.querySelector(".tiny-site");
    if (date && days && listedBy) {
      var line = q(".isg-updated") || listedBy.appendChild(document.createElement("div"));
      line.className = "isg-updated";
      line.textContent = "Updated " + date.textContent.trim().split(" ")[0] +
        " · " + days.textContent.replace(/^\s*ON MARKET:\s*/i, "").trim();
      block.style.display = "none";
    }

  }, 1000);
})();
