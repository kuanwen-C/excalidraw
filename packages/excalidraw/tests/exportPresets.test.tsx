import { queryByTestId, within } from "@testing-library/react";

import { actionExportWithDarkMode } from "../actions/actionExport";
import { Excalidraw } from "../index";

import { act, fireEvent, render, toggleMenu, waitFor } from "./test-utils";

const { h } = window;

describe("named export presets", () => {
  it("creates, renames, applies, and deletes a preset from the export dialog", async () => {
    const { container } = await render(<Excalidraw />);
    toggleMenu(container);
    fireEvent.click(queryByTestId(container, "image-export-button")!);

    const presetControls = within(
      document.querySelector(".ImageExportModal__preset")!,
    );
    const nameInput = presetControls.getByPlaceholderText("Preset name");

    act(() => {
      h.setState({
        exportBackground: false,
        exportScale: 2,
        exportEmbedScene: true,
      });
    });
    act(() => {
      h.app.actionManager.executeAction(actionExportWithDarkMode, "ui", true);
    });
    await waitFor(() => {
      expect(h.state).toMatchObject({
        exportBackground: false,
        exportWithDarkMode: true,
        exportScale: 2,
        exportEmbedScene: true,
      });
    });

    fireEvent.change(nameInput, { target: { value: "Slides" } });
    fireEvent.click(presetControls.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(h.state.exportPresets).toHaveLength(1);
    });
    expect(h.state.exportPresets[0]).toMatchObject({
      name: "Slides",
      preferences: {
        exportBackground: false,
        exportWithDarkMode: true,
        exportScale: 2,
        exportEmbedScene: true,
      },
    });

    const presetId = h.state.exportPresets[0].id;
    fireEvent.change(presetControls.getByRole("combobox"), {
      target: { value: presetId },
    });
    fireEvent.change(nameInput, { target: { value: "Documentation" } });
    fireEvent.click(presetControls.getByRole("button", { name: "Rename" }));

    await waitFor(() => {
      expect(h.state.exportPresets[0].name).toBe("Documentation");
    });

    act(() => {
      h.setState({
        exportBackground: true,
        exportScale: 1,
        exportEmbedScene: false,
      });
    });
    act(() => {
      h.app.actionManager.executeAction(actionExportWithDarkMode, "ui", false);
    });
    fireEvent.click(presetControls.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(h.state).toMatchObject({
        exportBackground: false,
        exportWithDarkMode: true,
        exportScale: 2,
        exportEmbedScene: true,
      });
    });

    fireEvent.click(presetControls.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(h.state.exportPresets).toEqual([]);
    });
  });

  it("shows a validation error for duplicate names", async () => {
    const { container } = await render(<Excalidraw />);
    toggleMenu(container);
    fireEvent.click(queryByTestId(container, "image-export-button")!);

    const presetControls = within(
      document.querySelector(".ImageExportModal__preset")!,
    );
    const nameInput = presetControls.getByPlaceholderText("Preset name");

    fireEvent.change(nameInput, { target: { value: "Slides" } });
    fireEvent.click(presetControls.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.state.exportPresets).toHaveLength(1));

    fireEvent.change(nameInput, { target: { value: " slides " } });
    fireEvent.click(presetControls.getByRole("button", { name: "Save" }));

    expect(presetControls.getByRole("alert")).toHaveTextContent(
      "A preset with this name already exists.",
    );
    expect(h.state.exportPresets).toHaveLength(1);
  });
});
