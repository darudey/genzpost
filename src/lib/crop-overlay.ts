
import { fabric } from 'fabric';

export function createCropOverlay(
  canvas: fabric.Canvas,
  frame: fabric.Rect
) {
  // Get the frame's absolute bounding rectangle
  const frameRect = frame.getBoundingRect(true);
  
  const vpt = canvas.viewportTransform;
  if (!vpt) {
    // Should not happen, but as a safeguard
    return { overlay: new fabric.Rect() };
  }

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

  // Calculate the position and dimensions of the "hole" by inverting the viewport transform.
  // This ensures the clip path aligns with the frame, regardless of canvas zoom or pan.
  const clipRect = new fabric.Rect({
    left: frameRect.left,
    top: frameRect.top,
    width: frameRect.width,
    height: frameRect.height,
    absolutePositioned: true, // This is key for clipPath to respect absolute coords.
  });

  overlay.clipPath = clipRect;

  return { overlay };
}
