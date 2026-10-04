import {
  CaptureUpdateAction,
  getAlignReferenceElement,
  getAlignmentUnits,
  isFrameLikeElement,
  isSingleSelectedGroup,
} from "@excalidraw/element";

import { register } from "./register";

import type { AppClassProperties, UIAppState } from "../types";

/**
 * The selection can become the align reference if it is exactly one unit
 * (an element or a whole group) that alignment would otherwise handle: not
 * frame-like, not locked.
 *
 * A lone selected group is bucketed by its children when aligned on its own,
 * but as one unit once anything else is selected with it, which is the only
 * way a reference gets used.
 */
const canSetAlignReference = (
  appState: UIAppState,
  app: AppClassProperties,
) => {
  const selectedElements = app.scene.getSelectedElements(appState);
  if (
    !selectedElements.length ||
    selectedElements.some(
      (element) => isFrameLikeElement(element) || element.locked,
    )
  ) {
    return false;
  }
  return (
    isSingleSelectedGroup(selectedElements, appState) ||
    getAlignmentUnits(
      selectedElements,
      app.scene.getNonDeletedElementsMap(),
      appState,
    ).length === 1
  );
};

const hasAlignReference = (appState: UIAppState, app: AppClassProperties) =>
  getAlignReferenceElement(appState, app.scene.getNonDeletedElementsMap()) !==
  null;

export const actionSetAlignReference = register({
  name: "setAlignReference",
  label: "labels.setAlignReference",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) =>
    canSetAlignReference(appState, app) && !hasAlignReference(appState, app),
  perform: (elements, appState, _, app) => {
    if (!canSetAlignReference(appState, app)) {
      return false;
    }
    // any member identifies the unit; the reference resolves to the whole
    // unit it is bucketed into when aligning
    const [referenceElement] = app.scene.getSelectedElements(appState);
    return {
      appState: { ...appState, alignReferenceElementId: referenceElement.id },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

export const actionClearAlignReference = register({
  name: "clearAlignReference",
  label: "labels.clearAlignReference",
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => hasAlignReference(appState, app),
  perform: (elements, appState) => ({
    appState: { ...appState, alignReferenceElementId: null },
    captureUpdate: CaptureUpdateAction.EVENTUALLY,
  }),
});
