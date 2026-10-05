import { degreesToRadians, pointFrom, pointRotateRads } from "@excalidraw/math";
import { act, fireEvent, queryByTestId, within } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";

import { setDateTimeForTests, reseed } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  handleBindTextResize,
  isInGroup,
} from "@excalidraw/element";

import { isTextElement } from "@excalidraw/element";

import type { Degrees } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw, getCommonBounds } from "../..";
import { actionGroup } from "../../actions";
import { t } from "../../i18n";
import * as StaticScene from "../../renderer/staticScene";
import { API } from "../../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../../tests/helpers/ui";
import { getTextEditor, updateTextEditor } from "../../tests/queries/dom";
import {
  GlobalTestState,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "../../tests/test-utils";

import { getStepSizedValue } from "./utils";

const { h } = window;
const mouse = new Pointer("mouse");
const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");
let stats: HTMLElement | null = null;
let elementStats: HTMLElement | null | undefined = null;

const getAspectRatioLock = () =>
  within(UI.queryStats()!).getByRole("button", {
    name: t("stats.keepProportions"),
  });

const getDimensionInput = (property: "width" | "height") =>
  UI.queryStatsProperty(property === "width" ? "W" : "H")!.querySelector(
    "input",
  )!;

const dragDimension = (
  property: "width" | "height",
  movements: number[],
  shiftKey = false,
) => {
  const label = UI.queryStatsProperty(
    property === "width" ? "W" : "H",
  )!.querySelector(".drag-input-label")!;
  const ownerWindow = h.app.ownerWindow;
  fireEvent.pointerDown(label, { clientX: 0 });
  fireEvent.pointerMove(ownerWindow, { clientX: 0 });
  movements.forEach((clientX) => {
    fireEvent.pointerMove(ownerWindow, { clientX, shiftKey });
  });
  fireEvent.pointerUp(ownerWindow);
};

const testInputProperty = (
  element: ExcalidrawElement,
  property: "x" | "y" | "width" | "height" | "angle" | "fontSize",
  label: string,
  initialValue: number,
  nextValue: number,
) => {
  const input = UI.queryStatsProperty(label)?.querySelector(
    ".drag-input",
  ) as HTMLInputElement;
  expect(input).toBeDefined();
  expect(input.value).toBe(initialValue.toString());
  UI.updateInput(input, String(nextValue));
  if (property === "angle") {
    expect(element[property]).toBe(
      degreesToRadians(Number(nextValue) as Degrees),
    );
  } else if (property === "fontSize" && isTextElement(element)) {
    expect(element[property]).toBe(Number(nextValue));
  } else if (property !== "fontSize") {
    expect(element[property]).toBe(Number(nextValue));
  }
};

describe("step sized value", () => {
  it("should return edge values correctly", () => {
    const steps = [10, 15, 20, 25, 30];
    const values = [10, 15, 20, 25, 30];

    steps.forEach((step, idx) => {
      expect(getStepSizedValue(values[idx], step)).toEqual(values[idx]);
    });
  });

  it("step sized value lies in the middle", () => {
    let stepSize = 15;
    let values = [7.5, 9, 12, 14.99, 15, 22.49];

    values.forEach((value) => {
      expect(getStepSizedValue(value, stepSize)).toEqual(15);
    });

    stepSize = 10;
    values = [-5, 4.99, 0, 1.23];
    values.forEach((value) => {
      expect(getStepSizedValue(value, stepSize)).toEqual(0);
    });
  });
});

describe("binding with linear elements", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(19);
    setDateTimeForTests("201933152653");

    await render(<Excalidraw handleKeyboardGlobally={true} />);

    API.setElements([]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByTestId(contextMenu!, "stats")!);
    stats = UI.queryStats();

    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(200, 100);

    UI.clickTool("arrow");
    mouse.down(-5, 0);
    mouse.up(300, 50);

    elementStats = stats?.querySelector("#elementStats");
  });

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should remain bound to linear element on small position change", async () => {
    const linear = h.elements[1] as ExcalidrawLinearElement;
    const inputX = UI.queryStatsProperty("X")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(linear.startBinding).not.toBe(null);
    expect(inputX).not.toBeNull();
    UI.updateInput(inputX, String("184"));
    expect(linear.startBinding).not.toBe(null);
  });

  it("should unbind linear element on large position change", async () => {
    const linear = h.elements[1] as ExcalidrawLinearElement;
    const inputX = UI.queryStatsProperty("X")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(linear.startBinding).not.toBe(null);
    expect(inputX).not.toBeNull();
    UI.updateInput(inputX, String("254"));
    expect(linear.startBinding).toBe(null);
  });
});

