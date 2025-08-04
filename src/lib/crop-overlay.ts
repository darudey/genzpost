import { fabric } from 'fabric';

export function createCropOverlay(canvas: fabric.Canvas, frame: fabric.Rect) {
  // 1. Full-canvas backdrop
  const overlay = new fabric.Rect({
    left: 0,
    top: 0,
    width: canvas.width!,
    height: canvas.height!,
    fill: 'rgba(0,0,0,.55)',
    selectable: false,
    evented: false,
  });

  // 2. Hole = exact frame shape (handles rotation, scale, skew)
  const clipRect = new fabric.Rect({
    left: frame.left,
    top: frame.top,
    width: frame.width! * frame.scaleX!,
    height: frame.height! * frame.scaleY!,
    angle: frame.angle ?? 0,
    skewX: frame.skewX ?? 0,
    skewY: frame.skewY ?? 0,
    absolutePositioned: true,
  });
  overlay.clipPath = clipRect;

  return { overlay };
}

// ----------------------------------------------
// confirmCrop.ts  (use in your finish/done button)
// ----------------------------------------------
export function confirmCrop(
  group: fabric.Group,
  image: fabric.Image,
  canvas: fabric.Canvas
) {
  const frame = group.getObjects('rect')[0] as fabric.Rect;

  // 1. Compute scale to *fill* the frame (never crop)
  const fx = frame.width! * frame.scaleX!;
  const fy = frame.height! * frame.scaleY!;
  const scale = Math.max(fx / image.width!, fy / image.height!);

  // 2. Center inside the frame
  image.set({
    scaleX: scale,
    scaleY: scale,
    left: (fx - image.width! * scale) / 2,
    top:  (fy - image.height! * scale) / 2,
    angle: 0,              // reset any user rotation
    selectable: false,
    evented: false,
  });

  // 3. Re-lock the group
  group.addWithUpdate();
  canvas.renderAll();
}
