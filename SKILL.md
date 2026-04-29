---
name: "web-content-analyzer"
description: "Analyze web page content length and recommend optimal AI reading strategy. Use before fetching web content to avoid context overflow. Returns character count, token estimate, risk level (safe/warning/danger), and recommended prompts."
---

# Web Content Analyzer v1.0.0

Analyze web page content length before giving it to AI. Prevents context overflow by recommending the right reading strategy.

## When to Use This Skill

Use this skill when:

- You are about to give AI a web page URL to read
- You want to know if a page is too long for AI to process completely
- You need to choose between direct reading, section-specific reading, or progressive dialogue
- Another skill needs to assess content length before processing
- You want to generate optimal prompts for long documents

## Core Capabilities

- **Content Length Analysis**: Character count, token estimate, screen count
- **Risk Assessment**: Three-level rating (safe / warning / danger)
- **Strategy Recommendation**: Auto-generate optimal AI prompts
- **GitHub Support**: Auto-fetch raw README from GitHub repos
- **Composable**: Can be called by other skills as a pre-check

## Quick Start

### As a Standalone Tool

```bash
# Analyze a web page
node analyze.js https://github.com/openclaw/openclaw

# Output:
# 📊 Total: 46,025 chars | ~69,038 tokens | 🔴 Danger
# 💡 Strategy: Must split - ask for document structure first
```

### As a Pre-Check for Other Skills

```javascript
const { analyzeWebPage } = require('./analyze');

// Before fetching content, check if it's safe
const report = await analyzeWebPage(url);

if (report.assessment.level === 'danger') {
  // Use progressive dialogue instead of direct reading
  return report.recommendations.bestPrompt;
} else {
  // Safe to read directly
  return report.recommendations.alternativePrompts.direct;
}
```

### As an AI Agent Tool

```
User: "Help me install OpenClaw from https://github.com/openclaw/openclaw"

AI workflow:
1. Call web-content-analyzer first
2. Result: 🔴 Danger (46,025 chars, ~69K tokens)
3. Strategy: Ask for document structure, then drill into specific sections
4. Execute: "What is the structure of this document?"
5. Then: "What does the Installation section say?"
```

## Three-Level Assessment

| Level | Chars | Strategy | Example |
|-------|-------|----------|---------|
| 🟢 Safe | < 3,000 | Read directly | Blog posts, short docs |
| 🟡 Warning | 3,000-10,000 | Specify sections | GitHub READMEs, tutorials |
| 🔴 Danger | > 10,000 | Must split | Full API docs, books |

## API Reference

### `analyzeWebPage(url)`

Returns a report object:

```javascript
{
  url: "https://example.com",
  timestamp: "2026-04-29T18:00:00.000Z",
  statistics: {
    totalChars: 46025,
    chineseChars: 0,
    englishWords: 5691,
    estimatedTokens: 69038,
    estimatedScreens: 12
  },
  assessment: {
    level: "danger",        // "safe" | "warning" | "danger"
    emoji: "🔴",
    label: "危险",
    description: "Content is very long, AI can only read a small portion",
    strategy: "Must split: ask for structure first, then drill into sections",
    confidence: "low"
  },
  recommendations: {
    bestPrompt: "...",
    alternativePrompts: {
      direct: "...",
      structured: "..."
    }
  }
}
```

### `formatReport(report)`

Returns a formatted string for display.

## Integration Patterns

### Pattern 1: Pre-Search Filter

```
Other Skill → wants to fetch URL
    ↓
web-content-analyzer → checks length
    ↓
If safe → proceed with direct fetch
If danger → switch to progressive dialogue
```

### Pattern 2: Multi-URL Prioritizer

```javascript
// Rank multiple URLs by content length
const urls = [url1, url2, url3];
const reports = await Promise.all(urls.map(analyzeWebPage));
const sorted = reports.sort((a, b) => a.statistics.totalChars - b.statistics.totalChars);
// Read shortest first, longest with progressive dialogue
```

### Pattern 3: Context Budget Manager

```javascript
// Given a context budget, decide how many pages to read
const budget = 50000; // tokens
let used = 0;
for (const url of urls) {
  const report = await analyzeWebPage(url);
  if (used + report.statistics.estimatedTokens <= budget) {
    // Safe to read this page
    used += report.statistics.estimatedTokens;
  } else {
    // Skip or use progressive dialogue
  }
}
```

## Configuration

```javascript
const SKILL_CONFIG = {
  safeThreshold: 3000,      // 🟢 Safe line
  warningThreshold: 10000,  // 🟡 Warning line
  tokenRatio: 1.5,          // Chinese chars to tokens ratio
  maxFetchLength: 50000     // Max fetch length (prevents huge pages)
};
```

## Threshold Rationale

Based on AI context window limits:

| Metric | Value | Source |
|--------|-------|--------|
| Single tool return | ~2-8K tokens | WebSearch actual return |
| Safe context | ~100K tokens | Compression threshold |
| Chinese:Token ratio | 1:1.5 | Empirical measurement |

Calculation:
- 3,000 Chinese chars ≈ 4,500 tokens → within single return limit
- 10,000 Chinese chars ≈ 15,000 tokens → approaching single return limit

## Why This Matters

Without this tool:
```
User gives AI a URL → AI reads only first 20% → Misses critical info → Task fails
```

With this tool:
```
User gives AI a URL → Analyzer checks length → Recommends strategy → AI reads correctly → Task succeeds
```

## Related Skills

- **multi-search-engine**: Search the web first, then analyze results with this tool
- **ocr-document-processor**: After OCR extraction, use this tool to check if content fits in context
- **find-skills**: Discover more skills for your workflow

## License

MIT License