// single element
describe("stats for a generic element", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(7);
    setDateTimeForTests("201933152653");

    await render(<Excalidraw handleKeyboardGlobally={true} />);

    API.setElements([]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByTestId(contextMenu!, "stats")!);
    stats = UI.queryStats();

    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(200, 100);
    elementStats = stats?.querySelector("#elementStats");
  });

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should open stats", () => {
    expect(stats).toBeDefined();
    expect(elementStats).toBeDefined();

    // title
    const title = elementStats?.querySelector("h3");
    expect(title?.lastChild?.nodeValue)?.toBe(t("stats.elementProperties"));

    // element type
    const elementType = queryByTestId(elementStats!, "stats-element-type");
    expect(elementType).toBeDefined();
    expect(elementType?.lastChild?.nodeValue).toBe(t("element.rectangle"));

    // properties
    ["X", "Y", "W", "H", "A"].forEach((label) => () => {
      expect(
        stats!.querySelector?.(`.drag-input-container[data-testid="${label}"]`),
      ).toBeDefined();
    });
  });

  it("should be able to edit all properties for a general element", () => {
    const rectangle = h.elements[0];
    const initialX = rectangle.x;
    const initialY = rectangle.y;

    testInputProperty(rectangle, "width", "W", 200, 100);
    testInputProperty(rectangle, "height", "H", 100, 200);
    testInputProperty(rectangle, "x", "X", initialX, 230);
    testInputProperty(rectangle, "y", "Y", initialY, 220);
    testInputProperty(rectangle, "angle", "A", 0, 45);
  });

  it("should keep only two decimal places", () => {
    const rectangle = h.elements[0];
    const rectangleId = rectangle.id;

    const input = UI.queryStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe(rectangle.width.toString());
    UI.updateInput(input, "123.123");
    expect(h.elements.length).toBe(1);
    expect(rectangle.id).toBe(rectangleId);
    expect(input.value).toBe("123.12");
    expect(rectangle.width).toBe(123.12);

    UI.updateInput(input, "88.98766");
    expect(input.value).toBe("88.99");
    expect(rectangle.width).toBe(88.99);
  });

  it("should reject non-finite values", () => {
    const rectangle = h.elements[0];

    const input = UI.queryStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(input).toBeDefined();

    UI.updateInput(input, "100");
    expect(rectangle.width).toBe(100);

    for (const garbage of ["Infinity", "-Infinity", "1e999"]) {
      UI.updateInput(input, garbage);
      expect(rectangle.width).toBe(100);
      expect(input.value).toBe("100");
    }
  });

  it("should update input x and y when angle is changed", () => {
    const rectangle = h.elements[0];
    const [cx, cy] = [
      rectangle.x + rectangle.width / 2,
      rectangle.y + rectangle.height / 2,
    ];
    const [topLeftX, topLeftY] = pointRotateRads(
      pointFrom(rectangle.x, rectangle.y),
      pointFrom(cx, cy),
      rectangle.angle,
    );

    const xInput = UI.queryStatsProperty("X")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    const yInput = UI.queryStatsProperty("Y")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(xInput.value).toBe(topLeftX.toString());
    expect(yInput.value).toBe(topLeftY.toString());

    testInputProperty(rectangle, "angle", "A", 0, 45);

    let [newTopLeftX, newTopLeftY] = pointRotateRads(
      pointFrom(rectangle.x, rectangle.y),
      pointFrom(cx, cy),
      rectangle.angle,
    );

    expect(newTopLeftX.toString()).not.toEqual(xInput.value);
    expect(newTopLeftY.toString()).not.toEqual(yInput.value);

    testInputProperty(rectangle, "angle", "A", 45, 66);

    [newTopLeftX, newTopLeftY] = pointRotateRads(
      pointFrom(rectangle.x, rectangle.y),
      pointFrom(cx, cy),
      rectangle.angle,
    );
    expect(newTopLeftX.toString()).not.toEqual(xInput.value);
    expect(newTopLeftY.toString()).not.toEqual(yInput.value);
  });

  it("should fix top left corner when width or height is changed", () => {
    const rectangle = h.elements[0];

    testInputProperty(rectangle, "angle", "A", 0, 45);
    let [cx, cy] = [
      rectangle.x + rectangle.width / 2,
      rectangle.y + rectangle.height / 2,
    ];
    const [topLeftX, topLeftY] = pointRotateRads(
      pointFrom(rectangle.x, rectangle.y),
      pointFrom(cx, cy),
      rectangle.angle,
    );
    testInputProperty(rectangle, "width", "W", rectangle.width, 400);
    [cx, cy] = [
      rectangle.x + rectangle.width / 2,
      rectangle.y + rectangle.height / 2,
    ];
    let [currentTopLeftX, currentTopLeftY] = pointRotateRads(
      pointFrom(rectangle.x, rectangle.y),
      pointFrom(cx, cy),
      rectangle.angle,
    );
    expect(currentTopLeftX).toBeCloseTo(topLeftX, 4);
    expect(currentTopLeftY).toBeCloseTo(topLeftY, 4);

    testInputProperty(rectangle, "height", "H", rectangle.height, 400);
    [cx, cy] = [
      rectangle.x + rectangle.width / 2,
      rectangle.y + rectangle.height / 2,
    ];
    [currentTopLeftX, currentTopLeftY] = pointRotateRads(
      pointFrom(rectangle.x, rectangle.y),
      pointFrom(cx, cy),
      rectangle.angle,
    );

    expect(currentTopLeftX).toBeCloseTo(topLeftX, 4);
    expect(currentTopLeftY).toBeCloseTo(topLeftY, 4);
  });
});

