# GitHub Actions CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CI workflow that type-checks, tests, and builds the app on every push to `master` and every PR targeting `master`.

**Architecture:** One workflow file (`.github/workflows/ci.yml`) with a single sequential job. Before the workflow can run `astro check`, the `@astrojs/check` dev dependency must be installed — it is not currently in `package.json`.

**Tech Stack:** GitHub Actions, Node 26, Astro 6 (`astro check`), Vitest (`npm test`), `@astrojs/cloudflare` adapter (`npm run build`)

---

### Task 1: Install `@astrojs/check`

**Files:**
- Modify: `package.json` (devDependencies)
- Modify: `package-lock.json` (auto-updated by npm)

- [ ] **Step 1: Install the package**

```bash
npm install --save-dev @astrojs/check
```

Expected output ends with something like:
```
added 1 package, and audited N packages in Xs
```

- [ ] **Step 2: Verify `astro check` now runs**

```bash
npx astro check
```

Expected: type-check output with no fatal errors (warnings about `.astro` files are fine, but the command should exit 0).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @astrojs/check for astro type checking"
```

---

### Task 2: Create the CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflows directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 26
          cache: npm

      - run: npm ci

      - run: npx astro check

      - run: npm test

      - run: npm run build
```

- [ ] **Step 3: Verify YAML is valid**

```bash
node -e "const fs = require('fs'); const yaml = require('js-yaml'); yaml.load(fs.readFileSync('.github/workflows/ci.yml', 'utf8')); console.log('valid')" 2>/dev/null || python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('valid')"
```

Expected: `valid`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for type check, test, and build"
```

---

### Task 3: Verify locally

**Files:** None (read-only verification)

- [ ] **Step 1: Confirm all three CI steps pass locally**

Run each command that CI will run, in order:

```bash
npx astro check
```
Expected: exits 0 (no type errors)

```bash
npm test
```
Expected: all tests pass, suite summary shows 0 failures

```bash
npm run build
```
Expected: `dist/` directory is written, no build errors

- [ ] **Step 2: Confirm workflow file is picked up by GitHub**

Push to `master` (or open a PR) and navigate to the **Actions** tab of the GitHub repository. The `CI` workflow should appear and all steps should show green checkmarks.
