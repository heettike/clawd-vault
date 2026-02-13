# clawd vault

a chrome extension that saves links to your ai agent's memory via [openclaw](https://openclaw.com).

no databases. no cloud accounts. your links go straight to your agent — who can remember, search, and reason about everything you save.

## what it does

- **save any page** with `cmd+shift+v` (or `ctrl+shift+v`)
- **add context** — write a note, select a category, highlight text before saving
- **search your vault** from the popup
- **right-click to save** any link, image, or selection
- categories: writing, design, code, ideas, knowledge, edit, film

## how it works

1. you save a link from the extension
2. the link is stored locally in the extension + sent to your openclaw gateway
3. your openclaw agent receives it and stores it in its memory
4. ask your agent "what design links did i save?" and it knows

## install

1. clone or download this repo
2. open `chrome://extensions` → enable developer mode
3. click "load unpacked" → select the `extension/` folder
4. click the extension icon → right-click → options
5. enter your openclaw gateway url and token
6. copy `vault-skill/SKILL.md` into your openclaw workspace skills

## design

dark theme. monospace. lowercase. sharp edges. no rounded corners. no emojis. `#0a0a0a` background.

## icons

you'll need to provide your own icon files in the extension folder:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

a simple white glyph on transparent background works well.

## architecture

```
extension (chrome)
  ├── saves locally (chrome.storage.local)
  └── syncs to openclaw gateway (POST /api/v1/message)

openclaw agent
  ├── receives vault:save messages
  ├── stores in vault/items.jsonl
  └── can search + recall on demand
```

the extension works offline — saves are stored locally first. gateway sync is fire-and-forget. if your gateway is down, you still have your links.

## future ideas

- [ ] export vault as json/csv
- [ ] auto-categorize using the agent's llm
- [ ] tag pages with multiple labels
- [ ] "save and summarize" — agent reads the page content and stores a summary
- [ ] vault dashboard — a full-page view of all saved items with filters
- [ ] import from pocket/raindrop/bookmarks
- [ ] sync vault back from agent to extension (bidirectional)
- [ ] share collections — export a category as a shareable link list
- [ ] "why did i save this?" — agent adds its own context based on your browsing patterns

## license

mit
