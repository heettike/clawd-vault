# clawd vault

a chrome extension that saves links directly to your ai agent's memory via [openclaw](https://openclaw.com).

no cloud accounts. no bookmarks folder you'll never open. links go straight to your agent — who can remember, search, and reason about everything you save.

## features

- **click the icon** — opens the vault popup. search and browse all saved links
- **cmd+shift+v** — overlay for adding notes + picking a category before saving
- **right-click** — quick save any link, image, or selection. or save with a note
- **7 categories** — writing, design, code, ideas, knowledge, edit, film (editable)
- **search** — filter your vault from the popup, instant results
- **dark theme** — monospace, lowercase, sharp edges, `#0a0a0a` background

## install

1. clone this repo

```
git clone https://github.com/heettike/clawd-vault.git
cd clawd-vault
```

2. open `chrome://extensions` in your browser

3. enable **developer mode** (toggle in the top right)

4. click **load unpacked** and select the `extension/` folder

5. pin the extension to your toolbar (click the puzzle icon, then the pin)

6. right-click the extension icon > **options** to enter your openclaw gateway url and token

7. done. click the icon to open your vault, or press `cmd+shift+v` to save with notes

## how it works

```
you save a link
  -> stored locally in chrome.storage
  -> synced to your openclaw gateway (fire-and-forget)
     -> your agent receives [vault:save] messages
     -> agent can search, recall, reason about saved links
```

the extension works offline. saves are stored locally first. if your gateway is down, you still have your links. gateway sync happens in the background.

## usage

| action | what happens |
|--------|-------------|
| click icon | opens vault popup (search + browse) |
| cmd+shift+v | overlay — add note, pick category, save |
| right-click > save to vault | instant save, no prompt |
| right-click > save + add note | opens overlay for notes |

## openclaw integration

the extension sends structured messages to your openclaw gateway:

```
[vault:save]
url: https://example.com/article
title: some article title
category: knowledge
note: interesting take on distributed systems
saved: 2025-02-13T21:00:00.000Z
```

your agent receives these via the gateway's message api. add a vault skill to your agent's workspace to enable search and recall:

```
"what design links did i save last week?"
"find that article about distributed systems"
"summarize everything in my code category"
```

## configuration

open the extension options page (right-click icon > options) to set:

- **gateway url** — your openclaw gateway endpoint (e.g. `https://your-gateway.example.com`)
- **api token** — if your gateway requires authentication

## architecture

```
extension (chrome, manifest v3)
  |-- popup.html/js     vault browser + search
  |-- overlay.js        save overlay (notes + categories)
  |-- background.js     context menus, shortcuts, gateway sync
  |-- options.html/js   gateway configuration
  |
  |-- chrome.storage.local   (primary store, works offline)
  |-- openclaw gateway       (async sync, fire-and-forget)
```

## design

dark theme. monospace. lowercase. sharp edges. no rounded corners. `#0a0a0a` background. no emojis.

## license

mit
