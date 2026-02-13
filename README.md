# clawd vault

save links to your agent's memory. chrome extension + openclaw.

## how it works

click the extension icon to save a link. that's it. your agent remembers everything.

### actions

- **1-click icon** — instant save + toast notification (with "+ note" and "cancel" buttons)
- **2-click icon** — opens vault side panel on the current tab (search + browse saved links)
- **cmd+shift+v** — overlay for detailed notes + category selection
- **right-click** — "save to vault" (instant) or "save to vault + add note" (overlay)

### categories

writing, design, code, ideas, knowledge, edit, film

### cancel

every save shows a toast with a cancel button. click it to undo.

## install

```
git clone https://github.com/heettike/clawd-vault.git
```

1. open `chrome://extensions`
2. enable **developer mode** (top right toggle)
3. click **load unpacked**, select the `extension/` folder
4. pin the extension to your toolbar
5. right-click icon > **options** — enter your openclaw gateway url and token

works with chrome, brave, arc, and any chromium browser.

## api

syncs to openclaw gateway via `POST /api/v1/message`. each save sends:

```
[vault:save]
url: https://example.com/article
title: some article title
category: knowledge
note: interesting take on distributed systems
saved: 2025-02-13T21:00:00.000Z
```

## license

mit. do whatever you want.

built on [openclaw](https://openclaw.com).
