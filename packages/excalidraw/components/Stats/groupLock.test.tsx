import React from "react";
import { act, fireEvent, within } from "@testing-library/react";
import { vi } from "vitest";

import {
  getFontString,
  reseed,
  STICKY_NOTE_MIN_SIZE,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  getCommonBounds,
  getNonDeletedElements,
  isTextElement,
  isElbowArrow,
  redrawTextBoundingBox,
  updateStickyNoteLayout,
  wrapText,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint, Radians } from "@excalidraw/math";

import { Excalidraw } from "../..";
import { actionGroup } from "../../actions";
import { t } from "../../i18n";
import { API } from "../../tests/helpers/api";
import { Keyboard, UI } from "../../tests/helpers/ui";
import {
  render,
  mockBoundingClientRect,
  restoreOriginalGetBoundingClientRect,
} from "../../tests/test-utils";

const { h } = window;
const quarters = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
const input = (property: "width" | "height") =>
  UI.queryStatsProperty(property === "width" ? "W" : "H")!.querySelector(
    "input",
  )!;
const lock = () =>
  within(UI.queryStats()!).getByRole("button", {
    name: t("stats.keepProportions"),
  });
const capture = () =>
  act(() =>
    h.app.syncActionResult({ captureUpdate: CaptureUpdateAction.IMMEDIATELY }),
  );
const displayed = (value: number) => String(Number(value.toFixed(2)));
// Compare content as well as geometry; history deliberately changes versions.
const content = () =>
  h.elements.map((element) => ({
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    angle: element.angle,
    type: element.type,
    groupIds: element.groupIds,
    ...(isTextElement(element)
      ? {
          text: element.text,
          originalText: element.originalText,
          fontSize: element.fontSize,
          autoResize: element.autoResize,
          baseFontSize: element.baseFontSize,
        }
      : {}),
    ...(element.type === "stickynote"
      ? { baseHeight: element.baseHeight }
      : {}),
  }));
const assertDisplay = () => {
  const bounds = getCommonBounds(h.app.scene.getSelectedElements(h.state));
  expect(input("width").value).toBe(displayed(bounds[2] - bounds[0]));
  expect(input("height").value).toBe(displayed(bounds[3] - bounds[1]));
};
const assertHistory = (
  before: ReturnType<typeof content>,
  undoCount: number,
) => {
  const after = content();
  expect(API.getUndoStack()).toHaveLength(undoCount + 1);
  Keyboard.undo();
  expect(content()).toEqual(before);
  Keyboard.redo();
  expect(content()).toEqual(after);
};
const pair = (angle = 0, group = "group", offset = 0) => [
  API.createElement({
    type: "rectangle",
    x: offset,
    y: 0,
    width: 40,
    height: 20,
    angle: angle as Radians,
    groupIds: [group],
  }),
  API.createElement({
    type: "image",
    x: offset + 60,
    y: 30,
    width: 40,
    height: 20,
    angle: angle as Radians,
    groupIds: [group],
    fileId: "group-image",
  }),
];

