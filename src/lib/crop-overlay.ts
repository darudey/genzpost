
import { fabric } from 'fabric';

export function createCropOverlay(
  canvas: fabric.Canvas,
  frame: fabric.Rect
) {
  const vpt = canvas.viewportTransform;
  if (!vpt) return { overlay: new fabric.Rect() };

  // The dark backdrop, covering the entire canvas
  const overlay = new fabric.Rect({
    left: 0,
    top: 0,
    width: canvas.width!,
    height: canvas.height!,
    fill: 'rgba(0,0,0,.55)',
    selectable: false,
    evented: false,
  });

  // Get the absolute bounding rectangle of the frame
  const frameRect = frame.getBoundingRect(true);

  // Create the "hole" for the clip path.
  // It's crucial to set absolutePositioned: true so that the clip path
  // is not affected by the overlay's own transformations.
  const clipRect = new fabric.Rect({
    left: frameRect.left,
    top: frameRect.top,
    width: frameRect.width,
    height: frameRect.height,
    absolutePositioned: true,
  });

  overlay.clipPath = clipRect;

  return { overlay };
}
