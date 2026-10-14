const compressibleTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function compressImageFile(file, {
  maxSizeBytes,
  maxDimension = 1800,
  quality = 0.82,
  cropAspectRatio,
  cropFocusX = 50,
  cropFocusY = 50,
} = {}) {
  if (maxSizeBytes && file.size > maxSizeBytes) {
    const limitMb = Math.ceil(maxSizeBytes / (1024 * 1024));
    throw new Error(`${file.name} exceeds the ${limitMb} MB upload limit.`);
  }
  if (!compressibleTypes.has(file.type)) return file;

  const bitmap = await createImageBitmap(file);
  try {
    const requestedAspect = Number(cropAspectRatio);
    const shouldCrop = Number.isFinite(requestedAspect) && requestedAspect > 0;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = bitmap.width;
    let sourceHeight = bitmap.height;
    if (shouldCrop) {
      const sourceAspect = bitmap.width / bitmap.height;
      const focusX = Math.min(100, Math.max(0, Number(cropFocusX) || 0)) / 100;
      const focusY = Math.min(100, Math.max(0, Number(cropFocusY) || 0)) / 100;
      if (sourceAspect > requestedAspect) {
        sourceWidth = bitmap.height * requestedAspect;
        sourceX = (bitmap.width - sourceWidth) * focusX;
      } else {
        sourceHeight = bitmap.width / requestedAspect;
        sourceY = (bitmap.height - sourceHeight) * focusY;
      }
    }
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the selected image.");
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("The selected image could not be compressed."));
      }, "image/webp", quality);
    });
    if (!shouldCrop && blob.size >= file.size && scale === 1) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