describe("Stats shared group lock", () => {
  beforeAll(() => mockBoundingClientRect());
  afterAll(() => restoreOriginalGetBoundingClientRect());
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setAppState({ stats: { ...h.state.stats, open: true } });
  });

  describe.each(["rectangle", "rotated group"] as const)(
    "%s alongside ungrouped standalone text",
    (unit) => {
      describe.each(["width", "height"] as const)("%s", (property) => {
        it.each([false, true])(
          "locks the eligible unit while retaining independent text layout (drag=%s)",
          (drag) => {
            const eligible =
              unit === "rotated group"
                ? pair(Math.PI / 4)
                : [
                    API.createElement({
                      type: "rectangle",
                      width: 100,
                      height: 50,
                    }),
                  ];
            const text = API.createElement({
              type: "text",
              x: 700,
              width: 300,
              height: 25,
              text: "A long line of text to wrap",
              fontSize: 20,
            });
            API.setElements([...eligible, text]);
            API.setSelectedElements([text]);
            capture();
            const edit = () => {
              if (!drag) {
                UI.updateInput(input(property), "60");
                return;
              }
              const label = UI.queryStatsProperty(
                property === "width" ? "W" : "H",
              )!.querySelector(".drag-input-label")!;
              fireEvent.pointerDown(label, { clientX: 0 });
              fireEvent.pointerMove(h.app.ownerWindow, { clientX: 0 });
              fireEvent.pointerMove(h.app.ownerWindow, { clientX: 35 });
              fireEvent.pointerUp(h.app.ownerWindow);
            };
            // The existing single-text W/H path is the compatibility baseline:
            // W rewraps, while H scales the font and width.
            edit();
            const independentText = content().find(
              (element) => element.id === text.id,
            );
            expect(API.getElement(text).fontSize).toBe(
              property === "width" ? 20 : 48,
            );
            expect(API.getElement(text).originalText).toBe(text.originalText);
            Keyboard.undo();

            API.setSelectedElements([
              ...eligible.map((element) => API.getElement(element)),
              API.getElement(text),
            ]);
            capture();
            expect(lock()).toHaveAttribute("aria-pressed", "false");
            const before = content();
            const count = API.getUndoStack().length;
            if (unit === "rotated group") {
              const unchanged = structuredClone(h.elements);
              edit();
              expect(h.elements).toEqual(unchanged);
              expect(input(property).value).toBe("Mixed");
              expect(API.getUndoStack()).toHaveLength(count);
              expect(h.state.toast?.message).toBe(
                t("stats.resizeUnsupportedAngle"),
              );
              expect(lock()).toHaveAttribute("aria-pressed", "false");
            }
            fireEvent.click(lock());
            expect(content()).toEqual(before);
            expect(API.getUndoStack()).toHaveLength(count);
            const bounds = getCommonBounds(
              eligible.map((element) => API.getElement(element)),
            );
            const originalSize =
              property === "width"
                ? bounds[2] - bounds[0]
                : bounds[3] - bounds[1];
            const requested = drag ? Math.round(originalSize + 35) : 60;
            edit();
            const afterBounds = getCommonBounds(
              eligible.map((element) => API.getElement(element)),
            );
            expect(afterBounds[2] - afterBounds[0]).toBeCloseTo(
              ((bounds[2] - bounds[0]) * requested) / originalSize,
              8,
            );
            expect(afterBounds[3] - afterBounds[1]).toBeCloseTo(
              ((bounds[3] - bounds[1]) * requested) / originalSize,
              8,
            );
            expect(content().find((element) => element.id === text.id)).toEqual(
              independentText,
            );
            expect(lock()).toHaveAttribute("aria-pressed", "true");
            assertHistory(before, count);
          },
        );
      });
    },
  );

  it("hides the lock for only ungrouped text without losing the preference", () => {
    const rectangle = API.createElement({ type: "rectangle" });
    const first = API.createElement({ type: "text", text: "First" });
    const second = API.createElement({ type: "text", x: 300, text: "Second" });
    API.setElements([rectangle, first, second]);
    API.setSelectedElements([rectangle]);
    fireEvent.click(lock());
    API.setSelectedElements([first, second]);
    expect(
      within(UI.queryStats()!).queryByRole("button", {
        name: t("stats.keepProportions"),
      }),
    ).toBeNull();
    API.setSelectedElements([rectangle, first, second]);
    expect(lock()).toHaveAttribute("aria-pressed", "true");
  });

  describe.each(["width", "height"] as const)("unlocked %s", (property) => {
    it.each(
      quarters.flatMap((angle) =>
        [200.25, 0.5].map((target) => [angle, target]),
      ),
    )(
      "transforms quarter-turn centers and actual bounds at %s to %s",
      (angle, target) => {
        const members = pair(angle);
        API.setElements(members);
        API.setSelectedElements(members);
        expect(lock()).toHaveAttribute("aria-pressed", "false");
        capture();
        const before = content();
        const undoCount = API.getUndoStack().length;
        const originals = structuredClone(members);
        const [x1, y1, x2, y2] = getCommonBounds(members);
        UI.updateInput(input(property), String(target));
        const sx = property === "width" ? Math.max(1, target) / (x2 - x1) : 1;
        const sy = property === "height" ? Math.max(1, target) / (y2 - y1) : 1;
        const bounds = getCommonBounds(members);
        expect(bounds[0]).toBeCloseTo(x1, 8);
        expect(bounds[1]).toBeCloseTo(y1, 8);
        expect(bounds[2] - bounds[0]).toBeCloseTo((x2 - x1) * sx, 8);
        expect(bounds[3] - bounds[1]).toBeCloseTo((y2 - y1) * sy, 8);
        members.forEach((member, index) => {
          const old = originals[index];
          expect(member.x + member.width / 2).toBeCloseTo(
            x1 + (old.x + old.width / 2 - x1) * sx,
            8,
          );
          expect(member.y + member.height / 2).toBeCloseTo(
            y1 + (old.y + old.height / 2 - y1) * sy,
            8,
          );
          expect(member.angle).toBe(old.angle);
          expect(member.type).toBe(old.type);
          expect(member.groupIds).toEqual(old.groupIds);
        });
        expect(bounds[2] - bounds[0]).toBeGreaterThanOrEqual(1 - 1e-12);
        expect(bounds[3] - bounds[1]).toBeGreaterThanOrEqual(1 - 1e-12);
        assertDisplay();
        assertHistory(before, undoCount);
      },
    );

    it.each([false, true])(
      "keeps label drag rounding and Shift steps (%s)",
      (shiftKey) => {
        const members = pair(Math.PI / 2);
        API.setElements(members);
        API.setSelectedElements(members);
        const original = getCommonBounds(members);
        const label = UI.queryStatsProperty(
          property === "width" ? "W" : "H",
        )!.querySelector(".drag-input-label")!;
        fireEvent.pointerDown(label, { clientX: 0 });
        fireEvent.pointerMove(h.app.ownerWindow, { clientX: 0 });
        fireEvent.pointerMove(h.app.ownerWindow, { clientX: 6.3, shiftKey });
        fireEvent.pointerUp(h.app.ownerWindow);
        const bounds = getCommonBounds(members);
        const oldSize =
          property === "width"
            ? original[2] - original[0]
            : original[3] - original[1];
        expect(
          property === "width" ? bounds[2] - bounds[0] : bounds[3] - bounds[1],
        ).toBeCloseTo(oldSize + (shiftKey ? 10 : 6), 8);
        expect(
          property === "width" ? bounds[3] - bounds[1] : bounds[2] - bounds[0],
        ).toBeCloseTo(
          property === "width"
            ? original[3] - original[1]
            : original[2] - original[0],
          8,
        );
        assertDisplay();
      },
    );

    it("resizes each mixed unit independently and retains the preference across selections", () => {
      const first = pair();
      const second = pair(Math.PI / 2, "second", 300);
      const single = API.createElement({
        type: "rectangle",
        x: 700,
        width: 20,
        height: 30,
      });
      const unrelated = API.createElement({
        type: "ellipse",
        x: 1000,
        width: 77,
        height: 55,
      });
      API.setElements([...first, ...second, single, unrelated]);
      API.setSelectedElements([single]);
      capture();
      const unchanged = structuredClone(h.elements);
      const count = API.getUndoStack().length;
      fireEvent.click(lock());
      API.setSelectedElements([...first, ...second, single]);
      expect(lock()).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(lock());
      expect(h.elements).toEqual(unchanged);
      expect(API.getUndoStack()).toHaveLength(count);
      const other = property === "width" ? "height" : "width";
      const oldBounds = [first, second].map((group) => getCommonBounds(group));
      const before = content();
      UI.updateInput(input(property), "200.25");
      [first, second].forEach((group, i) => {
        const bounds = getCommonBounds(group);
        expect(
          property === "width" ? bounds[2] - bounds[0] : bounds[3] - bounds[1],
        ).toBeCloseTo(200.25, 8);
        expect(
          property === "width" ? bounds[3] - bounds[1] : bounds[2] - bounds[0],
        ).toBeCloseTo(
          property === "width"
            ? oldBounds[i][3] - oldBounds[i][1]
            : oldBounds[i][2] - oldBounds[i][0],
          8,
        );
      });
      expect(single[property]).toBe(200.25);
      expect(single[other]).toBe(property === "width" ? 30 : 20);
      expect(unrelated).toEqual(unchanged[5]);
      expect(input(property).value).toBe("200.25");
      assertHistory(before, count);
      API.setSelectedElements([API.getElement(single)]);
      expect(lock()).toHaveAttribute("aria-pressed", "false");
    });

    it.each(
      quarters.flatMap((angle) =>
        [false, true].map((minimum) => ({ angle, minimum })),
      ),
    )(
      "rewraps bound text once at $angle (minimum=$minimum) with stable Undo/Redo",
      ({ angle, minimum }) => {
        const container = API.createElement({
          type: "rectangle",
          width: 200,
          height: 100,
          angle: angle as Radians,
          groupIds: ["group"],
        });
        const label = API.createElement({
          type: "text",
          text: "Several words that must wrap inside a narrower container",
          fontSize: 20,
          containerId: container.id,
          groupIds: ["group"],
          angle: angle as Radians,
        });
        const other = API.createElement({
          type: "rectangle",
          x: 300,
          y: 200,
          width: 30,
          height: 30,
          groupIds: ["group"],
        });
        const unrelated = API.createElement({
          type: "text",
          x: 700,
          text: "Unrelated",
        });
        API.updateElement(container, {
          boundElements: [{ id: label.id, type: "text" }],
        });
        API.setElements([container, label, other, unrelated]);
        act(() => redrawTextBoundingBox(label, container, h.app.scene));
        API.setSelectedElements([container, label, other]);
        capture();
        const before = content();
        const unrelatedBefore = structuredClone(unrelated);
        const originalText = label.originalText;
        const originalFont = label.fontSize;
        const mutate = vi.spyOn(h.app.scene, "mutateElement");
        const count = API.getUndoStack().length;
        UI.updateInput(
          input(property),
          minimum ? "1" : String(Number(input(property).value) / 2),
        );
        expect(
          mutate.mock.calls.filter(
            ([element, updates]) =>
              element.id === label.id && "fontSize" in updates,
          ),
        ).toHaveLength(1);
        mutate.mockRestore();
        expect(label.fontSize).toBe(originalFont);
        expect(label.originalText).toBe(originalText);
        expect(label.angle).toBe(container.angle);
        expect(label.text).toBe(
          wrapText(originalText, getFontString(label), container.width - 10),
        );
        if (!minimum) {
          expect(label.text).toContain("\n");
        }
        const bounds = getCommonBounds([container, label, other]);
        expect(bounds[2] - bounds[0]).toBeGreaterThanOrEqual(1);
        expect(bounds[3] - bounds[1]).toBeGreaterThanOrEqual(1);
        expect(unrelated).toEqual(unrelatedBefore);
        assertDisplay();
        assertHistory(before, count);
      },
    );

    it.each(quarters)(
      "rewraps standalone group text at angle %s without scaling its font",
      (angle) => {
        const text = API.createElement({
          type: "text",
          text: "Several words that rewrap from their original source",
          width: 400,
          fontSize: 20,
          angle: angle as Radians,
          groupIds: ["group"],
        });
        const other = API.createElement({
          type: "rectangle",
          x: 500,
          y: 100,
          width: 30,
          height: 30,
          groupIds: ["group"],
        });
        API.setElements([text, other]);
        act(() => redrawTextBoundingBox(text, null, h.app.scene));
        API.setSelectedElements([text, other]);
        capture();
        const before = content();
        const originalText = text.originalText;
        const count = API.getUndoStack().length;
        UI.updateInput(
          input(property),
          String(Number(input(property).value) / 3),
        );
        expect(text.fontSize).toBe(20);
        expect(text.originalText).toBe(originalText);
        expect(text.angle).toBe(angle);
        expect(text.autoResize).toBe(false);
        expect(text.text).toBe(
          wrapText(originalText, getFontString(text), text.width),
        );
        const narrowsLocalWidth =
          property === "width" ? angle % Math.PI === 0 : angle % Math.PI !== 0;
        if (narrowsLocalWidth) {
          expect(text.text).toContain("\n");
        }
        assertDisplay();
        assertHistory(before, count);
      },
    );

    it.each(
      quarters.flatMap((angle) => [2, 0.05].map((scale) => ({ angle, scale }))),
    )(
      "uses the sticky-note local resize direction at $angle (scale=$scale)",
      ({ angle, scale }) => {
        const note = API.createElement({
          type: "stickynote",
          width: 200,
          height: 200,
          baseHeight: 200,
          angle: angle as Radians,
          groupIds: ["group"],
        });
        const label = API.createElement({
          type: "text",
          text: "Sticky label",
          fontSize: 20,
          containerId: note.id,
          groupIds: ["group"],
          angle: angle as Radians,
        });
        const other = API.createElement({
          type: "rectangle",
          x: 400,
          y: 300,
          width: 50,
          height: 50,
          groupIds: ["group"],
        });
        API.updateElement(note, {
          boundElements: [{ id: label.id, type: "text" }],
        });
        API.setElements([note, label, other]);
        act(() => updateStickyNoteLayout(note, h.app.scene));
        API.setSelectedElements([note, label, other]);
        capture();
        const before = content();
        const oldWidth = note.width;
        const oldBase = note.baseHeight;
        const oldText = label.originalText;
        const count = API.getUndoStack().length;
        UI.updateInput(
          input(property),
          String(Number(input(property).value) * scale),
        );
        const changesLocalHeight =
          property === "width" ? angle % Math.PI !== 0 : angle % Math.PI === 0;
        expect(note.baseHeight).toBeCloseTo(
          Math.max(
            STICKY_NOTE_MIN_SIZE,
            oldBase * (changesLocalHeight ? scale : 1),
          ),
          8,
        );
        expect(note.width).toBeCloseTo(
          Math.max(
            STICKY_NOTE_MIN_SIZE,
            oldWidth * (changesLocalHeight ? 1 : scale),
          ),
          8,
        );
        expect(note.angle).toBe(angle);
        expect(label.originalText).toBe(oldText);
        expect(label.baseFontSize).toBe(20);
        assertDisplay();
        assertHistory(before, count);
      },
    );

    it.each([300, 0.5, 0, -1])(
      "resizes a flat group's positive axis to %s",
      (value) => {
        const vertical = property === "height";
        const members = [0, 100].map((offset) =>
          API.createElement({
            type: "line",
            x: vertical ? 20 : offset,
            y: vertical ? offset : 20,
            width: vertical ? 0 : 100,
            height: vertical ? 100 : 0,
            points: [
              pointFrom<LocalPoint>(0, 0),
              pointFrom<LocalPoint>(vertical ? 0 : 100, vertical ? 100 : 0),
            ],
            roughness: 0,
            roundness: null,
            groupIds: ["flat"],
          }),
        );
        API.setElements(members);
        API.setSelectedElements(members);
        capture();
        const before = content();
        const count = API.getUndoStack().length;
        UI.updateInput(input(property), String(value));
        const bounds = getCommonBounds(members);
        expect(bounds[2] - bounds[0]).toBe(vertical ? 0 : Math.max(1, value));
        expect(bounds[3] - bounds[1]).toBe(vertical ? Math.max(1, value) : 0);
        assertDisplay();
        assertHistory(before, count);
      },
    );

    it.each(quarters)(
      "checks actual curve minimum bounds at angle %s",
      (angle) => {
        API.setAppState({
          currentItemRoughness: 2,
          currentItemRoundness: "round",
        });
        UI.createElement("line", {
          x: 200,
          y: 200,
          angle,
          points: [
            [0, 0],
            [-100, -30],
            [-50, 60],
            [20, -10],
          ].map(([x, y]) => pointFrom<LocalPoint>(x, y)),
        });
        UI.createElement("rectangle", {
          x: 150,
          y: 210,
          width: 10,
          height: 10,
        });
        API.setSelectedElements([...getNonDeletedElements(h.elements)]);
        API.executeAction(actionGroup);
        UI.updateInput(input(property), "1");
        const [x1, y1, x2, y2] = getCommonBounds(h.elements);
        expect(x2 - x1).toBeGreaterThanOrEqual(1);
        expect(y2 - y1).toBeGreaterThanOrEqual(1);
        assertDisplay();
      },
    );

    it("preserves elbow points and fixed-segment metadata", () => {
      const points = [
        [0, 0],
        [40, 0],
        [40, 80],
        [100, 80],
      ].map(([x, y]) => pointFrom<LocalPoint>(x, y));
      const arrow = API.createElement({
        type: "arrow",
        x: 20,
        y: 20,
        width: 100,
        height: 80,
        points,
        elbowed: true,
        roughness: 0,
        roundness: null,
        startArrowhead: "circle",
        endArrowhead: "arrow",
        groupIds: ["group"],
      });
      const other = API.createElement({
        type: "rectangle",
        x: 150,
        y: 130,
        width: 50,
        height: 50,
        groupIds: ["group"],
      });
      // createElement does not forward fixedSegments to newArrowElement.
      if (!isElbowArrow(arrow)) {
        throw new Error("Expected an elbow arrow");
      }
      arrow.fixedSegments = [{ index: 2, start: points[1], end: points[2] }];
      API.setElements([arrow, other]);
      API.setSelectedElements([arrow, other]);
      const original = structuredClone(arrow);
      const before = getCommonBounds([arrow, other]);
      UI.updateInput(
        input(property),
        String(Number(input(property).value) * 2),
      );
      expect(arrow.elbowed).toBe(true);
      expect(arrow.angle).toBe(original.angle);
      expect(arrow.startBinding).toEqual(original.startBinding);
      expect(arrow.endBinding).toEqual(original.endBinding);
      expect(arrow.startArrowhead).toBe("circle");
      expect(arrow.endArrowhead).toBe("arrow");
      expect(arrow.points).toEqual(
        points.map(([x, y]) => [
          x * (property === "width" ? 2 : 1),
          y * (property === "height" ? 2 : 1),
        ]),
      );
      expect(arrow.fixedSegments).toEqual([
        { index: 2, start: arrow.points[1], end: arrow.points[2] },
      ]);
      const after = getCommonBounds([arrow, other]);
      expect(after[2] - after[0]).toBeCloseTo(
        (before[2] - before[0]) * (property === "width" ? 2 : 1),
        8,
      );
      expect(after[3] - after[1]).toBeCloseTo(
        (before[3] - before[1]) * (property === "height" ? 2 : 1),
        8,
      );
      assertDisplay();
    });

    it.each(["line", "arrow"] as const)(
      "accepts regenerated %s bounds and displays the actual result",
      (type) => {
        API.setAppState({
          currentItemRoughness: 2,
          currentItemRoundness: "round",
        });
        const curve = UI.createElement(type, {
          x: 200,
          y: 200,
          points: [
            [0, 0],
            [-100, -30],
            [-50, 60],
            [20, -10],
          ].map(([x, y]) => pointFrom<LocalPoint>(x, y)),
        });
        UI.createElement("rectangle", {
          x: 150,
          y: 210,
          width: 10,
          height: 10,
        });
        API.setSelectedElements([...getNonDeletedElements(h.elements)]);
        API.executeAction(actionGroup);
        const original = structuredClone(curve.get());
        const beforeBounds = getCommonBounds(h.elements);
        const target = Number(input(property).value) * 2;
        UI.updateInput(input(property), String(target));
        expect(curve.angle).toBe(original.angle);
        expect(curve.type).toBe(original.type);
        expect(curve.groupIds).toEqual(original.groupIds);
        expect(curve.points).not.toEqual(original.points);
        assertDisplay();
        const bounds = getCommonBounds(h.elements);
        const expectedWidth =
          property === "width" ? target : beforeBounds[2] - beforeBounds[0];
        const expectedHeight =
          property === "height" ? target : beforeBounds[3] - beforeBounds[1];
        // Rough curves are regenerated. A correct point transformation need not
        // make their rendered bounds equal the requested bounds.
        expect(
          Math.max(
            Math.abs(bounds[2] - bounds[0] - expectedWidth),
            Math.abs(bounds[3] - bounds[1] - expectedHeight),
          ),
        ).toBeGreaterThan(1e-5);
        expect(h.state.toast).toBeNull();
      },
    );
  });

  it.each(["angle", "zero-axis", "zero-bounds", "overflow"] as const)(
    "rejects the entire mixed edit for %s, restores Mixed, and creates no history",
    (obstacle) => {
      const first = pair();
      const later =
        obstacle === "angle"
          ? pair(0.73, "later", 300)
          : [0, 100].map((offset) =>
              API.createElement({
                type: "line",
                x: 400,
                y: obstacle === "zero-bounds" ? 0 : offset,
                width: 0,
                height: obstacle === "zero-bounds" ? 0 : 100,
                points: [
                  pointFrom<LocalPoint>(0, 0),
                  pointFrom<LocalPoint>(
                    0,
                    obstacle === "zero-bounds" ? 0 : 100,
                  ),
                ],
                roughness: 0,
                roundness: null,
                groupIds: ["later"],
              }),
            );
      const single = API.createElement({
        type: "rectangle",
        x: 700,
        width: 30,
        height: 50,
      });
      const unrelated = API.createElement({ type: "rectangle", x: 1000 });
      const selected =
        obstacle === "overflow"
          ? [...first, single]
          : [...first, ...later, single];
      API.setElements([...selected, unrelated]);
      API.setSelectedElements(selected);
      capture();
      const before = structuredClone(h.elements);
      const count = API.getUndoStack().length;
      UI.updateInput(input("width"), obstacle === "overflow" ? "1e999" : "200");
      expect(h.elements).toEqual(before);
      expect(input("width").value).toBe("Mixed");
      expect(API.getUndoStack()).toHaveLength(count);
      const reason = {
        angle: "stats.resizeUnsupportedAngle",
        "zero-axis": "stats.resizeZeroAxis",
        "zero-bounds": "stats.resizeZeroBounds",
        overflow: "stats.resizeInvalidGeometry",
      } as const;
      expect(h.state.toast?.message).toBe(t(reason[obstacle]));
      expect(lock()).toHaveAttribute("aria-pressed", "false");
      if (obstacle === "angle") {
        fireEvent.click(lock());
        UI.updateInput(input("width"), "200");
        expect(h.elements).not.toEqual(before);
        expect(API.getUndoStack()).toHaveLength(count + 1);
      }
    },
  );
});
