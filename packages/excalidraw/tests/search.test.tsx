import React from "react";
import { fireEvent, screen } from "@testing-library/react";

import {
  CANVAS_SEARCH_TAB,
  CLASSES,
  DEFAULT_SIDEBAR,
  KEYS,
} from "@excalidraw/common";

import type {
  ExcalidrawFrameLikeElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { updateTextEditor } from "./queries/dom";
import { act, render, waitFor } from "./test-utils";

const { h } = window;

const querySearchInput = async () => {
  const input =
    h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
      `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
    )!;
  await waitFor(() => expect(input).not.toBeNull());
  return input;
};

const openSearch = async (query: string) => {
  Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.keyPress(KEYS.F));
  const input = await querySearchInput();
  updateTextEditor(input, query);
  return input;
};

const setScope = (scope: "all" | "selection" | "frame") => {
  fireEvent.change(screen.getByRole("combobox", { name: "Search scope" }), {
    target: { value: scope },
  });
};

const expectResults = async (ids: string[]) => {
  await waitFor(() => {
    expect(
      h.app.state.searchMatches?.matches.map((match) => match.id) ?? [],
    ).toEqual(ids);
    const menu =
      h.app.excalidrawContainerValue.container!.querySelector(
        ".layer-ui__search",
      )!;
    expect(menu.getAttribute("aria-busy")).toBe("false");
    expect(menu.querySelectorAll(".layer-ui__result-item")).toHaveLength(
      ids.length,
    );
    if (ids.length) {
      expect(
        menu.querySelector(".layer-ui__search-count")!.textContent,
      ).toContain(`${ids.length} result`);
      const index = h.app.state.searchMatches!.matches.findIndex(
        (match) => match.focus,
      );
      expect(index).toBeGreaterThanOrEqual(0);
      expect(h.app.state.searchMatches!.focusedId).toBe(ids[index]);
      expect(
        menu.querySelectorAll(".layer-ui__result-item.active"),
      ).toHaveLength(1);
      expect(
        Array.from(menu.querySelectorAll(".layer-ui__result-item")).indexOf(
          menu.querySelector(".layer-ui__result-item.active")!,
        ),
      ).toBe(index);
    }
  });
};

describe("search", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    API.setAppState({
      openSidebar: null,
    });
  });

  it("should toggle search on cmd+f", async () => {
    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

    const searchInput = await querySearchInput();
    expect(searchInput.matches(":focus")).toBe(true);
  });

  it("should refocus search input with cmd+f when search sidebar is still open", async () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });

    const searchInput =
      h.app.excalidrawContainerValue.container?.querySelector<HTMLInputElement>(
        `.${CLASSES.SEARCH_MENU_INPUT_WRAPPER} input`,
      );

    act(() => {
      searchInput?.blur();
    });

    expect(h.app.state.openSidebar).not.toBeNull();
    expect(searchInput?.matches(":focus")).toBe(false);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(searchInput?.matches(":focus")).toBe(true);
  });

  it("should match text and cycle through matches on Enter", async () => {
    const scrollIntoViewMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    API.setElements([
      API.createElement({ type: "text", text: "test one" }),
      API.createElement({ type: "text", text: "test two" }),
    ]);

    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

    const searchInput = await querySearchInput();

    expect(searchInput.matches(":focus")).toBe(true);

    updateTextEditor(searchInput, "test");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(2);
      expect(h.app.state.searchMatches?.matches[0].focus).toBe(true);
    });

    Keyboard.keyPress(KEYS.ENTER, searchInput);
    expect(h.app.state.searchMatches?.matches[0].focus).toBe(false);
    expect(h.app.state.searchMatches?.matches[1].focus).toBe(true);

    Keyboard.keyPress(KEYS.ENTER, searchInput);
    expect(h.app.state.searchMatches?.matches[0].focus).toBe(true);
    expect(h.app.state.searchMatches?.matches[1].focus).toBe(false);
  });

  it("should match text split across multiple lines", async () => {
    const scrollIntoViewMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    API.setElements([
      API.createElement({
        type: "text",
        text: "",
      }),
    ]);

    API.updateElement(h.elements[0] as ExcalidrawTextElement, {
      text: "t\ne\ns\nt \nt\ne\nx\nt \ns\np\nli\nt \ni\nn\nt\no\nm\nu\nlt\ni\np\nl\ne \nli\nn\ne\ns",
      originalText: "test text split into multiple lines",
    });

    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

    const searchInput = await querySearchInput();

    expect(searchInput.matches(":focus")).toBe(true);

    updateTextEditor(searchInput, "test");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(1);
      expect(h.app.state.searchMatches?.matches[0]?.matchedLines?.length).toBe(
        4,
      );
    });

    updateTextEditor(searchInput, "ext spli");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(1);
      expect(h.app.state.searchMatches?.matches[0]?.matchedLines?.length).toBe(
        6,
      );
    });
  });

  it("should match frame names", async () => {
    const scrollIntoViewMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    API.setElements([
      API.createElement({
        type: "frame",
      }),
    ]);

    API.updateElement(h.elements[0] as ExcalidrawFrameLikeElement, {
      name: "Frame: name test for frame, yes, frame!",
    });

    expect(h.app.state.openSidebar).toBeNull();

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.F);
    });
    expect(h.app.state.openSidebar).not.toBeNull();
    expect(h.app.state.openSidebar?.name).toBe(DEFAULT_SIDEBAR.name);
    expect(h.app.state.openSidebar?.tab).toBe(CANVAS_SEARCH_TAB);

    const searchInput = await querySearchInput();

    expect(searchInput.matches(":focus")).toBe(true);

    updateTextEditor(searchInput, "frame");

    await waitFor(() => {
      expect(h.app.state.searchMatches?.matches.length).toBe(3);
    });
  });

  it("follows live selection, including bound labels, without needing a scene change", async () => {
    const shape = API.createElement({
      id: "selected-shape",
      boundElements: [{ id: "label", type: "text" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      text: "API",
      containerId: shape.id,
    });
    const other = API.createElement({ type: "text", text: "API" });
    API.setElements([shape, label, other]);
    API.setAppState({ selectedElementIds: { [shape.id]: true } });
    await openSearch("api");
    setScope("selection");
    await expectResults([label.id]);
    const sceneNonce = h.app.scene.getSceneNonce();
    API.setAppState({ selectedElementIds: { [other.id]: true } });
    expect(h.app.scene.getSceneNonce()).toBe(sceneNonce);
    await expectResults([other.id]);
    API.setAppState({ selectedElementIds: {} });
    await expectResults([]);
    expect(screen.getByText("No matches found...")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Search scope" })).toHaveValue(
      "selection",
    );
  });

  it("distinguishes a selected frame from a chosen frame and keeps the chosen ID", async () => {
    const frame = {
      ...API.createElement({ type: "frame" }),
      name: "API frame",
    };
    const secondFrame = {
      ...API.createElement({ type: "frame", x: 500 }),
      name: "Other",
    };
    const child = API.createElement({
      type: "text",
      text: "API",
      frameId: frame.id,
    });
    const outsider = API.createElement({
      type: "text",
      text: "API",
      frameId: secondFrame.id,
    });
    API.setElements([frame, secondFrame, child, outsider]);
    API.setAppState({ selectedElementIds: { [frame.id]: true } });
    await openSearch("api");
    setScope("selection");
    await expectResults([frame.id]);
    setScope("frame");
    await expectResults([]);
    fireEvent.change(screen.getByRole("combobox", { name: "Chosen frame" }), {
      target: { value: frame.id },
    });
    await expectResults([frame.id, child.id]);
    API.setAppState({ selectedElementIds: { [secondFrame.id]: true } });
    await expectResults([frame.id, child.id]);
    expect(screen.getByRole("combobox", { name: "Chosen frame" })).toHaveValue(
      frame.id,
    );
    API.updateElement(child, { frameId: secondFrame.id });
    await expectResults([frame.id]);
    API.updateElement(frame, { name: "Renamed" });
    await expectResults([]);
    API.updateElement(frame, { name: "API renamed" });
    await expectResults([frame.id]);
    API.updateElement(frame as ExcalidrawFrameLikeElement, { isDeleted: true });
    await expectResults([]);
    expect(screen.getByRole("combobox", { name: "Chosen frame" })).toHaveValue(
      frame.id,
    );
    expect(
      screen.getByRole("option", { name: "Frame no longer available" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Search scope" })).toHaveValue(
      "frame",
    );
  });

  it("toggles case matching while keeping previews, counts, highlights, and navigation consistent", async () => {
    const text = API.createElement({ type: "text", text: "API api API" });
    API.setElements([text]);
    const input = await openSearch("API");
    await expectResults([text.id, text.id, text.id]);
    expect(
      Array.from(
        h.app.excalidrawContainerValue.container!.querySelectorAll(
          ".preview-text b",
        ),
      ).map((node) => node.textContent),
    ).toEqual(["API", "api", "API"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Match case" }));
    await expectResults([text.id, text.id]);
    Keyboard.keyPress(KEYS.ENTER, input);
    expect(
      h.app.state.searchMatches!.matches.map((match) => match.focus),
    ).toEqual([false, true]);
    fireEvent.click(screen.getByRole("button", { name: "Previous match" }));
    expect(
      h.app.state.searchMatches!.matches.map((match) => match.focus),
    ).toEqual([true, false]);
    fireEvent.click(screen.getByRole("button", { name: "Next match" }));
    expect(
      h.app.state.searchMatches!.matches.map((match) => match.focus),
    ).toEqual([false, true]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Match case" }));
    await expectResults([text.id, text.id, text.id]);
    expect(
      h.app.state.searchMatches!.matches.map((match) => match.focus),
    ).toEqual([false, false, true]);
  });

  it("preserves a specific repeated match when scene sorting changes", async () => {
    const repeated = API.createElement({ type: "text", text: "API API", y: 0 });
    const other = API.createElement({ type: "text", text: "API", y: 100 });
    API.setElements([repeated, other]);
    const input = await openSearch("api");
    await expectResults([repeated.id, repeated.id, other.id]);
    Keyboard.keyPress(KEYS.ENTER, input);
    API.updateElement(repeated, { y: 200 });
    await expectResults([other.id, repeated.id, repeated.id]);
    expect(
      h.app.state.searchMatches!.matches.map((match) => match.focus),
    ).toEqual([false, false, true]);
  });

  it("uses the latest query, scope, case, and selection after rapid changes", async () => {
    const lower = API.createElement({ type: "text", text: "api" });
    const upper = API.createElement({ type: "text", text: "API" });
    API.setElements([lower, upper]);
    const input = await openSearch("api");
    setScope("selection");
    API.setAppState({ selectedElementIds: { [lower.id]: true } });
    updateTextEditor(input, "API");
    fireEvent.click(screen.getByRole("checkbox", { name: "Match case" }));
    API.setAppState({ selectedElementIds: { [upper.id]: true } });
    await expectResults([upper.id]);
    // Wait past another debounce period: an older request must not overwrite this.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));
    await expectResults([upper.id]);
  });

  it("cancels pending searches when the menu closes", async () => {
    API.setElements([API.createElement({ type: "text", text: "API" })]);
    const input = await openSearch("api");
    updateTextEditor(input, "API");
    Keyboard.keyPress(KEYS.ESCAPE, input);
    expect(h.app.state.openSidebar).toBeNull();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(h.app.state.searchMatches).toBeNull();
  });

  it("refreshes highlights after resize and frame-name zoom changes without navigating again", async () => {
    const frame = {
      ...API.createElement({ type: "frame", width: 50 }),
      name: "API",
    };
    API.setElements([frame]);
    await openSearch("API");
    await expectResults([frame.id]);
    const setViewport = vi.spyOn(h.app.viewport, "setViewport");
    API.setAppState({ zoom: { value: 0.1 as typeof h.app.state.zoom.value } });
    await waitFor(() =>
      expect(
        h.app.state.searchMatches!.matches[0].matchedLines[0].showOnCanvas,
      ).toBe(false),
    );
    expect(setViewport).not.toHaveBeenCalled();
    API.updateElement(frame, { width: 1000 });
    await waitFor(() =>
      expect(
        h.app.state.searchMatches!.matches[0].matchedLines[0].showOnCanvas,
      ).toBe(true),
    );
    expect(setViewport).not.toHaveBeenCalled();
    setViewport.mockRestore();
  });
});
