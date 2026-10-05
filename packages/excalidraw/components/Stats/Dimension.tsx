import { clamp, round } from "@excalidraw/math";

import { MIN_WIDTH_OR_HEIGHT } from "@excalidraw/common";
import {
  MINIMAL_CROP_SIZE,
  getNonDeletedElements,
  getUncroppedWidthAndHeight,
  isNonDeletedElement,
} from "@excalidraw/element";
import { resizeSingleElement } from "@excalidraw/element";
import { isImageElement, isTextElement } from "@excalidraw/element";
import { isFrameLikeElement } from "@excalidraw/element";
import { getElementsInResizingFrame } from "@excalidraw/element";
import { replaceAllElementsInFrame } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { Scene } from "@excalidraw/element";

import { t } from "../../i18n";

import DragInput from "./DragInput";
import { calculateDimensions } from "./dimensionUtils";
import { getStepSizedValue, isPropertyEditable } from "./utils";

import type {
  DragFinishedCallbackType,
  DragInputCallbackType,
} from "./DragInput";
import type { AppState } from "../../types";

interface DimensionDragInputProps {
  property: "width" | "height";
  element: NonDeletedExcalidrawElement;
  scene: Scene;
  appState: AppState;
  shouldKeepAspectRatio: boolean;
}

const STEP_SIZE = 10;

const handleDimensionChange: DragInputCallbackType<
  DimensionDragInputProps["property"]