describe("stats for a non-generic element", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(7);
    setDateTimeForTests("201933152653");

    await render(<Excalidraw handleKeyboardGlobally={true} />);

    API.setElements([]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByTestId(contextMenu!, "stats")!);
    stats = UI.queryStats();
  });

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("text element", async () => {
    UI.clickTool("text");
    mouse.clickAt(20, 30);
    const editor = await getTextEditor();
    updateTextEditor(editor, "Hello!");
    Keyboard.exitTextEditor(editor);

    const text = h.elements[0] as ExcalidrawTextElement;
    API.setSelectedElements([text] as NonDeletedExcalidrawElement[]);

    elementStats = stats?.querySelector("#elementStats");

    // can change font size
    const input = UI.queryStatsProperty("F")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe(text.fontSize.toString());
    UI.updateInput(input, "36");
    expect(text.fontSize).toBe(36);

    // can change width or height
    const width = UI.queryStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(width).toBeDefined();
    const height = UI.queryStatsProperty("H")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(height).toBeDefined();

    const textHeightBeforeWrapping = text.height;
    const textBeforeWrapping = text.text;
    const originalTextBeforeWrapping = textBeforeWrapping;
    UI.updateInput(width, "30");
    expect(text.height).toBeGreaterThan(textHeightBeforeWrapping);
    expect(text.text).not.toBe(textBeforeWrapping);
    expect(text.originalText).toBe(originalTextBeforeWrapping);

    // min font size is 4
    UI.updateInput(input, "0");
    expect(text.fontSize).not.toBe(0);
    expect(text.fontSize).toBe(4);
  });

  it("frame element", () => {
    const frame = API.createElement({
      id: "id0",
      type: "frame",
      x: 150,
      width: 150,
    });
    API.setElements([frame]);
    API.setAppState({
      selectedElementIds: {
        [frame.id]: true,
      },
    });

    elementStats = stats?.querySelector("#elementStats");

    expect(elementStats).toBeDefined();

    // cannot change angle
    const angle = UI.queryStatsProperty("A")?.querySelector(".drag-input");
    expect(angle).toBeUndefined();

    // can change width or height
    testInputProperty(frame, "width", "W", frame.width, 250);
    testInputProperty(frame, "height", "H", frame.height, 500);
  });

  it("image element", () => {
    const image = API.createElement({ type: "image", width: 200, height: 100 });
    API.setElements([image]);
    mouse.clickOn(image);
    API.setAppState({
      selectedElementIds: {
        [image.id]: true,
      },
    });
    elementStats = stats?.querySelector("#elementStats");
    expect(elementStats).toBeDefined();
    const widthToHeight = image.width / image.height;

    fireEvent.click(getAspectRatioLock());

    // when width or height is changed, the aspect ratio is preserved
    testInputProperty(image, "width", "W", image.width, 400);
    expect(image.width).toBe(400);
    expect(image.width / image.height).toBe(widthToHeight);

    testInputProperty(image, "height", "H", image.height, 80);
    expect(image.height).toBe(80);
    expect(image.width / image.height).toBe(widthToHeight);
  });

  it("should display fontSize for bound text", () => {
    const container = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    const text = API.createElement({
      type: "text",
      width: 200,
      height: 100,
      containerId: container.id,
      fontSize: 20,
    });
    h.app.scene.mutateElement(container, {
      boundElements: [{ type: "text", id: text.id }],
    });
    API.setElements([container, text]);

    API.setSelectedElements([container]);
    const fontSize = UI.queryStatsProperty("F")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(fontSize).toBeDefined();

    UI.updateInput(fontSize, "40");

    expect(text.fontSize).toBe(40);
  });
});

