import { KEYS, arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";

import {
  CaptureUpdateAction,
  getAlignReferenceElement,
} from "@excalidraw/element";

import {
  actionAlignVerticallyCentered,
  actionAlignHorizontallyCentered,
  actionGroup,
  actionAlignTop,
  actionAlignBottom,
  actionAlignLeft,
  actionAlignRight,
  actionSetAlignReference,
  actionClearAlignReference,
} from "@excalidraw/excalidraw/actions";
import { defaultLang, setLanguage } from "@excalidraw/excalidraw/i18n";
import { Excalidraw } from "@excalidraw/excalidraw";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { UI, Pointer, Keyboard } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  act,
  unmountComponent,
  render,
} from "@excalidraw/excalidraw/tests/test-utils";

import type { Action } from "@excalidraw/excalidraw/actions/types";
import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

const { h } = window;

const mouse = new Pointer("mouse");

const createAndSelectTwoRectangles = () => {
  UI.clickTool("rectangle");
  mouse.down();
  mouse.up(100, 100);

  UI.clickTool("rectangle");
  mouse.down(10, 10);
  mouse.up(100, 100);

  // Select the first element.
  // The second rectangle is already reselected because it was the last element created
  mouse.reset();
  Keyboard.withModifierKeys({ shift: true }, () => {
    mouse.moveTo(10, 0);
    mouse.click();
  });
};

const createAndSelectTwoRectanglesWithDifferentSizes = () => {
  UI.clickTool("rectangle");
  mouse.down();
  mouse.up(100, 100);

  UI.clickTool("rectangle");
  mouse.down(10, 10);
  mouse.up(110, 110);

  // Select the first element.
  // The second rectangle is already reselected because it was the last element created
  mouse.reset();
  Keyboard.withModifierKeys({ shift: true }, () => {
    mouse.moveTo(10, 0);
    mouse.click();
  });
};

