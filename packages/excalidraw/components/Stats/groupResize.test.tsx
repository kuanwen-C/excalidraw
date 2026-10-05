import React from "react";
import { act, fireEvent, within } from "@testing-library/react";
import { vi } from "vitest";

import { reseed } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  getCommonBounds,
  handleBindTextResize,
  updateStickyNoteLayout,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { Radians, LocalPoint } from "@excalidraw/math";

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

import { calculateDimensions } from "./dimensionUtils";

const { h } = window;
const input = (property: "width" | "height") =>
  UI.queryStatsProperty(property === "width" ? "W" : "H")!.querySelector(
    "input",
  )!;
const capture = () =>
  act(() =>
    h.app.syncActionResult({ captureUpdate: CaptureUpdateAction.IMMEDIATELY }),
  );
const geometry = () =>
  h.elements.map(({ id, x, y, width, height, angle }) => ({
    id,
    x,
    y,
    width,
    height,
    angle,
  }));
const enableLock = () => {
  const button = within(UI.queryStats()!).getByRole("button", {
    name: t("stats.keepProportions"),
  });
  if (button.getAttribute("aria-pressed") === "false") {
    fireEvent.click(button);
  }
};
const displayed = (value: number) => String(Number(value.toFixed(2)));

describe("Stats proportional group integration", () => {
  beforeAll(() => mockBoundingClientRect());
  afterAll(() => restoreOriginalGetBoundingClientRect());
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setAppState({ stats: { ...h.state.stats, open: true } });
  });

  const pair = (angle = 0, offset = 0, group = "group") => [
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

  describe.each(["width", "height"] as const)(
    "flat group positive %s",
    (property) => {
      const selectFlatGroup = () => {
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
        enableLock();
        capture();
        return members;
      };
      it.each([300, 0.5, 0, -1])(
        "types %s and preserves the empty axis through Undo/Redo",
        (requestedValue) => {
          const members = selectFlatGroup();
          const before = geometry();
          const undoCount = API.getUndoStack().length;
          UI.updateInput(input(property), String(requestedValue));
          const positive = Math.max(1, requestedValue);
          const bounds = getCommonBounds(members);
          expect(bounds[2] - bounds[0]).toBe(
            property === "width" ? positive : 0,
          );
          expect(bounds[3] - bounds[1]).toBe(
            property === "height" ? positive : 0,
          );
          expect(input(property).value).toBe(String(positive));
          expect(input(property === "width" ? "height" : "width").value).toBe(
            "0",
          );
          const after = geometry();
          expect(API.getUndoStack()).toHaveLength(undoCount + 1);
          Keyboard.undo();
          expect(geometry()).toEqual(before);
          Keyboard.redo();
          expect(geometry()).toEqual(after);
          expect(
            within(UI.queryStats()!).queryByRole("button", {
              name: t("stats.keepProportions"),
            }),
          ).toHaveAttribute("aria-pressed", "true");
        },
      );
      it("drags the positive label without inventing an empty-axis extent", () => {
        const members = selectFlatGroup();
        const label = UI.queryStatsProperty(
          property === "width" ? "W" : "H",
        )!.querySelector(".drag-input-label")!;
        fireEvent.pointerDown(label, { clientX: 0 });
        fireEvent.pointerMove(h.app.ownerWindow, { clientX: 0 });
        fireEvent.pointerMove(h.app.ownerWindow, { clientX: 100 });
        fireEvent.pointerUp(h.app.ownerWindow);
        const bounds = getCommonBounds(members);
        expect(bounds[2] - bounds[0]).toBe(property === "width" ? 300 : 0);
        expect(bounds[3] - bounds[1]).toBe(property === "height" ? 300 : 0);
        expect(input(property).value).toBe("300");
      });
      it("rejects expanding the empty axis without adding an undo entry", () => {
        selectFlatGroup();
        const before = structuredClone(h.elements);
        const count = API.getUndoStack().length;
        const empty = property === "width" ? "height" : "width";
        UI.updateInput(input(empty), "50");
        expect(h.elements).toEqual(before);
        expect(input(empty).value).toBe("0");
        expect(API.getUndoStack()).toHaveLength(count);
      });
    },
  );

  describe.each(["width", "height"] as const)("%s", (property) => {
    it.each([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 0.73])(
      "scales group canvas bounds at angle %s",
      (angle) => {
        const members = pair(angle);
        API.setElements(members);
        API.setSelectedElements(members);
        enableLock();
        const before = structuredClone(members);
        const bounds = getCommonBounds(before);
        const target = calculateDimensions({
          originalWidth: bounds[2] - bounds[0],
          originalHeight: bounds[3] - bounds[1],
          property,
          requestedValue: 200.25,
          minimumSize: 1,
          keepAspectRatio: true,
        })!;
        expect(
          within(UI.queryStats()!).queryByRole("button", {
            name: t("stats.keepProportions"),
          }),
        ).toHaveAttribute("aria-pressed", "true");
        UI.updateInput(input(property), "200.25");
        const after = getCommonBounds(members);
        expect(after[0]).toBeCloseTo(bounds[0], 8);
        expect(after[1]).toBeCloseTo(bounds[1], 8);
        expect(after[2] - after[0]).toBeCloseTo(target.width, 8);
        expect(after[3] - after[1]).toBeCloseTo(target.height, 8);
        members.forEach((member, index) => {
          const scale = target.height / (bounds[3] - bounds[1]);
          expect(member.x).toBeCloseTo(
            bounds[0] + (before[index].x - bounds[0]) * scale,
            8,
          );
          expect(member.angle).toBe(before[index].angle);
        });
        expect(input(property).value).toBe("200.25");
      },
    );

    it("resolves minimum conflicts at group level without clamping members", () => {
      const members = pair();
      API.setElements(members);
      API.setSelectedElements(members);
      enableLock();
      UI.updateInput(input(property), "1");
      const [x1, y1, x2, y2] = getCommonBounds(members);
      expect(x2 - x1).toBeCloseTo(2, 12);
      expect(y2 - y1).toBeCloseTo(1, 12);
      expect(x2 - x1).toBeGreaterThanOrEqual(1);
      expect(y2 - y1).toBeGreaterThanOrEqual(1);
      expect(members[0].width).toBeLessThan(1);
      expect(input(property).value).toBe(property === "width" ? "2" : "1");
    });

    it("keeps mixed units separate and restores all geometry in one Undo/Redo", () => {
      const first = pair();
      const second = pair(0.73, 300, "second-group");
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
      API.setSelectedElements([...first, ...second, single]);
      enableLock();
      capture();
      const before = geometry();
      const unrelatedBefore = structuredClone(unrelated);
      const undoCount = API.getUndoStack().length;
      UI.updateInput(input(property), "200");
      const after = geometry();
      for (const group of [first, second]) {
        const [x1, y1, x2, y2] = getCommonBounds(group);
        expect(property === "width" ? x2 - x1 : y2 - y1).toBeCloseTo(200, 8);
      }
      expect(single[property]).toBe(200);
      expect(single[property === "width" ? "height" : "width"]).toBe(
        property === "width" ? 300 : (20 * 200) / 30,
      );
      expect(unrelated).toEqual(unrelatedBefore);
      expect(API.getUndoStack()).toHaveLength(undoCount + 1);
      Keyboard.undo();
      expect(geometry()).toEqual(before);
      Keyboard.redo();
      expect(geometry()).toEqual(after);
    });

    it("rejects the whole selection when a group calculation overflows", () => {
      const members = pair();
      if (property === "width") {
        API.updateElement(members[0], { height: 200 });
      }
      const single = API.createElement({
        type: "rectangle",
        x: 700,
        width: 20,
        height: 30,
      });
      API.setElements([...members, single]);
      API.setSelectedElements([...members, single]);
      enableLock();
      capture();
      const before = structuredClone(h.elements);
      const undoCount = API.getUndoStack().length;
      UI.updateInput(input(property), "1e308");
      expect(h.elements).toEqual(before);
      expect(geometry()).toEqual(
        before.map(({ id, x, y, width, height, angle }) => ({
          id,
          x,
          y,
          width,
          height,
          angle,
        })),
      );
      expect(input(property).value).toBe("Mixed");
      expect(API.getUndoStack()).toHaveLength(undoCount);
    });
  });

  it.each([false, true])(
    "keeps group label dragging rounding and Shift steps (%s)",
    (shiftKey) => {
      const members = pair();
      API.setElements(members);
      API.setSelectedElements(members);
      enableLock();
      const label =
        UI.queryStatsProperty("W")!.querySelector(".drag-input-label")!;
      fireEvent.pointerDown(label, { clientX: 0 });
      fireEvent.pointerMove(h.app.ownerWindow, { clientX: 0 });
      fireEvent.pointerMove(h.app.ownerWindow, { clientX: 6.3, shiftKey });
      fireEvent.pointerUp(h.app.ownerWindow);
      const bounds = getCommonBounds(members);
      expect(bounds[2] - bounds[0]).toBe(shiftKey ? 110 : 106);
      expect(bounds[3] - bounds[1]).toBe(shiftKey ? 55 : 53);
    },
  );

  it.each([
    [0, false],
    [Math.PI / 2, false],
    [0.73, false],
    [0, true],
    [Math.PI / 2, true],
    [0.73, true],
  ] as const)(
    "scales a bound label once through its container at angle %s (minimum=%s)",
    (angle, minimum) => {
      const container = API.createElement({
        type: "rectangle",
        width: 100,
        height: 50,
        angle: angle as Radians,
        groupIds: ["group"],
      });
      const label = API.createElement({
        type: "text",
        text: "Several words that must wrap inside a smaller container",
        fontSize: 20,
        containerId: container.id,
        groupIds: ["group"],
        angle: angle as Radians,
      });
      const other = API.createElement({
        type: "rectangle",
        x: 200,
        width: 30,
        height: 30,
        groupIds: ["group"],
      });
      API.updateElement(container, {
        boundElements: [{ id: label.id, type: "text" }],
      });
      API.setElements([container, label, other]);
      act(() => handleBindTextResize(container, h.app.scene, "e", true));
      API.setSelectedElements([container, label, other]);
      enableLock();
      capture();
      const originalBounds = getCommonBounds([container, label, other]);
      const width = originalBounds[2] - originalBounds[0];
      const originalFont = label.fontSize;
      const before = geometry();
      const undoCount = API.getUndoStack().length;
      const mutate = vi.spyOn(h.app.scene, "mutateElement");
      const requestedWidth = minimum ? 1 : Number(displayed(width / 2));
      UI.updateInput(input("width"), String(requestedWidth));
      expect(
        mutate.mock.calls.filter(
          ([element, updates]) =>
            element.id === label.id && "fontSize" in updates,
        ),
      ).toHaveLength(1);
      mutate.mockRestore();
      const resolved = calculateDimensions({
        originalWidth: width,
        originalHeight: originalBounds[3] - originalBounds[1],
        property: "width",
        requestedValue: requestedWidth,
        keepAspectRatio: true,
        minimumSize: 1,
      })!;
      const scale = resolved.width / width;
      expect(label.fontSize).toBeCloseTo(originalFont * scale, 8);
      expect(label.angle).toBe(container.angle);
      if (!minimum) {
        expect(label.text).toContain("\n");
      }
      const after = geometry();
      const finalBounds = getCommonBounds([container, label, other]);
      expect(finalBounds[2] - finalBounds[0]).toBeGreaterThanOrEqual(1);
      expect(finalBounds[3] - finalBounds[1]).toBeGreaterThanOrEqual(1);
      expect(input("width").value).toBe(
        displayed(finalBounds[2] - finalBounds[0]),
      );
      expect(input("height").value).toBe(
        displayed(finalBounds[3] - finalBounds[1]),
      );
      expect(API.getUndoStack()).toHaveLength(undoCount + 1);
      Keyboard.undo();
      expect(geometry()).toEqual(before);
      Keyboard.redo();
      expect(geometry()).toEqual(after);
    },
  );

  it.each([false, true])(
    "preserves frame membership handling alongside groups (drag=%s)",
    (drag) => {
      const members = pair();
      const frame = API.createElement({
        type: "frame",
        x: 400,
        y: 0,
        width: 100,
        height: 100,
      });
      const candidate = API.createElement({
        type: "rectangle",
        x: 550,
        y: 20,
        width: 20,
        height: 20,
      });
      API.setElements([...members, frame, candidate]);
      API.setSelectedElements([...members, frame]);
      enableLock();
      expect(candidate.frameId).toBeNull();
      if (drag) {
        const label =
          UI.queryStatsProperty("W")!.querySelector(".drag-input-label")!;
        fireEvent.pointerDown(label, { clientX: 0 });
        fireEvent.pointerMove(h.app.ownerWindow, { clientX: 0 });
        fireEvent.pointerMove(h.app.ownerWindow, { clientX: 100 });
        fireEvent.pointerUp(h.app.ownerWindow);
      } else {
        UI.updateInput(input("width"), "200");
      }
      expect(frame.width).toBe(200);
      expect(API.getElement(candidate).frameId).toBe(frame.id);
    },
  );

  it("preflights a valid group before rejecting expansion of a later group's zero axis", () => {
    const members = pair();
    const lines = [0, 100].map((x) =>
      API.createElement({
        type: "line",
        x,
        y: 300,
        width: 50,
        height: 0,
        roughness: 0,
        roundness: null,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(50, 0)],
        groupIds: ["flat-group"],
      }),
    );
    const single = API.createElement({
      type: "rectangle",
      x: 500,
      width: 50,
      height: 50,
    });
    API.setElements([...members, ...lines, single]);
    API.setSelectedElements([...members, ...lines, single]);
    enableLock();
    capture();
    const before = structuredClone(h.elements);
    const history = API.getUndoStack().length;
    UI.updateInput(input("height"), "200");
    expect(h.elements).toEqual(before);
    expect(input("height").value).toBe("Mixed");
    expect(API.getUndoStack()).toHaveLength(history);
  });

  it("preserves bindings and scales selected arrows once with their group", () => {
    const container = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      groupIds: ["group"],
    });
    const arrow = API.createElement({
      type: "arrow",
      x: 100,
      y: 25,
      width: 100,
      height: 25,
      roughness: 0,
      roundness: null,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 25)],
      startBinding: {
        elementId: container.id,
        fixedPoint: [1, 0.5],
        mode: "inside",
      },
      groupIds: ["group"],
      endArrowhead: "arrow",
    });
    API.updateElement(container, {
      boundElements: [{ id: arrow.id, type: "arrow" }],
    });
    API.setElements([container, arrow]);
    API.setSelectedElements([container, arrow]);
    enableLock();
    const binding = structuredClone(arrow.startBinding);
    UI.updateInput(input("width"), "400");
    expect(arrow.x).toBe(200);
    expect(arrow.y).toBe(50);
    expect(arrow.points).toEqual([
      [0, 0],
      [200, 50],
    ]);
    expect(arrow.startBinding).toEqual(binding);
    expect(arrow.endArrowhead).toBe("arrow");
  });

  it("preserves standalone text scaling and sticky-note layout", () => {
    const note = API.createElement({
      type: "stickynote",
      width: 200,
      height: 200,
      baseHeight: 200,
      groupIds: ["group"],
    });
    const label = API.createElement({
      type: "text",
      text: "Sticky label",
      fontSize: 20,
      containerId: note.id,
      groupIds: ["group"],
    });
    const text = API.createElement({
      type: "text",
      x: 300,
      text: "Standalone",
      fontSize: 20,
      groupIds: ["group"],
    });
    API.updateElement(note, {
      boundElements: [{ id: label.id, type: "text" }],
    });
    API.setElements([note, label, text]);
    act(() => updateStickyNoteLayout(note, h.app.scene));
    API.setSelectedElements([note, label, text]);
    enableLock();
    const baseFont = label.baseFontSize!;
    const bounds = getCommonBounds(h.elements);
    const width = bounds[2] - bounds[0];
    UI.updateInput(input("width"), displayed(width * 2));
    expect(note.width).toBe(400);
    expect(note.baseHeight).toBe(400);
    expect(label.baseFontSize).toBe(baseFont * 2);
    expect(text.fontSize).toBe(40);
    const after = getCommonBounds(h.elements);
    expect(input("height").value).toBe(displayed(after[3] - after[1]));
  });

  it.each([
    [1, 0, "width"],
    [1, 0, "height"],
    [1, 0.73, "width"],
    [1, 0.73, "height"],
    [2, 0, "width"],
    [2, 0, "height"],
    [2, 0.73, "width"],
    [2, 0.73, "height"],
  ] as const)(
    "checks actual final curve minimum: roughness %s angle %s edit %s",
    (roughness, angle, property) => {
      API.setAppState({
        currentItemRoughness: roughness,
        currentItemRoundness: "round",
      });
      const curve = UI.createElement("line", {
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
      const rectangle = API.createElement({
        type: "rectangle",
        x: 150,
        y: 210,
        width: 10,
        height: 10,
      });
      API.setElements([curve.get(), rectangle]);
      API.setSelectedElements(h.app.scene.getNonDeletedElements().slice());
      enableLock();
      API.executeAction(actionGroup);
      UI.updateInput(input(property), "1");
      const [x1, y1, x2, y2] = getCommonBounds(h.elements);
      expect(input("height").value).toBe(displayed(y2 - y1));
      expect(x2 - x1).toBeGreaterThanOrEqual(1);
      expect(y2 - y1).toBeGreaterThanOrEqual(1);
    },
  );
});
