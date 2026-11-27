# Operations Publishing Hub

[中文文档](./README.zh-CN.md)

A lightweight, browser-based pre-publish compliance workspace for content teams. The first module is a **banned-word checker** for Chinese social-commerce copy. Text is processed locally in the browser — nothing is uploaded to a server.

## Features

- **Four platform profiles**: General compliance, Xiaohongshu, Douyin, and Xianyu. Switching profiles loads the matching rule set.
- **Nine built-in categories**: advertising superlatives, exaggerated claims, medical/health claims, finance/investment claims, engagement bait, vulgar language, and platform-specific rules for Xiaohongshu, Douyin, and Xianyu.
- **Custom dictionary**: one phrase per line, up to 1,000 lines and 100 characters per phrase. Saved in `localStorage` on your machine.
- **Evasion-tolerant matching**: normalizes full-width characters, letter case, whitespace and common separators before matching.
- **Longest-match-first detection**: avoids double-counting overlapping words.
- **Readable results**: in-place highlighting, risk level, hit counts, first-occurrence position, suggested replacements, and a copyable plain-text report.
- **Keyboard shortcut**: `⌘/Ctrl + Enter` runs the check from the text area.

## Tech Stack

- Vite 6
- React 19 + TypeScript
- No backend, no runtime API calls

## Getting Started

Requirements: Node.js 18 or newer and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (by default `http://127.0.0.1:5173/`).

Other scripts:

```bash
npm run typecheck   # TypeScript check only
npm run build       # type check + production build
npm run preview     # preview the production build locally
```

## Project Structure

```text
.
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src
    ├── App.tsx              # UI and interactions
    ├── main.tsx             # React entry point
    ├── styles.css           # Light-theme styles
    ├── data
    │   └── words.ts         # Platforms, categories, and built-in dictionaries
    └── lib
        └── detector.ts      # Normalization, matching, stats, custom word parsing
```

## Customizing the Dictionaries

Edit `src/data/words.ts`:

- `PLATFORMS` defines the platform tabs.
- `CATEGORIES` defines the filter chips and which platforms see each category.
- `WORD_BANK` stores entries by category. Use `['phrase', 'suggested replacement']` when a replacement tip should be shown, or a plain string otherwise.

The detector reads these structures automatically; no changes to `detector.ts` are needed when adding words.

## How Detection Works

1. Both the input text and each dictionary phrase are normalized: full-width ASCII becomes half-width, ASCII letters become lowercase, and whitespace/zero-width characters plus common separators (`-`, `_`, `/`, `·`, etc.) are removed.
2. Every occurrence of every enabled phrase is located in the normalized text. Original character offsets are preserved through a position map.
3. Longer phrases win when matches overlap, so `全网第一` is reported instead of just `第一`.
4. Hits are grouped by phrase, counted, and rendered back onto the original text for highlighting.

## Disclaimer

The built-in dictionaries are a starting point, not legal advice. Results are for reference only; always follow the latest rules of the target platform and applicable advertising regulations.

## License

[MIT](./LICENSE) © 2026 riemann-chow-product
