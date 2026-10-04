import { useMemo } from "react";

import { MIN_WIDTH_OR_HEIGHT, getFontString } from "@excalidraw/common";
import {
  getElementsInResizingFrame,
  getNonDeletedElements,
  isFrameLikeElement,
  replaceAllElementsInFrame,
  updateBoundElements,
} from "@excalidraw/element";
import {
  getStickyNoteResizeIntent,
  isStickyNoteElement,
  updateStickyNoteLayout,
} from "@excalidraw/element";
import { resizeSingleElement } from "@excalidraw/element";
import {
  getBoundTextElement,
  redrawTextBoundingBox,
  getMinTextElementWidth,
  measureText,
  wrapText,
} from "@excalidraw/element";

import { isTextElement } from "@excalidraw/element";

import { getCommonBounds } from "@excalidraw/utils";

import type {
  NonDeletedExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import type { Scene } from "@excalidraw/element";

import { t } from "../../i18n";

import DragInput from "./DragInput";
import {
  calculateDimensions,
  calculateGroupDimensions,
} from "./dimensionUtils";
import { calculateGroupGeometry } from "./groupGeometry";
import { getAtomicUnits, getStepSizedValue, isPropertyEditable } from "./utils";
import { getElementsInAtomicUnit } from "./utils";

import type {
  DragFinishedCallbackType,
  DragInputCallbackType,
} from "./DragInput";
import type { AtomicUnit } from "./utils";
import type { AppState } from "../../types";

interface MultiDimensionProps {
  property: "width" | "height";
  elements: readonly NonDeletedExcalidrawElement[];
  elementsMap: NonDeletedSceneElementsMap;
  atomicUnits: AtomicUnit[];
  scene: Scene;
  appState: AppState;
  shouldKeepAspectRatio: boolean;
}

const STEP_SIZE = 10;

// The planner has already validated unlocked member angles as quarter turns.
// Map the edited canvas axis to the member's local resize direction.
const getLocalResizeHandle = (property: "width" | "height", angle: number) => {
  const turn =
    ((Math.round((angle % (2 * Math.PI)) / (Math.PI / 2)) % 4) + 4) % 4;
  return property === "width"
    ? (["e", "n", "w", "s"] as const)[turn]
    : (["s", "e", "n", "w"] as const)[turn];
};

const resizeErrorKeys = {
  "unsupported-angle": "stats.resizeUnsupportedAngle",
  "zero-axis-expansion": "stats.resizeZeroAxis",
  "zero-sized-bounds": "stats.resizeZeroBounds",
  "invalid-input": "stats.resizeInvalidGeometry",
  "non-finite-result": "stats.resizeInvalidGeometry",
  "point-transform-mismatch": "stats.resizeInvalidGeometry",
  "non-uniform-locked-target": "stats.resizeInvalidGeometry",
  "unsupported-element": "stats.resizeUnsupportedElement",
} as const;

const getDimensionSizes = (
  atomicUnits: AtomicUnit[],
  elementsMap: NonDeletedSceneElementsMap,
  property: MultiDimensionProps["property"],
) =>
  atomicUnits.flatMap((atomicUnit) => {
    const elementsInUnit = getElementsInAtomicUnit(atomicUnit, elementsMap);
    if (elementsInUnit.length > 1) {
      const [x1, y1, x2, y2] = getCommonBounds(
        elementsInUnit.map((el) => el.latest),
      );
      return [
        Math.round((property === "width" ? x2 - x1 : y2 - y1) * 100) / 100,
      ];
    }
    const [element] = elementsInUnit;
    return element ? [Math.round(element.latest[property] * 100) / 100] : [];
  });

const getDimensionValue = (sizes: number[]): number | "Mixed" =>
  new Set(sizes).size === 1 ? Math.round(sizes[0] * 100) / 100 : "Mixed";

type GeometryUpdate = Extract<
  ReturnType<typeof calculateGroupGeometry>,
  { status: "supported" }
>["updates"][number];

type GroupMemberPlan = {
  original: NonDeletedExcalidrawElement;
  latest: NonDeletedExcalidrawElement;
  update: GeometryUpdate;
  boundTextFontSize?: number;
  stickyIntent?: ReturnType<typeof getStickyNoteResizeIntent>;
  textLayout?: Pick<
    ExcalidrawTextElement,
    "x" | "y" | "width" | "height" | "text" | "originalText" | "autoResize"
  >;
};

type UnitPlan =
  | { kind: "group"; members: GroupMemberPlan[] }
  | {
      kind: "single";
      original: NonDeletedExcalidrawElement;
      latest: NonDeletedExcalidrawElement;
      dimensions: { width: number; height: number };
      keepAspectRatio: boolean;
    };

const handleDimensionChange: DragInputCallbackType<
  MultiDimensionProps["property"]
> = ({
  accumulatedChange,
  originalElements,
  originalElementsMap,
  originalAppState,
  shouldKeepAspectRatio,
  shouldChangeByStepSize,
  nextValue,
  scene,
  property,
  setAppState,
  setInputValue,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const atomicUnits = getAtomicUnits(originalElements, originalAppState);
  const selectedIds = new Set(originalElements.map((element) => element.id));
  const keepAspectRatio = shouldKeepAspectRatio;
  const restoreInputValue = () =>
    setInputValue(
      getDimensionValue(
        getDimensionSizes(
          atomicUnits,
          scene.getNonDeletedElementsMap(),
          property,
        ),
      ),
    );
  const rejectEdit = (reason: keyof typeof resizeErrorKeys) => {
    restoreInputValue();
    setAppState({ toast: { message: t(resizeErrorKeys[reason]) } });
  };
  const handle = property === "width" ? "e" : "s";
  const plans: UnitPlan[] = [];

  // Plan every atomic unit before touching the scene. All sizes and font/layout
  // intents are derived from the same gesture-start snapshot.
  for (const atomicUnit of atomicUnits) {
    const elementsInUnit = getElementsInAtomicUnit(
      atomicUnit,
      elementsMap,
      originalElementsMap,
    );
    if (!elementsInUnit.length) {
      continue;
    }
    const isGroup = elementsInUnit.length > 1;
    const [{ original, latest }] = elementsInUnit;
    // Ungrouped text retains its independent W/H layout behavior, even when
    // other selected units use the shared lock. Grouped text follows its group.
    const unitKeepsAspectRatio =
      keepAspectRatio && (isGroup || !isTextElement(original));
    if (!isGroup && !isPropertyEditable(latest, property)) {
      continue;
    }
    const bounds = isGroup
      ? getCommonBounds(elementsInUnit.map(({ original }) => original))
      : null;
    const originalWidth = bounds ? bounds[2] - bounds[0] : original.width;
    const originalHeight = bounds ? bounds[3] - bounds[1] : original.height;
    let requestedValue = nextValue;
    if (requestedValue === undefined) {
      const draggedValue = Math.max(
        0,
        (property === "width" ? originalWidth : originalHeight) +
          accumulatedChange,
      );
      requestedValue = shouldChangeByStepSize
        ? getStepSizedValue(draggedValue, STEP_SIZE)
        : Math.round(draggedValue);
    }
    const dimensions = (
      isGroup ? calculateGroupDimensions : calculateDimensions
    )({
      originalWidth,
      originalHeight,
      property,
      requestedValue,
      keepAspectRatio: unitKeepsAspectRatio,
      minimumSize: MIN_WIDTH_OR_HEIGHT,
    });
    if (!dimensions) {
      rejectEdit(
        isGroup && originalWidth === 0 && originalHeight === 0
          ? "zero-sized-bounds"
          : isGroup &&
            (property === "width" ? originalWidth : originalHeight) === 0 &&
            requestedValue > 0
          ? "zero-axis-expansion"
          : "invalid-input",
      );
      return;
    }
    // Bound labels are owned by their selected containers, even if the group
    // unit also lists the label. Standalone text owns its own layout.
    const members = elementsInUnit.filter(
      ({ original }) =>
        !(
          isTextElement(original) &&
          original.containerId &&
          selectedIds.has(original.containerId)
        ),
    );
    if (!members.length) {
      continue;
    }
    if (!bounds) {
      plans.push({
        kind: "single",
        original,
        latest,
        dimensions,
        keepAspectRatio: unitKeepsAspectRatio,
      });
      continue;
    }
    const result = calculateGroupGeometry({
      originalBounds: bounds,
      originalMembers: members.map(({ original }) => original),
      dimensions,
      keepAspectRatio,
    });
    if (result.status !== "supported") {
      rejectEdit(result.reason);
      return;
    }
    const scale =
      originalHeight > 0
        ? dimensions.height / originalHeight
        : dimensions.width / originalWidth;
    const groupMembers: GroupMemberPlan[] = [];
    for (let index = 0; index < members.length; index++) {
      const { original, latest } = members[index];
      const update = result.updates[index];
      const label = getBoundTextElement(original, originalElementsMap);
      const boundTextFontSize = label
        ? label.fontSize * (keepAspectRatio ? scale : 1)
        : undefined;
      const stickyIntent = isStickyNoteElement(original)
        ? getStickyNoteResizeIntent(
            { ...original, ...update },
            originalElementsMap,
            keepAspectRatio
              ? handle
              : getLocalResizeHandle(property, original.angle),
            { proportional: keepAspectRatio, fromCenter: false },
          )
        : undefined;
      if (
        [
          boundTextFontSize,
          stickyIntent?.baseHeight,
          stickyIntent?.baseFontSize,
        ].some((value) => value !== undefined && !Number.isFinite(value))
      ) {
        rejectEdit("invalid-input");
        return;
      }
      let textLayout: GroupMemberPlan["textLayout"];
      if (!keepAspectRatio && isTextElement(original)) {
        const font = getFontString(original);
        const width = Math.max(
          update.width,
          getMinTextElementWidth(font, original.lineHeight),
        );
        const text = wrapText(original.originalText, font, width);
        const { height } = measureText(text, font, original.lineHeight);
        // Text height is content-driven. Preserve the transformed center when
        // rewrapping changes the planned box, including at quarter turns.
        textLayout = {
          x: update.x + (update.width - width) / 2,
          y: update.y + (update.height - height) / 2,
          width,
          height,
          text,
          originalText: original.originalText,
          autoResize: false,
        };
        if (
          ![textLayout.x, textLayout.y, width, height].every(Number.isFinite)
        ) {
          rejectEdit("invalid-input");
          return;
        }
      }
      groupMembers.push({
        original,
        latest,
        update,
        boundTextFontSize,
        stickyIntent,
        textLayout,
      });
    }
    plans.push({ kind: "group", members: groupMembers });
  }

  const simultaneouslyUpdated = plans.flatMap((plan) =>
    plan.kind === "group"
      ? plan.members.map(({ latest }) => latest)
      : [plan.latest],
  );
  for (const plan of plans) {
    if (plan.kind === "group") {
      for (const {
        latest,
        update: { id, ...update },
        textLayout,
      } of plan.members) {
        scene.mutateElement(latest, { ...update, ...textLayout });
      }
    } else {
      resizeSingleElement(
        plan.dimensions.width,
        plan.dimensions.height,
        plan.latest,
        plan.original,
        originalElementsMap,
        scene,
        handle,
        {
          shouldInformMutation: false,
          shouldMaintainAspectRatio: plan.keepAspectRatio,
        },
      );
    }
  }
  // Layout owns each bound label exactly once, after group geometry is in place.
  for (const plan of plans) {
    if (plan.kind !== "group") {
      continue;
    }
    for (const {
      original,
      latest,
      boundTextFontSize,
      stickyIntent,
    } of plan.members) {
      if (isStickyNoteElement(latest)) {
        updateStickyNoteLayout(latest, scene, {
          ...stickyIntent,
          ...(keepAspectRatio ? { anchor: "top" as const } : {}),
          bindings: { simultaneouslyUpdated },
        });
        continue;
      }
      const label = getBoundTextElement(original, originalElementsMap);
      const latestLabel =
        label && scene.getNonDeletedElementsMap().get(label.id);
      if (
        latestLabel &&
        isTextElement(latestLabel) &&
        boundTextFontSize !== undefined
      ) {
        scene.mutateElement(latestLabel, {
          fontSize: boundTextFontSize,
          originalText: label!.originalText,
        });
        // Apply the same width/height content constraints as Undo/Redo. The
        // resize-only helper grows height but can leave a label wider than a
        // tiny container, causing history replay to produce different bounds.
        redrawTextBoundingBox(latestLabel, latest, scene);
      }
      updateBoundElements(latest, scene, { simultaneouslyUpdated });
    }
  }

  const elementsToHighlight: NonDeletedExcalidrawElement[] = [];
  for (const latest of simultaneouslyUpdated) {
    if (!isFrameLikeElement(latest)) {
      continue;
    }
    const nextElementsInFrame = getElementsInResizingFrame(
      scene.getElementsIncludingDeleted(),
      latest,
      originalAppState,
      scene.getNonDeletedElementsMap(),
    );
    if (nextValue !== undefined) {
      scene.replaceAllElements(
        replaceAllElementsInFrame(
          scene.getElementsIncludingDeleted(),
          nextElementsInFrame,
          latest,
        ),
      );
    } else {
      elementsToHighlight.push(...getNonDeletedElements(nextElementsInFrame));
    }
  }
  if (nextValue === undefined) {
    setAppState({ elementsToHighlight });
  }
  scene.triggerUpdate();
  restoreInputValue();
};

const handleDragFinished: DragFinishedCallbackType = ({
  setAppState,
  app,
  originalElements,
  originalAppState,
}) => {
  const elementsMap = app.scene.getNonDeletedElementsMap();
  // Every resized frame participates, including frames inside group units.
  for (const original of originalElements ?? []) {
    const latestElement = elementsMap.get(original.id);
    if (!latestElement || !isFrameLikeElement(latestElement)) {
      continue;
    }
    const nextElementsInFrame = getElementsInResizingFrame(
      app.scene.getElementsIncludingDeleted(),
      latestElement,
      originalAppState,
      app.scene.getNonDeletedElementsMap(),
    );
    app.scene.replaceAllElements(
      replaceAllElementsInFrame(
        app.scene.getElementsIncludingDeleted(),
        nextElementsInFrame,
        latestElement,
      ),
    );
  }
  setAppState({ elementsToHighlight: null });
};

const MultiDimension = ({
  property,
  elements,
  elementsMap,
  atomicUnits,
  scene,
  appState,
  shouldKeepAspectRatio,
}: MultiDimensionProps) => {
  const sizes = useMemo(
    () => getDimensionSizes(atomicUnits, elementsMap, property),
    [elementsMap, atomicUnits, property],
  );

  const value = getDimensionValue(sizes);

  const editable = sizes.length > 0;

  return (
    <DragInput
      label={property === "width" ? "W" : "H"}
      elements={elements}
      dragInputCallback={handleDimensionChange}
      value={value}
      editable={editable}
      appState={appState}
      shouldKeepAspectRatio={shouldKeepAspectRatio}
      property={property}
      scene={scene}
      dragFinishedCallback={handleDragFinished}
    />
  );
};

export default MultiDimension;
