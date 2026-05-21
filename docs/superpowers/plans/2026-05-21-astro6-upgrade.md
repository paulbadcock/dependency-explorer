# Astro 6 / Wrangler 4 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade from Astro 5 + Wrangler 3 + @astrojs/cloudflare 12 to Astro 6 + Wrangler 4 + @astrojs/cloudflare 13, migrating the deployment target from Cloudflare Pages to Cloudflare Workers.

**Architecture:** The package version bumps are straightforward. The meaningful infrastructure change is in `wrangler.toml`: add a `main` entrypoint (`@astrojs/cloudflare/entrypoints/server`) and an `[assets]` block pointing to `./dist`, replacing the old Cloudflare Pages model. The `preview` npm script changes from `wrangler pages dev ./dist` to `wrangler dev`. App code and middleware are unchanged.

**Tech Stack:** Astro 6.3.6, @astrojs/cloudflare 13.5.3, Wrangler 4.93.1, @astrojs/react 5.0.5, React 18, Tailwind 3, Cloudflare D1.

---

## Files changed

| File | Change |
|------|--------|
| `package.json` | Bump version ranges for astro, @astrojs/cloudflare, @astrojs/react, wrangler; update `preview` script |
| `wrangler.toml` | Add `main` entrypoint, add `[assets]` block, update `compatibility_date` |

No changes to `astro.config.mjs`, `src/middleware.ts`, or any source files unless the build surfaces errors.

---

### Task 1: Bump package versions and install

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update version ranges in `package.json`**

Change the following entries (leave all others untouched):

In `dependencies`:
```json
"@astrojs/cloudflare": "^13.5.3",
"@astrojs/react": "^5.0.5",
"astro": "^6.3.6",
```

In `devDependencies`:
```json
"wrangler": "^4.93.1"
```

The full `dependencies` block after the edit:
```json
"dependencies": {
  "@astrojs/cloudflare": "^13.5.3",
  "@astrojs/react": "^5.0.5",
  "@astrojs/tailwind": "^6.0.0",
  "astro": "^6.3.6",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "smol-toml": "^1.3.0",
  "tailwindcss": "^3.4.0"
}
```

The full `devDependencies` block after the edit:
```json
"devDependencies": {
  "@cloudflare/workers-types": "^4.0.0",
  "@testing-library/jest-dom": "^6.4.0",
  "@testing-library/react": "^16.0.0",
  "@types/better-sqlite3": "^7.6.0",
  "@types/react": "^18.3.0",
  "@types/react-dom": "^18.3.0",
  "@vitejs/plugin-react": "^4.3.0",
  "better-sqlite3": "^12.0.0",
  "jsdom": "^25.0.0",
  "vitest": "^2.0.0",
  "wrangler": "^4.93.1"
}
```

- [ ] **Step 2: Install updated packages**

```bash
npm install
```

Watch for peer dependency warnings. If you see warnings about `react` or `react-dom` requiring v19, upgrade them too:

```bash
npm install react@^19.0.0 react-dom@^19.0.0 @types/react@^19.0.0 @types/react-dom@^19.0.0
```

Only run that command if npm warns about React peer dependency mismatches. If React 18 is accepted without warnings, skip it.

- [ ] **Step 3: Verify installed versions**

```bash
node -e "
const a = JSON.parse(require('fs').readFileSync('node_modules/astro/package.json')).version
const c = JSON.parse(require('fs').readFileSync('node_modules/@astrojs/cloudflare/package.json')).version
const w = JSON.parse(require('fs').readFileSync('node_modules/wrangler/package.json')).version
console.log('astro:', a, '| cloudflare adapter:', c, '| wrangler:', w)
"
```

Expected output:
```
astro: 6.x.x | cloudflare adapter: 13.x.x | wrangler: 4.x.x
```

---

### Task 2: Update wrangler.toml and preview script

**Files:**
- Modify: `wrangler.toml`
- Modify: `package.json` (scripts section only)

