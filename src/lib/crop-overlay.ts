import { fabric } from 'fabric';

export function createCropOverlay(canvas: fabric.Canvas, frame: fabric.Rect) {
  // 1. Full-screen backdrop
  const overlay = new fabric.Rect({
    left: 0,
    top: 0,
    width: canvas.width!,
    height: canvas.height!,
    fill: 'rgba(0,0,0,.55)',
    selectable: false,
    evented: false,
  });

  // 2. Re-use the frame’s geometry for the hole
  //    Fabric’s clipPath is applied *before* transforms, so
  //    we simply clone the frame (absolutePositioned true).
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

  return { overlay, clipRect };
}
