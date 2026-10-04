import React from "react";
import { fireEvent, within } from "@testing-library/react";

import { getSizeFromPoints, reseed, ROUNDNESS } from "@excalidraw/common";
import {
  getCommonBounds,
  getNonDeletedElements,
  isLinearElement,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import { Excalidraw } from "../..";
import { actionGroup } from "../../actions";
import { t } from "../../i18n";
import { API } from "../../tests/helpers/api";
import { UI } from "../../tests/helpers/ui";
import {
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "../../tests/test-utils";

import { calculateDimensions } from "./dimensionUtils";
import { calculateGroupGeometry } from "./groupGeometry";

const { h } = window;

describe("locked group planner compatibility with current Stats resizing", () => {
  beforeAll(() => mockBoundingClientRect());
  afterAll(() => restoreOriginalGetBoundingClientRect());
  beforeEach(async () => {
    localStorage.clear();
    reseed(7);
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setAppState({
      stats: { ...h.state.stats, open: true },
      currentItemRoundness: "round",
    });
  });

  describe.each(["width", "height"] as const)("%s entry", (property) => {
    describe.each(["line", "arrow"] as const)("curved %s", (type) => {
      describe.each([1, 2])("roughness %s", (roughness) => {
        it.each([0, 0.73])(
          "matches the existing group transformation at angle %s",
          (angle) => {
            API.setAppState({ currentItemRoughness: roughness });
            // Draw via the UI: normalized origin, valid point dimensions and the
            // same proportional roundness offered by the properties panel.
            const curve = UI.createElement(type, {
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
            fireEvent.click(
              within(UI.queryStats()!).getByRole("button", {
                name: t("stats.keepProportions"),
              }),
            );
            const originalMembers = structuredClone(h.elements);
            const beforePlanning = structuredClone(originalMembers);
            const originalCurve = originalMembers.find(
              (member) => member.id === curve.id,
            )!;
            expect(isLinearElement(originalCurve)).toBe(true);
            if (!isLinearElement(originalCurve)) {
              throw new Error("Expected a line or arrow");
            }
            expect(originalCurve.points[0]).toEqual([0, 0]);
            expect(originalCurve).toMatchObject(
              getSizeFromPoints(originalCurve.points),
            );
            expect(originalCurve.roundness).toEqual({
              type: ROUNDNESS.PROPORTIONAL_RADIUS,
            });
            expect(originalCurve.groupIds.length).toBeGreaterThan(0);

            const originalBounds = getCommonBounds(originalMembers);
            const originalWidth = originalBounds[2] - originalBounds[0];
            const originalHeight = originalBounds[3] - originalBounds[1];
            // The legacy width path rounds its derived height to two decimals.
            // Target an integral height so both paths receive the same scale;
            // this compares geometry, not the intentionally removed rounding.
            const requestedValue =
              property === "height"
                ? 180
                : (originalWidth * 180) / originalHeight;
            const dimensions = calculateDimensions({
              originalWidth,
              originalHeight,
              property,
              requestedValue,
              keepAspectRatio: true,
              minimumSize: 1,
            })!;
            const result = calculateGroupGeometry({
              originalBounds,
              originalMembers,
              dimensions,
              keepAspectRatio: true,
            });
            expect(result.status).toBe("supported");
            if (result.status !== "supported") {
              throw new Error(result.reason);
            }
            const planned = originalMembers.map((member, index) => ({
              ...member,
              ...result.updates[index],
            }));
            const input = UI.queryStatsProperty(
              property === "width" ? "W" : "H",
            )!.querySelector("input")!;
            UI.updateInput(input, String(requestedValue));
            // Numeric entry retains its existing two-decimal precision. Unlike
            // legacy groups, the new path does not additionally round the
            // derived height, so compare the editor with that resolved target.
            const enteredDimensions = calculateDimensions({
              originalWidth,
              originalHeight,
              property,
              requestedValue: Number(requestedValue.toFixed(2)),
              keepAspectRatio: true,
              minimumSize: 1,
            })!;
            const enteredPlan = calculateGroupGeometry({
              originalBounds,
              originalMembers,
              dimensions: enteredDimensions,
              keepAspectRatio: true,
            });
            if (enteredPlan.status !== "supported") {
              throw new Error(enteredPlan.reason);
            }
            const enteredMembers = originalMembers.map((member, index) => ({
              ...member,
              ...enteredPlan.updates[index],
            }));
            enteredMembers.forEach((member, index) => {
              const actual = API.getElement(member);
              for (const key of ["x", "y", "width", "height"] as const) {
                expect(member[key]).toBeCloseTo(actual[key], 9);
              }
              expect(member.type).toBe(actual.type);
              expect(member.angle).toBe(actual.angle);
              expect(member.groupIds).toEqual(actual.groupIds);
              if (isLinearElement(member) && isLinearElement(actual)) {
                member.points.forEach((point, pointIndex) =>
                  point.forEach((value, axis) =>
                    expect(value).toBeCloseTo(
                      actual.points[pointIndex][axis],
                      9,
                    ),
                  ),
                );
                expect(member.startBinding).toEqual(actual.startBinding);
                expect(member.endBinding).toEqual(actual.endBinding);
                expect(member.startArrowhead).toBe(actual.startArrowhead);
                expect(member.endArrowhead).toBe(actual.endArrowhead);
                expect(member.roundness).toEqual(
                  originalMembers[index].roundness,
                );
              }
            });
            const actualBounds = getCommonBounds(h.elements);
            // Captured from the legacy Stats path before planner integration.
            // Keep these fixed: comparing planner to editor alone would become
            // circular once the editor consumes the planner.
            expect(
              JSON.parse(
                JSON.stringify(
                  {
                    members: planned.map((member) => ({
                      type: member.type,
                      x: member.x,
                      y: member.y,
                      width: member.width,
                      height: member.height,
                      angle: member.angle,
                      ...(isLinearElement(member)
                        ? {
                            points: member.points,
                            startArrowhead: member.startArrowhead,
                            endArrowhead: member.endArrowhead,
                          }
                        : {}),
                    })),
                    bounds: getCommonBounds(planned),
                  },
                  (_key, value) =>
                    typeof value === "number"
                      ? Number(value.toFixed(9))
                      : value,
                ),
              ),
            ).toMatchSnapshot();
            getCommonBounds(enteredMembers).forEach((value, index) =>
              expect(value).toBeCloseTo(actualBounds[index], 9),
            );
            const widthDifference =
              actualBounds[2] - actualBounds[0] - enteredDimensions.width;
            const heightDifference =
              actualBounds[3] - actualBounds[1] - enteredDimensions.height;
            expect(input.value).toBe(
              String(
                Number(
                  (property === "width"
                    ? actualBounds[2] - actualBounds[0]
                    : actualBounds[3] - actualBounds[1]
                  ).toFixed(2),
                ),
              ),
            );
            expect(Number.isFinite(widthDifference)).toBe(true);
            expect(Number.isFinite(heightDifference)).toBe(true);
            // Rough regenerated curves may miss the requested rendered bounds,
            // while the stored geometry remains compatible with current Stats.
            if (angle === 0.73) {
              expect(
                Math.max(Math.abs(widthDifference), Math.abs(heightDifference)),
              ).toBeGreaterThan(1e-6);
            }
            expect(originalMembers).toEqual(beforePlanning);
          },
        );
      });
    });
  });
});