describe("aligning", () => {
  beforeEach(async () => {
    unmountComponent();
    mouse.reset();

    await act(() => {
      return setLanguage(defaultLang);
    });
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("aligns two objects correctly to the top", () => {
    createAndSelectTwoRectangles();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_UP);
    });

    // Check if x position did not change
    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(0);
  });

  it("aligns two objects correctly to the bottom", () => {
    createAndSelectTwoRectangles();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });

    // Check if x position did not change
    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(110);
    expect(API.getSelectedElements()[1].y).toEqual(110);
  });

  it("aligns two objects correctly to the left", () => {
    createAndSelectTwoRectangles();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(0);

    // Check if y position did not change
    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);
  });

  it("aligns two objects correctly to the right", () => {
    createAndSelectTwoRectangles();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);

    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });

    expect(API.getSelectedElements()[0].x).toEqual(110);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    // Check if y position did not change
    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);
  });

  it("centers two objects with different sizes correctly vertically", () => {
    createAndSelectTwoRectanglesWithDifferentSizes();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);

    API.executeAction(actionAlignVerticallyCentered);

    // Check if x position did not change
    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(60);
    expect(API.getSelectedElements()[1].y).toEqual(55);
  });

  it("centers two objects with different sizes correctly horizontally", () => {
    createAndSelectTwoRectanglesWithDifferentSizes();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(110);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(60);
    expect(API.getSelectedElements()[1].x).toEqual(55);

    // Check if y position did not change
    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(110);
  });

  const createAndSelectGroupAndRectangle = () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // Select the first element.
    // The second rectangle is already reselected because it was the last element created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });

    API.executeAction(actionGroup);

    mouse.reset();
    UI.clickTool("rectangle");
    mouse.down(200, 200);
    mouse.up(100, 100);

    // Add the created group to the current selection
    mouse.restorePosition(0, 0);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });
  };

  it("aligns a group with another element correctly to the top", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(0);
  });

  it("aligns a group with another element correctly to the bottom", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(200);
    expect(API.getSelectedElements()[2].y).toEqual(200);
  });

  it("aligns a group with another element correctly to the left", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(0);
  });

  it("aligns a group with another element correctly to the right", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(200);
    expect(API.getSelectedElements()[2].x).toEqual(200);
  });

  it("centers a group with another element correctly vertically", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(150);
    expect(API.getSelectedElements()[2].y).toEqual(100);
  });

  it("centers a group with another element correctly horizontally", () => {
    createAndSelectGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(150);
    expect(API.getSelectedElements()[2].x).toEqual(100);
  });

  const createAndSelectTwoGroups = () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // Select the first element.
    // The second rectangle is already selected because it was the last element created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });

    API.executeAction(actionGroup);

    mouse.reset();
    UI.clickTool("rectangle");
    mouse.down(200, 200);
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    mouse.restorePosition(210, 200);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });

    API.executeAction(actionGroup);

    // Select the first group.
    // The second group is already selected because it was the last group created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });
  };

  it("aligns two groups correctly to the top", () => {
    createAndSelectTwoGroups();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(0);
    expect(API.getSelectedElements()[3].y).toEqual(100);
  });

  it("aligns two groups correctly to the bottom", () => {
    createAndSelectTwoGroups();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(200);
    expect(API.getSelectedElements()[1].y).toEqual(300);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);
  });

  it("aligns two groups correctly to the left", () => {
    createAndSelectTwoGroups();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(0);
    expect(API.getSelectedElements()[3].x).toEqual(100);
  });

  it("aligns two groups correctly to the right", () => {
    createAndSelectTwoGroups();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(200);
    expect(API.getSelectedElements()[1].x).toEqual(300);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);
  });

  it("centers two groups correctly vertically", () => {
    createAndSelectTwoGroups();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(200);
    expect(API.getSelectedElements()[2].y).toEqual(100);
    expect(API.getSelectedElements()[3].y).toEqual(200);
  });

  it("centers two groups correctly horizontally", () => {
    createAndSelectTwoGroups();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(200);
    expect(API.getSelectedElements()[2].x).toEqual(100);
    expect(API.getSelectedElements()[3].x).toEqual(200);
  });

  const createAndSelectNestedGroupAndRectangle = () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // Select the first element.
    // The second rectangle is already reselected because it was the last element created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });

    // Create first group of rectangles
    API.executeAction(actionGroup);

    mouse.reset();
    UI.clickTool("rectangle");
    mouse.down(200, 200);
    mouse.up(100, 100);

    // Add group to current selection
    mouse.restorePosition(10, 0);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });

    // Create the nested group
    API.executeAction(actionGroup);

    mouse.reset();
    UI.clickTool("rectangle");
    mouse.down(300, 300);
    mouse.up(100, 100);

    // Select the nested group, the rectangle is already selected
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });
  };

  it("aligns nested group and other element correctly to the top", () => {
    createAndSelectNestedGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(0);
  });

  it("aligns nested group and other element correctly to the bottom", () => {
    createAndSelectNestedGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(200);
    expect(API.getSelectedElements()[2].y).toEqual(300);
    expect(API.getSelectedElements()[3].y).toEqual(300);
  });

  it("aligns nested group and other element correctly to the left", () => {
    createAndSelectNestedGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(0);
  });

  it("aligns nested group and other element correctly to the right", () => {
    createAndSelectNestedGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(200);
    expect(API.getSelectedElements()[2].x).toEqual(300);
    expect(API.getSelectedElements()[3].x).toEqual(300);
  });

  it("centers nested group and other element correctly vertically", () => {
    createAndSelectNestedGroupAndRectangle();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);
    expect(API.getSelectedElements()[3].y).toEqual(300);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(150);
    expect(API.getSelectedElements()[2].y).toEqual(250);
    expect(API.getSelectedElements()[3].y).toEqual(150);
  });

  it("centers nested group and other element correctly horizontally", () => {
    createAndSelectNestedGroupAndRectangle();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);
    expect(API.getSelectedElements()[3].x).toEqual(300);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(150);
    expect(API.getSelectedElements()[2].x).toEqual(250);
    expect(API.getSelectedElements()[3].x).toEqual(150);
  });

  const createGroupAndSelectInEditGroupMode = () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // select the first element.
    // The second rectangle is already reselected because it was the last element created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });

    API.executeAction(actionGroup);
    mouse.reset();
    mouse.moveTo(10, 0);
    mouse.doubleClick();

    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
      mouse.moveTo(100, 100);
      mouse.click();
    });
  };

  it("aligns elements within a group while in group edit mode correctly to the top", () => {
    createGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(0);
  });
  it("aligns elements within a group while in group edit mode correctly to the bottom", () => {
    createGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(100);
  });
  it("aligns elements within a group while in group edit mode correctly to the left", () => {
    createGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(0);
  });
  it("aligns elements within a group while in group edit mode correctly to the right", () => {
    createGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(100);
  });
  it("aligns elements within a group while in group edit mode correctly to the vertical center", () => {
    createGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(50);
  });
  it("aligns elements within a group while in group edit mode correctly to the horizontal center", () => {
    createGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(50);
  });

  const createNestedGroupAndSelectInEditGroupMode = () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // Select the first element.
    // The second rectangle is already reselected because it was the last element created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });

    API.executeAction(actionGroup);

    mouse.reset();
    mouse.moveTo(200, 200);
    // create third element
    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // third element is already selected, select the initial group and group together
    mouse.reset();

    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });

    API.executeAction(actionGroup);

    // double click to enter edit mode
    mouse.doubleClick();

    // select nested group and other element within the group
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(200, 200);
      mouse.click();
    });
  };

  it("aligns element and nested group while in group edit mode correctly to the top", () => {
    createNestedGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(0);
  });
  it("aligns element and nested group while in group edit mode correctly to the bottom", () => {
    createNestedGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(200);
    expect(API.getSelectedElements()[2].y).toEqual(200);
  });
  it("aligns element and nested group while in group edit mode correctly to the left", () => {
    createNestedGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(0);
  });
  it("aligns element and nested group while in group edit mode correctly to the right", () => {
    createNestedGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(200);
    expect(API.getSelectedElements()[2].x).toEqual(200);
  });
  it("aligns element and nested group while in group edit mode correctly to the vertical center", () => {
    createNestedGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(150);
    expect(API.getSelectedElements()[2].y).toEqual(100);
  });
  it("aligns elements and nested group within a group while in group edit mode correctly to the horizontal center", () => {
    createNestedGroupAndSelectInEditGroupMode();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(150);
    expect(API.getSelectedElements()[2].x).toEqual(100);
  });

  const createAndSelectSingleGroup = () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // Select the first element.
    // The second rectangle is already reselected because it was the last element created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });

    API.executeAction(actionGroup);
  };

  it("aligns elements within a single-selected group correctly to the top", () => {
    createAndSelectSingleGroup();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(0);
  });
  it("aligns elements within a single-selected group correctly to the bottom", () => {
    createAndSelectSingleGroup();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(100);
  });
  it("aligns elements within a single-selected group correctly to the left", () => {
    createAndSelectSingleGroup();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(0);
  });
  it("aligns elements within a single-selected group correctly to the right", () => {
    createAndSelectSingleGroup();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(100);
  });
  it("aligns elements within a single-selected group correctly to the vertical center", () => {
    createAndSelectSingleGroup();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(50);
  });
  it("aligns elements within a single-selected group correctly to the horizontal center", () => {
    createAndSelectSingleGroup();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(50);
  });

  const createAndSelectSingleGroupWithNestedGroup = () => {
    UI.clickTool("rectangle");
    mouse.down();
    mouse.up(100, 100);

    UI.clickTool("rectangle");
    mouse.down(0, 0);
    mouse.up(100, 100);

    // Select the first element.
    // The second rectangle is already reselected because it was the last element created
    mouse.reset();
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.moveTo(10, 0);
      mouse.click();
    });

    API.executeAction(actionGroup);

    mouse.reset();
    UI.clickTool("rectangle");
    mouse.down(200, 200);
    mouse.up(100, 100);

    // Add group to current selection
    mouse.restorePosition(10, 0);
    Keyboard.withModifierKeys({ shift: true }, () => {
      mouse.click();
    });

    // Create the nested group
    API.executeAction(actionGroup);
  };
  it("aligns elements within a single-selected group containing a nested group correctly to the top", () => {
    createAndSelectSingleGroupWithNestedGroup();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignTop);

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(0);
  });
  it("aligns elements within a single-selected group containing a nested group correctly to the bottom", () => {
    createAndSelectSingleGroupWithNestedGroup();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignBottom);

    expect(API.getSelectedElements()[0].y).toEqual(100);
    expect(API.getSelectedElements()[1].y).toEqual(200);
    expect(API.getSelectedElements()[2].y).toEqual(200);
  });
  it("aligns elements within a single-selected group containing a nested group correctly to the left", () => {
    createAndSelectSingleGroupWithNestedGroup();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignLeft);

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(0);
  });
  it("aligns elements within a single-selected group containing a nested group correctly to the right", () => {
    createAndSelectSingleGroupWithNestedGroup();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignRight);

    expect(API.getSelectedElements()[0].x).toEqual(100);
    expect(API.getSelectedElements()[1].x).toEqual(200);
    expect(API.getSelectedElements()[2].x).toEqual(200);
  });
  it("aligns elements within a single-selected group containing a nested group correctly to the vertical center", () => {
    createAndSelectSingleGroupWithNestedGroup();

    expect(API.getSelectedElements()[0].y).toEqual(0);
    expect(API.getSelectedElements()[1].y).toEqual(100);
    expect(API.getSelectedElements()[2].y).toEqual(200);

    API.executeAction(actionAlignVerticallyCentered);

    expect(API.getSelectedElements()[0].y).toEqual(50);
    expect(API.getSelectedElements()[1].y).toEqual(150);
    expect(API.getSelectedElements()[2].y).toEqual(100);
  });
  it("aligns elements within a single-selected group containing a nested group correctly to the horizontal center", () => {
    createAndSelectSingleGroupWithNestedGroup();

    expect(API.getSelectedElements()[0].x).toEqual(0);
    expect(API.getSelectedElements()[1].x).toEqual(100);
    expect(API.getSelectedElements()[2].x).toEqual(200);

    API.executeAction(actionAlignHorizontallyCentered);

    expect(API.getSelectedElements()[0].x).toEqual(50);
    expect(API.getSelectedElements()[1].x).toEqual(150);
    expect(API.getSelectedElements()[2].x).toEqual(100);
  });

  const createAndSelectGroupWithBoundTextAndRectangle = () => {
    const groupId = "group-with-bound-text";

    // container is vertically/horizontally centered around its bound text
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      groupIds: [groupId],
      boundElements: [{ type: "text", id: "bound-text" }],
    });

    const boundText = API.createElement({
      type: "text",
      id: "bound-text",
      x: 120,
      y: 140,
      width: 60,
      height: 20,
      containerId: container.id,
      groupIds: [groupId],
    });

    const groupedRectangle = API.createElement({
      type: "rectangle",
      id: "grouped-rectangle",
      x: 100,
      y: 200,
      width: 100,
      height: 100,
      groupIds: [groupId],
    });

    const standaloneRectangle = API.createElement({
      type: "rectangle",
      id: "standalone-rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });

    API.setElements([
      container,
      boundText,
      groupedRectangle,
      standaloneRectangle,
    ]);

    API.setSelectedElements([container, groupedRectangle, standaloneRectangle]);

    return { container, boundText, groupedRectangle, standaloneRectangle };
  };

  it("keeps a bound text within its container when aligning a group to the top", () => {
    const { container, boundText, groupedRectangle, standaloneRectangle } =
      createAndSelectGroupWithBoundTextAndRectangle();

    API.executeAction(actionAlignTop);

    expect(API.getElement(standaloneRectangle).y).toEqual(0);
    expect(API.getElement(container).y).toEqual(0);
    expect(API.getElement(groupedRectangle).y).toEqual(100);

    expect(API.getElement(boundText).y).toEqual(40);
    expect(API.getElement(boundText).x).toEqual(120);
  });

  it("keeps a bound text within its container when aligning a group to the left", () => {
    const { container, boundText, groupedRectangle, standaloneRectangle } =
      createAndSelectGroupWithBoundTextAndRectangle();

    API.executeAction(actionAlignLeft);

    expect(API.getElement(standaloneRectangle).x).toEqual(0);
    expect(API.getElement(container).x).toEqual(0);
    expect(API.getElement(groupedRectangle).x).toEqual(0);

    expect(API.getElement(boundText).x).toEqual(20);
    expect(API.getElement(boundText).y).toEqual(140);
  });
});

