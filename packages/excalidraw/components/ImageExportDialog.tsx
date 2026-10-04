import { exportToCanvas } from "@excalidraw/utils/export";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_EXPORT_PADDING,
  EXPORT_IMAGE_TYPES,
  isFirefox,
  EXPORT_SCALES,
  cloneJSON,
} from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  actionExportWithDarkMode,
  actionChangeExportBackground,
  actionChangeExportEmbedScene,
  actionChangeExportScale,
  actionChangeProjectName,
  actionCreateExportPreset,
  actionRenameExportPreset,
  actionDeleteExportPreset,
  actionApplyExportPreset,
} from "../actions/actionExport";
import { probablySupportsClipboardBlob } from "../clipboard";
import { prepareElementsForExport } from "../data";
import { canvasToBlob } from "../data/blob";
import { nativeFileSystemSupported } from "../data/filesystem";
import { useCopyStatus } from "../hooks/useCopiedIndicator";

import { t } from "../i18n";
import { isSomeElementSelected } from "../scene";
import {
  getExportPreferences,
  getExportPresetNameError,
} from "../exportPreferences";

import { copyIcon, downloadIcon, helpIcon } from "./icons";
import { Dialog } from "./Dialog";
import { RadioGroup } from "./RadioGroup";
import { Switch } from "./Switch";
import { Tooltip } from "./Tooltip";
import { FilledButton } from "./FilledButton";
import { TextField } from "./TextField";

import "./ImageExportDialog.scss";

import type { ActionManager } from "../actions/manager";

import type { AppClassProperties, BinaryFiles, UIAppState } from "../types";

export const ErrorCanvasPreview = () => {
  return (
    <div>
      <h3>{t("canvasError.cannotShowPreview")}</h3>
      <p>
        <span>{t("canvasError.canvasTooBig")}</span>
      </p>
      <em>({t("canvasError.canvasTooBigTip")})</em>
    </div>
  );
};

type ImageExportModalProps = {
  appStateSnapshot: Readonly<UIAppState>;
  appState: Readonly<UIAppState>;
  elementsSnapshot: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
  name: string;
};