- [ ] **Step 1: Replace `wrangler.toml` with the Workers-compatible version**

Write the following as the complete contents of `wrangler.toml`:

```toml
name = "dependency-explorer"
main = "@astrojs/cloudflare/entrypoints/server"
compatibility_date = "2025-05-21"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./dist"

[[d1_databases]]
binding = "DB"
database_name = "dependency-explorer"
database_id = "placeholder-run-wrangler-d1-create-dependency-explorer"
```

Key changes from the previous version:
- Added `main = "@astrojs/cloudflare/entrypoints/server"` — points Wrangler to the adapter's unified entrypoint instead of the old built worker file
- Added `[assets]` block — tells Wrangler where to find static assets (previously implicit with Pages)
- Updated `compatibility_date` to today

- [ ] **Step 2: Update the `preview` script in `package.json`**

In `package.json`, change the `preview` script from:
```json
"preview": "wrangler pages dev ./dist"
```
To:
```json
"preview": "wrangler dev"
```

The full `scripts` block after the edit:
```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "wrangler dev",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Commit the config changes**

```bash
git add package.json package-lock.json wrangler.toml
git commit -m "chore: upgrade to Astro 6, Wrangler 4, @astrojs/cloudflare 13"
```

---

### Task 3: Build and fix any breaking changes

**Files:**
- Modify: `astro.config.mjs` only if the build reports errors related to it

- [ ] **Step 1: Run the production build**

```bash
npm run build 2>&1
```

Expected: build completes with no errors. The `dist/` directory is populated.

- [ ] **Step 2: If build fails with a `platformProxy` error**

If the error mentions `platformProxy` is no longer a valid option, update `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [react(), tailwind()],
})
```

If `platformProxy` is still valid (no error), leave `astro.config.mjs` unchanged.

- [ ] **Step 3: If build fails with a Tailwind error about deprecated options**

If the error mentions `@astrojs/tailwind` requiring Tailwind 4, or a config conflict, check the error message and update `astro.config.mjs` accordingly. Most Tailwind 3 configs work unchanged with astro 6 + @astrojs/tailwind 6.

- [ ] **Step 4: Re-run build until it passes with exit code 0**

```bash
npm run build
echo "Exit: $?"
```

Expected: `Exit: 0` and `dist/` directory contains files.

---

### Task 4: Run the test suite

**Files:** No changes — tests use a better-sqlite3 D1 shim and are unaffected by the wrangler/cloudflare changes.

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected output:
```
Test Files  12 passed (12)
     Tests  88 passed (88)
```

- [ ] **Step 2: If any tests fail**

Tests use `src/test-utils/d1-shim.ts` (a better-sqlite3-backed D1 compatible object) and do not touch Cloudflare or wrangler at all. If tests fail, the cause is a breaking change in Astro 6 or @astrojs/react 5 affecting the test environment (jsdom + vitest). Read the failure message carefully — most likely it's an import path change in the upgraded packages.

For React-related test failures, check if `@testing-library/react` version needs updating:
```bash
npm install --save-dev @testing-library/react@latest
```

- [ ] **Step 3: Commit test fixes if any were needed**

```bash
git add -p
git commit -m "fix: update tests for Astro 6 / React compatibility"
```

Skip this step if no test fixes were needed.

---

### Task 5: Smoke test dev server and run audit

**Files:** No changes.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev &
sleep 8
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321
```

Expected: `200`. Kill the background server after verifying: `kill %1`

- [ ] **Step 2: Run npm audit to verify CVEs are resolved**

```bash
npm audit 2>&1 | tail -5
```

Expected: the Astro XSS and @astrojs/cloudflare SSRF vulnerabilities are gone. The `devalue` and `esbuild`/`undici` issues may remain (they're in wrangler's transitive deps and require separate action).

- [ ] **Step 3: Commit**

If no fixes were needed in Tasks 3 or 4, all changes are already committed. Verify:

```bash
git status
```

Expected: `nothing to commit, working tree clean`
