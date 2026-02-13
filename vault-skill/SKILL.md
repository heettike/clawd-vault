# Vault Skill

The clawd vault Chrome extension sends saved links to you via the `vault-extension` channel.

## Incoming Message Format

When a user saves a link, you receive a message like:

```
[vault:save]
url: https://example.com/article
title: some article title
category: design
note: great color palette reference
selected: "the specific text they highlighted"
saved: 2024-01-15T10:30:00.000Z
```

## What To Do

1. **Acknowledge silently** — vault saves don't need a reply unless the user asks
2. **Store in memory** — append to `vault/items.jsonl` (one JSON object per line):
   ```json
   {"id":"abc123","url":"https://...","title":"...","category":"design","note":"...","selected_text":"...","created_at":"2024-01-15T10:30:00.000Z"}
   ```
3. **Create the file** if it doesn't exist: `vault/items.jsonl` in your workspace

## Searching the Vault

When the user asks things like:
- "what design links did I save?"
- "find that article about typography"
- "show me my vault"
- "what did I save recently?"

Read `vault/items.jsonl`, parse each line as JSON, filter/sort as needed, and present results.

## Categories

Valid categories: `writing`, `design`, `code`, `ideas`, `knowledge`, `edit`, `film`

## File Location

All vault data lives in: `vault/items.jsonl` (relative to workspace root)