describe("getAlignReferenceElement", () => {
  const rectangle = API.createElement({ type: "rectangle", id: "rect" });
  const deletedRectangle = API.createElement({
    type: "rectangle",
    id: "deleted-rect",
    isDeleted: true,
  });
  const frame = API.createElement({ type: "frame", id: "frame" });
  const magicFrame = API.createElement({ type: "magicframe", id: "magic" });
  const elementsMap = arrayToMap([
    rectangle,
    deletedRectangle,
    frame,
    magicFrame,
  ]);

  const resolve = (
    alignReferenceElementId: string | null,
    selectedIds: string[],
  ) =>
    getAlignReferenceElement(
      {
        alignReferenceElementId,
        selectedElementIds: Object.fromEntries(
          selectedIds.map((id) => [id, true as const]),
        ),
      },
      elementsMap,
    );

  it("returns the element when it is set, selected and not frame-like", () => {
    expect(resolve(rectangle.id, [rectangle.id])).toBe(rectangle);
  });

  it("returns null when no reference is set", () => {
    expect(resolve(null, [rectangle.id])).toBe(null);
  });

  it("returns null when the reference is no longer selected", () => {
    expect(resolve(rectangle.id, [])).toBe(null);
  });

  it("returns null when the reference is deleted or missing", () => {
    expect(resolve(deletedRectangle.id, [deletedRectangle.id])).toBe(null);
    expect(resolve("missing", ["missing"])).toBe(null);
  });

  it("returns null when the reference is frame-like", () => {
    expect(resolve(frame.id, [frame.id])).toBe(null);
    expect(resolve(magicFrame.id, [magicFrame.id])).toBe(null);
  });
});

