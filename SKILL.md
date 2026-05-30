---
name: "web-content-analyzer"
description: "Analyze webpage or text size before an AI workflow reads it. Use as a content-budget preflight step to choose direct reading, task-focused reading, or chunked progressive reading."
---

# Web Content Analyzer v2.0.0

This skill is a content-budget preflight tool. It does not prove that AI cannot fetch a page. It answers a more useful question: after the content is available, is it wise to feed it to AI all at once?

## When to Use

Use this skill when:

- A user gives a URL and expects the AI to read it.
- A workflow is about to fetch a long article, README, documentation page, or OCR result.
- You need to decide between direct reading, section-specific reading, and progressive chunked reading.
- You want a first-pass estimate of character count, rough token count, line count, and risk level.

Skip it when:

- The text is obviously short.
- The user already named the exact small section to inspect.
- You are only looking at search results or a compact browser snapshot.

## Core Idea

Do not treat "the AI has a link" as equivalent to "the AI read the right thing."

The stable workflow is:

```text
measure content size -> choose reading strategy -> ask a targeted question
```

## API

```javascript
const {
  analyzeWebPage,
  calculateStats,
  assessLevel,
  formatReport
} = require("./analyze");
```

### `analyzeWebPage(url)`

Fetches a URL, extracts readable text when possible, and returns:

- fetched URL
- character count
- rough token estimate
- line count
- truncation flag
- safe/warning/danger assessment
- recommended prompt and actions

### `calculateStats(text)`

Use this when the content is already available, for example OCR output or copied text.

### `assessLevel(stats)`

Returns the strategy level:

| Level | Meaning | Strategy |
|-------|---------|----------|
| safe | short content | read directly |
| warning | medium content | read with a clear task or section target |
| danger | long content | get structure first, then chunk |

## GitHub Handling

- `https://github.com/owner/repo` tries README on `main`, then `master`, then falls back to HTML.
- `https://github.com/owner/repo/blob/branch/path/file.md` converts to the matching raw file.
- Other GitHub URLs are handled as ordinary pages.

## Important Limitation

The token count is a rough estimate. For exact model-specific token counts, add a tokenizer for the target model.
