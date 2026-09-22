export type ImageTransform = { scale: number; x: number; y: number };

export function fitImage(width: number, height: number, viewportWidth: number, viewportHeight: number) {
  if (!(width > 0 && height > 0)) return { width: viewportWidth, height: viewportHeight };
  const ratio = Math.min(viewportWidth / width, viewportHeight / height);
  return { width: width * ratio, height: height * ratio };
}

export function constrainTransform(scale: number, x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number): ImageTransform {
  "worklet";
  const boundedScale = Math.min(4, Math.max(1, scale));
  const maxX = Math.max(0, (width * boundedScale - viewportWidth) / 2);
  const maxY = Math.max(0, (height * boundedScale - viewportHeight) / 2);
  return { scale: boundedScale, x: maxX === 0 ? 0 : Math.max(-maxX, Math.min(maxX, x)), y: maxY === 0 ? 0 : Math.max(-maxY, Math.min(maxY, y)) };
}

export function zoomAroundPoint(scale: number, x: number, y: number, nextScale: number, startX: number, startY: number, focalX: number, focalY: number): ImageTransform {
  "worklet";
  const boundedScale = Math.min(4, Math.max(1, nextScale));
  const ratio = boundedScale / scale;
  return { scale: boundedScale, x: focalX - (startX - x) * ratio, y: focalY - (startY - y) * ratio };
}

export function imagePageAfterSwipe(index: number, count: number, scale: number, dx: number, dy: number): number {
  "worklet";
  if (scale > 1.01 || Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy) * 1.5) return index;
  return Math.max(0, Math.min(count - 1, index + (dx < 0 ? 1 : -1)));
}
