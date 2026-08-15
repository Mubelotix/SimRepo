# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm dev` - Start development server with hot reload using tsx
- `pnpm build` - Build TypeScript project

## Architecture

This is a Hono backend server that generates SVG charts of GitHub repository star history, served entirely from `repos.sqlite`. The server never calls the GitHub API.

### Core Flow
1. **Data Source** (`repos.ts`): Reads star history + logo URLs from `repos.sqlite`
2. **Caching** (`cache.ts`): LRU cache (10K repos, 1GB max, 24h TTL) for star records and rendered chart SVGs
3. **Chart Generation** (`../shared/packages/xy-chart.tsx`): D3-based SVG chart rendering via JSDOM
4. **SVG Optimization**: Uses SVGO to minimize bandwidth

### Key Components
- **Main Server** (`main.ts`): Endpoints `/svg` (chart), `/repo-data` (star data + logo URLs), `/healthz`. `/svg` accepts query params (repos, type, size, theme, transparent). `style=landscape1` (OG cards) is disabled and returns 503 because it required the GitHub API.
- **Data Processing** (`../shared/common/chart.tsx`): Converts data to chart format, handles Date vs Timeline modes
- **Utilities** (`utils.ts`): Image conversion, SVG manipulation, size calculations

### Shared Code
Chart code and types live in root `shared/` (shared with frontend). Backend imports via `../shared/` relative paths. See root AGENTS.md for the full shared directory listing.

### Chart Types
- **Date Mode**: X-axis shows actual dates
- **Timeline Mode**: X-axis shows relative time from repo creation
- Supports multiple chart sizes and light/dark themes