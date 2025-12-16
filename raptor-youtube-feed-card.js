/* 
   -------------------------------------------------------------------------
   Raptor YouTube Feed Card - par Inter-Raptor (Vivien Jardot)
   -------------------------------------------------------------------------
   Carte Lovelace personnalisée pour Home Assistant.

   - Agrège les flux RSS YouTube de plusieurs chaînes en une seule carte.
   - Configuration simple via "Channel IDs" (génère automatiquement les flux RSS).
   - Affichage en mode liste (feed) ou grille (miniatures / video wall).
   - Filtres : par chaîne, et par type (videos / shorts / both).
   - Bouton Actualiser + cache local (localStorage) avec intervalle configurable.
   - Modes de lecture : externe (YouTube), lecteur inline, ou lecteur popup (dialog).
   - Option "taille fixe" pour éviter la déformation des dashboards (scroll interne).

   Utilisation typique dans Lovelace :
   type: custom:raptor-youtube-feed-card
   title: Actu YouTube
   layout: grid
   grid_columns: 3
   player_mode: inline
   show_refresh: true
   show_channel_filters: true
   content_filter: both
   collapsible: true
   show_expand: true
   items_collapsed: 9
   items_expanded: 18
   fixed_height: true
   height: 480
   channel_ids:
     - UCHbCfQACGAsTbgnF6eppHRw

   Auteur  : Inter-Raptor (Vivien Jardot)
   Version : 0.1.0
   -------------------------------------------------------------------------
*/

/* Logo "Raptor" (ASCII art) --------------------------------------------- */
//                                   .,.                                          
//                       *******                        *#### (#####              
//                  ******                          / ########     .#####.        
//              ,*****                          //////##########   #####  /####   
//           .*****                           // /////*#####################  ##  
//         ******                             //// /// ######*      *############ 
//       ******                               ////// /   ###########,            
//     .*****                                 ////////     ##################     
//    ******                                  //////// #                         
//   *****.                                  ## ////// ###                       
//  *****,                              #########/ /// #####/                  , 
// ,*****                           ################ /.######                   
// *****                       (####################   (#####                   *
// ******                   #####   ########   ////////   ###                   .*
//,******             .*** ######### #####*   /////////     # /                 *
// *********    .******* ############ ###### ////////       ////                *
//  ******************* (############# #####///////      *///// ##              *
//   ****************** //// ,######### ###  /########       #########          *
//     ****************  ////////  #####/(       #######.          ####         *
//                       /////// /////  ##     //    (####           ###       **
//                        ///// //////////, /////     .####       /*(##       **
//                       ////// ///////    / ////   ## ###         ,         ,**
//                     ////////////       // ///      #                     ***.
//    .              /////////,         ////,/                             ***   
//                   ///               ......                            ****    
//       ,           ,///##              /////                         ****.     
//         *.         // ###              ,/// /                     *****       
//           ,*       / ####                /*/// ///             *****          
//              **,    ####( ####             ///// ///        ******            
//                 ****  ##### #####                      ,*******               
//                     ******.                      **********                   
//                           ***************************                         

class RaptorYouTubeFeedCard extends HTMLElement {
  static getStubConfig() {
    const defaultId = "UCHbCfQACGAsTbgnF6eppHRw"; // ✅ ta chaîne par défaut (supprimable)
    return {
      type: "custom:raptor-youtube-feed-card",
      title: "Actu YouTube",

      // Preferred input (editor): channel IDs
      channel_ids: [defaultId],

      // Data (feeds will be generated from channel_ids if not provided)
      feeds: [`https://www.youtube.com/feeds/videos.xml?channel_id=${defaultId}`],
      proxy: "allorigins", // "none" | "allorigins" | "corsproxy"
      refresh_minutes: 30,

      // Content filter
      content_filter: "both", // "both" | "videos" | "shorts"

      // Display count
      max_items: 6, // used when collapsible=false
      collapsible: false,
      items_collapsed: 5,
      items_expanded: 12,
      show_expand: false, // default OFF

      // UI buttons
      show_refresh: true, // default ON
      show_channel_filters: false, // optional

      // Layout
      layout: "list", // "list" | "grid"
      grid_columns: 3,
      grid_gap: 10,
      tile_show_title: false,
      tile_show_channel: false,
      tile_show_date: false,

      // List meta
      show_thumbnail: true,
      show_channel: true,
      show_date: true,

      // Player
      player_mode: "external", // "external" | "inline" | "dialog"
      player_autoplay: false,
      player_mute: false,
      open_in_new_tab: true,

      // Labels
      filters_all_label: "Tout",
      refresh_label: "Actualiser",
      expand_label: "Voir plus",
      collapse_label: "Voir moins",

      // Fixed dimensions (OFF by default)
      fixed_height: false, // if true => card keeps a fixed height
      height: 420,         // px
      scroll: true,        // true => internal scroll when content overflows
    };
  }

