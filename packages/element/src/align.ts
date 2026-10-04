import type { AppState } from "@excalidraw/excalidraw/types";

import { updateBoundElements } from "./binding";
import { getCommonBoundingBox } from "./bounds";
import { getSelectedElementsByGroup } from "./groups";
import { isFrameLikeElement } from "./typeChecks";

import { getNonDeletedElements } from ".";

import type { Scene } from "./Scene";

import type { BoundingBox } from "./bounds";
import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "./types";

export interface Alignment {
  position: "start" | "center" | "end";
  axis: "x" | "y";
}

/**
 * Strategy deciding the box every selected unit aligns to. Kept apart from
 * `alignElements` so where the reference comes from never affects how units
 * are bucketed, moved, or have their bindings updated.
 *
 * `fixedUnit` is the unit that defines the box, if any; it is never moved.
 */
export type ReferenceBounds = (
  selectedElements: readonly NonDeletedExcalidrawElement[],
  units: readonly (readonly NonDeletedExcalidrawElement[])[],
) => {
  box: BoundingBox;
  fixedUnit: readonly NonDeletedExcalidrawElement[] | null;
};

/** Align to the bounding box of the whole selection (the default). */
export const selectionBounds: ReferenceBounds = (selectedElements) => ({
  box: getCommonBoundingBox(selectedElements),
  fixedUnit: null,
});

/**
 * Align to the unit (element or group, as bucketed for alignment) containing
 * the reference element, which stays fixed. Falls back to the selection box
 * if no selected unit contains it.
 */
export const referenceElementBounds =
  (referenceElementId: ExcalidrawElement["id"]): ReferenceBounds =>
  (selectedElements, units) => {
    const referenceUnit = units.find((unit) =>
      unit.some((element) => element.id === referenceElementId),
    );
    if (!referenceUnit) {
      return selectionBounds(selectedElements, units);
    }
    return {
      box: getCommonBoundingBox(referenceUnit),
      fixedUnit: referenceUnit,
    };
  };

/**
 * Returns the alignment reference element if `appState.alignReferenceElementId`
 * is usable: the element exists, isn't deleted, is still selected and isn't
 * frame-like (frames are excluded from alignment). Otherwise null, which means
 * "align to the selection box".
 */
export const getAlignReferenceElement = (
  appState: Readonly<
    Pick<AppState, "alignReferenceElementId" | "selectedElementIds">
  >,
  elementsMap: ElementsMap,
): NonDeletedExcalidrawElement | null => {
  const { alignReferenceElementId } = appState;
  if (!alignReferenceElementId) {
    return null;
  }
  const element = elementsMap.get(alignReferenceElementId);
  if (
    !element ||
    element.isDeleted ||
    !appState.selectedElementIds[element.id] ||
    isFrameLikeElement(element)
  ) {
    return null;
  }
  return element as NonDeletedExcalidrawElement;
};

export const alignElements = (
  selectedElements: NonDeletedExcalidrawElement[],
  alignment: Alignment,
  scene: Scene,
  appState: Readonly<AppState>,
  referenceBounds: ReferenceBounds = selectionBounds,
): NonDeletedExcalidrawElement[] => {
  const groups = getSelectedElementsByGroup(
    selectedElements,
    scene.getNonDeletedElementsMap(),
    appState,
  ).map(getNonDeletedElements); // Nothing to align on deleted elements
  const { box: referenceBoundingBox, fixedUnit } = referenceBounds(
    selectedElements,
    groups,
  );

  return groups
    .filter((group) => group !== fixedUnit)
    .flatMap((group) => {
      const translation = calculateTranslation(
        group,
        referenceBoundingBox,
        alignment,
      );
      return group.map((element) => {
        // update element
        const updatedEle = scene.mutateElement(element, {
          x: element.x + translation.x,
          y: element.y + translation.y,
        });

        // update bound elements
        updateBoundElements(element, scene, {
          simultaneouslyUpdated: group,
        });
        return updatedEle;
      });
    });
};

const calculateTranslation = (
  group: readonly ExcalidrawElement[],
  referenceBoundingBox: BoundingBox,
  { axis, position }: Alignment,
): { x: number; y: number } => {
  const groupBoundingBox = getCommonBoundingBox(group);

  const [min, max]: ["minX" | "minY", "maxX" | "maxY"] =
    axis === "x" ? ["minX", "maxX"] : ["minY", "maxY"];

  const noTranslation = { x: 0, y: 0 };
  if (position === "start") {
    return {
      ...noTranslation,
      [axis]: referenceBoundingBox[min] - groupBoundingBox[min],
    };
  } else if (position === "end") {
    return {
      ...noTranslation,
      [axis]: referenceBoundingBox[max] - groupBoundingBox[max],
    };
  } // else if (position === "center") {
  return {
    ...noTranslation,
    [axis]:
      (referenceBoundingBox[min] + referenceBoundingBox[max]) / 2 -
      (groupBoundingBox[min] + groupBoundingBox[max]) / 2,
  };
};
