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
- **Grid mode** (video wall style)
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

## 📦 Installation

### HACS (recommended)
*(when published)*

1. Open **HACS**
2. Go to **Frontend → Custom cards**
3. Search for **Raptor YouTube Feed Card**
4. Install
5. Reload the browser

---

### Manual installation

1. Copy the file:
   ```
   raptor-youtube-feed-card.js
   ```
   into:
   ```
   /config/www/
   ```

2. Add the resource in Home Assistant:
   - **Settings → Dashboards → Resources**
   - Type: **JavaScript module**
   - URL:
     ```
     /local/raptor-youtube-feed-card.js
     ```

3. Reload the browser (**Ctrl + F5**)

---

## 🧠 Dependencies & architecture

❌ No Home Assistant integration required  
❌ No API key needed  
✔ Works entirely as a frontend card

⚠️ The card depends on:
- YouTube **RSS feeds**
- Browser **CORS restrictions**
- A **proxy** to bypass CORS

### Proxy options
- `allorigins` (default, public)
- `corsproxy.io`
- `none` (direct, may fail due to CORS)

➡️ For public sharing or higher reliability, a **local proxy** (Node-RED / Nginx / HA add-on) is recommended.

---

## 🧩 Configuration (Visual editor)

When adding the card, you get a **full visual editor**.

### Channel IDs input

Enter **one Channel ID per line**:

```
UCHbCfQACGAsTbgnF6eppHRw
UC_yP2DpIgs5Y1uWC0T03Chw
```

The card automatically generates the corresponding YouTube RSS feeds.

> One Channel ID is **pre-filled by default** and can be removed at any time.

---

### 🔎 How to quickly get a Channel ID (YouTube UI)

The easiest method (no external tools required):

1. Open the **YouTube channel page**
2. Click **… More** (or **About / Plus…**, depending on your language)
3. Click **Share channel**
4. Click **Copy channel ID**

Paste the copied ID into the card (one ID per line).

---

## ⚙️ Configuration options

### Playback
```yaml
player_mode: inline     # external | inline | dialog
player_autoplay: false
player_mute: false
open_in_new_tab: true
```

### Content filter
```yaml
content_filter: both    # both | videos | shorts
```

### Layout
```yaml
layout: grid            # list | grid
grid_columns: 3
grid_gap: 10
```

### Expand / collapse
```yaml
collapsible: true
show_expand: true
items_collapsed: 6
items_expanded: 12
```

### Fixed height (recommended for dashboards)
```yaml
fixed_height: true
height: 420
scroll: true
```

---

## 🧪 Minimal YAML example

```yaml
type: custom:raptor-youtube-feed-card
title: YouTube Updates
channel_ids:
  - UCHbCfQACGAsTbgnF6eppHRw
layout: list
player_mode: external
```

---

## 🧪 Video wall example

```yaml
type: custom:raptor-youtube-feed-card
title: YouTube Wall
layout: grid
grid_columns: 3
content_filter: videos
collapsible: true
items_collapsed: 9
items_expanded: 18
player_mode: dialog
fixed_height: true
height: 480
channel_ids:
  - UCHbCfQACGAsTbgnF6eppHRw
  - UC_yP2DpIgs5Y1uWC0T03Chw
```

---

## 🦖 Raptor Cards ecosystem

This card follows the same design philosophy as:

- **Raptor Orbit Card**
- **Raptor Bar Next Card**
- **Raptor Grid Card**
- **Raptor YouTube Feed Card**

Shared goals:
- modular
- readable
- user-first
- no unnecessary dependencies

---

## ⚠️ Known limitations

- YouTube RSS does **not officially mark Shorts**
  - Shorts detection is heuristic (`/shorts/` in URL)
- Public proxy services may be:
  - slow
  - rate-limited
  - unavailable

---

## 🛣️ Possible roadmap

- UI buttons for Videos / Shorts filtering
- Advanced “thumbnails-only” grid mode
- Built-in local proxy helper
- Visual alignment with other Raptor cards

---

## 👤 Author

**Vivien Jardot**  
aka **Inter-Raptor**

🦖 *Build dashboards. Control data. Dominate feeds.*

---

## 📄 License

MIT
****