  // Visual editor hook
  static getConfigElement() {
    return document.createElement("raptor-youtube-feed-card-editor");
  }

  constructor() {
    super();
    this._config = null;
    this._hass = null;

    this._els = null;

    // State
    this._selectedVideo = null;     // inline player
    this._selectedChannel = "__all__";
    this._expanded = false;

    this._lastItems = null;         // cached in-memory items
    this._lastChannels = [];
    this._loading = false;
  }

  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    const stub = RaptorYouTubeFeedCard.getStubConfig();
    this._config = { ...stub, ...(config || {}) };

    // If user provided channel_ids but not feeds, generate feeds automatically
    if ((!Array.isArray(this._config.feeds) || this._config.feeds.length === 0) && Array.isArray(this._config.channel_ids)) {
      this._config.feeds = this._config.channel_ids
        .map((id) => String(id || "").trim())
        .filter(Boolean)
        .map((id) => `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`);
    }

    if (!Array.isArray(this._config.feeds) || this._config.feeds.length === 0) {
      throw new Error("Vous devez fournir 'feeds:' (URLs RSS) ou 'channel_ids:' (IDs de chaînes).");
    }

    // Normalize
    this._config.layout = String(this._config.layout || "list").toLowerCase();
    this._config.proxy = String(this._config.proxy || "allorigins").toLowerCase();
    this._config.player_mode = String(this._config.player_mode || "external").toLowerCase();
    this._config.content_filter = String(this._config.content_filter || "both").toLowerCase();

    this._config.max_items = this._toInt(this._config.max_items, 6);
    this._config.items_collapsed = this._toInt(this._config.items_collapsed, 5);
    this._config.items_expanded = this._toInt(this._config.items_expanded, 12);
    this._config.refresh_minutes = this._toInt(this._config.refresh_minutes, 30);

    this._config.grid_columns = this._clampInt(this._config.grid_columns, 3, 1, 8);
    this._config.grid_gap = this._clampInt(this._config.grid_gap, 10, 0, 40);

    // Fixed size normalize
    this._config.fixed_height = this._config.fixed_height === true;
    this._config.height = this._clampInt(this._config.height, 420, 120, 2000);
    this._config.scroll = this._config.scroll !== false; // default true

    // Reset state
    this._selectedVideo = null;
    this._selectedChannel = "__all__";
    this._expanded = false;
    this._lastItems = null;
    this._lastChannels = [];