const ImageExportModal = ({
  appStateSnapshot,
  appState,
  elementsSnapshot,
  files,
  actionManager,
  onExportImage,
  name,
}: ImageExportModalProps) => {
  const hasSelection = isSomeElementSelected(
    elementsSnapshot,
    appStateSnapshot,
  );

  const [projectName, setProjectName] = useState(name);
  const [exportSelectionOnly, setExportSelectionOnly] = useState(hasSelection);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [presetError, setPresetError] = useState<string | null>(null);
  const {
    exportBackground,
    exportWithDarkMode,
    exportScale,
    exportEmbedScene,
  } = appState;
  const exportPreferences = useMemo(
    () =>
      getExportPreferences({
        exportBackground,
        exportWithDarkMode,
        exportScale,
        exportEmbedScene,
      }),
    [exportBackground, exportWithDarkMode, exportScale, exportEmbedScene],
  );
  const selectedPreset = appState.exportPresets.find(
    (preset) => preset.id === selectedPresetId,
  );

  const previewRef = useRef<HTMLDivElement>(null);
  const previewRenderRequestIdRef = useRef(0);
  const [renderError, setRenderError] = useState<Error | null>(null);

  const { onCopy, copyStatus, resetCopyStatus } = useCopyStatus();

  useEffect(() => {
    // if user changes setting right after export to clipboard, reset the status
    // so they don't have to wait for the timeout to click the button again
    resetCopyStatus();
  }, [
    projectName,
    exportBackground,
    exportWithDarkMode,
    exportScale,
    exportEmbedScene,
    resetCopyStatus,
  ]);

  const { exportedElements, exportingFrame } = prepareElementsForExport(
    elementsSnapshot,
    appStateSnapshot,
    exportSelectionOnly,
  );

  useEffect(() => {
    const previewNode = previewRef.current;
    if (!previewNode) {
      return;
    }
    const maxWidth = previewNode.offsetWidth;
    const maxHeight = previewNode.offsetHeight;
    if (!maxWidth) {
      return;
    }

    const requestId = ++previewRenderRequestIdRef.current;
    const isStaleRequest = () => {
      return requestId !== previewRenderRequestIdRef.current;
    };

    exportToCanvas({
      elements: exportedElements,
      appState: {
        ...appStateSnapshot,
        name: projectName,
        ...exportPreferences,
      },
      files,
      exportPadding: DEFAULT_EXPORT_PADDING,
      maxWidthOrHeight: Math.max(maxWidth, maxHeight),
      exportingFrame,
    })
      .then(async (canvas) => {
        if (isStaleRequest()) {
          return;
        }

        // If converting to blob fails, there's some problem that will likely
        // prevent preview and export (e.g. canvas too big).
        try {
          await canvasToBlob(canvas);
        } catch (error: any) {
          if (error.name === "CANVAS_POSSIBLY_TOO_BIG") {
            throw new Error(t("canvasError.canvasTooBig"));
          }
          throw error;
        }

        if (isStaleRequest()) {
          return;
        }

        setRenderError(null);
        previewNode.replaceChildren(canvas);
      })
      .catch((error) => {
        if (isStaleRequest()) {
          return;
        }

        console.error(error);
        setRenderError(error);
      });

    return () => {
      previewRenderRequestIdRef.current += 1;
    };
  }, [
    appStateSnapshot,
    files,
    exportedElements,
    exportingFrame,
    projectName,
    exportPreferences,
  ]);

  return (
    <div className="ImageExportModal">
      <h3>{t("imageExportDialog.header")}</h3>
      <div className="ImageExportModal__preview">
        <div className="ImageExportModal__preview__canvas" ref={previewRef}>
          {renderError && <ErrorCanvasPreview />}
        </div>
        <div className="ImageExportModal__preview__filename">
          {!nativeFileSystemSupported && (
            <input
              type="text"
              className="TextInput"
              value={projectName}
              style={{ width: "30ch" }}
              onChange={(event) => {
                setProjectName(event.target.value);
                actionManager.executeAction(
                  actionChangeProjectName,
                  "ui",
                  event.target.value,
                );
              }}
            />
          )}
        </div>
      </div>
      <div className="ImageExportModal__settings">
        <h3>{t("imageExportDialog.header")}</h3>
        <div className="ImageExportModal__preset">
          <label htmlFor="exportPresetSelect">
            {t("imageExportDialog.preset.label")}
          </label>
          <select
            id="exportPresetSelect"
            className="dropdown-select"
            value={selectedPresetId}
            onChange={(event) => {
              const id = event.target.value;
              const preset = appState.exportPresets.find(
                (candidate) => candidate.id === id,
              );
              setSelectedPresetId(id);
              setPresetName(preset?.name ?? "");
              setPresetError(null);
            }}
          >
            <option value="">{t("imageExportDialog.preset.none")}</option>
            {appState.exportPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <TextField
            value={presetName}
            fullWidth
            placeholder={t("imageExportDialog.preset.namePlaceholder")}
            onChange={(value) => {
              setPresetName(value);
              setPresetError(null);
            }}
          />
          {presetError && (
            <div className="ImageExportModal__preset__error" role="alert">
              {presetError}
            </div>
          )}
          <div className="ImageExportModal__preset__buttons">
            <FilledButton
              variant="outlined"
              label={t("imageExportDialog.preset.save")}
              onClick={() => {
                const error = getExportPresetNameError(
                  appState.exportPresets,
                  presetName,
                );
                if (error) {
                  setPresetError(
                    error === "empty"
                      ? t("imageExportDialog.preset.error.emptyName")
                      : t("imageExportDialog.preset.error.duplicateName"),
                  );
                  return;
                }
                actionManager.executeAction(actionCreateExportPreset, "ui", {
                  name: presetName,
                });
                setPresetName("");
              }}
            />
            <FilledButton
              variant="outlined"
              label={t("imageExportDialog.preset.apply")}
              disabled={!selectedPreset}
              onClick={() => {
                if (selectedPreset) {
                  actionManager.executeAction(actionApplyExportPreset, "ui", {
                    id: selectedPreset.id,
                  });
                }
              }}
            />
            <FilledButton
              variant="outlined"
              label={t("imageExportDialog.preset.rename")}
              disabled={!selectedPreset}
              onClick={() => {
                if (!selectedPreset) {
                  return;
                }
                const error = getExportPresetNameError(
                  appState.exportPresets,
                  presetName,
                  selectedPreset.id,
                );
                if (error) {
                  setPresetError(
                    error === "empty"
                      ? t("imageExportDialog.preset.error.emptyName")
                      : t("imageExportDialog.preset.error.duplicateName"),
                  );
                  return;
                }
                actionManager.executeAction(actionRenameExportPreset, "ui", {
                  id: selectedPreset.id,
                  name: presetName,
                });
              }}
            />
            <FilledButton
              variant="outlined"
              color="danger"
              label={t("imageExportDialog.preset.delete")}
              disabled={!selectedPreset}
              onClick={() => {
                if (selectedPreset) {
                  actionManager.executeAction(actionDeleteExportPreset, "ui", {
                    id: selectedPreset.id,
                  });
                  setSelectedPresetId("");
                  setPresetName("");
                }
              }}
            />
          </div>
        </div>
        {hasSelection && (
          <ExportSetting
            label={t("imageExportDialog.label.onlySelected")}
            name="exportOnlySelected"
          >
            <Switch
              name="exportOnlySelected"
              checked={exportSelectionOnly}
              onChange={(checked) => {
                setExportSelectionOnly(checked);
              }}
            />
          </ExportSetting>
        )}
        <ExportSetting
          label={t("imageExportDialog.label.withBackground")}
          name="exportBackgroundSwitch"
        >
          <Switch
            name="exportBackgroundSwitch"
            checked={exportBackground}
            onChange={(checked) => {
              actionManager.executeAction(
                actionChangeExportBackground,
                "ui",
                checked,
              );
            }}
          />
        </ExportSetting>
        <ExportSetting
          label={t("imageExportDialog.label.darkMode")}
          name="exportDarkModeSwitch"
        >
          <Switch
            name="exportDarkModeSwitch"
            checked={exportWithDarkMode}
            onChange={(checked) => {
              actionManager.executeAction(
                actionExportWithDarkMode,
                "ui",
                checked,
              );
            }}
          />
        </ExportSetting>
        <ExportSetting
          label={t("imageExportDialog.label.embedScene")}
          tooltip={t("imageExportDialog.tooltip.embedScene")}
          name="exportEmbedSwitch"
        >
          <Switch
            name="exportEmbedSwitch"
            checked={exportEmbedScene}
            onChange={(checked) => {
              actionManager.executeAction(
                actionChangeExportEmbedScene,
                "ui",
                checked,
              );
            }}
          />
        </ExportSetting>
        <ExportSetting
          label={t("imageExportDialog.label.scale")}
          name="exportScale"
        >
          <RadioGroup
            name="exportScale"
            value={exportScale}
            onChange={(scale) => {
              actionManager.executeAction(actionChangeExportScale, "ui", scale);
            }}
            choices={EXPORT_SCALES.map((scale) => ({
              value: scale,
              label: `${scale}\u00d7`,
            }))}
          />
        </ExportSetting>

        <div className="ImageExportModal__settings__buttons">
          <FilledButton
            className="ImageExportModal__settings__buttons__button"
            label={t("imageExportDialog.title.exportToPng")}
            onClick={() =>
              onExportImage(EXPORT_IMAGE_TYPES.png, exportedElements, {
                exportingFrame,
              })
            }
            icon={downloadIcon}
          >
            {t("imageExportDialog.button.exportToPng")}
          </FilledButton>
          <FilledButton
            className="ImageExportModal__settings__buttons__button"
            label={t("imageExportDialog.title.exportToSvg")}
            onClick={() =>
              onExportImage(EXPORT_IMAGE_TYPES.svg, exportedElements, {
                exportingFrame,
              })
            }
            icon={downloadIcon}
          >
            {t("imageExportDialog.button.exportToSvg")}
          </FilledButton>
          {(probablySupportsClipboardBlob || isFirefox) && (
            <FilledButton
              className="ImageExportModal__settings__buttons__button"
              label={t("imageExportDialog.title.copyPngToClipboard")}
              status={copyStatus}
              onClick={async () => {
                await onExportImage(
                  EXPORT_IMAGE_TYPES.clipboard,
                  exportedElements,
                  {
                    exportingFrame,
                  },
                );
                onCopy();
              }}
              icon={copyIcon}
            >
              {t("imageExportDialog.button.copyPngToClipboard")}
            </FilledButton>
          )}
        </div>
      </div>
    </div>
  );
};

type ExportSettingProps = {
  label: string;
  children: React.ReactNode;
  tooltip?: string;
  name?: string;
};

const ExportSetting = ({
  label,
  children,
  tooltip,
  name,
}: ExportSettingProps) => {
  return (
    <div className="ImageExportModal__settings__setting" title={label}>
      <label
        htmlFor={name}
        className="ImageExportModal__settings__setting__label"
      >
        {label}
        {tooltip && (
          <Tooltip label={tooltip} long={true}>
            {helpIcon}
          </Tooltip>
        )}
      </label>
      <div className="ImageExportModal__settings__setting__content">
        {children}
      </div>
    </div>
  );
};

export const ImageExportDialog = ({
  elements,
  appState,
  files,
  actionManager,
  onExportImage,
  onCloseRequest,
  name,
}: {
  appState: UIAppState;
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
  onCloseRequest: () => void;
  name: string;
}) => {
  // we need to take a snapshot so that the exported state can't be modified
  // while the dialog is open
  const [{ appStateSnapshot, elementsSnapshot }] = useState(() => {
    return {
      appStateSnapshot: cloneJSON(appState),
      elementsSnapshot: cloneJSON(elements),
    };
  });

  return (
    <Dialog onCloseRequest={onCloseRequest} size="wide" title={false}>
      <ImageExportModal
        elementsSnapshot={elementsSnapshot}
        appStateSnapshot={appStateSnapshot}
        appState={appState}
        files={files}
        actionManager={actionManager}
        onExportImage={onExportImage}
        name={name}
      />
    </Dialog>
  );
};
