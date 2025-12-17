![List and Grid comparison](./raptor-youtube-demo-comparison.gif)

# 🦖 Raptor YouTube Feed Card

> **Custom Lovelace card for Home Assistant**  
> Aggregate **YouTube channels** into a single card using **YouTube RSS feeds**, with thumbnails, filters, grid/list layouts and optional embedded playback.

Part of the **Raptor Cards ecosystem**, designed for:
- clean and modern dashboards
- powerful yet simple configuration
- no heavy integrations
- frontend-only logic

---

## ✨ Features

### 📺 YouTube RSS aggregation
- Multiple YouTube channels in one card
- Configuration via **Channel IDs** (no RSS URLs required)
- RSS feeds generated automatically:
  ```
  https://www.youtube.com/feeds/videos.xml?channel_id=...
  ```

### 🔁 Refresh & cache
- Manual refresh button
- Local cache (`localStorage`)
- Configurable refresh interval

### 🧠 Smart filtering
- Filter by **channel**
- Filter by **content type**:
  - Videos only
  - Shorts only
  - Both

### 📐 Layouts
- **List mode** (classic feed layout)
- **Grid mode** (video wall / thumbnails)
- Optional metadata display:
  - title
  - channel name
  - publish date

### ▶️ Playback modes
- Open video directly on YouTube
- **Inline player** (embedded inside the card)
- **Dialog / popup player**

### 📏 Fixed height mode (optional)
- Prevents dashboard reflow
- Keeps card size stable
- Optional internal scrolling

### 🧩 Visual editor (UI)
- Full **Home Assistant visual editor**
- No YAML required
- All options exposed
- Channel IDs entered as simple text

---

## 🖼️ Layout examples

### 📋 List mode (popup player)

![List demo](./raptor-youtube-demo-list.gif)

```yaml
type: custom:raptor-youtube-feed-card
title: Actu YouTube (List)
layout: list

player_mode: dialog
player_autoplay: true

show_refresh: true

collapsible: true
show_expand: true
items_collapsed: 4
items_expanded: 8

channel_ids:
  - UCHbCfQACGAsTbgnF6eppHRw
  - UC_yP2DpIgs5Y1uWC0T03Chw
```

---

### 🧱 Grid mode (3×3, inline player)

![Grid demo](./raptor-youtube-demo-grid.gif)

```yaml
type: custom:raptor-youtube-feed-card
title: Actu YouTube (Grid 3×3)
layout: grid
grid_columns: 3

player_mode: inline
player_autoplay: true

show_refresh: true

collapsible: true
show_expand: true
items_collapsed: 9
items_expanded: 18

tile_show_title: false
tile_show_channel: false
tile_show_date: false

channel_ids:
  - UCHbCfQACGAsTbgnF6eppHRw
  - UC_yP2DpIgs5Y1uWC0T03Chw
```

---

## 📦 Installation

### HACS (recommended)

1. Open **HACS**
2. Go to **Frontend → Custom cards**
3. Search for **Raptor YouTube Feed Card**
4. Install
5. Reload the browser

---

### Manual installation

1. Copy:
   ```
   raptor-youtube-feed-card.js
   ```
   into:
   ```
   /config/www/
   ```

2. Add the resource:
   - **Settings → Dashboards → Resources**
   - Type: **JavaScript module**
   - URL:
     ```
     /local/raptor-youtube-feed-card.js
     ```

3. Reload browser (**Ctrl + F5**)

---

## 🧠 Dependencies & architecture

❌ No Home Assistant integration  
❌ No API key  
✔ Frontend-only card

⚠️ Depends on:
- YouTube **RSS feeds**
- Browser **CORS**
- Optional **proxy**

---

## 🧩 Configuration (Visual editor)

When adding the card, you get a **full visual editor**.

### Channel IDs
Enter **one Channel ID per line**:

```
UCHbCfQACGAsTbgnF6eppHRw
UC_yP2DpIgs5Y1uWC0T03Chw
```

---

## 🦖 Raptor Cards ecosystem

Same philosophy as:
- **Raptor Orbit Card**
- **Raptor Bar Next Card**
- **Raptor Grid Card**

---

## 👤 Author

**Vivien Jardot**  
aka **Inter-Raptor**

🦖 *Build dashboards. Control data. Dominate feeds.*

---

## 📄 License

MIT
