import { getSizeFromPoints, rescalePoints } from "@excalidraw/common";
import { pointFrom, pointRotateRads } from "@excalidraw/math";
import {
  getElementAbsoluteCoords,
  getElementBounds,
} from "@excalidraw/element/bounds";
import {
  isElbowArrow,
  isFreeDrawElement,
  isLinearElement,
} from "@excalidraw/element/typeChecks";

import type { Bounds } from "@excalidraw/common";
import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawElbowArrowElement,
} from "@excalidraw/element/types";

/** Radians; only used to classify quarter turns, never to change stored angles. */
export const QUARTER_TURN_TOLERANCE = 1e-10;

type GroupGeometryUpdate = Pick<
  ExcalidrawElement,
  "id" | "x" | "y" | "width" | "height"
> & {
  points?: ExcalidrawLinearElement["points"];
  fixedSegments?: ExcalidrawElbowArrowElement["fixedSegments"];
  fontSize?: number;
};

type GroupGeometryResult =
  | { status: "supported"; updates: GroupGeometryUpdate[] }
  | {
      status: "unsupported";
      reason:
        | "zero-sized-bounds"
        | "zero-axis-expansion"
        | "invalid-input"
        | "unsupported-element"
        | "unsupported-angle"
        | "non-uniform-locked-target"
        | "point-transform-mismatch"
        | "non-finite-result";
      memberId?: string;
    };

/**
 * Plans geometry from already-resolved group dimensions. Text and sticky-note
 * layout remain the caller's job.
 * Bounds and members must come from the same pre-edit snapshot. No minimum,
 * ratio, content-layout, or scene rules are applied here. Only geometry fields
 * are returned; applying them preserves types, angles, and group membership.
 */
