import {
  cleanAppStateForExport,
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "../appState";
import { STORAGE_KEYS } from "../../../excalidraw-app/app_constants";
import { importFromLocalStorage } from "../../../excalidraw-app/data/localStorage";
import {
  createExportPreset,
  deleteExportPreset,
  getAppliedExportPreset,
  getExportPreferences,
  getExportPresetNameError,
  renameExportPreset,
  validateExportPresets,
} from "../exportPreferences";

import type { ExportPreferences, ExportPreset } from "../exportPreferences";

const preferences: ExportPreferences = {
  exportBackground: false,
  exportWithDarkMode: true,
  exportScale: 2,
  exportEmbedScene: true,
};

const preset = (overrides: Partial<ExportPreset> = {}): ExportPreset => ({
  id: "slides",
  name: "Slides",
  preferences,
  ...overrides,
});

describe("export presets", () => {
  it("creates a trimmed snapshot of the active export preferences", () => {
    const result = createExportPreset([], "  Slides  ", preferences);

    if (typeof result === "string") {
      throw new Error(`Unexpected preset error: ${result}`);
    }
    expect(result[0]).toMatchObject({ name: "Slides", preferences });
    expect(result[0].preferences).not.toBe(preferences);
  });

  it("keeps selection scope outside the preset and scene file", () => {
    expect(
      getExportPreferences({
        ...preferences,
        exportSelectionOnly: true,
      } as ExportPreferences & { exportSelectionOnly: boolean }),
    ).toEqual(preferences);

    expect(
      cleanAppStateForExport({
        ...getDefaultAppState(),
        exportPresets: [preset()],
      }),
    ).not.toHaveProperty("exportPresets");
  });

  it("rejects empty and case-insensitive duplicate names", () => {
    expect(getExportPresetNameError([preset()], "   ")).toBe("empty");
    expect(getExportPresetNameError([preset()], " slides ")).toBe("duplicate");
    expect(createExportPreset([preset()], "SLIDES", preferences)).toBe(
      "duplicate",
    );
  });

  it("renames, applies, and deletes presets by id", () => {
    const presets = [preset()];
    const renamed = renameExportPreset(presets, "slides", "Documentation");

    if (typeof renamed === "string") {
      throw new Error(`Unexpected preset error: ${renamed}`);
    }
    expect(renamed[0].name).toBe("Documentation");
    expect(getAppliedExportPreset(renamed, "slides")).toEqual(preferences);
    expect(deleteExportPreset(renamed, "slides")).toEqual([]);
  });

  it("allows a preset to keep its normalized name during rename", () => {
    expect(renameExportPreset([preset()], "slides", " slides ")).toEqual([
      preset({ name: "slides" }),
    ]);
  });

  it("drops malformed presets and duplicate ids or names", () => {
    const valid = preset();
    const result = validateExportPresets([
      valid,
      preset({ id: "slides" }),
      preset({ id: "other", name: " slides " }),
      preset({
        id: "bad-scale",
        name: "Bad scale",
        preferences: {
          ...preferences,
          exportScale: 4,
        } as ExportPreferences,
      }),
      { id: "missing-preferences", name: "Missing" },
      null,
    ]);

    expect(result).toEqual([valid]);
  });

  it("validates presets while preparing browser storage", () => {
    const state = clearAppStateForLocalStorage({
      ...getDefaultAppState(),
      exportPresets: [
        preset(),
        preset({
          id: "invalid",
          name: "Invalid",
          preferences: {
            ...preferences,
            exportWithDarkMode: "yes",
          } as unknown as ExportPreferences,
        }),
      ],
    });

    expect(state.exportPresets).toEqual([preset()]);
  });

  it("restores valid presets and ignores invalid browser data on reload", () => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify({
        exportPresets: [
          preset(),
          preset({
            id: "invalid",
            name: "Invalid",
            preferences: { ...preferences, exportScale: 100 },
          }),
        ],
      }),
    );

    expect(importFromLocalStorage().appState?.exportPresets).toEqual([
      preset(),
    ]);
  });
});
