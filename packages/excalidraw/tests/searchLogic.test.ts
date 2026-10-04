import type { ExcalidrawElement } from "@excalidraw/element/types";

import { searchDrawing } from "../search";

import { API } from "./helpers/api";

import type { SearchOptions, SearchQuery } from "../search";

const search = (
  elements: readonly ExcalidrawElement[],
  query: string,
  options?: SearchOptions,
) => searchDrawing(elements, query as SearchQuery, 1, options);

describe("drawing search logic", () => {
  it("preserves default matching and frame-first ordering without changing scene order", () => {
    const lower = API.createElement({ type: "text", text: "api", y: 200 });
    const upper = API.createElement({ type: "text", text: "API", y: 100 });
    const frame = { ...API.createElement({ type: "frame" }), name: "Api" };
    const deleted = API.createElement({
      type: "text",
      text: "API",
      isDeleted: true,
    });
    const elements = [lower, frame, upper, deleted];

    expect(search(elements, "api").map((match) => match.element.id)).toEqual([
      frame.id,
      upper.id,
      lower.id,
    ]);
    expect(elements).toEqual([lower, frame, upper, deleted]);
    expect(search(elements, "")).toEqual([]);
  });

  it("searches a selected frame name without implicitly including its contents", () => {
    const frame = { ...API.createElement({ type: "frame" }), name: "API" };
    const child = API.createElement({
      type: "text",
      text: "API",
      frameId: frame.id,
    });
    expect(
      search([frame, child], "api", {
        scope: { type: "selection" },
        selectedElementIds: { [frame.id]: true },
      }).map((match) => match.element.id),
    ).toEqual([frame.id]);
  });

  it("includes bound labels once when their container and label are both selected", () => {
    const shape = API.createElement({ id: "shape", locked: true });
    const label = API.createElement({
      type: "text",
      text: "API API",
      containerId: shape.id,
    });
    const other = API.createElement({ type: "text", text: "API" });
    const options: SearchOptions = {
      scope: { type: "selection" },
      selectedElementIds: { [shape.id]: true, [label.id]: true },
    };
    const matches = search([shape, label, other], "api", options);
    expect(matches.map((match) => [match.element.id, match.index])).toEqual([
      [label.id, 0],
      [label.id, 4],
    ]);
    expect(
      search([shape, label, other], "api", {
        ...options,
        selectedElementIds: { [shape.id]: true },
      }),
    ).toHaveLength(2);
  });

  it("uses frame membership and includes its name and dependent labels", () => {
    const frame = { ...API.createElement({ type: "frame" }), name: "API" };
    const shape = API.createElement({ id: "shape", frameId: frame.id });
    // A bound label need not carry its container's frameId.
    const label = API.createElement({
      type: "text",
      text: "API",
      containerId: shape.id,
    });
    const child = API.createElement({
      type: "text",
      text: "api",
      frameId: frame.id,
    });
    const overlap = API.createElement({
      type: "text",
      text: "API",
      x: frame.x,
      y: frame.y,
    });
    expect(
      search([frame, shape, label, child, overlap], "api", {
        scope: { type: "frame", frameId: frame.id },
      }).map((match) => match.element.id),
    ).toEqual([frame.id, label.id, child.id]);
  });

  it("returns zero results for empty selection, absent frame, or a deleted frame", () => {
    const frame = API.createElement({ type: "frame", isDeleted: true });
    const text = API.createElement({
      type: "text",
      text: "api",
      frameId: frame.id,
    });
    for (const scope of [
      { type: "selection" } as const,
      { type: "frame", frameId: null } as const,
      { type: "frame", frameId: "missing" } as const,
      { type: "frame", frameId: frame.id } as const,
      { type: "frame", frameId: text.id } as const,
    ]) {
      expect(search([frame, text], "api", { scope })).toEqual([]);
    }
  });

  it("applies match-case to both text and frame names and preserves preview casing", () => {
    const text = API.createElement({ type: "text", text: "API api Api" });
    const frame = { ...API.createElement({ type: "frame" }), name: "API api" };
    const matches = search([text, frame], "api");
    expect(matches.map((match) => match.matchedText)).toEqual([
      "API",
      "api",
      "API",
      "api",
      "Api",
    ]);
    for (const match of matches) {
      expect(
        match.preview.previewText.slice(
          match.preview.indexInSearchQuery,
          match.preview.indexInSearchQuery + 3,
        ),
      ).toBe(match.matchedText);
    }
    expect(
      search([text, frame], "API", { matchCase: true }).map(
        (match) => match.matchedText,
      ),
    ).toEqual(["API", "API"]);
    expect(
      search([text, frame], "api", { matchCase: true }).map(
        (match) => match.index,
      ),
    ).toEqual([4, 4]);
  });

  it("matches regex characters literally and keeps repeated match offsets", () => {
    const text = API.createElement({ type: "text", text: "a+b [API] a+b" });
    expect(search([text], "a+b").map((match) => match.index)).toEqual([0, 10]);
    expect(search([text], "[api]")).toHaveLength(1);
    expect(search([text], ".*")).toEqual([]);
  });

  it("maps matches in original text to multiple wrapped highlight lines", () => {
    const text = {
      ...API.createElement({ type: "text", text: "AP\nI ap\ni" }),
      originalText: "API api",
    };
    const matches = search([text], "api");
    expect(matches).toHaveLength(2);
    expect(matches.map((match) => match.matchedLines.length)).toEqual([2, 2]);
    expect(search([text], "API", { matchCase: true })).toHaveLength(1);
  });
});
