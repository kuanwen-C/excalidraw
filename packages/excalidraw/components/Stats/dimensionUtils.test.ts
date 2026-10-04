import {
  calculateDimensions,
  calculateGroupDimensions,
} from "./dimensionUtils";

describe("calculateGroupDimensions", () => {
  describe.each([false, true])("keepAspectRatio=%s", (keepAspectRatio) => {
    describe.each(["width", "height"] as const)(
      "%s is the positive axis",
      (property) => {
        const originalWidth = property === "width" ? 200 : 0;
        const originalHeight = property === "height" ? 200 : 0;
        it.each([300, 0.5, 0, -20])(
          "edits to %s while keeping the other axis zero",
          (requestedValue) => {
            const input = {
              originalWidth,
              originalHeight,
              property,
              requestedValue,
              keepAspectRatio,
              minimumSize: 1,
            };
            expect(calculateGroupDimensions(input)).toEqual({
              width: property === "width" ? Math.max(1, requestedValue) : 0,
              height: property === "height" ? Math.max(1, requestedValue) : 0,
            });
            // Single-element minimum behavior is deliberately unchanged.
            expect(calculateDimensions(input)).toEqual({
              width: property === "width" ? Math.max(1, requestedValue) : 1,
              height: property === "height" ? Math.max(1, requestedValue) : 1,
            });
          },
        );
        it("does not invent extent on the zero axis", () => {
          const input = {
            originalWidth,
            originalHeight,
            property:
              property === "width" ? ("height" as const) : ("width" as const),
            requestedValue: 1,
            keepAspectRatio,
            minimumSize: 1,
          };
          expect(calculateGroupDimensions(input)).toBeNull();
          expect(
            calculateGroupDimensions({ ...input, requestedValue: 0 }),
          ).toEqual({ width: originalWidth, height: originalHeight });
          expect(
            calculateGroupDimensions({ ...input, requestedValue: -1 }),
          ).toEqual({ width: originalWidth, height: originalHeight });
        });
        it("delegates ordinary group dimensions without changing their rules", () => {
          const input = {
            originalWidth: 100,
            originalHeight: 50,
            property,
            requestedValue: 0.5,
            keepAspectRatio,
            minimumSize: 1,
          };
          expect(calculateGroupDimensions(input)).toEqual(
            calculateDimensions(input),
          );
        });
      },
    );
    it("rejects a point-sized group", () => {
      expect(
        calculateGroupDimensions({
          originalWidth: 0,
          originalHeight: 0,
          property: "width",
          requestedValue: 200,
          keepAspectRatio,
          minimumSize: 1,
        }),
      ).toBeNull();
    });
  });
  it.each([
    { originalWidth: -1 },
    { originalHeight: NaN },
    { requestedValue: Infinity },
    { minimumSize: -1 },
    { minimumSize: Infinity },
  ])("retains invalid-input checks: %j", (overrides) => {
    expect(
      calculateGroupDimensions({
        originalWidth: 200,
        originalHeight: 0,
        property: "width",
        requestedValue: 300,
        keepAspectRatio: true,
        minimumSize: 1,
        ...overrides,
      }),
    ).toBeNull();
  });
});

