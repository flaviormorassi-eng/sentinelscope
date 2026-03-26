# Threat Map QA Checklist

Use this checklist to validate the optimized threat map behavior before closing the workstream.

## 1) Core Render & Navigation
- [ ] Threat Map page loads without console/runtime errors.
- [ ] Context return actions work: `Return to Alerts`, `Return to Flow`, `Return to Threat Log`.
- [ ] Focused threat deep-link opens the corresponding popup.

## 2) Performance Modes
- [ ] Default load uses lazy map mount (`Preparing map view...` appears before map enters viewport).
- [ ] `Load map now` bypasses lazy wait and renders immediately.
- [ ] Viewport optimization is enabled by default and can be toggled off/on.
- [ ] Marker cap behavior works: when dataset is large, recent points cap appears with `Show all points`.

## 3) Cluster Behavior
- [ ] Cluster mode is enabled by default.
- [ ] Dense areas show cluster markers with counts.
- [ ] Clicking a cluster zooms in and progressively expands markers.
- [ ] When a specific threat is focused, clustering is bypassed for precise focus behavior.

## 4) Data Refresh & Stability
- [ ] Poll refresh keeps map stable (no repeated aggressive recentering during normal live updates).
- [ ] Source IP filter still narrows points correctly and `Clear source filter` resets state.
- [ ] `Visible on screen` count updates when pan/zoom changes.

## 5) Localization
- [ ] New map controls are translated in English and Portuguese.
- [ ] No raw translation keys are visible in the Threat Map UI.

## 6) Regression Smoke
- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
- [ ] Optional: verify live page interaction with `npm run dev:bg` + manual map pan/zoom stress test.
