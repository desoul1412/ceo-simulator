---
name: tavily-research
description: "Use when needing web search, content extraction, or deep research with citations."
source: tavily-skills
applies_to: [CEO, PM, Backend, DevOps]
---

# Tavily Research Suite

Web research tools for AI agents. Escalation pattern: search > extract > map > crawl > research.

## Tools

### tavily-search
Search the web with LLM-optimized results.
```bash
tvly search "query" --depth basic --max-results 5
```
Options: `--depth` (ultra-fast/fast/basic/advanced), `--time-range` (day/week/month/year), `--include-domains`

### tavily-extract
Extract clean markdown from specific URLs.
```bash
tvly extract "https://example.com/page" --query "specific topic"
```

### tavily-map
Discover all URLs on a website (no content).
```bash
tvly map "https://example.com" --instructions "find API docs"
```

### tavily-crawl
Crawl and extract multiple pages from a site.
```bash
tvly crawl "https://docs.example.com" --output-dir ./research --max-depth 2
```

### tavily-research
AI-powered deep research with citations (30-120 seconds).
```bash
tvly research "comprehensive analysis of X" --model pro
```

## Installation
```bash
curl -fsSL https://cli.tavily.com/install.sh | bash
tvly login --api-key tvly-YOUR_KEY
```

## When to Use
- Market research before strategic decisions (CEO)
- Competitor analysis (PM)
- API documentation lookup (Backend, DevOps)
- Technology evaluation (DevOps)
- Save findings to `./brain/raw/` per CLAUDE.md directive
