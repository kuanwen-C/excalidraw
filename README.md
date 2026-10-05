# Team 6 — Excalidraw (CMU 17-695 Group Project)

## How to run

- **Requirements:** Node 18 or newer and Yarn 1.22.22
- **Install:** `corepack yarn install`
- **Start:** `corepack yarn start` (opens on port 3001)

## How to check

```bash
corepack yarn test:typecheck
corepack yarn test:app --watch=false
corepack yarn test:code
corepack yarn test:other
```

(`test:other` does fail on `COURSE.md`. That file was already unformatted in the course version and we didn’t change it.)

**Results on the final combined version (commit `63926f5b`):** typecheck and lint are clean, and all 2,771 tests pass across 142 test files.

## Individual changes

### Issue 04 (dylan40907)

**Change:** Allowing for align function to align to a reference object or group. Primary changes for the feature were made to `packages/element/src/align.ts`, `actions/actionAlign.tsx`, and `actions/actionAlignReference.tsx`. The reference box became a parameter of `alignElements`, so the existing whole selection alignment and the new reference alignment share one movement path.

**Check results:**

- Existing 50 align tests passed unedited after the refactor.
- [`align.test.tsx`](https://github.com/kuanwen-C/excalidraw/blob/main/packages/element/tests/align.test.tsx) now has 83 tests including the old vs new equivalence test. That equivalence test was confirmed to fail when the two paths disagreed.
- Full suite, typecheck, and lint pass on the combined build.
- Manual checks all pass (reference align, undo, reference cleared after reload, and the cross feature checks with stats and search).

**What changed from the RFC:**

- Clearing became eager, via `componentDidUpdate` and the check at use.
- The command palette ended up needing an edit to `CommandPalette.tsx`.
- Locked elements can’t be the reference.
- A single selected group will count as one unit.
- Extra files that were edited despite not being on the RFC: `actions/types.ts`, `CommandPalette.tsx`, and `InteractiveCanvas.tsx`.
- The RFC assumed alignment updates frame membership, but the code only updates membership while dragging so the tests check that both commands leave membership unchanged.

**What remains:** Aligning can move a framed element outside its frame (for example, aligned to an element outside the frame), and Excalidraw keeps it as a member of that frame because membership only updates while dragging. This is existing behavior shared by the old and new commands and I didn’t change it.

### Issue 12 (kuanwen-C)

**Change:** Added a shared aspect-ratio lock to Stats panel. `Stats/index.tsx` provides the control, while `Dimension.tsx` and `MultiDimension.tsx` apply it to single and multiple selections. And new shared helpers handle dimension calculations and group resizing. Related tests and labels are also updated.

**Check results:** Ran 598 tests related to issue 12. Manual tests also passed for single and multiple selections, group resizing, text wrapping, minimum size, undo functions. Also ran through the existing 2771 automated tests in the codebase to make sure unrelated things are working properly as well. And type checking and lint are both passed.

**What changed from the RFC:**

- For groups with a zero-sized axis, that axis now stays zero while the other axis can resize.
- Curved hand-drawn elements may produce bounds different from the requested size, so Stats display the actual final dimension for this case.
- I also changed the group-text helper to keep test fitting consistent between resizing and undo operations.

**What remains:**

- Unlocked groups support 0°, 90°, 180°, and 270° member angles; locked groups support any angle.
- Zero group axes cannot expand, and 0x0 groups cannot be resized.
- Textlayout can adjust final dimensions.
- Cropping and single/upgrouped stand let text retain their existing behavior.

### Issue 07 (Rc0824)

**Change:** Added named export presets to the image export dialog. A preset saves the background, dark mode, scale, and embed-scene settings. Presets can be created, renamed, applied, and deleted, and persist in the same browser. Selection scope remains outside the preset. The preview, PNG/SVG export, and Copy as PNG/SVG paths use the same active export preferences.

**Check results:** All 10 new preset tests passed. Typecheck, lint, and the full application test suite passed (137 test files and 2230 tests passed). Manual checks passed for create, rename, apply, delete, reload persistence, duplicate and empty names, selection-only behavior, PNG/SVG output, Copy as PNG/SVG, and embedded image,dark-mode export, and 3x scale.

**What changed from the RFC:**

- Applying a preset also updates `sessionExportThemeOverride` so the dark-mode preview changes immediately.
- Preset validation was added to the existing AppState local-storage path instead of introducing a separate storage service.
- Preview/output agreement is checked manually rather than with a new pixel-comparison test.

**What remains:** Existing presets cannot be updated with the current export settings; users must delete and recreate a preset to change its saved values. Presets also cannot be imported, exported, or synchronized across browsers because they are stored only in the current browser.

### Issue 01 (PeiranXu-108)

**Change:** Added whole-drawing, current-selection, and chosen-frame search scopes, plus match-case controls. Extracted matching and highlight calculations from `SearchMenu.tsx` into shared `search.ts`, keeping results, counts, highlights, and navigation consistent. Whole-drawing, case-insensitive search remains the default.

**Check results:** The branch contains 20 search tests, including 15 new tests covering scope changes, bound labels, wrapped text, case matching, deleted frames, rapid input changes, cancellation, and focus consistency. The reported combined-version results are clean typecheck and lint, with all 2,771 tests passing across 142 files. Issue-specific execution results and manual checks were not independently verified here.

**What changed from the RFC:** The scope behavior matches the provided RFC excerpts: selection follows live selection, while chosen-frame search retains a frame ID and includes its contents. The implementation cancels pending debounced searches on changes or unmount and preserves the focused match when possible. Other deviations cannot be confirmed without the complete RFC.

**What remains:**

- Scope and match-case preferences are not persisted.
- Search runs synchronously; resolving a scope still scans scene elements.
- New interface labels were added only to the English locale.