> = ({
  accumulatedChange,
  originalElements,
  originalElementsMap,
  shouldKeepAspectRatio,
  shouldChangeByStepSize,
  nextValue,
  property,
  originalAppState,
  instantChange,
  scene,
  setAppState,
  setInputValue,
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const elementId = originalElements[0]?.id;
  const origElement = elementId && originalElementsMap.get(elementId);
  const latestElement = elementId && elementsMap.get(elementId);
  if (origElement && isNonDeletedElement(origElement) && latestElement) {
    const keepAspectRatio =
      shouldKeepAspectRatio && !isTextElement(origElement);

    if (originalAppState.croppingElementId === origElement.id) {
      const element = elementsMap.get(origElement.id);

      if (!element || !isImageElement(element) || !element.crop) {
        return;
      }

      const crop = element.crop;
      let nextCrop = { ...crop };

      const isFlippedByX = element.scale[0] === -1;
      const isFlippedByY = element.scale[1] === -1;

      const { width: uncroppedWidth, height: uncroppedHeight } =
        getUncroppedWidthAndHeight(element);

      const naturalToUncroppedWidthRatio = crop.naturalWidth / uncroppedWidth;
      const naturalToUncroppedHeightRatio =
        crop.naturalHeight / uncroppedHeight;

      const MAX_POSSIBLE_WIDTH = isFlippedByX
        ? crop.width + crop.x
        : crop.naturalWidth - crop.x;

      const MAX_POSSIBLE_HEIGHT = isFlippedByY
        ? crop.height + crop.y
        : crop.naturalHeight - crop.y;

      const MIN_WIDTH = MINIMAL_CROP_SIZE * naturalToUncroppedWidthRatio;
      const MIN_HEIGHT = MINIMAL_CROP_SIZE * naturalToUncroppedHeightRatio;

      if (nextValue !== undefined) {
        if (property === "width") {
          const nextValueInNatural = nextValue * naturalToUncroppedWidthRatio;

          const nextCropWidth = clamp(
            nextValueInNatural,
            MIN_WIDTH,
            MAX_POSSIBLE_WIDTH,
          );

          nextCrop = {
            ...nextCrop,
            width: nextCropWidth,
            x: isFlippedByX ? crop.x + crop.width - nextCropWidth : crop.x,
          };
        } else if (property === "height") {
          const nextValueInNatural = nextValue * naturalToUncroppedHeightRatio;
          const nextCropHeight = clamp(
            nextValueInNatural,
            MIN_HEIGHT,
            MAX_POSSIBLE_HEIGHT,
          );

          nextCrop = {
            ...nextCrop,
            height: nextCropHeight,
            y: isFlippedByY ? crop.y + crop.height - nextCropHeight : crop.y,
          };
        }

        scene.mutateElement(element, {
          crop: nextCrop,
          width: nextCrop.width / (crop.naturalWidth / uncroppedWidth),
          height: nextCrop.height / (crop.naturalHeight / uncroppedHeight),
        });
        return;
      }

      const changeInWidth = property === "width" ? instantChange : 0;
      const changeInHeight = property === "height" ? instantChange : 0;

      const nextCropWidth = clamp(
        crop.width + changeInWidth,
        MIN_WIDTH,
        MAX_POSSIBLE_WIDTH,
      );

      const nextCropHeight = clamp(
        crop.height + changeInHeight,
        MIN_WIDTH,
        MAX_POSSIBLE_HEIGHT,
      );

      nextCrop = {
        ...crop,
        x: isFlippedByX ? crop.x + crop.width - nextCropWidth : crop.x,
        y: isFlippedByY ? crop.y + crop.height - nextCropHeight : crop.y,
        width: nextCropWidth,
        height: nextCropHeight,
      };

      scene.mutateElement(element, {
        crop: nextCrop,
        width: nextCrop.width / (crop.naturalWidth / uncroppedWidth),
        height: nextCrop.height / (crop.naturalHeight / uncroppedHeight),
      });

      return;
    }

    let requestedValue = nextValue;
    if (requestedValue === undefined) {
      const draggedValue = Math.max(
        0,
        origElement[property] + accumulatedChange,
      );
      requestedValue = shouldChangeByStepSize
        ? getStepSizedValue(draggedValue, STEP_SIZE)
        : Math.round(draggedValue);
    }

    const dimensions = calculateDimensions({
      originalWidth: origElement.width,
      originalHeight: origElement.height,
      property,
      requestedValue,
      keepAspectRatio,
      minimumSize: MIN_WIDTH_OR_HEIGHT,
    });
    if (!dimensions) {
      setInputValue(round(latestElement[property], 2));
      setAppState({ toast: { message: t("stats.resizeInvalidGeometry") } });
      return;
    }

    const { width: nextWidth, height: nextHeight } = dimensions;

    // User types in a value to stats then presses Enter
    if (nextValue !== undefined) {
      resizeSingleElement(
        nextWidth,
        nextHeight,
        latestElement,
        origElement,
        originalElementsMap,
        scene,
        property === "width" ? "e" : "s",
        {
          shouldMaintainAspectRatio: keepAspectRatio,
        },
      );

      // Handle frame membership update for resized frames
      if (isFrameLikeElement(latestElement)) {
        const nextElementsInFrame = getElementsInResizingFrame(
          scene.getElementsIncludingDeleted(),
          latestElement,
          originalAppState,
          scene.getNonDeletedElementsMap(),
        );

        const updatedElements = replaceAllElementsInFrame(
          scene.getElementsIncludingDeleted(),
          nextElementsInFrame,
          latestElement,
        );

        scene.replaceAllElements(updatedElements);
      }

      // Layout may adjust the requested size, or clamping may leave it unchanged.
      const finalElement = scene
        .getNonDeletedElementsMap()
        .get(latestElement.id);
      if (finalElement) {
        setInputValue(round(finalElement[property], 2));
      }
      return;
    }

    // Stats slider is dragged
    resizeSingleElement(
      nextWidth,
      nextHeight,
      latestElement,
      origElement,
      originalElementsMap,
      scene,
      property === "width" ? "e" : "s",
      {
        shouldMaintainAspectRatio: keepAspectRatio,
      },
    );

    // Handle highlighting frame element candidates
    if (isFrameLikeElement(latestElement)) {
      const nextElementsInFrame = getNonDeletedElements(
        getElementsInResizingFrame(
          scene.getElementsIncludingDeleted(),
          latestElement,
          originalAppState,
          scene.getNonDeletedElementsMap(),
        ),
      );

      setAppState({
        elementsToHighlight: nextElementsInFrame,
      });
    }
  }
};

const handleDragFinished: DragFinishedCallbackType = ({
  setAppState,
  app,
  originalElements,
  originalAppState,
}) => {
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const origElement = originalElements?.[0];
  const latestElement = origElement && elementsMap.get(origElement.id);

  // Handle frame membership update for resized frames
  if (latestElement && isFrameLikeElement(latestElement)) {
    const nextElementsInFrame = getElementsInResizingFrame(
      app.scene.getElementsIncludingDeleted(),
      latestElement,
      originalAppState,
      app.scene.getNonDeletedElementsMap(),
    );

    const updatedElements = replaceAllElementsInFrame(
      app.scene.getElementsIncludingDeleted(),
      nextElementsInFrame,
      latestElement,
    );

    app.scene.replaceAllElements(updatedElements);

    setAppState({
      elementsToHighlight: null,
    });
  }
};

const DimensionDragInput = ({
  property,
  element,
  scene,
  appState,
  shouldKeepAspectRatio,
}: DimensionDragInputProps) => {
  let value = round(property === "width" ? element.width : element.height, 2);

  if (
    appState.croppingElementId &&
    appState.croppingElementId === element.id &&
    isImageElement(element) &&
    element.crop
  ) {
    const { width: uncroppedWidth, height: uncroppedHeight } =
      getUncroppedWidthAndHeight(element);
    if (property === "width") {
      const ratio = uncroppedWidth / element.crop.naturalWidth;
      value = round(element.crop.width * ratio, 2);
    }
    if (property === "height") {
      const ratio = uncroppedHeight / element.crop.naturalHeight;
      value = round(element.crop.height * ratio, 2);
    }
  }

  return (
    <DragInput
      label={property === "width" ? "W" : "H"}
      elements={[element]}
      dragInputCallback={handleDimensionChange}
      value={value}
      editable={isPropertyEditable(element, property)}
      scene={scene}
      appState={appState}
      shouldKeepAspectRatio={shouldKeepAspectRatio}
      property={property}
      dragFinishedCallback={handleDragFinished}
    />
  );
};

export default DimensionDragInput;
