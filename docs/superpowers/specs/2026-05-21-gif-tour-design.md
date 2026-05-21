# GIF Tour Design

**Date:** 2026-05-21
**Goal:** Produce two polished screen-capture clips of Dependency Explorer — a short LinkedIn hook (MP4) and a full feature tour (GIF) for the README.

## Outputs

| File | Format | Dimensions | Length | Destination |
|------|--------|------------|--------|-------------|
| `screenshots/tour-linkedin.mp4` | H.264 MP4 | 1280×720 | ~12s | LinkedIn post |
| `screenshots/tour-readme.gif` | Optimised GIF | 1280×800 | ~40s | README embed |

## Toolchain

1. **Playwright** — drives the browser headlessly with realistic human-like pacing (delays, smooth scrolling, cursor movement)
2. **ffmpeg** — converts Playwright's `.webm` video output to GIF (two-pass palette) and MP4 (H.264)
3. **Prerequisite:** `brew install ffmpeg` (one-time system install)

## Shot Lists

### Clip 1 — LinkedIn Hook (~12s)

| Time | Action |
|------|--------|
| 0s | Home page visible, recent analyses list shown, cursor idles briefly |
| 2s | File drag-simulated onto upload zone (`requirements-old.txt`) |
| 4s | "Analysing…" spinner shown |
| 6s | Analysis page loads — 87 CVEs badge dominates header |
| 8s | Slow scroll down package list — red CVE badges visible on each row |
| 12s | Freeze on `requests` row with CVE count — hard cut |

### Clip 2 — README Full Tour (~40s)

| Time | Action |
|------|--------|
| 0s | Home page |
| 3s | Upload `requirements-old.txt` |
| 6s | Analysis page loads — header stats (87 CVEs, 4 major behind, 2 EOL) |
| 9s | Click `requests` row → right panel opens with version timeline |
| 14s | Scroll CVE list — several CVE entries visible with severity badges |
| 20s | Click Compare button → dropdown opens, select `requirements-new.txt` analysis |
| 25s | Compare page loads — old vs new side-by-side |
| 30s | Scroll compare table — CVE counts visibly dropping (55→68 django, 3→1 flask) |
| 38s | End on `sqlalchemy` row: critical → warning |

## Implementation Approach

- **Pre-seeding:** Before recording the README tour, the script silently uploads `requirements-new.txt` via the API (`POST /api/analyze`) so it appears in the Compare dropdown. This upload is not part of the recorded video.
- One Playwright script per clip: `scripts/record-linkedin.mjs` and `scripts/record-readme.mjs`
- Each script uses `recordVideo` context option → saves `.webm` to `screenshots/`
- ffmpeg converts:
  - LinkedIn: `webm → mp4` (H.264, faststart for streaming)
  - README: `webm → palette.png → gif` (two-pass for colour quality)
- Intermediate `.webm` and `palette.png` files cleaned up after conversion
- Dev server must be running at `http://localhost:4321` before running scripts

## Realistic Pacing Techniques

- `page.mouse.move()` with intermediate coordinates to simulate cursor travel
- `page.waitForTimeout()` with randomised ±200ms jitter on key pauses
- Smooth scroll via `page.evaluate(() => window.scrollBy({ top: X, behavior: 'smooth' }))` with wait after
- Upload simulated via `setInputFiles()` (same as screenshot script)
- For drag simulation on upload zone: use `dispatchEvent` with a DataTransfer containing the file

## Out of Scope

- Audio
- Captions/text overlays
- Looping control (GIF loops by default; MP4 does not)
- Hosting — user uploads MP4 to LinkedIn directly; GIF committed to repo and referenced in README