    this._renderSkeleton(true);
    this._loadAndRender({ force: true });
  }

  getCardSize() {
    if (this._config?.fixed_height) {
      return Math.max(3, Math.round((this._config.height || 420) / 50));
    }
    return this._config?.layout === "grid" ? 6 : 4;
  }

  // ---------------------------
  // Rendering
  // ---------------------------

  _renderSkeleton(force = false) {
    if (this.shadowRoot && !force) return;
    if (this.shadowRoot && force) this.shadowRoot.innerHTML = "";

    const root = this.attachShadow({ mode: "open" });
    const card = document.createElement("ha-card");
    card.innerHTML = `
      <style>
        .wrap { padding: 14px 16px 12px; }
        .topbar { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .title { font-size: 16px; font-weight: 800; margin: 2px 0 6px; }
        .actions { display:flex; gap:8px; align-items:center; }
        .btn {
          border:0; cursor:pointer;
          padding: 6px 10px;
          border-radius: 10px;
          background: rgba(127,127,127,0.18);
          color: inherit;
          font-weight: 800;
          line-height: 1;
        }
        .btn:hover { background: rgba(127,127,127,0.26); }

        .sub { opacity: 0.75; font-size: 12px; margin-top: 6px; }
        .loading { opacity: 0.75; }

        /* Fixed content area (optional) */
        .contentWrap{
          height: var(--ryfc-height, auto);
          overflow: var(--ryfc-overflow, visible);
        }

        /* Filters */
        .filters {
          display:flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 10px 0 12px;
        }
        .chip {
          border: 0;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(127,127,127,0.14);
          color: inherit;
          font-weight: 800;
          font-size: 12px;
        }
        .chip:hover { background: rgba(127,127,127,0.22); }
        .chip.active { background: rgba(127,127,127,0.30); }

        /* List layout */
        .list { display: flex; flex-direction: column; gap: 10px; }
        .item {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 10px;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }
        .item:active { transform: scale(0.995); }

        .thumb {
          width: 120px; height: 68px;
          border-radius: 10px;
          object-fit: cover;
          background: rgba(127,127,127,0.20);
        }

        .meta { display:flex; flex-direction:column; gap: 4px; min-width: 0; }
        .name {
          font-size: 14px;
          font-weight: 800;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .row { display:flex; gap: 8px; flex-wrap: wrap; opacity: 0.80; font-size: 12px; }
        .pill {
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(127,127,127,0.14);
        }

        /* Grid layout */
        .grid {
          display: grid;
          grid-template-columns: repeat(var(--ryfc-cols, 3), 1fr);
          gap: var(--ryfc-gap, 10px);
        }
        .tile {
          cursor: pointer;
          border-radius: 12px;
          overflow: hidden;
          background: rgba(127,127,127,0.20);
          position: relative;
          aspect-ratio: 16 / 9;
        }
        .tile img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display:block;
        }
        .tileOverlay {
          position:absolute;
          left: 8px;
          right: 8px;
          bottom: 8px;
          display:flex;
          flex-direction:column;
          gap: 6px;
          pointer-events:none;
        }
        .tileTitle {
          font-size: 12px;
          font-weight: 900;
          line-height: 1.2;
          color: white;
          text-shadow: 0 2px 10px rgba(0,0,0,0.8);
          overflow:hidden;
          display:-webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .tileBadges { display:flex; gap:6px; flex-wrap: wrap; }
        .tilePill {
          font-size: 11px;
          font-weight: 900;
          padding: 2px 8px;
          border-radius: 999px;
          color: white;
          background: rgba(0,0,0,0.45);
          text-shadow: 0 1px 6px rgba(0,0,0,0.6);
          max-width: 100%;
          overflow:hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Inline player */
        .playerHeader {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .playerTitle {
          font-weight: 900;
          overflow:hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .playerBox {
          position: relative;
          padding-top: 56.25%;
          border-radius: 12px;
          overflow: hidden;
          background: rgba(127,127,127,0.12);
        }
        .playerBox iframe {
          position:absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }

        .footer {
          margin-top: 10px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
        }
        .hint { opacity: 0.75; font-size: 12px; }

        .error { color: var(--error-color); }

        @media (max-width: 420px) {
          .item { grid-template-columns: 92px 1fr; }
          .thumb { width: 92px; height: 52px; border-radius: 8px; }
        }
      </style>

      <div class="wrap">
        <div class="topbar">
          <div class="title"></div>
          <div class="actions"></div>
        </div>

        <div class="filters" style="display:none;"></div>

        <div class="contentWrap">
          <div class="content loading">Chargement…</div>
        </div>

        <div class="footer">
          <div class="hint"></div>
          <div class="footerActions"></div>
        </div>
      </div>
    `;
    root.appendChild(card);

    this._els = {
      card,
      title: card.querySelector(".title"),
      actions: card.querySelector(".actions"),
      filters: card.querySelector(".filters"),
      contentWrap: card.querySelector(".contentWrap"),
      content: card.querySelector(".content"),
      hint: card.querySelector(".hint"),
      footerActions: card.querySelector(".footerActions"),
    };

    // Apply fixed height settings (optional)
    if (this._config.fixed_height) {
      const reserved = 140; // px
      const contentH = Math.max(120, this._config.height - reserved);
      this._els.card.style.setProperty("--ryfc-height", `${contentH}px`);
      this._els.card.style.setProperty("--ryfc-overflow", this._config.scroll ? "auto" : "hidden");
    } else {
      this._els.card.style.setProperty("--ryfc-height", "auto");
      this._els.card.style.setProperty("--ryfc-overflow", "visible");
    }

    // Header actions (refresh)
    this._els.actions.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button");
      if (!btn) return;
      if (btn.dataset.action === "refresh") {
        if (this._loading) return;
        this._loadAndRender({ force: true, clearCache: true });
      }
    });

    // Filters
    this._els.filters.addEventListener("click", (ev) => {
      const chip = ev.target?.closest?.("button");
      if (!chip) return;
      if (chip.dataset.action !== "filter") return;

      const channel = chip.dataset.channel || "__all__";
      this._selectedChannel = channel;
      this._selectedVideo = null;
      this._renderFromMemory();
    });

    // Footer actions (expand/collapse)
    this._els.footerActions.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button");
      if (!btn) return;
      if (btn.dataset.action === "toggleExpand") {
        this._expanded = !this._expanded;
        this._renderFromMemory();
      }
    });

    // Content click (items + inline back)
    this._els.content.addEventListener("click", (ev) => {
      const t = ev.target;

      if (t && t.classList && t.classList.contains("ryfc-back")) {
        this._selectedVideo = null;
        this._renderFromMemory();
        return;
      }

      const clickable = t?.closest?.("[data-action='select']");
      if (!clickable) return;

      const link = clickable.dataset.link || "";
      const title = clickable.dataset.title || "";
      const channel = clickable.dataset.channel || "";
      const ts = parseInt(clickable.dataset.ts || "0", 10) || 0;
      const thumb = clickable.dataset.thumb || "";

      this._onSelectVideo({ link, title, channel, published_ts: ts, thumbnail: thumb });
    });
  }

  async _loadAndRender({ force = false, clearCache = false } = {}) {
    if (!this._config) return;

    this._els.title.textContent = this._config.title || "Actu YouTube";
    this._setLoading(true);
    this._renderHeaderActions();

    try {
      const items = await this._getMergedItems({ force, clearCache });

      this._lastItems = items;
      this._lastChannels = this._extractChannels(items);

      if (this._selectedChannel !== "__all__" && !this._lastChannels.includes(this._selectedChannel)) {
        this._selectedChannel = "__all__";
      }

      this._renderFromMemory();
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      this._els.content.classList.remove("loading");
      this._els.content.innerHTML = `
        <div class="sub error">Erreur: ${this._escape(msg)}</div>
        <div class="sub">Astuce : active <b>proxy: allorigins</b> si YouTube bloque (CORS).</div>
      `;
      this._els.hint.textContent = "";
      this._renderFilters([]);
      this._renderFooterActions(0);
    } finally {
      this._setLoading(false);
      this._renderHeaderActions();
    }
  }

  _renderFromMemory() {
    const items = Array.isArray(this._lastItems) ? this._lastItems : [];

    if (this._config.show_channel_filters) {
      this._renderFilters(this._lastChannels);
    } else {
      this._renderFilters([]);
    }

    // Inline player view
    if (this._selectedVideo && this._config.player_mode === "inline") {
      this._els.content.classList.remove("loading");
      this._els.content.innerHTML = this._renderInlinePlayer(this._selectedVideo);
      this._els.hint.textContent = `Sources : ${this._config.feeds.length} flux RSS`;
      this._renderFooterActions(0);
      return;
    }

    // Channel filter
    let filtered = (this._selectedChannel === "__all__")
      ? items
      : items.filter((x) => (x.channel || "") === this._selectedChannel);

    // Shorts/videos filter
    const cf = (this._config.content_filter || "both").toLowerCase();
    if (cf === "shorts") {
      filtered = filtered.filter((x) => this._isShort(x));
    } else if (cf === "videos") {
      filtered = filtered.filter((x) => !this._isShort(x));
    }

    const visibleCount = this._getVisibleCount();
    const shown = filtered.slice(0, visibleCount);

    if (shown.length === 0) {
      this._els.content.classList.remove("loading");
      this._els.content.innerHTML = `<div class="sub">Aucune vidéo trouvée.</div>`;
      this._els.hint.textContent = `Sources : ${this._config.feeds.length} flux RSS`;
      const canExpand = this._config.collapsible && this._config.show_expand;
      this._renderFooterActions(canExpand ? filtered.length : 0);
      return;
    }

    if (this._config.layout === "grid") {
      this._els.content.classList.remove("loading");
      this._els.content.style.setProperty("--ryfc-cols", String(this._config.grid_columns));
      this._els.content.style.setProperty("--ryfc-gap", `${this._config.grid_gap}px`);
      this._els.content.innerHTML = `
        <div class="grid">
          ${shown.map((it, i) => this._renderTile(it, i)).join("")}
        </div>
      `;
    } else {
      this._els.content.classList.remove("loading");
      this._els.content.innerHTML = `
        <div class="list">
          ${shown.map((it, i) => this._renderListItem(it, i)).join("")}
        </div>
      `;
    }

    this._els.hint.textContent = `Sources : ${this._config.feeds.length} flux RSS`;

    const canExpand = this._config.collapsible && this._config.show_expand && filtered.length > this._config.items_collapsed;
    this._renderFooterActions(canExpand ? filtered.length : 0);
  }

  _renderHeaderActions() {
    const parts = [];
    if (this._config.show_refresh) {
      parts.push(`
        <button class="btn" data-action="refresh" title="${this._escapeAttr(this._config.refresh_label)}">
          ⟳
        </button>
      `);
    }
    this._els.actions.innerHTML = parts.join("");
  }

  _renderFilters(channels) {
    if (!channels || channels.length === 0) {
      this._els.filters.style.display = "none";
      this._els.filters.innerHTML = "";
      return;
    }

    const allLabel = this._config.filters_all_label || "Tout";

    const chips = [
      this._renderChip(allLabel, "__all__", this._selectedChannel === "__all__"),
      ...channels.map((c) => this._renderChip(c, c, this._selectedChannel === c)),
    ];

    this._els.filters.style.display = "flex";
    this._els.filters.innerHTML = chips.join("");
  }

  _renderChip(label, channelValue, active) {
    return `
      <button class="chip ${active ? "active" : ""}"
        data-action="filter"
        data-channel="${this._escapeAttr(channelValue)}"
        title="${this._escapeAttr(label)}"
      >${this._escape(label)}</button>
    `;
  }

  _renderFooterActions(_totalFiltered) {
    const parts = [];

    if (this._config.collapsible && this._config.show_expand) {
      const expanded = this._expanded === true;
      const label = expanded
        ? (this._config.collapse_label || "Voir moins")
        : (this._config.expand_label || "Voir plus");
      parts.push(`<button class="btn" data-action="toggleExpand">${this._escape(label)}</button>`);
    }

    this._els.footerActions.innerHTML = parts.join("");
  }

  _renderListItem(it, idx) {
    const showThumb = this._config.show_thumbnail !== false && !!it.thumbnail;
    const showChannel = this._config.show_channel !== false && !!it.channel;
    const showDate = this._config.show_date !== false && !!it.published_ts;

    const dateStr = showDate ? new Date(it.published_ts).toLocaleString() : "";

    return `
      <div class="item"
        data-action="select"
        data-idx="${idx}"
        data-link="${this._escapeAttr(it.link)}"
        data-title="${this._escapeAttr(it.title)}"
        data-channel="${this._escapeAttr(it.channel || "")}"
        data-ts="${this._escapeAttr(String(it.published_ts || 0))}"
        data-thumb="${this._escapeAttr(it.thumbnail || "")}"
        title="${this._escapeAttr(it.title)}"
      >
        ${showThumb ? `<img class="thumb" src="${this._escapeAttr(it.thumbnail)}" alt="">` : `<div class="thumb"></div>`}
        <div class="meta">
          <div class="name">${this._escape(it.title)}</div>
          <div class="row">
            ${showChannel ? `<span class="pill">${this._escape(it.channel)}</span>` : ""}
            ${showDate ? `<span class="pill">${this._escape(dateStr)}</span>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  _renderTile(it, idx) {
    const showTitle = this._config.tile_show_title === true;
    const showChannel = this._config.tile_show_channel === true && !!it.channel;
    const showDate = this._config.tile_show_date === true && !!it.published_ts;

    const dateStr = showDate ? new Date(it.published_ts).toLocaleDateString() : "";

    return `
      <div class="tile"
        data-action="select"
        data-idx="${idx}"
        data-link="${this._escapeAttr(it.link)}"
        data-title="${this._escapeAttr(it.title)}"
        data-channel="${this._escapeAttr(it.channel || "")}"
        data-ts="${this._escapeAttr(String(it.published_ts || 0))}"
        data-thumb="${this._escapeAttr(it.thumbnail || "")}"
        title="${this._escapeAttr(it.title)}"
      >
        ${it.thumbnail ? `<img src="${this._escapeAttr(it.thumbnail)}" alt="">` : ""}
        ${(showTitle || showChannel || showDate) ? `
          <div class="tileOverlay">
            ${showTitle ? `<div class="tileTitle">${this._escape(it.title)}</div>` : ""}
            ${(showChannel || showDate) ? `
              <div class="tileBadges">
                ${showChannel ? `<div class="tilePill">${this._escape(it.channel)}</div>` : ""}
                ${showDate ? `<div class="tilePill">${this._escape(dateStr)}</div>` : ""}
              </div>
            ` : ""}
          </div>
        ` : ""}
      </div>
    `;
  }

  _setLoading(isLoading) {
    this._loading = !!isLoading;
    this._els.content.classList.toggle("loading", this._loading);
    if (this._loading) this._els.content.textContent = "Chargement…";
  }

  _getVisibleCount() {
    if (this._config.collapsible) {
      const collapsed = Math.max(1, this._config.items_collapsed);
      const expanded = Math.max(collapsed, this._config.items_expanded);
      return this._expanded ? expanded : collapsed;
    }
    return Math.max(1, this._config.max_items);
  }

  // Shorts detection
  _isShort(item) {
    const link = (item.link || "").toLowerCase();
    return link.includes("/shorts/");
  }

  // Player
  _onSelectVideo(item) {
    const id = this._extractVideoId(item.link);
    const mode = (this._config.player_mode || "external").toLowerCase();

    if (!id || mode === "external") {
      window.open(item.link, this._config.open_in_new_tab ? "_blank" : "_self");
      return;
    }

    const video = { ...item, id };

    if (mode === "inline") {
      this._selectedVideo = video;
      this._renderFromMemory();
      return;
    }

    if (mode === "dialog") {
      this._openDialog(video);
      return;
    }

    window.open(item.link, this._config.open_in_new_tab ? "_blank" : "_self");
  }

  _extractVideoId(url) {
    try {
      const u = new URL(url);

      if (u.hostname.includes("youtube.com")) {
        const v = u.searchParams.get("v");
        if (v) return v;

        const m = u.pathname.match(/\/shorts\/([^/?]+)/);
        if (m && m[1]) return m[1];

        return null;
      }

      if (u.hostname === "youtu.be") {
        return u.pathname.replace("/", "") || null;
      }

      return null;
    } catch {
      return null;
    }
  }

  _buildEmbedSrc(videoId) {
    const autoplay = this._config.player_autoplay ? "1" : "0";
    const mute = this._config.player_mute ? "1" : "0";
    const origin = encodeURIComponent(window.location.origin);

    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=${autoplay}&mute=${mute}&origin=${origin}`;
  }

  _renderInlinePlayer(video) {
    const src = this._buildEmbedSrc(video.id);

    const showChannel = this._config.show_channel !== false && !!video.channel;
    const showDate = this._config.show_date !== false && !!video.published_ts;
    const dateStr = showDate ? new Date(video.published_ts).toLocaleString() : "";

    return `
      <div class="playerHeader">
        <div style="min-width:0;">
          <div class="playerTitle">${this._escape(video.title)}</div>
          <div class="row" style="margin-top:6px;">
            ${showChannel ? `<span class="pill">${this._escape(video.channel)}</span>` : ""}
            ${showDate ? `<span class="pill">${this._escape(dateStr)}</span>` : ""}
          </div>
        </div>
        <button class="btn ryfc-back" title="Retour">✕</button>
      </div>

      <div class="playerBox">
        <iframe
          src="${src}"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>

      <div style="margin-top:10px;">
        <button class="btn ryfc-back">← Retour à la liste</button>
      </div>
    `;
  }

  _openDialog(video) {
    const src = this._buildEmbedSrc(video.id);

    const overlay = document.createElement("div");
    overlay.innerHTML = `
      <style>
        .ryfc-ov{
          position:fixed; inset:0;
          background:rgba(0,0,0,.55);
          display:flex; align-items:center; justify-content:center;
          z-index:9999;
        }
        .ryfc-dlg{
          width:min(900px,92vw);
          background:var(--card-background-color, #fff);
          color: var(--primary-text-color, #000);
          border-radius:16px;
          overflow:hidden;
          box-shadow:0 10px 30px rgba(0,0,0,.35);
        }
        .ryfc-hdr{
          display:flex; align-items:center; justify-content:space-between; gap:10px;
          padding:10px 14px; font-weight:900;
          border-bottom: 1px solid rgba(127,127,127,.25);
        }
        .ryfc-title{
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .ryfc-btn{
          border:0; background:rgba(127,127,127,.20);
          border-radius:10px; padding:6px 10px; cursor:pointer;
          color: inherit; font-weight: 900;
        }
        .ryfc-btn:hover{ background:rgba(127,127,127,.28); }
        .ryfc-vid{ position:relative; padding-top:56.25%; background: rgba(127,127,127,.12); }
        .ryfc-vid iframe{ position:absolute; inset:0; width:100%; height:100%; border:0; }
      </style>
      <div class="ryfc-ov">
        <div class="ryfc-dlg" role="dialog" aria-modal="true">
          <div class="ryfc-hdr">
            <div class="ryfc-title">${this._escape(video.title)}</div>
            <button class="ryfc-btn ryfc-close" title="Fermer">✕</button>
          </div>
          <div class="ryfc-vid">
            <iframe
              src="${src}"
              referrerpolicy="strict-origin-when-cross-origin"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    overlay.querySelector(".ryfc-close")?.addEventListener("click", close);
    overlay.querySelector(".ryfc-ov")?.addEventListener("click", (e) => {
      if (e.target.classList.contains("ryfc-ov")) close();
    });

    document.body.appendChild(overlay);
  }

  // RSS fetch + cache
  async _getMergedItems({ force = false, clearCache = false } = {}) {
    const feeds = this._config.feeds.filter(Boolean);
    const refreshMs = Math.max(1, this._config.refresh_minutes) * 60 * 1000;

    const cacheKey = "ryfc:" + this._hash(JSON.stringify({
      feeds,
      proxy: this._config.proxy,
    }));

    const now = Date.now();

    if (clearCache) {
      try { localStorage.removeItem(cacheKey); } catch (_) {}
    }

    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (cached && Array.isArray(cached.items) && typeof cached.ts === "number") {
          if (now - cached.ts < refreshMs) {
            return cached.items
              .map((x) => ({ ...x, published_ts: Number(x.published_ts || 0) }))
              .sort((a, b) => b.published_ts - a.published_ts);
          }
        }
      } catch (_) {}
    }

    const results = await Promise.allSettled(feeds.map((url) => this._fetchFeed(url)));
    const merged = [];

    for (const r of results) {
      if (r.status === "fulfilled" && Array.isArray(r.value)) merged.push(...r.value);
    }

    merged.sort((a, b) => b.published_ts - a.published_ts);

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ ts: now, items: merged }));
    } catch (_) {}

    return merged;
  }

  _applyProxy(url) {
    const p = (this._config.proxy || "allorigins").toLowerCase();
    if (p === "none") return url;
    if (p === "allorigins") return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    if (p === "corsproxy") return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    return url;
  }

  async _fetchFeed(url) {
    const finalUrl = this._applyProxy(url);

    const res = await fetch(finalUrl, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
    });

    if (!res.ok) throw new Error(`Flux inaccessible (${res.status}) : ${url}`);

    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "application/xml");

    const parserErr = doc.querySelector("parsererror");
    if (parserErr) throw new Error(`RSS invalide : ${url}`);

    const entries = Array.from(doc.getElementsByTagName("entry"));
    return entries.map((entry) => this._parseEntry(entry)).filter(Boolean);
  }

  _parseEntry(entry) {
    const title = this._text(entry, "title") || "Sans titre";
    const linkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector("link");
    const link = linkEl?.getAttribute("href") || "";
    const published = this._text(entry, "published") || this._text(entry, "updated") || "";
    const published_ts = published ? Date.parse(published) : 0;

    const authorName = entry.querySelector("author > name")?.textContent?.trim() || "";

    const mediaThumb =
      entry.querySelector("media\\:group media\\:thumbnail") ||
      entry.querySelector("thumbnail") ||
      entry.querySelector("media\\:thumbnail");
    const thumbnail = mediaThumb?.getAttribute("url") || "";

    if (!link) return null;

    return {
      title,
      link,
      channel: authorName,
      published,
      published_ts: Number.isFinite(published_ts) ? published_ts : 0,
      thumbnail,
    };
  }

  _extractChannels(items) {
    const set = new Set();
    for (const it of items) {
      const c = (it.channel || "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }

  // Utils
  _text(root, tag) {
    const el = root.getElementsByTagName(tag)?.[0];
    return el?.textContent?.trim() || "";
  }

  _escape(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  _escapeAttr(s) {
    return this._escape(s).replaceAll("\n", " ").replaceAll("\r", " ");
  }

  _hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  _toInt(v, d) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
  }

  _clampInt(v, d, min, max) {
    const n = this._toInt(v, d);
    return Math.max(min, Math.min(max, n));
  }
}

customElements.define("raptor-youtube-feed-card", RaptorYouTubeFeedCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "raptor-youtube-feed-card",
  name: "Raptor YouTube Feed Card",
  description: "Flux RSS YouTube multi-chaînes avec miniatures, filtres, rafraîchissement, grille, lecteur inline/dialog + filtre shorts/vidéos + hauteur fixe optionnelle + éditeur visuel (channel_id).",
});


/* ============================================================================
 * Visual editor (ha-form)
 * - asks for channel IDs (1 per line)
 * - generates feeds automatically
 * - exposes all options
 * ============================================================================
 */

class RaptorYouTubeFeedCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...(config || {}) };
    this._render();
  }

  _emitChanged() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  _valueChanged(ev) {
    if (!this._config) return;
    const v = ev.detail?.value || {};
    this._config = { ...this._config, ...v };

    // channel_ids_text -> channel_ids[] -> feeds[]
    if (typeof this._config.channel_ids_text === "string") {
      const ids = this._config.channel_ids_text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      this._config.channel_ids = ids;
      this._config.feeds = ids.map(
        (id) => `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`
      );

      delete this._config.channel_ids_text;
    }

    if (!Array.isArray(this._config.channel_ids)) this._config.channel_ids = [];
    if (!Array.isArray(this._config.feeds)) this._config.feeds = [];

    this._emitChanged();
  }

  _render() {
    if (!this._config) return;

    const defaultId = "UCHbCfQACGAsTbgnF6eppHRw";

    const idsText =
      Array.isArray(this._config.channel_ids) && this._config.channel_ids.length
        ? this._config.channel_ids.join("\n")
        : defaultId; // pré-rempli, supprimable

    const data = { ...this._config, channel_ids_text: idsText };

    const schema = [
      { name: "title", selector: { text: {} } },

      { name: "channel_ids_text", selector: { text: { multiline: true } } },

      { name: "proxy", selector: { select: { mode: "dropdown", options: [
        { value: "allorigins", label: "allorigins (recommandé)" },
        { value: "corsproxy", label: "corsproxy.io" },
        { value: "none", label: "aucun (direct)" },
      ]}}},

      { name: "refresh_minutes", selector: { number: { min: 1, max: 1440, mode: "box" } } },

      { name: "layout", selector: { select: { mode: "dropdown", options: [
        { value: "list", label: "Liste" },
        { value: "grid", label: "Grille" },
      ]}}},

      { name: "grid_columns", selector: { number: { min: 1, max: 8, mode: "box" } } },
      { name: "grid_gap", selector: { number: { min: 0, max: 40, mode: "box" } } },

      { name: "content_filter", selector: { select: { mode: "dropdown", options: [
        { value: "both", label: "Vidéos + Shorts" },
        { value: "videos", label: "Vidéos seulement" },
        { value: "shorts", label: "Shorts seulement" },
      ]}}},

      { name: "show_refresh", selector: { boolean: {} } },
      { name: "show_channel_filters", selector: { boolean: {} } },

      { name: "collapsible", selector: { boolean: {} } },
      { name: "show_expand", selector: { boolean: {} } },
      { name: "max_items", selector: { number: { min: 1, max: 200, mode: "box" } } },
      { name: "items_collapsed", selector: { number: { min: 1, max: 200, mode: "box" } } },
      { name: "items_expanded", selector: { number: { min: 1, max: 500, mode: "box" } } },

      // List meta
      { name: "show_thumbnail", selector: { boolean: {} } },
      { name: "show_channel", selector: { boolean: {} } },
      { name: "show_date", selector: { boolean: {} } },

      // Grid tile meta
      { name: "tile_show_title", selector: { boolean: {} } },
      { name: "tile_show_channel", selector: { boolean: {} } },
      { name: "tile_show_date", selector: { boolean: {} } },

      // Player
      { name: "player_mode", selector: { select: { mode: "dropdown", options: [
        { value: "external", label: "Ouvrir YouTube (external)" },
        { value: "inline", label: "Lecteur dans la carte (inline)" },
        { value: "dialog", label: "Popup (dialog)" },
      ]}}},

      { name: "player_autoplay", selector: { boolean: {} } },
      { name: "player_mute", selector: { boolean: {} } },
      { name: "open_in_new_tab", selector: { boolean: {} } },

      // Labels
      { name: "filters_all_label", selector: { text: {} } },
      { name: "refresh_label", selector: { text: {} } },
      { name: "expand_label", selector: { text: {} } },
      { name: "collapse_label", selector: { text: {} } },

      // Fixed size
      { name: "fixed_height", selector: { boolean: {} } },
      { name: "height", selector: { number: { min: 120, max: 2000, mode: "box" } } },
      { name: "scroll", selector: { boolean: {} } },
    ];

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        .wrap{ padding: 12px; }
        .hint{ opacity:.75; font-size:12px; margin-top:10px; line-height:1.35; }
        code{ font-family: monospace; }
      </style>
      <div class="wrap">
        <ha-form></ha-form>
        <div class="hint">
          <b>Channel IDs (1 par ligne)</b><br>
          Exemple : <code>${defaultId}</code><br>
          (La carte génère automatiquement les flux RSS YouTube.)
        </div>
      </div>
    `;

    const form = this.shadowRoot.querySelector("ha-form");
    form.schema = schema;
    form.data = data;

    form.computeLabel = (s) => {
      const map = {
        title: "Titre",
        channel_ids_text: "Channel IDs (1 ID par ligne)",
        proxy: "Proxy CORS",
        refresh_minutes: "Rafraîchissement (minutes)",

        layout: "Affichage",
        grid_columns: "Colonnes (grille)",
        grid_gap: "Espace (grille)",

        content_filter: "Filtre (Vidéos/Shorts)",

        show_refresh: "Bouton Actualiser",
        show_channel_filters: "Filtres par chaîne",

        collapsible: "Voir plus/moins activé",
        show_expand: "Afficher bouton Voir plus/moins",
        max_items: "Nombre (si pas de Voir plus/moins)",
        items_collapsed: "Nombre (mode réduit)",
        items_expanded: "Nombre (mode étendu)",

        show_thumbnail: "Miniature (liste)",
        show_channel: "Nom chaîne (liste)",
        show_date: "Date (liste)",

        tile_show_title: "Titre (grille)",
        tile_show_channel: "Chaîne (grille)",
        tile_show_date: "Date (grille)",

        player_mode: "Mode de lecture",
        player_autoplay: "Lecture auto",
        player_mute: "Muet",
        open_in_new_tab: "Ouvrir liens dans nouvel onglet",

        filters_all_label: "Libellé filtre 'Tout'",
        refresh_label: "Libellé bouton refresh",
        expand_label: "Libellé 'Voir plus'",
        collapse_label: "Libellé 'Voir moins'",

        fixed_height: "Taille fixe (anti-déformation dashboard)",
        height: "Hauteur (px)",
        scroll: "Scroll interne",
      };
      return map[s.name] || s.name;
    };

    form.addEventListener("value-changed", (ev) => this._valueChanged(ev));
  }
}

customElements.define("raptor-youtube-feed-card-editor", RaptorYouTubeFeedCardEditor);