export const calculateGroupGeometry = ({
  originalBounds,
  originalMembers,
  dimensions,
  keepAspectRatio,
}: {
  originalBounds: Bounds;
  originalMembers: readonly ExcalidrawElement[];
  dimensions: { width: number; height: number };
  keepAspectRatio: boolean;
}): GroupGeometryResult => {
  const [anchorX, anchorY, maxX, maxY] = originalBounds;
  const originalWidth = maxX - anchorX;
  const originalHeight = maxY - anchorY;
  if (
    ![
      ...originalBounds,
      originalWidth,
      originalHeight,
      dimensions.width,
      dimensions.height,
    ].every(Number.isFinite) ||
    originalWidth < 0 ||
    originalHeight < 0 ||
    dimensions.width < 0 ||
    dimensions.height < 0 ||
    originalMembers.length === 0
  ) {
    return { status: "unsupported", reason: "invalid-input" };
  }
  if (originalWidth === 0 && originalHeight === 0) {
    return { status: "unsupported", reason: "zero-sized-bounds" };
  }
  if (
    (originalWidth === 0 && dimensions.width !== 0) ||
    (originalHeight === 0 && dimensions.height !== 0)
  ) {
    return { status: "unsupported", reason: "zero-axis-expansion" };
  }

  // The empty axis stays empty. Locked scaling takes its common factor from
  // the nonzero axis; unlocked scaling leaves the empty axis unchanged.
  const uniformScale =
    originalHeight > 0
      ? dimensions.height / originalHeight
      : dimensions.width / originalWidth;
  const scaleX =
    originalWidth > 0
      ? dimensions.width / originalWidth
      : keepAspectRatio
      ? uniformScale
      : 1;
  const scaleY =
    originalHeight > 0
      ? dimensions.height / originalHeight
      : keepAspectRatio
      ? uniformScale
      : 1;
  if (![scaleX, scaleY].every(Number.isFinite)) {
    return { status: "unsupported", reason: "non-finite-result" };
  }
  // Accommodate floating-point division of resolved proportional dimensions,
  // but reject inconsistent locked targets instead of correcting their ratio.
  if (
    keepAspectRatio &&
    Math.abs(scaleX - scaleY) > 8 * Number.EPSILON * Math.max(scaleX, scaleY)
  ) {
    return { status: "unsupported", reason: "non-uniform-locked-target" };
  }

  const updates: GroupGeometryUpdate[] = [];
  for (const member of originalMembers) {
    if (member.type === "selection") {
      return {
        status: "unsupported",
        reason: "unsupported-element",
        memberId: member.id,
      };
    }
    if (
      ![member.x, member.y, member.width, member.height, member.angle].every(
        Number.isFinite,
      ) ||
      member.width < 0 ||
      member.height < 0
    ) {
      return {
        status: "unsupported",
        reason: "invalid-input",
        memberId: member.id,
      };
    }

    let swapAxes = false;
    if (!keepAspectRatio) {
      const angle = member.angle % (2 * Math.PI);
      const quarterTurn = Math.round(angle / (Math.PI / 2));
      if (
        Math.abs(angle - quarterTurn * (Math.PI / 2)) > QUARTER_TURN_TOLERANCE
      ) {
        return {
          status: "unsupported",
          reason: "unsupported-angle",
          memberId: member.id,
        };
      }
      swapAxes = Math.abs(quarterTurn % 2) === 1;
    }

    // Stats' existing proportional group path uses one height-derived scale
    // for stored positions, dimensions and points. Regenerated rough curves
    // need not have exactly proportional rendered bounds or rotation centers.
    const localScaleX = keepAspectRatio ? scaleY : swapAxes ? scaleY : scaleX;
    const localScaleY = swapAxes ? scaleX : scaleY;
    let width = member.width * localScaleX;
    let height = member.height * localScaleY;
    const pointUpdates: Pick<GroupGeometryUpdate, "points" | "fixedSegments"> =
      {};
    const textUpdates =
      member.type === "text"
        ? { fontSize: member.fontSize * (keepAspectRatio ? scaleY : 1) }
        : {};
    if (
      member.type === "text" &&
      (!Number.isFinite(member.fontSize) ||
        member.fontSize < 0 ||
        !Number.isFinite(textUpdates.fontSize))
    ) {
      return {
        status: "unsupported",
        reason: "invalid-input",
        memberId: member.id,
      };
    }
    if (isLinearElement(member) || isFreeDrawElement(member)) {
      if (
        !member.points.length ||
        !member.points.every((point) => point.every(Number.isFinite))
      ) {
        return {
          status: "unsupported",
          reason: "invalid-input",
          memberId: member.id,
        };
      }
      const size = getSizeFromPoints(member.points);
      if (!keepAspectRatio) {
        width = size.width * localScaleX;
        height = size.height * localScaleY;
      }
      // Preserve the point origin (including negative coordinates). The shared
      // helper deliberately leaves a zero-span axis alone; its constant offset
      // is accounted for by the bounds-derived position below.
      pointUpdates.points = rescalePoints(
        0,
        width,
        rescalePoints(1, height, member.points, false),
        false,
      );
      if (!keepAspectRatio && (size.width === 0 || size.height === 0)) {
        // rescalePoints deliberately keeps constant coordinates on zero-span
        // axes. Scale those offsets too so local points receive one affine
        // transformation even when their origin is not normalized to [0, 0].
        pointUpdates.points = pointUpdates.points.map(([px, py], index) =>
          pointFrom<LocalPoint>(
            size.width === 0 ? member.points[index][0] * localScaleX : px,
            size.height === 0 ? member.points[index][1] * localScaleY : py,
          ),
        );
      }
      if (isElbowArrow(member) && member.fixedSegments) {
        if (
          member.fixedSegments.some(
            ({ index }) =>
              !Number.isInteger(index) ||
              index < 1 ||
              index >= member.points.length,
          )
        ) {
          return {
            status: "unsupported",
            reason: "invalid-input",
            memberId: member.id,
          };
        }
        pointUpdates.fixedSegments = member.fixedSegments.map((segment) => ({
          ...segment,
          start: pointUpdates.points![segment.index - 1],
          end: pointUpdates.points![segment.index],
        }));
      }
    }
    if (
      ![width, height].every(Number.isFinite) ||
      pointUpdates.points?.some((point) => !point.every(Number.isFinite))
    ) {
      return {
        status: "unsupported",
        reason: "non-finite-result",
        memberId: member.id,
      };
    }
    // Linear elements use curve bounds, freedraw uses point bounds, and other
    // shapes use their box. Bound labels are intentionally excluded here.
    const elementsMap = new Map();
    const [, , , , oldCenterX, oldCenterY] = getElementAbsoluteCoords(
      member,
      elementsMap,
    );
    const resized = { ...member, x: 0, y: 0, width, height, ...pointUpdates };
    const [, , , , resizedCenterX, resizedCenterY] = getElementAbsoluteCoords(
      resized,
      elementsMap,
    );
    const centerX = anchorX + (oldCenterX - anchorX) * scaleX;
    const centerY = anchorY + (oldCenterY - anchorY) * scaleY;
    // A regenerated curve can change its local rotation center. Compensate
    // for that change in scene space so each stored point still lands at the
    // canvas-axis transform of its original position. Merely moving the new
    // bounding-box center would shift every point, especially at 90°/270°.
    const centerCorrection =
      !keepAspectRatio && pointUpdates.points
        ? pointRotateRads(
            pointFrom(
              resizedCenterX - (oldCenterX - member.x) * localScaleX,
              resizedCenterY - (oldCenterY - member.y) * localScaleY,
            ),
            pointFrom(0, 0),
            member.angle,
          )
        : pointFrom(0, 0);
    const x = keepAspectRatio
      ? anchorX + (member.x - anchorX) * scaleY
      : centerX - resizedCenterX + centerCorrection[0];
    const y = keepAspectRatio
      ? anchorY + (member.y - anchorY) * scaleY
      : centerY - resizedCenterY + centerCorrection[1];
    if (![width, height, centerX, centerY, x, y].every(Number.isFinite)) {
      return {
        status: "unsupported",
        reason: "non-finite-result",
        memberId: member.id,
      };
    }
    if (pointUpdates.points) {
      // Rough/rounded paths are regenerated from points, not an affine copy of
      // their old curves (e.g. roughness offsets and elbow corner radii). Check
      // their actual bounds for invalid geometry in both modes. Exact rendered
      // bounds are not a condition of resizing in either mode.
      const before = getElementBounds(member, elementsMap);
      const after = getElementBounds({ ...resized, x, y }, elementsMap);
      if (![...before, ...after].every(Number.isFinite)) {
        return {
          status: "unsupported",
          reason: "non-finite-result",
          memberId: member.id,
        };
      }
      const expected = before.map((value, index) =>
        index % 2 === 0
          ? anchorX + (value - anchorX) * scaleX
          : anchorY + (value - anchorY) * scaleY,
      );
      if (!expected.every(Number.isFinite)) {
        return {
          status: "unsupported",
          reason: "non-finite-result",
          memberId: member.id,
        };
      }
      const tolerance =
        1e-8 * Math.max(1, width, height) +
        16 * Number.EPSILON * Math.max(...expected.map(Math.abs));
      if (
        !keepAspectRatio &&
        (isLinearElement(member) || isFreeDrawElement(member))
      ) {
        for (let index = 0; index < member.points.length; index++) {
          const [px, py] = member.points[index];
          const oldPoint = pointRotateRads(
            pointFrom(member.x + px, member.y + py),
            pointFrom(oldCenterX, oldCenterY),
            member.angle,
          );
          const expectedPoint = pointFrom(
            anchorX + (oldPoint[0] - anchorX) * scaleX,
            anchorY + (oldPoint[1] - anchorY) * scaleY,
          );
          const nextPoint = pointUpdates.points[index];
          const actualPoint = pointRotateRads(
            pointFrom(x + nextPoint[0], y + nextPoint[1]),
            pointFrom(x + resizedCenterX, y + resizedCenterY),
            member.angle,
          );
          if (![...expectedPoint, ...actualPoint].every(Number.isFinite)) {
            return {
              status: "unsupported",
              reason: "non-finite-result",
              memberId: member.id,
            };
          }
          if (
            actualPoint.some(
              (value, axis) =>
                Math.abs(value - expectedPoint[axis]) > tolerance,
            )
          ) {
            return {
              status: "unsupported",
              reason: "point-transform-mismatch",
              memberId: member.id,
            };
          }
        }
      }
    }
    updates.push({
      id: member.id,
      x,
      y,
      width,
      height,
      ...pointUpdates,
      ...textUpdates,
    });
  }

  return { status: "supported", updates };
};
