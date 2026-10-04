import { EXPORT_SCALES, randomId } from "@excalidraw/common";

import type { AppState } from "./types";

export type ExportPreferences = Pick<
  AppState,
  "exportBackground" | "exportWithDarkMode" | "exportScale" | "exportEmbedScene"
>;

export type ExportPreset = {
  id: string;
  name: string;
  preferences: ExportPreferences;
};

export type ExportPresetNameError = "empty" | "duplicate";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const getExportPreferences = (
  appState: ExportPreferences,
): ExportPreferences => ({
  exportBackground: appState.exportBackground,
  exportWithDarkMode: appState.exportWithDarkMode,
  exportScale: appState.exportScale,
  exportEmbedScene: appState.exportEmbedScene,
});

export const validateExportPreferences = (
  value: unknown,
): ExportPreferences | null => {
  if (!isRecord(value)) {
    return null;
  }

  const {
    exportBackground,
    exportWithDarkMode,
    exportScale,
    exportEmbedScene,
  } = value;

  if (
    typeof exportBackground !== "boolean" ||
    typeof exportWithDarkMode !== "boolean" ||
    typeof exportEmbedScene !== "boolean" ||
    typeof exportScale !== "number" ||
    !EXPORT_SCALES.includes(exportScale)
  ) {
    return null;
  }

  return {
    exportBackground,
    exportWithDarkMode,
    exportScale,
    exportEmbedScene,
  };
};

export const normalizeExportPresetName = (name: string) =>
  name.trim().toLowerCase();

export const getExportPresetNameError = (
  presets: readonly ExportPreset[],
  name: string,
  excludedPresetId?: string,
): ExportPresetNameError | null => {
  const normalizedName = normalizeExportPresetName(name);
  if (!normalizedName) {
    return "empty";
  }

  return presets.some(
    (preset) =>
      preset.id !== excludedPresetId &&
      normalizeExportPresetName(preset.name) === normalizedName,
  )
    ? "duplicate"
    : null;
};

export const validateExportPresets = (value: unknown): ExportPreset[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = new Set<string>();
  const names = new Set<string>();
  const presets: ExportPreset[] = [];

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      continue;
    }

    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const name =
      typeof candidate.name === "string" ? candidate.name.trim() : "";
    const normalizedName = normalizeExportPresetName(name);
    const preferences = validateExportPreferences(candidate.preferences);

    if (
      !id ||
      !normalizedName ||
      !preferences ||
      ids.has(id) ||
      names.has(normalizedName)
    ) {
      continue;
    }

    ids.add(id);
    names.add(normalizedName);
    presets.push({ id, name, preferences });
  }

  return presets;
};

export const createExportPreset = (
  presets: readonly ExportPreset[],
  name: string,
  preferences: ExportPreferences,
): ExportPreset[] | ExportPresetNameError => {
  const error = getExportPresetNameError(presets, name);
  if (error) {
    return error;
  }

  return [
    ...presets,
    {
      id: randomId(),
      name: name.trim(),
      preferences: getExportPreferences(preferences),
    },
  ];
};

export const renameExportPreset = (
  presets: readonly ExportPreset[],
  id: string,
  name: string,
): ExportPreset[] | ExportPresetNameError => {
  const error = getExportPresetNameError(presets, name, id);
  if (error) {
    return error;
  }

  return presets.map((preset) =>
    preset.id === id ? { ...preset, name: name.trim() } : preset,
  );
};

export const deleteExportPreset = (
  presets: readonly ExportPreset[],
  id: string,
) => presets.filter((preset) => preset.id !== id);

export const getAppliedExportPreset = (
  presets: readonly ExportPreset[],
  id: string,
): ExportPreferences | null =>
  presets.find((preset) => preset.id === id)?.preferences ?? null;