describe("align reference lifetime", () => {
  beforeEach(async () => {
    unmountComponent();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("clears the reference once its element leaves the selection", () => {
    const rectA = API.createElement({ type: "rectangle", id: "A" });
    const rectB = API.createElement({ type: "rectangle", id: "B", x: 200 });
    API.setElements([rectA, rectB]);
    API.setSelectedElements([rectA, rectB]);
    act(() => {
      API.setAppState({ alignReferenceElementId: rectA.id });
    });
    expect(h.state.alignReferenceElementId).toBe(rectA.id);

    // still selected alongside others: kept
    API.setSelectedElements([rectA]);
    expect(h.state.alignReferenceElementId).toBe(rectA.id);

    // deselected: cleared, and reselecting doesn't bring it back
    API.setSelectedElements([rectB]);
    expect(h.state.alignReferenceElementId).toBe(null);
    API.setSelectedElements([rectA, rectB]);
    expect(h.state.alignReferenceElementId).toBe(null);
  });
});

const ALIGN_ACTIONS = [
  ["top", actionAlignTop],
  ["bottom", actionAlignBottom],
  ["left", actionAlignLeft],
  ["right", actionAlignRight],
  ["vertical center", actionAlignVerticallyCentered],
  ["horizontal center", actionAlignHorizontallyCentered],
] as const;

/** selects `reference` alone, sets it as the align reference, then selects
 * `selection`, which is how a user picks a reference */
const setReferenceAndSelect = (
  reference: NonDeletedExcalidrawElement[],
  selection: NonDeletedExcalidrawElement[],
) => {
  API.setSelectedElements(reference);
  API.executeAction(actionSetAlignReference);
  API.setSelectedElements(selection);
};

/** geometry and relationships alignment may change, by element id */
const sceneState = () =>
  Object.fromEntries(
    h.elements.map((element) => [
      element.id,
      {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        frameId: element.frameId,
        groupIds: element.groupIds,
        locked: element.locked,
        boundElements: element.boundElements,
        containerId: "containerId" in element ? element.containerId : undefined,
        points: "points" in element ? element.points : undefined,
        startBinding:
          "startBinding" in element
            ? element.startBinding?.elementId ?? null
            : undefined,
        endBinding:
          "endBinding" in element
            ? element.endBinding?.elementId ?? null
            : undefined,
      },
    ]),
  );

const renderEditor = async () => {
  unmountComponent();
  mouse.reset();
  await act(() => {
    return setLanguage(defaultLang);
  });
  await render(<Excalidraw handleKeyboardGlobally={true} />);
};

describe("aligning to a reference element", () => {
  beforeEach(renderEditor);

  // heading spans x 100..300, y 0..40; neither box shares any of its edges
  const createHeadingAndBoxes = () => {
    const heading = API.createElement({
      type: "rectangle",
      id: "heading",
      x: 100,
      y: 0,
      width: 200,
      height: 40,
    });
    const boxA = API.createElement({
      type: "rectangle",
      id: "boxA",
      x: 0,
      y: 100,
      width: 50,
      height: 50,
    });
    const boxB = API.createElement({
      type: "rectangle",
      id: "boxB",
      x: 300,
      y: 200,
      width: 80,
      height: 60,
    });
    // through the store, like loading a scene, so undo has a baseline
    API.updateScene({
      elements: [heading, boxA, boxB],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setReferenceAndSelect([heading], [heading, boxA, boxB]);
    return { heading, boxA, boxB };
  };

  it.each([
    ["top", actionAlignTop, { boxA: [0, 0], boxB: [300, 0] }],
    ["bottom", actionAlignBottom, { boxA: [0, -10], boxB: [300, -20] }],
    ["left", actionAlignLeft, { boxA: [100, 100], boxB: [100, 200] }],
    ["right", actionAlignRight, { boxA: [250, 100], boxB: [220, 200] }],
    [
      "vertical center",
      actionAlignVerticallyCentered,
      { boxA: [0, -5], boxB: [300, -10] },
    ],
    [
      "horizontal center",
      actionAlignHorizontallyCentered,
      { boxA: [175, 100], boxB: [160, 200] },
    ],
  ] as const)(
    "aligns to the reference's %s and keeps the reference fixed",
    (_, action, expected) => {
      const { heading, boxA, boxB } = createHeadingAndBoxes();
      expect(h.state.alignReferenceElementId).toBe(heading.id);

      API.executeAction(action);

      expect([API.getElement(heading).x, API.getElement(heading).y]).toEqual([
        100, 0,
      ]);
      expect([API.getElement(boxA).x, API.getElement(boxA).y]).toEqual(
        expected.boxA,
      );
      expect([API.getElement(boxB).x, API.getElement(boxB).y]).toEqual(
        expected.boxB,
      );
    },
  );

  it("keeps the reference after aligning and reverts the align with one undo", () => {
    const { heading, boxA, boxB } = createHeadingAndBoxes();

    API.executeAction(actionAlignLeft);
    expect(API.getElement(boxA).x).toBe(100);
    expect(h.state.alignReferenceElementId).toBe(heading.id);

    Keyboard.undo();
    expect(API.getElement(boxA).isDeleted).toBe(false);
    expect(API.getElement(boxA).x).toBe(0);
    expect(API.getElement(boxB).x).toBe(300);
    expect(API.getElement(heading).x).toBe(100);
  });

  it("aligns to the selection box again once the reference is cleared", () => {
    const { heading, boxA, boxB } = createHeadingAndBoxes();

    API.executeAction(actionClearAlignReference);
    expect(h.state.alignReferenceElementId).toBe(null);
    API.executeAction(actionAlignLeft);

    expect(API.getElement(heading).x).toBe(0);
    expect(API.getElement(boxA).x).toBe(0);
    expect(API.getElement(boxB).x).toBe(0);
  });

  it("ignores a reference that was deleted", () => {
    const { heading, boxA, boxB } = createHeadingAndBoxes();

    API.updateElement<ExcalidrawElement>(heading, { isDeleted: true });
    API.executeAction(actionAlignLeft);

    // as if no reference was ever set: the selection box of what's left
    expect(h.state.alignReferenceElementId).toBe(null);
    expect(API.getElement(boxA).x).toBe(0);
    expect(API.getElement(boxB).x).toBe(0);
  });

  it("moves groups as units when aligning them to a reference", () => {
    const heading = API.createElement({
      type: "rectangle",
      x: 100,
      y: 0,
      width: 200,
      height: 40,
    });
    const member1 = API.createElement({
      type: "rectangle",
      x: 0,
      y: 100,
      width: 50,
      height: 50,
      groupIds: ["g"],
    });
    const member2 = API.createElement({
      type: "rectangle",
      x: 70,
      y: 130,
      width: 50,
      height: 50,
      groupIds: ["g"],
    });
    API.setElements([heading, member1, member2]);
    setReferenceAndSelect([heading], [heading, member1, member2]);

    API.executeAction(actionAlignLeft);

    expect(API.getElement(heading).x).toBe(100);
    expect(API.getElement(member1).x).toBe(100);
    expect(API.getElement(member2).x).toBe(170);
    expect(API.getElement(member2).y - API.getElement(member1).y).toBe(30);
  });

  describe("with a group as the reference", () => {
    const createGroupAndBox = () => {
      const member1 = API.createElement({
        type: "rectangle",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        groupIds: ["g"],
      });
      const member2 = API.createElement({
        type: "rectangle",
        x: 200,
        y: 150,
        width: 50,
        height: 50,
        groupIds: ["g"],
      });
      const box = API.createElement({
        type: "rectangle",
        x: 0,
        y: 400,
        width: 30,
        height: 30,
      });
      API.setElements([member1, member2, box]);
      return { member1, member2, box };
    };

    it("offers set for a whole selected group", () => {
      const { member1, member2 } = createGroupAndBox();
      API.setSelectedElements([member1, member2]);
      expect(h.state.selectedGroupIds).toEqual({ g: true });

      expect(h.app.actionManager.isActionEnabled(actionSetAlignReference)).toBe(
        true,
      );
    });

    it("aligns to the whole group's box and keeps the group fixed", () => {
      const { member1, member2, box } = createGroupAndBox();
      setReferenceAndSelect([member1, member2], [member1, member2, box]);

      API.executeAction(actionAlignRight);

      // group spans x 100..250
      expect(API.getElement(member1).x).toBe(100);
      expect(API.getElement(member2).x).toBe(200);
      expect(API.getElement(box).x).toBe(220);
    });

    it("behaves like a normal align while the group is selected on its own", () => {
      const { member1, member2 } = createGroupAndBox();
      API.setSelectedElements([member1, member2]);
      API.executeAction(actionSetAlignReference);

      API.executeAction(actionAlignLeft);

      // members align to the group (= selection) box, as without a reference
      expect(API.getElement(member1).x).toBe(100);
      expect(API.getElement(member2).x).toBe(100);
    });
  });

  it("doesn't offer frames or locked elements as the reference", () => {
    const frame = API.createElement({ type: "frame", width: 100 });
    const locked = API.createElement({
      type: "rectangle",
      x: 200,
      locked: true,
    });
    API.setElements([frame, locked]);

    API.setSelectedElements([frame]);
    expect(h.app.actionManager.isActionEnabled(actionSetAlignReference)).toBe(
      false,
    );
    API.setSelectedElements([locked]);
    expect(h.app.actionManager.isActionEnabled(actionSetAlignReference)).toBe(
      false,
    );
  });
});

/**
 * The issue's check: the existing align commands and the reference-based
 * command must treat groups, frames, locked elements and bound labels
 * identically, shown by running both on the same fixture drawing.
 */
describe("selection vs reference alignment on one fixture", () => {
  beforeEach(renderEditor);

  // a panel enclosing everything else, so its box equals the selection box;
  // inside it: a group, a labeled container, two shapes joined by an arrow
  // bound at both ends, a frame with a child, and a locked element
  const createFixture = () => {
    const panel = API.createElement({
      type: "rectangle",
      id: "panel",
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
    });
    const member1 = API.createElement({
      type: "rectangle",
      id: "member1",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      groupIds: ["group"],
    });
    const member2 = API.createElement({
      type: "rectangle",
      id: "member2",
      x: 250,
      y: 150,
      width: 100,
      height: 100,
      groupIds: ["group"],
    });
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      x: 500,
      y: 100,
      width: 200,
      height: 100,
      boundElements: [{ type: "text", id: "label" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      x: 550,
      y: 135,
      width: 100,
      height: 30,
      containerId: container.id,
    });
    const arrowStart = API.createElement({
      type: "rectangle",
      id: "arrowStart",
      x: 100,
      y: 500,
      width: 100,
      height: 100,
      boundElements: [{ type: "arrow", id: "arrow" }],
    });
    const arrowEnd = API.createElement({
      type: "rectangle",
      id: "arrowEnd",
      x: 550,
      y: 700,
      width: 100,
      height: 100,
      boundElements: [{ type: "arrow", id: "arrow" }],
    });
    const arrow = API.createElement({
      type: "arrow",
      id: "arrow",
      x: 215,
      y: 560,
      width: 320,
      height: 180,
      points: [pointFrom(0, 0), pointFrom(320, 180)],
      startBinding: {
        elementId: arrowStart.id,
        fixedPoint: [0.5, 0.5],
        mode: "orbit",
      },
      endBinding: {
        elementId: arrowEnd.id,
        fixedPoint: [0.5, 0.5],
        mode: "orbit",
      },
    });
    const frame = API.createElement({
      type: "frame",
      id: "frame",
      x: 750,
      y: 400,
      width: 200,
      height: 200,
    });
    const frameChild = API.createElement({
      type: "rectangle",
      id: "frameChild",
      x: 800,
      y: 450,
      width: 50,
      height: 50,
      frameId: frame.id,
    });
    const locked = API.createElement({
      type: "rectangle",
      id: "locked",
      x: 400,
      y: 850,
      width: 80,
      height: 80,
      locked: true,
    });

    API.setElements([
      panel,
      member1,
      member2,
      container,
      label,
      arrowStart,
      arrowEnd,
      arrow,
      frame,
      frameChild,
      locked,
    ]);

    // what alignment can act on: frames stay excluded and locked elements
    // can't be selected, so neither is part of it
    const selection = [
      panel,
      member1,
      member2,
      container,
      arrowStart,
      arrowEnd,
      arrow,
      frameChild,
    ];
    return { panel, member1, member2, frame, selection };
  };

  type Fixture = ReturnType<typeof createFixture>;

  const alignWithoutReference = (action: Action) => {
    const { selection } = createFixture();
    API.setSelectedElements(selection);
    API.executeAction(action);
    return sceneState();
  };

  const alignWithReference = (
    action: Action,
    pickReference: (fixture: Fixture) => NonDeletedExcalidrawElement[],
  ) => {
    const fixture = createFixture();
    setReferenceAndSelect(pickReference(fixture), fixture.selection);
    expect(
      getAlignReferenceElement(h.state, h.app.scene.getNonDeletedElementsMap()),
    ).not.toBe(null);
    API.executeAction(action);
    return sceneState();
  };

  it.each(ALIGN_ACTIONS)(
    "gives identical results when the reference box equals the selection box (%s)",
    async (_, action) => {
      createFixture();
      const initial = sceneState();
      const withoutReference = alignWithoutReference(action);

      await renderEditor();
      const withReference = alignWithReference(action, ({ panel }) => [panel]);

      // the fixture actually moved, so the comparison isn't vacuous
      expect(withoutReference).not.toEqual(initial);
      expect(withReference).toEqual(withoutReference);
    },
  );

  // invariants both commands must keep, whatever the reference box is
  const expectInvariants = (
    before: ReturnType<typeof sceneState>,
    after: ReturnType<typeof sceneState>,
  ) => {
    // groups keep their internal layout
    expect(after.member2.x - after.member1.x).toBe(
      before.member2.x - before.member1.x,
    );
    expect(after.member2.y - after.member1.y).toBe(
      before.member2.y - before.member1.y,
    );
    // bound labels stay where they were in their container
    expect(after.label.x - after.container.x).toBe(
      before.label.x - before.container.x,
    );
    expect(after.label.y - after.container.y).toBe(
      before.label.y - before.container.y,
    );
    expect(after.label.containerId).toBe("container");
    // the arrow stays bound at both ends
    expect(after.arrow.startBinding).toBe("arrowStart");
    expect(after.arrow.endBinding).toBe("arrowEnd");
    // frames and locked elements aren't touched
    expect(after.frame).toEqual(before.frame);
    expect(after.locked).toEqual(before.locked);
    // frame membership only changes while dragging, so aligning keeps it
    expect(after.frameChild.frameId).toBe(before.frameChild.frameId);
  };

  it.each(ALIGN_ACTIONS)(
    "keeps groups, labels, arrows, frames and locked elements valid either way (%s)",
    async (_, action) => {
      createFixture();
      const before = sceneState();
      expectInvariants(before, alignWithoutReference(action));

      await renderEditor();
      // a whole group as the reference, which must stay fixed
      const after = alignWithReference(action, ({ member1, member2 }) => [
        member1,
        member2,
      ]);
      expectInvariants(before, after);
      expect(after.member1).toEqual(before.member1);
      expect(after.member2).toEqual(before.member2);
    },
  );

  it("disables every align command once a frame is selected, with or without a reference", () => {
    const { panel, frame, selection } = createFixture();

    API.setSelectedElements([...selection, frame]);
    expect(h.app.actionManager.isActionEnabled(actionAlignLeft)).toBe(false);

    setReferenceAndSelect([panel], [...selection, frame]);
    expect(h.state.alignReferenceElementId).toBe(panel.id);
    for (const [, action] of ALIGN_ACTIONS) {
      expect(h.app.actionManager.isActionEnabled(action)).toBe(false);
    }
  });
});