describe("calculateDimensions", () => {
  const originalDimensions = {
    originalWidth: 100,
    originalHeight: 50,
    minimumSize: 1,
  };

  it.each([
    ["width", false, 200, { width: 200, height: 50 }],
    ["height", false, 75, { width: 100, height: 75 }],
    ["width", true, 200, { width: 200, height: 100 }],
    ["height", true, 75, { width: 150, height: 75 }],
    ["width", true, 25, { width: 25, height: 12.5 }],
    ["height", true, 25, { width: 50, height: 25 }],
  ] as const)(
    "edits %s with keepAspectRatio=%s and requestedValue=%s",
    (property, keepAspectRatio, requestedValue, expected) => {
      expect(
        calculateDimensions({
          ...originalDimensions,
          property,
          requestedValue,
          keepAspectRatio,
        }),
      ).toEqual(expected);
    },
  );

  it.each([
    [100, 50, "width", 1, { width: 2, height: 1 }],
    [50, 100, "height", 1, { width: 1, height: 2 }],
    [100, 50, "height", 0.5, { width: 2, height: 1 }],
    [50, 100, "width", 0.5, { width: 1, height: 2 }],
  ] as const)(
    "preserves the ratio at the minimum for %s × %s editing %s to %s",
    (originalWidth, originalHeight, property, requestedValue, expected) => {
      expect(
        calculateDimensions({
          originalWidth,
          originalHeight,
          property,
          requestedValue,
          keepAspectRatio: true,
          minimumSize: 1,
        }),
      ).toEqual(expected);
    },
  );

  it.each(["width", "height"] as const)(
    "clamps both dimensions when editing %s unlocked",
    (property) => {
      expect(
        calculateDimensions({
          originalWidth: 0.5,
          originalHeight: 0.25,
          property,
          requestedValue: 0.125,
          keepAspectRatio: false,
          minimumSize: 2,
        }),
      ).toEqual({ width: 2, height: 2 });
    },
  );

  describe.each([false, true])("keepAspectRatio=%s", (keepAspectRatio) => {
    it.each([
      ["width", 0],
      ["width", -10],
      ["height", 0],
      ["height", -10],
    ] as const)("clamps a %s request of %s", (property, requestedValue) => {
      expect(
        calculateDimensions({
          ...originalDimensions,
          property,
          requestedValue,
          keepAspectRatio,
        }),
      ).toEqual(
        keepAspectRatio
          ? { width: 2, height: 1 }
          : property === "width"
          ? { width: 1, height: 50 }
          : { width: 100, height: 1 },
      );
    });

    it.each(["width", "height"] as const)(
      "allows a zero minimum when editing %s",
      (property) => {
        expect(
          calculateDimensions({
            ...originalDimensions,
            property,
            requestedValue: -10,
            keepAspectRatio,
            minimumSize: 0,
          }),
        ).toEqual(
          keepAspectRatio
            ? { width: 0, height: 0 }
            : property === "width"
            ? { width: 0, height: 50 }
            : { width: 100, height: 0 },
        );
      },
    );

    it.each(["width", "height"] as const)(
      "preserves decimal precision when editing %s",
      (property) => {
        expect(
          calculateDimensions({
            originalWidth: 10.25,
            originalHeight: 5.125,
            property,
            requestedValue: 12.5625,
            keepAspectRatio,
            minimumSize: 0.125,
          }),
        ).toEqual(
          property === "width"
            ? { width: 12.5625, height: keepAspectRatio ? 6.28125 : 5.125 }
            : { width: keepAspectRatio ? 25.125 : 10.25, height: 12.5625 },
        );
      },
    );

    it.each([
      [0, 50, "width", { width: 20, height: 50 }],
      [0, 50, "height", { width: 1, height: 20 }],
      [100, 0, "width", { width: 20, height: 1 }],
      [100, 0, "height", { width: 100, height: 20 }],
      [0, 0, "width", { width: 20, height: 1 }],
      [0, 0, "height", { width: 1, height: 20 }],
    ] as const)(
      "uses an independent edit for %s × %s editing %s",
      (originalWidth, originalHeight, property, expected) => {
        expect(
          calculateDimensions({
            originalWidth,
            originalHeight,
            property,
            requestedValue: 20,
            keepAspectRatio,
            minimumSize: 1,
          }),
        ).toEqual(expected);
      },
    );

    describe.each([
      "originalWidth",
      "originalHeight",
      "requestedValue",
      "minimumSize",
    ] as const)("invalid %s", (field) => {
      it.each([NaN, Infinity, -Infinity])("rejects %s", (value) => {
        expect(
          calculateDimensions({
            ...originalDimensions,
            property: "width",
            requestedValue: 200,
            keepAspectRatio,
            [field]: value,
          }),
        ).toBeNull();
      });
    });

    it.each(["originalWidth", "originalHeight", "minimumSize"] as const)(
      "rejects negative %s",
      (field) => {
        expect(
          calculateDimensions({
            ...originalDimensions,
            property: "height",
            requestedValue: 200,
            keepAspectRatio,
            [field]: -1,
          }),
        ).toBeNull();
      },
    );
  });

  it("does not round a calculated recurring fraction", () => {
    expect(
      calculateDimensions({
        originalWidth: 3,
        originalHeight: 1,
        property: "width",
        requestedValue: 1,
        keepAspectRatio: true,
        minimumSize: 0,
      }),
    ).toEqual({ width: 1, height: 1 / 3 });
  });

  it.each([
    [1, 2, "width", Number.MAX_VALUE, 1],
    [2, 1, "height", Number.MAX_VALUE, 1],
    [Number.MIN_VALUE, 1, "width", 1, 0],
    [1, Number.MIN_VALUE, "height", 1, 0],
    [Number.MIN_VALUE, 1, "height", 1, 1],
  ] as const)(
    "rejects overflowing results for %s × %s editing %s to %s with minimum %s",
    (originalWidth, originalHeight, property, requestedValue, minimumSize) => {
      expect(
        calculateDimensions({
          originalWidth,
          originalHeight,
          property,
          requestedValue,
          keepAspectRatio: true,
          minimumSize,
        }),
      ).toBeNull();
    },
  );
});
