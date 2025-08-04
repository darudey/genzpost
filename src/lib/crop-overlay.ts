
import { fabric } from 'fabric';

export function createCropOverlay(
  canvas: fabric.Canvas,
  frame: fabric.Rect   // the visible white stroke
) {
  const { left, top, width, height } = frame.getBoundingRect(true);

  // dark backdrop
  const overlay = new fabric.Rect({
    left: 0,
    top: 0,
    width: canvas.width!,
    height: canvas.height!,
    fill: 'rgba(0,0,0,.55)',
    selectable: false,
    evented: false,
  });

  // “hole” that lets the image shine through
  const clip = new fabric.Rect({
    left,
    top,
    width,
    height,
    absolutePositioned: true,
  });
  
  // A slight issue with clipPath is that it's relative to the object's center.
  // We need to invert the transformation of the overlay to make the clip path's coordinates absolute.
  const invertedMatrix = fabric.util.invertTransform(overlay.calcTransformMatrix());
  const transformedPoint = fabric.util.transformPoint({x: clip.left!, y: clip.top!} as fabric.Point, invertedMatrix);

  const clipRect = new fabric.Rect({
      left: transformedPoint.x,
      top: transformedPoint.y,
      width: clip.width,
      height: clip.height,
  });
  
  overlay.clipPath = clipRect;

  return { overlay };
}

    