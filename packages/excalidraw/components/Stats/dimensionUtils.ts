type DimensionCalculationInput = {
  originalWidth: number;
  originalHeight: number;
  property: "width" | "height";
  requestedValue: number;
  keepAspectRatio: boolean;
  minimumSize: number;
};

/** Calculates Stats dimensions without applying element or content constraints. */
export const calculateDimensions = ({
  originalWidth,
  originalHeight,
  property,
  requestedValue,
  keepAspectRatio,
  minimumSize,
}: DimensionCalculationInput): { width: number; height: number } | null => {
  if (
    ![originalWidth, originalHeight, requestedValue, minimumSize].every(
      Number.isFinite,
    ) ||
    originalWidth < 0 ||
    originalHeight < 0 ||
    minimumSize < 0
  ) {
    return null;
  }

  let width: number;
  let height: number;

  // A zero original dimension has no usable aspect ratio.
  if (keepAspectRatio && originalWidth > 0 && originalHeight > 0) {
    const originalEditedDimension =
      property === "width" ? originalWidth : originalHeight;
    const scale = Math.max(
      requestedValue / originalEditedDimension,
      minimumSize / originalWidth,
      minimumSize / originalHeight,
    );
    width = originalWidth * scale;
    height = originalHeight * scale;
  } else {
    width = Math.max(
      property === "width" ? requestedValue : originalWidth,
      minimumSize,
    );
    height = Math.max(
      property === "height" ? requestedValue : originalHeight,
      minimumSize,
    );
  }

  return Number.isFinite(width) && Number.isFinite(height)
    ? { width, height }
    : null;
};

/**
 * Group-only minimum exception: an originally zero canvas axis stays zero.
 * The positive axis still obeys the minimum, in either lock state. Creating
 * extent on a zero axis (or resizing a point-sized group) needs new geometry
 * and is unsupported. Single-element callers keep calculateDimensions().
 */
export const calculateGroupDimensions = (
  input: DimensionCalculationInput,
): { width: number; height: number } | null => {
  const dimensions = calculateDimensions(input);
  if (!dimensions) {
    return null;
  }
  const { originalWidth, originalHeight, property, requestedValue } = input;
  if (originalWidth > 0 && originalHeight > 0) {
    return dimensions;
  }
  if (
    (originalWidth === 0 && originalHeight === 0) ||
    ((property === "width" ? originalWidth : originalHeight) === 0 &&
      requestedValue > 0)
  ) {
    return null;
  }
  return {
    width: originalWidth === 0 ? 0 : dimensions.width,
    height: originalHeight === 0 ? 0 : dimensions.height,
  };
};
