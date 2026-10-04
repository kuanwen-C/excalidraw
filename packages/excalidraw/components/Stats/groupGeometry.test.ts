import { getSizeFromPoints } from "@excalidraw/common";
import {
  getCommonBounds,
  getElementAbsoluteCoords,
  LinearElementEditor,
  isLinearElement,
  isFreeDrawElement,
} from "@excalidraw/element";
import { pointFrom, pointRotateRads } from "@excalidraw/math";

import type { Bounds } from "@excalidraw/common";
import type {
  ExcalidrawElement,
  ExcalidrawElbowArrowElement,
} from "@excalidraw/element/types";
import type { Radians, LocalPoint, GlobalPoint } from "@excalidraw/math";

import { API } from "../../tests/helpers/api";

import {
  calculateDimensions,
  calculateGroupDimensions,
} from "./dimensionUtils";
import {
  calculateGroupGeometry,
  QUARTER_TURN_TOLERANCE,
} from "./groupGeometry";

const makeMembers = (angles = [0, 0]) =>
  angles.map((angle, index) =>
    API.createElement({
      type: index % 2 === 0 ? "rectangle" : "image",
      x: -40 + index * 75,
      y: 20 + index * 35,
      width: 40 + index * 10,
      height: 20 + index * 5,
      angle: angle as Radians,
      groupIds: ["outer-group", "resize-group"],
    }),
  );

const makePointMember = (
  type: "line" | "arrow" | "freedraw",
  coordinates: [number, number][],
  angle: number,
  roughness = 0,
  roundness: ExcalidrawElement["roundness"] = null,
) => {
  // UI-created paths have their first point at the local origin.
  const [originX, originY] = coordinates[0];
  const points = coordinates.map(([x, y]) =>
    pointFrom<LocalPoint>(x - originX, y - originY),
  );
  return API.createElement({
    type,
    x: -35 + originX,
    y: 27 + originY,
    ...getSizeFromPoints(points),
    points,
    angle: angle as Radians,
    roughness,
    roundness,
    groupIds: ["group"],
  });
};

const globalPoints = (member: ExcalidrawElement): GlobalPoint[] => {
  if (isLinearElement(member)) {
    return LinearElementEditor.getPointsGlobalCoordinates(member, new Map());
  }
  if (isFreeDrawElement(member)) {
    const [, , , , cx, cy] = getElementAbsoluteCoords(member, new Map());
    return member.points.map(([x, y]) =>
      pointRotateRads(
        pointFrom<GlobalPoint>(member.x + x, member.y + y),
        pointFrom<GlobalPoint>(cx, cy),
        member.angle,
      ),
    );
  }
  return [];
};

const resizeAndCheck = (
  members: readonly ExcalidrawElement[],
  property: "width" | "height",
  requestedValue: number,
  keepAspectRatio: boolean,
  minimumSize = 1,
  precision = 7,
) => {
  const originalBounds = getCommonBounds(members);
  const [x1, y1, x2, y2] = originalBounds;
  const dimensions = calculateDimensions({
    originalWidth: x2 - x1,
    originalHeight: y2 - y1,
    property,
    requestedValue,
    keepAspectRatio,
    minimumSize,
  });
  if (!dimensions) {
    throw new Error("Expected valid resolved dimensions");
  }
  const result = calculateGroupGeometry({
    originalBounds,
    originalMembers: members,
    dimensions,
    keepAspectRatio,
  });
  expect(result.status).toBe("supported");
  if (result.status !== "supported") {
    throw new Error(result.reason);
  }
  expect(result.updates).toHaveLength(members.length);
  const resized = members.map((member, index) => ({
    ...member,
    ...result.updates[index],
  }));
  const [nextX1, nextY1, nextX2, nextY2] = getCommonBounds(resized);
  expect(nextX1).toBeCloseTo(x1, precision);
  expect(nextY1).toBeCloseTo(y1, precision);
  expect(nextX2 - nextX1).toBeCloseTo(dimensions.width, precision);
  expect(nextY2 - nextY1).toBeCloseTo(dimensions.height, precision);
  resized.forEach((member, index) => {
    const original = members[index];
    // Centers retain their relative position within the group's canvas bounds.
    const [, , , , oldCenterX, oldCenterY] = getElementAbsoluteCoords(
      original,
      new Map(),
    );
    const [, , , , centerX, centerY] = getElementAbsoluteCoords(
      member,
      new Map(),
    );
    expect(centerX).toBeCloseTo(
      x1 + ((oldCenterX - x1) / (x2 - x1)) * dimensions.width,
      precision,
    );
    expect(centerY).toBeCloseTo(
      y1 + ((oldCenterY - y1) / (y2 - y1)) * dimensions.height,
      precision,
    );
    expect(member.angle).toBe(original.angle);
    expect(member.type).toBe(original.type);
    expect(member.groupIds).toEqual(original.groupIds);
    const beforePoints = globalPoints(original);
    globalPoints(member).forEach(([x, y], index) => {
      expect(x).toBeCloseTo(
        x1 + ((beforePoints[index][0] - x1) * dimensions.width) / (x2 - x1),
        precision,
      );
      expect(y).toBeCloseTo(
        y1 + ((beforePoints[index][1] - y1) * dimensions.height) / (y2 - y1),
        precision,
      );
    });
  });
  return resized;
};