describe("Stats aspect-ratio lock for single elements", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(7);
    setDateTimeForTests("201933152653");
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([]);
    API.setAppState({ stats: { ...h.state.stats, open: true } });
  });

  beforeAll(() => mockBoundingClientRect());
  afterAll(() => restoreOriginalGetBoundingClientRect());

  const selectElement = (type: "rectangle" | "image" = "rectangle") => {
    const element = API.createElement({ type, width: 100, height: 50 });
    API.setElements([element]);
    API.setSelectedElements([element]);
    act(() => {
      h.app.syncActionResult({
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
    return element;
  };

  describe.each(["rectangle", "image"] as const)("%s", (type) => {
    it.each([
      ["width", false, 123.12, 50],
      ["height", false, 100, 123.12],
      ["width", true, 123.12, 61.56],
      ["height", true, 246.24, 123.12],
    ] as const)(
      "types %s with lock=%s, retaining decimal precision",
      (property, locked, width, height) => {
        const element = selectElement(type);
        expect(getAspectRatioLock()).toHaveAttribute("aria-pressed", "false");
        if (locked) {
          fireEvent.click(getAspectRatioLock());
        }
        UI.updateInput(getDimensionInput(property), "123.12");
        expect(element.width).toBeCloseTo(width, 8);
        expect(element.height).toBeCloseTo(height, 8);
      },
    );

    it.each([
      ["width", false, 1, 50],
      ["height", false, 100, 1],
      ["width", true, 2, 1],
      ["height", true, 2, 1],
    ] as const)(
      "clamps %s with lock=%s without breaking a locked ratio",
      (property, locked, width, height) => {
        const element = selectElement(type);
        if (locked) {
          fireEvent.click(getAspectRatioLock());
        }
        UI.updateInput(getDimensionInput(property), "1");
        expect(element.width).toBe(width);
        expect(element.height).toBe(height);
      },
    );

    it.each([
      ["width", false, false, 116, 50.125],
      ["height", false, false, 100.25, 66],
      ["width", true, false, 116, 58],
      ["height", true, false, 132, 66],
      ["width", false, true, 120, 50.125],
      ["height", false, true, 100.25, 70],
      ["width", true, true, 120, 60],
      ["height", true, true, 140, 70],
    ] as const)(
      "drags %s with lock=%s and Shift=%s from the original snapshot",
      (property, locked, shiftKey, width, height) => {
        const element = selectElement(type);
        API.updateElement(element, { width: 100.25, height: 50.125 });
        if (locked) {
          fireEvent.click(getAspectRatioLock());
        }
        dragDimension(property, [7, 16], shiftKey);
        expect(element.width).toBeCloseTo(width, 8);
        expect(element.height).toBeCloseTo(height, 8);
      },
    );
  });

  it("clamps a locked drag and can grow again from the original snapshot", () => {
    const element = selectElement();
    fireEvent.click(getAspectRatioLock());
    dragDimension("width", [-99]);
    expect(element.width).toBe(2);
    expect(element.height).toBe(1);
    dragDimension("width", [10, 20]);
    expect(element.width).toBe(22);
    expect(element.height).toBe(11);
  });

  it("toggles without mutating elements or adding drawing history", () => {
    selectElement();
    const elementsBefore = JSON.parse(JSON.stringify(h.elements));
    const undoBefore = [...API.getUndoStack()];
    const redoBefore = [...API.getRedoStack()];
    fireEvent.click(getAspectRatioLock());
    expect(getAspectRatioLock()).toHaveAttribute("aria-pressed", "true");
    expect(h.elements).toEqual(elementsBefore);
    fireEvent.click(getAspectRatioLock());
    expect(getAspectRatioLock()).toHaveAttribute("aria-pressed", "false");
    expect(h.elements).toEqual(elementsBefore);
    expect(API.getUndoStack()).toEqual(undoBefore);
    expect(API.getRedoStack()).toEqual(redoBefore);
  });

  it("retains its preference across deselection and multiple selections", () => {
    const rectangle = selectElement();
    const image = API.createElement({ type: "image", width: 200, height: 50 });
    API.setElements([rectangle, image]);
    fireEvent.click(getAspectRatioLock());

    API.setSelectedElements([]);
    expect(
      within(UI.queryStats()!).queryByRole("button", {
        name: t("stats.keepProportions"),
      }),
    ).toBeNull();
    API.setSelectedElements([rectangle, image]);
    expect(getAspectRatioLock()).toHaveAttribute("aria-pressed", "true");
    UI.updateInput(getDimensionInput("width"), "300");
    expect(rectangle.height).toBe(150);
    expect(image.height).toBe(75);

    API.setSelectedElements([image]);
    expect(getAspectRatioLock()).toHaveAttribute("aria-pressed", "true");
    UI.updateInput(getDimensionInput("width"), "600");
    expect(image.height).toBe(150);
  });

  it("keeps standalone text unlocked without losing the preference", () => {
    const rectangle = selectElement();
    const text = API.createElement({
      type: "text",
      text: "A long line of text that must wrap when narrowed",
      width: 300,
      height: 25,
      fontSize: 20,
    });
    API.setElements([rectangle, text]);
    fireEvent.click(getAspectRatioLock());
    API.setSelectedElements([text]);
    expect(
      within(UI.queryStats()!).queryByRole("button", {
        name: t("stats.keepProportions"),
      }),
    ).toBeNull();
    UI.updateInput(getDimensionInput("width"), "60");
    expect(text.fontSize).toBe(20);
    expect(text.text).toContain("\n");
    expect(text.height).toBeGreaterThan(25);
    API.setSelectedElements([rectangle]);
    expect(getAspectRatioLock()).toHaveAttribute("aria-pressed", "true");
  });

  it("leaves cropping independent and retains the lock on exiting crop mode", () => {
    const image = API.createElement({
      type: "image",
      width: 100,
      height: 50,
    });
    API.setElements([image]);
    API.updateElement(image, {
      crop: {
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        naturalWidth: 200,
        naturalHeight: 100,
      },
    });
    API.setSelectedElements([image]);
    fireEvent.click(getAspectRatioLock());
    API.setAppState({ croppingElementId: image.id });
    expect(
      within(UI.queryStats()!).queryByRole("button", {
        name: t("stats.keepProportions"),
      }),
    ).toBeNull();
    UI.updateInput(getDimensionInput("width"), "80");
    expect(image.width).toBe(80);
    expect(image.height).toBe(50);
    UI.updateInput(getDimensionInput("height"), "40");
    expect(image.width).toBe(80);
    expect(image.height).toBe(40);
    API.setAppState({ croppingElementId: null });
    expect(getAspectRatioLock()).toHaveAttribute("aria-pressed", "true");
  });

  it.each(["close", "zen"] as const)(
    "resets after unmounting via %s",
    (mode) => {
      selectElement();
      fireEvent.click(getAspectRatioLock());
      if (mode === "close") {
        fireEvent.click(UI.queryStats()!.querySelector(".close")!);
        expect(UI.queryStats()).toBeNull();
        API.setAppState({ stats: { ...h.state.stats, open: true } });
      } else {
        API.setAppState({ zenModeEnabled: true });
        expect(UI.queryStats()).toBeNull();
        API.setAppState({ zenModeEnabled: false });
      }
      expect(getAspectRatioLock()).toHaveAttribute("aria-pressed", "false");
    },
  );

  it("restores the resulting width after a clamped no-op without adding history", () => {
    const rectangle = selectElement();
    fireEvent.click(getAspectRatioLock());
    const widthInput = getDimensionInput("width");
    UI.updateInput(widthInput, "2");
    expect(rectangle.width).toBe(2);
    expect(rectangle.height).toBe(1);
    const elementsBefore = JSON.parse(JSON.stringify(h.elements));
    const undoBefore = [...API.getUndoStack()];

    UI.updateInput(widthInput, "1");

    expect(rectangle.width).toBe(2);
    expect(rectangle.height).toBe(1);
    expect(widthInput.value).toBe("2");
    expect(h.elements).toEqual(elementsBefore);
    expect(API.getUndoStack()).toEqual(undoBefore);
  });

  it("restores the current height after a rejected calculation without adding history", () => {
    selectElement();
    fireEvent.click(getAspectRatioLock());
    const elementsBefore = JSON.parse(JSON.stringify(h.elements));
    const undoBefore = [...API.getUndoStack()];
    const heightInput = getDimensionInput("height");
    // Finite input whose proportional width would overflow.
    UI.updateInput(heightInput, "1e308");
    expect(h.elements).toEqual(elementsBefore);
    expect(heightInput.value).toBe("50");
    expect(API.getUndoStack()).toEqual(undoBefore);
  });
});

describe("Stats aspect-ratio lock for ungrouped multiple selections", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(7);
    setDateTimeForTests("201933152653");
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setElements([]);
    API.setAppState({ stats: { ...h.state.stats, open: true } });
  });

  beforeAll(() => mockBoundingClientRect());
  afterAll(() => restoreOriginalGetBoundingClientRect());

  const captureSetup = () => {
    act(() => {
      h.app.syncActionResult({
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
  };

  const selectPair = () => {
    const first = API.createElement({
      type: "rectangle",
      width: 100,
      height: 50,
    });
    const second = API.createElement({
      type: "image",
      x: 300,
      width: 60,
      height: 120,
      fileId: "stats-resize-image",
    });
    const unrelated = API.createElement({
      type: "ellipse",
      x: 1000,
      width: 81,
      height: 43,
    });
    API.setElements([first, second, unrelated]);
    API.setSelectedElements([first, second]);
    captureSetup();
    return { first, second, unrelated };
  };

  const geometry = () =>
    h.elements.map(({ id, x, y, width, height }) => ({
      id,
      x,
      y,
      width,
      height,
    }));

  it.each([
    ["width", false, 123.12, 50, 123.12, 120],
    ["height", false, 100, 123.12, 60, 123.12],
    ["width", true, 123.12, 61.56, 123.12, 246.24],
    ["height", true, 246.24, 123.12, 61.56, 123.12],
  ] as const)(
    "types decimal %s with lock=%s and undoes/redoes both elements in one step",
    (property, locked, width1, height1, width2, height2) => {
      const { first, second, unrelated } = selectPair();
      const unrelatedBefore = JSON.parse(JSON.stringify(unrelated));
      const before = geometry();
      const undoCount = API.getUndoStack().length;
      if (locked) {
        fireEvent.click(getAspectRatioLock());
      }
      UI.updateInput(getDimensionInput(property), "123.12");
      expect(first.width).toBeCloseTo(width1, 8);
      expect(first.height).toBeCloseTo(height1, 8);
      expect(second.width).toBeCloseTo(width2, 8);
      expect(second.height).toBeCloseTo(height2, 8);
      expect(getDimensionInput(property).value).toBe("123.12");
      expect(unrelated).toEqual(unrelatedBefore);
      expect(API.getUndoStack()).toHaveLength(undoCount + 1);
      const after = geometry();
      Keyboard.undo();
      expect(geometry()).toEqual(before);
      Keyboard.redo();
      expect(geometry()).toEqual(after);
      expect(h.elements.find((element) => element.id === unrelated.id)).toEqual(
        unrelatedBefore,
      );
    },
  );

  it.each([
    ["width", false, 1, 50, 1, 120, "1"],
    ["height", false, 100, 1, 60, 1, "1"],
    ["width", true, 2, 1, 1, 2, "Mixed"],
    ["height", true, 2, 1, 1, 2, "Mixed"],
  ] as const)(
    "clamps %s with lock=%s and restores the actual input on a repeated no-op",
    (property, locked, width1, height1, width2, height2, displayed) => {
      const { first, second } = selectPair();
      if (locked) {
        fireEvent.click(getAspectRatioLock());
      }
      const input = getDimensionInput(property);
      UI.updateInput(input, "0");
      expect(first.width).toBe(width1);
      expect(first.height).toBe(height1);
      expect(second.width).toBe(width2);
      expect(second.height).toBe(height2);
      expect(input.value).toBe(displayed);
      const before = JSON.parse(JSON.stringify(h.elements));
      const undoBefore = [...API.getUndoStack()];
      UI.updateInput(input, "-1");
      expect(input.value).toBe(displayed);
      expect(h.elements).toEqual(before);
      expect(API.getUndoStack()).toEqual(undoBefore);
    },
  );

  it.each(["width", "height"] as const)(
    "restores a common numeric %s after a locked clamped no-op",
    (property) => {
      const { first, second } = selectPair();
      const dimensions =
        property === "width"
          ? { width: 2, height: 1 }
          : { width: 1, height: 2 };
      API.updateElement(first, dimensions);
      API.updateElement(second, dimensions);
      captureSetup();
      fireEvent.click(getAspectRatioLock());
      const undoBefore = [...API.getUndoStack()];
      UI.updateInput(getDimensionInput(property), "1");
      expect(getDimensionInput(property).value).toBe("2");
      expect(first.width).toBe(dimensions.width);
      expect(second.height).toBe(dimensions.height);
      expect(API.getUndoStack()).toEqual(undoBefore);
    },
  );

  it.each([
    ["width", false, false, 116, 50.125, 76, 120.5],
    ["height", false, false, 100.25, 66, 60.25, 137],
    ["width", true, false, 116, 58, 76, 152],
    ["height", true, false, 132, 66, 68.5, 137],
    ["width", false, true, 120, 50.125, 80, 120.5],
    ["height", false, true, 100.25, 70, 60.25, 140],
    ["width", true, true, 120, 60, 80, 160],
    ["height", true, true, 140, 70, 70, 140],
  ] as const)(
    "drags %s with lock=%s and Shift=%s from each original snapshot",
    (property, locked, shiftKey, width1, height1, width2, height2) => {
      const { first, second, unrelated } = selectPair();
      API.updateElement(first, { width: 100.25, height: 50.125 });
      API.updateElement(second, { width: 60.25, height: 120.5 });
      captureSetup();
      const before = geometry();
      const unrelatedBefore = JSON.parse(JSON.stringify(unrelated));
      const undoCount = API.getUndoStack().length;
      if (locked) {
        fireEvent.click(getAspectRatioLock());
      }
      dragDimension(property, [7, 16], shiftKey);
      expect(first.width).toBeCloseTo(width1, 8);
      expect(first.height).toBeCloseTo(height1, 8);
      expect(second.width).toBeCloseTo(width2, 8);
      expect(second.height).toBeCloseTo(height2, 8);
      expect(unrelated).toEqual(unrelatedBefore);
      expect(API.getUndoStack()).toHaveLength(undoCount + 1);
      const after = geometry();
      Keyboard.undo();
      expect(geometry()).toEqual(before);
      Keyboard.redo();
      expect(geometry()).toEqual(after);
    },
  );

  it.each([
    ["width", false],
    ["width", true],
    ["height", false],
    ["height", true],
  ] as const)(
    "rejects all typed %s changes when the second calculation overflows (mixed=%s)",
    (property, mixed) => {
      const { first, second } = selectPair();
      API.updateElement(
        first,
        property === "width"
          ? { width: 50, height: 25 }
          : { width: 25, height: 50 },
      );
      API.updateElement(
        second,
        property === "width"
          ? { width: mixed ? 100 : 50, height: 200 }
          : { width: 200, height: mixed ? 100 : 50 },
      );
      captureSetup();
      fireEvent.click(getAspectRatioLock());
      const before = JSON.parse(JSON.stringify(h.elements));
      const undoBefore = [...API.getUndoStack()];
      const input = getDimensionInput(property);
      UI.updateInput(input, "1e308");
      expect(input.value).toBe(mixed ? "Mixed" : "50");
      expect(h.elements).toEqual(before);
      expect(API.getUndoStack()).toEqual(undoBefore);
    },
  );

  it("rejects an overflowing drag before changing its first valid element", () => {
    selectPair();
    fireEvent.click(getAspectRatioLock());
    const before = JSON.parse(JSON.stringify(h.elements));
    const undoBefore = [...API.getUndoStack()];
    // First width/height pair remains finite; the second height would overflow.
    dragDimension("width", [1e308]);
    expect(getDimensionInput("width").value).toBe("Mixed");
    expect(h.elements).toEqual(before);
    expect(API.getUndoStack()).toEqual(undoBefore);
  });

  it("retains the preference for eligible units alongside standalone text", () => {
    const { first, second, unrelated } = selectPair();
    fireEvent.click(getAspectRatioLock());
    const text = API.createElement({
      type: "text",
      text: "A long line of text to wrap",
      width: 300,
      height: 25,
      fontSize: 20,
    });
    API.setElements([first, second, unrelated, text]);
    API.setSelectedElements([first, text]);
    expect(
      within(UI.queryStats()!).queryByRole("button", {
        name: t("stats.keepProportions"),
      }),
    ).toHaveAttribute("aria-pressed", "true");
    UI.updateInput(getDimensionInput("width"), "60");
    expect(first.height).toBe(30);
    expect(text.width).toBe(60);
    expect(text.fontSize).toBe(20);
    expect(text.text).toContain("\n");
    API.setSelectedElements([first, second]);
    expect(getAspectRatioLock()).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(getAspectRatioLock());
    API.setSelectedElements([first]);
    expect(getAspectRatioLock()).toHaveAttribute("aria-pressed", "false");
  });

  it("shares the retained lock with groups and ungrouped units", () => {
    const { first, second, unrelated } = selectPair();
    fireEvent.click(getAspectRatioLock());
    const groupA = API.createElement({
      type: "rectangle",
      x: 400,
      y: 0,
      width: 100,
      height: 50,
      groupIds: ["group"],
    });
    const groupB = API.createElement({
      type: "rectangle",
      x: 500,
      y: 0,
      width: 100,
      height: 50,
      groupIds: ["group"],
    });
    API.setElements([first, second, unrelated, groupA, groupB]);
    API.setSelectedElements([first, groupA, groupB]);
    expect(
      within(UI.queryStats()!).queryByRole("button", {
        name: t("stats.keepProportions"),
      }),
    ).toHaveAttribute("aria-pressed", "true");
    UI.updateInput(getDimensionInput("width"), "400");
    expect(first.width).toBe(400);
    expect(first.height).toBe(200);
    const [x1, y1, x2, y2] = getCommonBounds([groupA, groupB]);
    expect(x2 - x1).toBe(400);
    expect(y2 - y1).toBe(100);
    API.setSelectedElements([first, second]);
    expect(getAspectRatioLock()).toHaveAttribute("aria-pressed", "true");
  });

  it("rewraps bound text and displays final container dimensions after layout", () => {
    const { first, second, unrelated } = selectPair();
    const text = API.createElement({
      type: "text",
      containerId: first.id,
      text: "A long line of text that wraps inside a narrow container",
      width: 90,
      height: 25,
      fontSize: 20,
    });
    API.setElements([first, second, unrelated, text]);
    API.updateElement(first, {
      boundElements: [{ id: text.id, type: "text" }],
    });
    captureSetup();
    const originalText = text.originalText;
    UI.updateInput(getDimensionInput("width"), "60");
    expect(text.text).toContain("\n");
    expect(text.originalText).toBe(originalText);
    expect(text.fontSize).toBe(20);
    const heightInput = getDimensionInput("height");
    UI.updateInput(heightInput, "1");
    expect(first.height).toBeGreaterThan(1);
    expect(second.height).toBe(1);
    expect(heightInput.value).toBe("Mixed");
    const before = geometry();
    const wrappedText = text.text;
    UI.updateInput(heightInput, "1");
    expect(heightInput.value).toBe("Mixed");
    expect(geometry()).toEqual(before);
    expect(text.text).toBe(wrappedText);
    expect(text.fontSize).toBe(20);
  });

  it("includes dependent text in the same undo/redo step", () => {
    const { first, second, unrelated } = selectPair();
    const text = API.createElement({
      type: "text",
      containerId: first.id,
      text: "A long line that wraps after resizing the container",
      width: 90,
      height: 25,
      fontSize: 20,
    });
    API.setElements([first, second, unrelated, text]);
    API.updateElement(first, {
      boundElements: [{ id: text.id, type: "text" }],
    });
    captureSetup();
    // Start from a laid-out label, as a real container would, so undo restores
    // valid geometry rather than normalizing an artificial unwrapped fixture.
    act(() => handleBindTextResize(first, h.app.scene, "e", false));
    captureSetup();
    const snapshot = () => ({
      geometry: geometry(),
      text: API.getElement(text).text,
      originalText: API.getElement(text).originalText,
      fontSize: API.getElement(text).fontSize,
    });
    const before = snapshot();
    const undoCount = API.getUndoStack().length;
    UI.updateInput(getDimensionInput("width"), "60");
    const after = snapshot();
    expect(after.text).toContain("\n");
    expect(API.getUndoStack()).toHaveLength(undoCount + 1);
    Keyboard.undo();
    expect(snapshot()).toEqual(before);
    Keyboard.redo();
    expect(snapshot()).toEqual(after);
  });
});

// multiple elements
describe("stats for multiple elements", () => {
  beforeEach(async () => {
    mouse.reset();
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(7);
    setDateTimeForTests("201933152653");

    await render(<Excalidraw handleKeyboardGlobally={true} />);

    API.setElements([]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByTestId(contextMenu!, "stats")!);
    stats = UI.queryStats();
  });

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should display MIXED for elements with different values", () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(200, 100);

    UI.clickTool("ellipse");
    mouse.down(50, 50);
    mouse.up(100, 100);

    UI.clickTool("diamond");
    mouse.down(-100, -100);
    mouse.up(125, 145);

    API.setAppState({
      selectedElementIds: h.elements.reduce((acc, el) => {
        acc[el.id] = true;
        return acc;
      }, {} as Record<string, true>),
    });

    elementStats = stats?.querySelector("#elementStats");

    const width = UI.queryStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(width?.value).toBe("Mixed");
    const height = UI.queryStatsProperty("H")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(height?.value).toBe("Mixed");
    const angle = UI.queryStatsProperty("A")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(angle.value).toBe("0");

    UI.updateInput(width, "250");
    h.elements.forEach((el) => {
      expect(el.width).toBe(250);
    });

    UI.updateInput(height, "450");
    h.elements.forEach((el) => {
      expect(el.height).toBe(450);
    });
  });

  it("should display a property when one of the elements is editable for that property", async () => {
    // text, rectangle, frame
    UI.clickTool("text");
    mouse.clickAt(20, 30);
    const editor = await getTextEditor();
    updateTextEditor(editor, "Hello!");
    act(() => {
      editor.blur();
    });

    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(200, 100);

    const frame = API.createElement({
      type: "frame",
      x: 150,
      width: 150,
    });

    API.setElements([...h.elements, frame]);

    const text = h.elements.find((el) => el.type === "text");
    const rectangle = h.elements.find((el) => el.type === "rectangle");

    API.setAppState({
      selectedElementIds: h.elements.reduce((acc, el) => {
        acc[el.id] = true;
        return acc;
      }, {} as Record<string, true>),
    });

    elementStats = stats?.querySelector("#elementStats");

    const width = UI.queryStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(width).toBeDefined();
    expect(width.value).toBe("Mixed");

    const height = UI.queryStatsProperty("H")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(height).toBeDefined();
    expect(height.value).toBe("Mixed");

    const angle = UI.queryStatsProperty("A")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(angle).toBeDefined();
    expect(angle.value).toBe("0");

    const fontSize = UI.queryStatsProperty("F")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(fontSize).toBeDefined();

    UI.updateInput(width, "200");

    expect(rectangle?.width).toBe(200);
    expect(frame.width).toBe(200);
    expect(text?.width).toBe(200);

    UI.updateInput(angle, "40");

    const angleInRadian = degreesToRadians(40 as Degrees);
    expect(rectangle?.angle).toBeCloseTo(angleInRadian, 4);
    expect(text?.angle).toBeCloseTo(angleInRadian, 4);
    expect(frame.angle).toBe(0);
  });

  it("should treat groups as single units", () => {
    const createAndSelectGroup = () => {
      UI.clickTool("rectangle");
      mouse.down();
      mouse.up(100, 100);

      UI.clickTool("rectangle");
      mouse.down(0, 0);
      mouse.up(100, 100);

      mouse.reset();
      Keyboard.withModifierKeys({ shift: true }, () => {
        mouse.moveTo(10, 0);
        mouse.click();
      });

      API.executeAction(actionGroup);
    };

    createAndSelectGroup();
    fireEvent.click(getAspectRatioLock());

    const elementsInGroup = h.elements.filter((el) => isInGroup(el));
    let [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);

    elementStats = stats?.querySelector("#elementStats");

    const x = UI.queryStatsProperty("X")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(x).toBeDefined();
    expect(Number(x.value)).toBe(x1);

    UI.updateInput(x, "300");

    expect(h.elements[0].x).toBe(300);
    expect(h.elements[1].x).toBe(400);
    expect(x.value).toBe("300");

    const y = UI.queryStatsProperty("Y")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(y).toBeDefined();
    expect(Number(y.value)).toBe(y1);

    UI.updateInput(y, "200");

    expect(h.elements[0].y).toBe(200);
    expect(h.elements[1].y).toBe(300);
    expect(y.value).toBe("200");

    const width = UI.queryStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(width).toBeDefined();
    expect(Number(width.value)).toBe(200);

    const height = UI.queryStatsProperty("H")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    expect(height).toBeDefined();
    expect(Number(height.value)).toBe(200);

    UI.updateInput(width, "400");

    [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);
    let newGroupWidth = x2 - x1;

    expect(newGroupWidth).toBeCloseTo(400, 4);

    UI.updateInput(width, "300");

    [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);
    newGroupWidth = x2 - x1;
    expect(newGroupWidth).toBeCloseTo(300, 4);

    UI.updateInput(height, "500");

    [x1, y1, x2, y2] = getCommonBounds(elementsInGroup);
    const newGroupHeight = y2 - y1;
    expect(newGroupHeight).toBeCloseTo(500, 4);
  });
});

describe("frame resizing behavior", () => {
  beforeEach(async () => {
    localStorage.clear();
    renderStaticScene.mockClear();
    reseed(7);
    setDateTimeForTests("201933152653");

    await render(<Excalidraw handleKeyboardGlobally={true} />);

    API.setElements([]);

    fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
      button: 2,
      clientX: 1,
      clientY: 1,
    });
    const contextMenu = UI.queryContextMenu();
    fireEvent.click(queryByTestId(contextMenu!, "stats")!);
    stats = UI.queryStats();
  });

  beforeAll(() => {
    mockBoundingClientRect();
  });

  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("should add shapes to frame when resizing frame to encompass them", () => {
    // Create a frame
    const frame = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 100,
      height: 103,
    });

    // Create a rectangle outside the frame
    const rectangle = API.createElement({
      type: "rectangle",
      x: 150,
      y: 50,
      width: 50,
      height: 50,
    });

    API.setElements([frame, rectangle]);

    // Initially, rectangle should not be in the frame
    expect(rectangle.frameId).toBe(null);

    // Select the frame
    API.setAppState({
      selectedElementIds: {
        [frame.id]: true,
      },
    });

    elementStats = stats?.querySelector("#elementStats");

    // Find the width input and update it to encompass the rectangle
    const widthInput = UI.queryStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    expect(widthInput).toBeDefined();
    expect(widthInput.value).toBe("100");

    // Resize frame to width 250, which should encompass the rectangle
    UI.updateInput(widthInput, "250");

    // After resizing, the rectangle should now be part of the frame
    expect(h.elements.find((el) => el.id === rectangle.id)?.frameId).toBe(
      frame.id,
    );
  });

  it("should add multiple shapes when frame encompasses them through height resize", () => {
    const frame = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });

    const rectangle1 = API.createElement({
      type: "rectangle",
      x: 50,
      y: 150,
      width: 50,
      height: 50,
    });

    const rectangle2 = API.createElement({
      type: "rectangle",
      x: 100,
      y: 180,
      width: 40,
      height: 40,
    });

    API.setElements([frame, rectangle1, rectangle2]);

    // Initially, rectangles should not be in the frame
    expect(rectangle1.frameId).toBe(null);
    expect(rectangle2.frameId).toBe(null);

    // Select the frame
    API.setAppState({
      selectedElementIds: {
        [frame.id]: true,
      },
    });

    elementStats = stats?.querySelector("#elementStats");

    // Resize frame height to encompass both rectangles
    const heightInput = UI.queryStatsProperty("H")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    // Resize frame to height 250, which should encompass both rectangles
    UI.updateInput(heightInput, "250");

    // After resizing, both rectangles should now be part of the frame
    expect(h.elements.find((el) => el.id === rectangle1.id)?.frameId).toBe(
      frame.id,
    );
    expect(h.elements.find((el) => el.id === rectangle2.id)?.frameId).toBe(
      frame.id,
    );
  });

  it("should not affect shapes that remain outside frame after resize", () => {
    const frame = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });

    const insideRect = API.createElement({
      type: "rectangle",
      x: 120,
      y: 50,
      width: 30,
      height: 30,
    });

    const outsideRect = API.createElement({
      type: "rectangle",
      x: 300,
      y: 50,
      width: 30,
      height: 30,
    });

    API.setElements([frame, insideRect, outsideRect]);

    // Initially, both rectangles should not be in the frame
    expect(insideRect.frameId).toBe(null);
    expect(outsideRect.frameId).toBe(null);

    // Select the frame
    API.setAppState({
      selectedElementIds: {
        [frame.id]: true,
      },
    });

    elementStats = stats?.querySelector("#elementStats");

    // Resize frame width to 200, which should only encompass insideRect
    const widthInput = UI.queryStatsProperty("W")?.querySelector(
      ".drag-input",
    ) as HTMLInputElement;

    UI.updateInput(widthInput, "200");

    // After resizing, only insideRect should be in the frame
    expect(h.elements.find((el) => el.id === insideRect.id)?.frameId).toBe(
      frame.id,
    );
    expect(h.elements.find((el) => el.id === outsideRect.id)?.frameId).toBe(
      null,
    );
  });
});
