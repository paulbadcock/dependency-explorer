# README Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current CLAUDE.md-style README with a human, portfolio-friendly README that includes real screenshots of the running app.

**Architecture:** Create fixture lockfiles for demo data, start the dev server, use browser automation to capture three screenshots (home, analysis, compare), then write the final README.md referencing those screenshots.

**Tech Stack:** Astro 5 dev server, Claude-in-Chrome browser automation for screenshots, Markdown.

---

### Task 1: Create screenshots directory and fixture lockfiles

**Files:**
- Create: `screenshots/.gitkeep`
- Create: `fixtures/requirements-old.txt`
- Create: `fixtures/requirements-new.txt`

- [ ] **Step 1: Create the screenshots directory**

```bash
mkdir -p screenshots
touch screenshots/.gitkeep
```

- [ ] **Step 2: Create the "old" fixture — a requirements.txt with outdated packages**

Create `fixtures/requirements-old.txt` with this exact content:

```
requests==2.25.1
flask==1.1.4
django==3.2.0
pillow==8.2.0
numpy==1.21.0
sqlalchemy==1.4.0
```

- [ ] **Step 3: Create the "new" fixture — an updated version for the compare screenshot**

Create `fixtures/requirements-new.txt` with this exact content:

```
requests==2.31.0
flask==3.0.3
django==4.2.13
pillow==10.3.0
numpy==1.26.4
sqlalchemy==2.0.30
```

- [ ] **Step 4: Create the fixtures directory if it doesn't exist, then commit**

```bash
mkdir -p fixtures
git add screenshots/.gitkeep fixtures/requirements-old.txt fixtures/requirements-new.txt
git commit -m "chore: add screenshots dir and demo fixture lockfiles"
```

---

### Task 2: Start the dev server

**Files:**
- No file changes — just starts the server for the screenshot session.

- [ ] **Step 1: Start the Astro dev server in the background**

```bash
npm run dev
```

Run this in the background. The server starts at `http://localhost:4321`. Wait for output containing `Local` and the port before proceeding.

- [ ] **Step 2: Verify the server is up**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321
```

Expected: `200`

---

### Task 3: Capture the home page screenshot

**Files:**
- Create: `screenshots/home.png`

Use Claude-in-Chrome browser automation for all steps in this task.

- [ ] **Step 1: Get current browser tabs context**

Use `mcp__claude-in-chrome__tabs_context_mcp` to get available tabs.

- [ ] **Step 2: Create a new tab and navigate to the home page**

Use `mcp__claude-in-chrome__tabs_create_mcp` to open a new tab, then `mcp__claude-in-chrome__navigate` to go to `http://localhost:4321`.

- [ ] **Step 3: Resize the window for a clean screenshot**

Use `mcp__claude-in-chrome__resize_window` to set the window to 1280×800.

- [ ] **Step 4: Capture the home page**

Use `mcp__claude-in-chrome__computer` with action `screenshot`. Save the result to `screenshots/home.png`.

---

### Task 4: Upload the old fixture and capture the analysis screenshot

**Files:**
- Create: `screenshots/analysis.png`

- [ ] **Step 1: Upload `fixtures/requirements-old.txt` via the upload form**

Use `mcp__claude-in-chrome__file_upload` to upload `fixtures/requirements-old.txt` through the upload zone on the home page. The page will redirect to `/analysis/<id>` after upload completes.

- [ ] **Step 2: Wait for the analysis page to load**

Use `mcp__claude-in-chrome__get_page_text` to confirm the page has loaded (text should contain package names like "requests" or "flask").

- [ ] **Step 3: Capture the analysis results page**

Use `mcp__claude-in-chrome__computer` with action `screenshot`. Save the result to `screenshots/analysis.png`.

- [ ] **Step 4: Save the analysis URL for the compare step**

Note the current URL — it will be `http://localhost:4321/analysis/<id1>`. Keep `id1` for Task 5.

---

### Task 5: Upload the new fixture and capture the compare screenshot

**Files:**
- Create: `screenshots/compare.png`

- [ ] **Step 1: Navigate back to the home page**

Use `mcp__claude-in-chrome__navigate` to go to `http://localhost:4321`.

- [ ] **Step 2: Upload `fixtures/requirements-new.txt`**

Use `mcp__claude-in-chrome__file_upload` to upload `fixtures/requirements-new.txt`. The page will redirect to `/analysis/<id2>`.

- [ ] **Step 3: Navigate to the compare page using both IDs**

Use `mcp__claude-in-chrome__navigate` to go to `http://localhost:4321/compare/<id1>/<id2>`, substituting the real IDs from Task 4 Step 4 and the current URL.

- [ ] **Step 4: Wait for the compare page to load**

Use `mcp__claude-in-chrome__get_page_text` to confirm both panels have loaded (text should include package names in both columns).

- [ ] **Step 5: Capture the compare page**

Use `mcp__claude-in-chrome__computer` with action `screenshot`. Save the result to `screenshots/compare.png`.

- [ ] **Step 6: Commit the screenshots**

```bash
git add screenshots/home.png screenshots/analysis.png screenshots/compare.png
git commit -m "chore: add app screenshots for README"
```

---

### Task 6: Write README.md

**Files:**
- Modify: `README.md` (full replacement)

- [ ] **Step 1: Replace README.md with the final content**

Write the following as the complete contents of `README.md`:

```markdown
# Dependency Explorer

I kept needing a fast way to audit Python and NuGet dependency files at work — something that would show CVEs, staleness, and upgrade gaps in one place without having to cross-reference three different tools. So I built one.

![Dependency Explorer home page](screenshots/home.png)

## What it does

Drop in a `requirements.txt`, `poetry.lock`, or `packages.lock.json` and get back:

- **CVE scan** — checks every package against [osv.dev](https://osv.dev), flags known vulnerabilities
- **Version staleness** — shows how far behind each package is (patch / minor / major)
- **Status at a glance** — critical / EOL / warning / healthy classification per package
- **Transitive deps** — one level of indirect dependencies surfaced per package
- **Compare mode** — diff two analyses side-by-side to see what changed between lockfiles
- **Cached results** — same file always returns instantly; no duplicate API calls

![Analysis results showing CVE flags and version staleness](screenshots/analysis.png)

![Side-by-side comparison of two lockfile analyses](screenshots/compare.png)

## Running it locally

Requires Node.js and a Cloudflare account (for the D1 database).

\`\`\`bash
npm install
npm run dev
\`\`\`

Then open `http://localhost:4321` and upload a lockfile.

For a production deploy, push to Cloudflare Pages and bind a D1 database named `DB`.

## Stack

- **[Astro 5](https://astro.build)** (SSR) + **React 18** + **Tailwind 3**
- **Cloudflare Pages** for hosting, **Cloudflare D1** (SQLite) for persistence
- Analysis pipeline: PyPI + NuGet metadata APIs → [osv.dev](https://osv.dev) batch CVE lookup
- Vitest for testing, with a `better-sqlite3` shim for D1 in Node

The analysis ID is a SHA-256 of the raw file content — uploading the same lockfile twice always hits the cache. Package metadata is TTL-cached in D1 to avoid hammering upstream APIs.
```

- [ ] **Step 2: Commit the README**

```bash
git add README.md
git commit -m "docs: rewrite README with human intro, features, screenshots, and stack"
```