describe("calculateGroupGeometry", () => {
  describe.each(["line", "arrow", "elbow"] as const)(
    "unlocked %s canvas point transforms",
    (type) => {
      describe.each(["width", "height"] as const)("%s", (property) => {
        it.each([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2])(
          "preserves points and metadata at quarter turn %s",
          (angle) => {
            const base = makePointMember(
              type === "elbow" ? "arrow" : type,
              type === "elbow"
                ? [
                    [0, 0],
                    [-40, 0],
                    [-40, 80],
                    [20, 80],
                  ]
                : [
                    [0, 0],
                    [-100, -30],
                    [-50, 60],
                    [20, -10],
                  ],
              angle,
              1,
              { type: 2 },
            );
            const member =
              type === "elbow"
                ? {
                    ...base,
                    type: "arrow" as const,
                    elbowed: true,
                    fixedSegments: [
                      { index: 2, start: base.points[1], end: base.points[2] },
                    ],
                    startIsSpecial: false,
                    endIsSpecial: false,
                    startBinding: null,
                    endBinding: null,
                    startArrowhead: "circle" as const,
                    endArrowhead: "arrow" as const,
                  }
                : base;
            const originalBounds = getCommonBounds([member]);
            const [x1, y1, x2, y2] = originalBounds;
            const dimensions = calculateGroupDimensions({
              originalWidth: x2 - x1,
              originalHeight: y2 - y1,
              property,
              requestedValue: 213.25,
              keepAspectRatio: false,
              minimumSize: 1,
            })!;
            const before = structuredClone(member);
            const result = calculateGroupGeometry({
              originalBounds,
              originalMembers: [member],
              dimensions,
              keepAspectRatio: false,
            });
            expect(result.status).toBe("supported");
            if (result.status !== "supported") {
              throw new Error(result.reason);
            }
            const resized = { ...member, ...result.updates[0] };
            const oldPoints = globalPoints(member);
            globalPoints(resized).forEach(([x, y], index) => {
              expect(x).toBeCloseTo(
                x1 +
                  ((oldPoints[index][0] - x1) * dimensions.width) / (x2 - x1),
                8,
              );
              expect(y).toBeCloseTo(
                y1 +
                  ((oldPoints[index][1] - y1) * dimensions.height) / (y2 - y1),
                8,
              );
            });
            expect(getCommonBounds([resized]).every(Number.isFinite)).toBe(
              true,
            );
            expect(resized.angle).toBe(member.angle);
            expect(resized.type).toBe(member.type);
            expect(resized.groupIds).toEqual(member.groupIds);
            if (isLinearElement(member) && isLinearElement(resized)) {
              expect(resized.startBinding).toEqual(member.startBinding);
              expect(resized.endBinding).toEqual(member.endBinding);
              expect(resized.startArrowhead).toBe(member.startArrowhead);
              expect(resized.endArrowhead).toBe(member.endArrowhead);
            }
            if (type === "elbow") {
              expect(resized.fixedSegments).toEqual([
                { index: 2, start: resized.points[1], end: resized.points[2] },
              ]);
              expect(resized).toMatchObject({
                startIsSpecial: false,
                endIsSpecial: false,
              });
            }
            expect(member).toEqual(before);
          },
        );
      });
    },
  );

  it.each([0, Math.PI / 2])(
    "transforms constant point offsets on a zero-span member axis at angle %s",
    (angle) => {
      const member = {
        ...makePointMember(
          "line",
          [
            [0, 0],
            [-100, 0],
          ],
          angle,
        ),
        points: [pointFrom<LocalPoint>(15, 10), pointFrom<LocalPoint>(-85, 10)],
      };
      resizeAndCheck([member, ...makeMembers()], "height", 213.25, false);
    },
  );

  it("preserves freedraw pressure and stroke metadata without mutating points", () => {
    const member = {
      ...makePointMember(
        "freedraw",
        [
          [0, 0],
          [-30, 50],
          [40, -10],
        ],
        0.47,
      ),
      pressures: [0.2, 0.9, 0.4],
      simulatePressure: false,
      strokeOptions: { variability: "variable" as const, streamline: 0.3 },
    };
    member.points.forEach(Object.freeze);
    Object.freeze(member.points);
    Object.freeze(member);
    const [resized] = resizeAndCheck([member], "width", 200, true);
    expect(resized).toMatchObject({
      pressures: member.pressures,
      simulatePressure: false,
      strokeOptions: member.strokeOptions,
    });
    expect("points" in resized && resized.points).not.toBe(member.points);
  });

  it.each([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2])(
    "scales elbow geometry and metadata at quarter turn %s",
    (angle) => {
      const points = [
        [0, 0],
        [-40, 0],
        [-40, 80],
        [20, 80],
      ].map(([x, y]) => pointFrom<LocalPoint>(x, y));
      const member: ExcalidrawElbowArrowElement = {
        ...API.createElement({
          type: "arrow",
          x: 30,
          y: -10,
          ...getSizeFromPoints(points),
          points,
          angle: angle as Radians,
          elbowed: true,
          roughness: 0,
          startArrowhead: "circle",
          endArrowhead: "triangle",
        }),
        type: "arrow",
        elbowed: true,
        fixedSegments: [{ index: 2, start: points[1], end: points[2] }],
        startIsSpecial: true,
        endIsSpecial: false,
        startBinding: {
          elementId: "start",
          fixedPoint: [0, 0.5],
          mode: "inside",
        },
        endBinding: null,
      };
      const before = structuredClone(member);
      const [resized] = resizeAndCheck([member], "height", 160, false);
      expect(resized).toMatchObject({
        type: "arrow",
        elbowed: true,
        startIsSpecial: true,
        endIsSpecial: false,
        startArrowhead: "circle",
        endArrowhead: "triangle",
        startBinding: member.startBinding,
        endBinding: null,
      });
      expect(resized.fixedSegments).toEqual([
        { index: 2, start: resized.points![1], end: resized.points![2] },
      ]);
      expect(member).toEqual(before);
    },
  );

  it("preserves polygon and arrow bindings while transforming points", () => {
    const polygon = {
      ...makePointMember(
        "line",
        [
          [0, 0],
          [-80, -20],
          [-40, 50],
          [0, 0],
        ],
        Math.PI / 2,
      ),
      polygon: true,
    };
    const arrow = API.createElement({
      type: "arrow",
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(-80, 50)],
      width: 80,
      height: 50,
      roughness: 0,
      roundness: null,
      startArrowhead: "bar",
      endArrowhead: "arrow",
      startBinding: {
        elementId: "container",
        fixedPoint: [1, 0.5],
        mode: "orbit",
      },
    });
    const resized = resizeAndCheck([polygon, arrow], "width", 250.5, false);
    expect(resized[0]).toMatchObject({ polygon: true });
    expect(resized[1]).toMatchObject({
      startArrowhead: "bar",
      endArrowhead: "arrow",
      startBinding: arrow.startBinding,
    });
  });

  it.each([[], [[NaN, 0]], [[0, Infinity]]])(
    "rejects invalid points %j before returning any updates",
    (...coordinates) => {
      const member = {
        ...makePointMember(
          "line",
          [
            [0, 0],
            [10, 20],
          ],
          0,
        ),
        points: coordinates.map(([x, y]) => pointFrom<LocalPoint>(x, y)),
      };
      expect(
        calculateGroupGeometry({
          originalBounds: [0, 0, 100, 50],
          originalMembers: [...makeMembers(), member],
          dimensions: { width: 200, height: 100 },
          keepAspectRatio: true,
        }),
      ).toEqual({
        status: "unsupported",
        reason: "invalid-input",
        memberId: member.id,
      });
    },
  );

  describe.each(["width", "height"] as const)(
    "non-text %s edits",
    (property) => {
      it.each([
        "diamond",
        "ellipse",
        "frame",
        "magicframe",
        "iframe",
        "embeddable",
      ] as const)("supports %s geometry without changing metadata", (type) => {
        for (const angle of [
          0,
          Math.PI / 2,
          Math.PI,
          (3 * Math.PI) / 2,
          0.713,
        ]) {
          const member = API.createElement({
            type,
            x: 30,
            y: -50,
            width: 80,
            height: 35,
            angle: angle as Radians,
            groupIds: ["group"],
            frameId: "frame-id",
          });
          const resized = resizeAndCheck(
            [member],
            property,
            213.25,
            angle === 0.713,
          );
          expect(resized[0].frameId).toBe(member.frameId);
        }
      });

      describe.each(["line", "arrow", "freedraw"] as const)("%s", (type) => {
        it.each([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 0.713, -1.34])(
          "transforms negative points at angle %s",
          (angle) => {
            const member = makePointMember(
              type,
              [
                [0, 0],
                [-100, -30],
                [-50, 60],
                [20, -10],
              ],
              angle,
            );
            resizeAndCheck(
              [member],
              property,
              213.25,
              angle === 0.713 || angle === -1.34,
            );
          },
        );

        it.each([
          [
            [0, 0],
            [-100, 0],
          ],
          [
            [0, 0],
            [0, -100],
          ],
          [
            [-20, 10],
            [80, 10],
          ],
          [
            [10, -20],
            [10, 80],
          ],
          [
            [0, 0],
            [0, 0],
          ],
        ])(
          "allows a zero member dimension in a positive-sized group (%j, %j)",
          (a, b) => {
            for (const angle of [0, Math.PI / 2, 0.73]) {
              resizeAndCheck(
                [
                  makePointMember(
                    type,
                    [a as [number, number], b as [number, number]],
                    angle,
                  ),
                  API.createElement({
                    type: "rectangle",
                    x: 30,
                    y: 80,
                    width: 30,
                    height: 60,
                  }),
                ],
                property,
                213.25,
                angle === 0.73,
              );
            }
          },
        );
      });

      it("transforms a mixture of shapes and point-based members", () => {
        resizeAndCheck(
          [
            ...makeMembers([0, Math.PI / 2]),
            API.createElement({
              type: "ellipse",
              x: -90,
              y: -20,
              width: 10,
              height: 20,
            }),
            API.createElement({
              type: "diamond",
              x: 80,
              y: 50,
              width: 30,
              height: 10,
            }),
            makePointMember(
              "line",
              [
                [0, 0],
                [-120, 0],
              ],
              Math.PI / 2,
            ),
            makePointMember(
              "arrow",
              [
                [0, 0],
                [-20, 80],
                [50, 70],
              ],
              Math.PI,
            ),
            makePointMember(
              "freedraw",
              [
                [0, 0],
                [-10, -40],
                [80, 60],
              ],
              (3 * Math.PI) / 2,
            ),
          ],
          property,
          213.25,
          false,
        );
      });

      it("supports generated smooth curved line bounds", () => {
        for (const angle of [0, Math.PI / 2, 0.73]) {
          resizeAndCheck(
            [
              makePointMember(
                "line",
                [
                  [0, 0],
                  [-100, -30],
                  [-50, 60],
                  [20, -10],
                ],
                angle,
                0,
                { type: 2 },
              ),
            ],
            property,
            213.25,
            angle === 0.73,
          );
        }
      });

      it.each([1, 2])(
        "transforms unlocked curve points despite different generated bounds, roughness %s",
        (roughness) => {
          const member = makePointMember(
            "line",
            [
              [0, 0],
              [-100, -30],
              [-50, 60],
              [20, -10],
            ],
            Math.PI / 2,
            roughness,
            { type: 2 },
          );
          const originalBounds = getCommonBounds([member]);
          const dimensions = calculateDimensions({
            originalWidth: originalBounds[2] - originalBounds[0],
            originalHeight: originalBounds[3] - originalBounds[1],
            property,
            requestedValue: 213.25,
            keepAspectRatio: false,
            minimumSize: 1,
          })!;
          const before = structuredClone(member);
          const result = calculateGroupGeometry({
            originalBounds,
            originalMembers: [member],
            dimensions,
            keepAspectRatio: false,
          });
          expect(result.status).toBe("supported");
          if (result.status !== "supported") {
            throw new Error(result.reason);
          }
          const resized = { ...member, ...result.updates[0] };
          const [x1, y1, x2, y2] = originalBounds;
          const pointsBefore = globalPoints(member);
          globalPoints(resized).forEach(([x, y], index) => {
            expect(x).toBeCloseTo(
              x1 +
                ((pointsBefore[index][0] - x1) * dimensions.width) / (x2 - x1),
              8,
            );
            expect(y).toBeCloseTo(
              y1 +
                ((pointsBefore[index][1] - y1) * dimensions.height) / (y2 - y1),
              8,
            );
          });
          const actualBounds = getCommonBounds([resized]);
          expect(
            Math.max(
              Math.abs(actualBounds[2] - actualBounds[0] - dimensions.width),
              Math.abs(actualBounds[3] - actualBounds[1] - dimensions.height),
            ),
          ).toBeGreaterThan(1e-6);
          expect(resized.angle).toBe(member.angle);
          expect(resized.type).toBe(member.type);
          expect(member).toEqual(before);
        },
      );
    },
  );
  describe.each(["width", "height"] as const)("%s edit", (property) => {
    describe.each([false, true])("keepAspectRatio=%s", (keepAspectRatio) => {
      it.each([0, 1, 2, 3])(
        "preserves actual bounds and centers at quarter turn %s",
        (turn) => {
          resizeAndCheck(
            makeMembers([(turn * Math.PI) / 2, (turn * Math.PI) / 2]),
            property,
            250.125,
            keepAspectRatio,
          );
        },
      );

      it("consumes minimum-resolved targets without clamping each member", () => {
        const members = [
          API.createElement({
            type: "rectangle",
            x: 0,
            y: 0,
            width: 1,
            height: 0.5,
          }),
          API.createElement({
            type: "image",
            x: 90,
            y: 40,
            width: 10,
            height: 10,
          }),
        ];
        expect(getCommonBounds(members)).toEqual([0, 0, 100, 50]);
        const resized = resizeAndCheck(members, property, 0.5, keepAspectRatio);
        const [x1, y1, x2, y2] = getCommonBounds(resized);
        expect(x2 - x1).toBe(
          keepAspectRatio ? 2 : property === "width" ? 1 : 100,
        );
        expect(y2 - y1).toBe(
          keepAspectRatio ? 1 : property === "height" ? 1 : 50,
        );
        expect(resized[0][property]).toBeLessThan(1);
      });
    });

    it("supports different quarter turns in the same unlocked group", () => {
      resizeAndCheck(
        makeMembers([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]),
        property,
        123.125,
        false,
      );
    });

    it.each([0.123, Math.PI / 4, Math.PI / 3, -Math.PI / 5, 2 * Math.PI + 0.2])(
      "supports uniform scaling with arbitrary stored angle %s",
      (angle) => {
        resizeAndCheck(
          makeMembers([angle, angle + 0.37]),
          property,
          123.125,
          true,
        );
      },
    );
  });

  it("swaps local axes and transforms centers around a nonzero anchor", () => {
    const members = [
      API.createElement({
        type: "rectangle",
        x: 10,
        y: 20,
        width: 40,
        height: 20,
        angle: (Math.PI / 2) as Radians,
      }),
      API.createElement({ type: "image", x: 80, y: 40, width: 20, height: 40 }),
    ];
    expect(getCommonBounds(members)).toEqual([20, 10, 100, 80]);
    const resized = resizeAndCheck(members, "width", 160, false);
    expect(resized[0]).toMatchObject({ x: 20, y: 10, width: 40, height: 40 });
    expect(resized[1]).toMatchObject({ x: 140, y: 40, width: 40, height: 40 });
    expect(getCommonBounds(resized)).toEqual([20, 10, 180, 80]);
  });

  it.each([-4, -1, 0, 1, 2, 3, 4, 5])(
    "classifies wrapped quarter turn %s without changing the angle",
    (turn) => {
      resizeAndCheck(
        makeMembers([(turn * Math.PI) / 2]),
        "width",
        123.125,
        false,
      );
    },
  );

  it.each([-1, 1])(
    "accepts quarter-turn noise on side %s without snapping the stored angle",
    (sign) => {
      const angle = Math.PI / 2 + (sign * QUARTER_TURN_TOLERANCE) / 2;
      const resized = resizeAndCheck(
        makeMembers([angle]),
        "height",
        123.125,
        false,
        1,
        6,
      );
      expect(resized[0].angle).toBe(angle);
      expect(resized[0].angle).not.toBe(Math.PI / 2);
    },
  );

  it.each([
    Math.PI / 4,
    Math.PI / 2 - 2 * QUARTER_TURN_TOLERANCE,
    Math.PI / 2 + 2 * QUARTER_TURN_TOLERANCE,
  ])(
    "rejects unsupported unlocked angle %s without returning partial updates",
    (angle) => {
      const members = makeMembers([0, angle]);
      const before = JSON.parse(JSON.stringify(members));
      expect(
        calculateGroupGeometry({
          originalBounds: getCommonBounds(members),
          originalMembers: members,
          dimensions: { width: 200, height: 100 },
          keepAspectRatio: false,
        }),
      ).toEqual({
        status: "unsupported",
        reason: "unsupported-angle",
        memberId: members[1].id,
      });
      expect(members).toEqual(before);
    },
  );

  describe.each([false, true])("keepAspectRatio=%s", (keepAspectRatio) => {
    it.each<Bounds>([
      [5, 10, 5, 30],
      [5, 10, 25, 10],
      [5, 10, 5, 10],
    ])("rejects expansion on a zero axis of bounds %j", (...originalBounds) => {
      expect(
        calculateGroupGeometry({
          originalBounds,
          originalMembers: makeMembers(),
          dimensions: { width: 100, height: 50 },
          keepAspectRatio,
        }),
      ).toEqual({
        status: "unsupported",
        reason:
          originalBounds[0] === originalBounds[2] &&
          originalBounds[1] === originalBounds[3]
            ? "zero-sized-bounds"
            : "zero-axis-expansion",
      });
    });
  });

  describe.each([false, true])(
    "flat groups with keepAspectRatio=%s",
    (keepAspectRatio) => {
      describe.each(["width", "height"] as const)("positive %s", (property) => {
        it.each([300, 0.5, 0, -1])(
          "resolves %s without expanding the zero axis",
          (requestedValue) => {
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
            const originalBounds = getCommonBounds(members);
            const dimensions = calculateGroupDimensions({
              originalWidth: vertical ? 0 : 200,
              originalHeight: vertical ? 200 : 0,
              property,
              requestedValue,
              keepAspectRatio,
              minimumSize: 1,
            })!;
            const before = structuredClone(members);
            const result = calculateGroupGeometry({
              originalBounds,
              originalMembers: members,
              dimensions,
              keepAspectRatio,
            });
            expect(result.status).toBe("supported");
            if (result.status !== "supported") {
              throw new Error(result.reason);
            }
            const resized = members.map((member, index) => ({
              ...member,
              ...result.updates[index],
            }));
            const bounds = getCommonBounds(resized);
            const target = Math.max(1, requestedValue);
            expect(bounds).toEqual(
              vertical ? [20, 0, 20, target] : [0, 20, target, 20],
            );
            resized.forEach((member, index) => {
              expect(member.angle).toBe(members[index].angle);
              expect(member.groupIds).toEqual(members[index].groupIds);
              expect(member[property]).toBe(target / 2);
              expect(member[property === "width" ? "x" : "y"]).toBe(
                (index * target) / 2,
              );
            });
            expect(members).toEqual(before);
          },
        );
      });
    },
  );

  it("leaves frozen inputs unchanged and returns only geometry updates", () => {
    const members = makeMembers();
    const originalBounds = Object.freeze(getCommonBounds(members));
    members.forEach((member) => {
      Object.freeze(member.groupIds);
      Object.freeze(member);
    });
    Object.freeze(members);
    const dimensions = Object.freeze({ width: 200, height: 100 });
    const before = JSON.parse(
      JSON.stringify({ members, originalBounds, dimensions }),
    );
    const result = calculateGroupGeometry({
      originalBounds,
      originalMembers: members,
      dimensions,
      keepAspectRatio: false,
    });
    expect(result.status).toBe("supported");
    if (result.status === "supported") {
      result.updates.forEach((update) =>
        expect(Object.keys(update).sort()).toEqual([
          "height",
          "id",
          "width",
          "x",
          "y",
        ]),
      );
    }
    expect({ members, originalBounds, dimensions }).toEqual(before);
  });

  it("rejects a nonuniform locked target instead of recalculating its ratio", () => {
    expect(
      calculateGroupGeometry({
        originalBounds: [0, 0, 100, 50],
        originalMembers: makeMembers(),
        dimensions: { width: 200, height: 50 },
        keepAspectRatio: true,
      }),
    ).toEqual({ status: "unsupported", reason: "non-uniform-locked-target" });
  });

  it("plans unlocked text geometry while preserving font size for layout", () => {
    const members = [
      API.createElement({ type: "rectangle" }),
      API.createElement({ type: "text", fontSize: 20 }),
    ];
    const result = calculateGroupGeometry({
      originalBounds: getCommonBounds(members),
      originalMembers: members,
      dimensions: { width: 200, height: 100 },
      keepAspectRatio: false,
    });
    expect(result.status).toBe("supported");
    if (result.status === "supported") {
      expect(result.updates[1].fontSize).toBe(20);
    }
  });

  it.each([NaN, Infinity, -Infinity, -1])(
    "rejects invalid target width %s",
    (width) => {
      expect(
        calculateGroupGeometry({
          originalBounds: [0, 0, 100, 50],
          originalMembers: makeMembers(),
          dimensions: { width, height: 50 },
          keepAspectRatio: false,
        }),
      ).toMatchObject({ status: "unsupported", reason: "invalid-input" });
    },
  );

  it.each([NaN, Infinity, -Infinity])(
    "rejects invalid member angle %s",
    (angle) => {
      const members = makeMembers([angle]);
      expect(
        calculateGroupGeometry({
          originalBounds: [0, 0, 100, 50],
          originalMembers: members,
          dimensions: { width: 200, height: 100 },
          keepAspectRatio: true,
        }),
      ).toMatchObject({ status: "unsupported", reason: "invalid-input" });
    },
  );

  it.each<Bounds>([
    [10, 0, 0, 50],
    [0, 0, Infinity, 50],
    [NaN, 0, 100, 50],
  ])("rejects invalid group bounds %j", (...originalBounds) => {
    expect(
      calculateGroupGeometry({
        originalBounds,
        originalMembers: makeMembers(),
        dimensions: { width: 200, height: 100 },
        keepAspectRatio: false,
      }),
    ).toMatchObject({ status: "unsupported", reason: "invalid-input" });
  });

  it("rejects overflowing scales", () => {
    expect(
      calculateGroupGeometry({
        originalBounds: [0, 0, Number.MIN_VALUE, 50],
        originalMembers: makeMembers(),
        dimensions: { width: 200, height: 100 },
        keepAspectRatio: false,
      }),
    ).toMatchObject({ status: "unsupported", reason: "non-finite-result" });
  });

  it("rejects overflowing member geometry", () => {
    const members = [
      API.createElement({
        type: "rectangle",
        x: 1e308,
        width: 1e308,
        height: 50,
      }),
    ];
    expect(
      calculateGroupGeometry({
        originalBounds: [1e308, 0, 1.5e308, 50],
        originalMembers: members,
        dimensions: { width: 1e308, height: 100 },
        keepAspectRatio: true,
      }),
    ).toMatchObject({ status: "unsupported", reason: "non-finite-result" });
  });
});
