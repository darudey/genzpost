
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChangeEvent } from "react";
import { fabric } from 'fabric';
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MousePointer,
  ImageUp,
  Palette,
  Trash2,
  Download,
  Loader2,
  SendToBack,
  BringToFront,
  LayoutTemplate,
  PlusSquare,
  RectangleHorizontal,
  Settings,
  Crop,
} from "lucide-react";
import { detectLayoutStructure } from "@/ai/flows/detect-layout-structure";
import { useToast } from "@/hooks/use-toast";

type CanvasSize = { width: number; height: number };
type CanvasSizeMap = Record<string, CanvasSize>;
type CanvasSizeKey = keyof CanvasSizeMap;

const INITIAL_CANVAS_SIZES: CanvasSizeMap = {
    "400x600": { width: 400, height: 600 },
};

export function LayoutCanvasClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [canvasBgColor, setCanvasBgColor] = useState("#F8F8FF");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [canvasSizes, setCanvasSizes] = useState<CanvasSizeMap>(INITIAL_CANVAS_SIZES);
  const [currentSizeKey, setCurrentSizeKey] = useState<CanvasSizeKey>("400x600");
  const [isEditSizesOpen, setIsEditSizesOpen] = useState(false);
  const [isSizePopoverOpen, setIsSizePopoverOpen] = useState(false);
  const [tempSizes, setTempSizes] = useState(canvasSizes);
  const [newSize, setNewSize] = useState({ width: "", height: "" });
  
  const canvasSize = canvasSizes[currentSizeKey];

  const initCanvas = useCallback(() => {
    // Custom Crop control
    const cropIcon = new Image();
    cropIcon.src = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-crop'%3E%3Cpath d='M6 2v14a2 2 0 0 0 2 2h14'/%3E%3Cpath d='M18 22V8a2 2 0 0 0-2-2H2'/%3E%3C/svg%3E";

    const renderCropIcon = (ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: fabric.Object) => {
        ctx.save();
        ctx.translate(left, top);
        ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle || 0));
        ctx.drawImage(cropIcon, -12, -12, 24, 24);
        ctx.restore();
    };

    const startCropping = (eventData: MouseEvent, transform: fabric.Transform) => {
        const target = transform.target as fabric.Group;
        const canvas = fabricCanvasRef.current;
        if (!canvas || !target || !target.data?.isCropGroup) return false;
  
        // Hide all other objects and controls
        canvas.getObjects().forEach(obj => {
            if (obj !== target) {
                obj.set({ visible: false });
            }
        });
        target.set({ controls: {} }); // Hide default controls
  
        // Create semi-transparent overlay
        const overlay = new fabric.Rect({
            left: 0,
            top: 0,
            width: canvas.width!,
            height: canvas.height!,
            fill: 'rgba(0,0,0,0.7)',
            selectable: false,
            evented: false,
            data: { isCropOverlay: true }
        });
        canvas.add(overlay);
        overlay.sendToBack();
        target.bringToFront();
  
  
        const image = target.getObjects('image')[0] as fabric.Image;
  
        // Clone image to show original state
        const originalImageState = {
          left: image.left,
          top: image.top,
          scaleX: image.scaleX,
          scaleY: image.scaleY,
        };
  
        image.set({
            selectable: true,
            evented: true,
            lockMovementX: false,
            lockMovementY: false,
            lockScalingX: false,
            lockScalingY: false,
            lockRotation: false,
            hasControls: true,
        });
  
        canvas.setActiveObject(image);
  
        const cleanupAndRestore = (restoreState: boolean) => {
            if (restoreState) {
                image.set(originalImageState);
                image.setCoords();
            }
            // Re-lock image
            image.set({ selectable: false, evented: false });
            target.setCoords(); // Update group coordinates
    
            // Cleanup
            canvas.remove(overlay);
            canvas.getObjects().forEach(obj => obj.set({ visible: true }));
            canvas.discardActiveObject();
            canvas.setActiveObject(target);
            target.controls.cropControl.visible = true;
            canvas.renderAll();
            window.removeEventListener('keydown', keydownHandler);
        };
        
        const commitCrop = () => cleanupAndRestore(false);
        const cancelCrop = () => cleanupAndRestore(true);
  
        const keydownHandler = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                commitCrop();
            } else if (e.key === 'Escape') {
                cancelCrop();
            }
        };
        
        window.addEventListener('keydown', keydownHandler);
  
        // Add Commit/Cancel buttons
        const checkIcon = new Image();
        checkIcon.src = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-check'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E";
        const xIcon = new Image();
        xIcon.src = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-x'%3E%3Cpath d='M18 6 6 18'/%3E%3Cpath d='m6 6 12 12'/%3E%3C/svg%3E";
        
        const commitBtn = new fabric.Control({
            x: 0.5,
            y: 0.5,
            offsetX: 30,
            offsetY: 30,
            cursorStyle: 'pointer',
            mouseUpHandler: commitCrop,
            render: (ctx, left, top) => {
                ctx.save();
                ctx.translate(left, top);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(-15, -15, 30, 30);
                ctx.drawImage(checkIcon, -12, -12, 24, 24);
                ctx.restore();
            },
        });
  
        const cancelBtn = new fabric.Control({
            x: -0.5,
            y: 0.5,
            offsetX: -30,
            offsetY: 30,
            cursorStyle: 'pointer',
            mouseUpHandler: cancelCrop,
            render: (ctx, left, top) => {
                ctx.save();
                ctx.translate(left, top);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(-15, -15, 30, 30);
                ctx.drawImage(xIcon, -12, -12, 24, 24);
                ctx.restore();
            },
        });
  
        image.controls = {
            ...fabric.Image.prototype.controls,
            commit: commitBtn,
            cancel: cancelBtn
        };
  
        canvas.renderAll();
        return true;
    };
    
    fabric.Object.prototype.controls.cropControl = new fabric.Control({
        x: 0,
        y: -0.5,
        offsetY: -32,
        cursorStyle: 'pointer',
        mouseUpHandler: startCropping,
        render: renderCropIcon,
    });


    const canvas = new fabric.Canvas(canvasRef.current, {
        width: canvasSize.width,
        height: canvasSize.height,
        backgroundColor: canvasBgColor,
        selection: true,
        controlsAboveOverlay: true,
    });
    fabricCanvasRef.current = canvas;

    const updateControlsVisibility = (target?: fabric.Object) => {
      if (target && target.data?.isCropGroup) {
        target.controls.cropControl.visible = true;
      }
    };
    
    canvas.on('selection:created', (e) => updateControlsVisibility(e.target));
    canvas.on('selection:updated', (e) => updateControlsVisibility(e.target));
    
    return canvas;
  }, [canvasSize.width, canvasSize.height, canvasBgColor]);

  const fitCanvasToContainer = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const container = canvasWrapperRef.current;

    if (canvas && container) {
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;

      const scaleX = containerWidth / canvas.width!;
      const scaleY = containerHeight / canvas.height!;
      const scale = Math.min(scaleX, scaleY) * 0.9;

      canvas.setZoom(scale);
      canvas.setWidth(canvas.width! * canvas.getZoom());
      canvas.setHeight(canvas.height! * canvas.getZoom());

      const vpt = canvas.viewportTransform;
      if (vpt) {
        vpt[4] = (containerWidth - canvas.getWidth()) / 2;
        vpt[5] = (containerHeight - canvas.getHeight()) / 2;
      }
      
      canvas.renderAll();
    }
  }, []);

  useEffect(() => {
    let canvas: fabric.Canvas;
    if (!fabricCanvasRef.current) {
        canvas = initCanvas();
    } else {
        canvas = fabricCanvasRef.current;
        canvas.setDimensions({ width: canvasSize.width, height: canvasSize.height });
        canvas.backgroundColor = canvasBgColor;
        canvas.renderAll();
    }

    const resizeObserver = new ResizeObserver(fitCanvasToContainer);
    
    const currentCanvasWrapper = canvasWrapperRef.current;
    if (currentCanvasWrapper) {
        resizeObserver.observe(currentCanvasWrapper);
    }
    
    fitCanvasToContainer();
    
    return () => {
      if (currentCanvasWrapper) {
        resizeObserver.disconnect();
      }
    }
  }, [initCanvas, fitCanvasToContainer, canvasSize, canvasBgColor]);


  const handleTemplateFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setIsAiProcessing(true);
      try {
        toast({ title: "🤖 AI is detecting layout...", description: "This might take a moment." });
        const result = await detectLayoutStructure({ imageDataUri: dataUrl });

        if (!result.boxes || result.boxes.length === 0) {
          toast({ title: "No layout detected", description: "Couldn't find any boxes in the image.", variant: "destructive" });
          return;
        }
        
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        
        const detectedBoxes = result.boxes;
        const outerBoxX1 = Math.min(...detectedBoxes.map(b => b.x));
        const outerBoxY1 = Math.min(...detectedBoxes.map(b => b.y));
        const outerBoxX2 = Math.max(...detectedBoxes.map(b => b.x + b.width));
        const outerBoxY2 = Math.max(...detectedBoxes.map(b => b.y + b.height));
        const outerBox = { x: outerBoxX1, y: outerBoxY1, width: outerBoxX2 - outerBoxX1, height: outerBoxY2 - outerBoxY1 };

        const canvasLogicalWidth = canvas.width!;
        const canvasLogicalHeight = canvas.height!;
        const scaleX = canvasLogicalWidth / outerBox.width;
        const scaleY = canvasLogicalHeight / outerBox.height;
        const scaleFactor = Math.min(scaleX, scaleY) * 0.9;
        const scaledLayoutWidth = outerBox.width * scaleFactor;
        const scaledLayoutHeight = outerBox.height * scaleFactor;
        const finalOffsetX = (canvasLogicalWidth - scaledLayoutWidth) / 2;
        const finalOffsetY = (canvasLogicalHeight - scaledLayoutHeight) / 2;

        detectedBoxes.forEach(box => {
          const frameWidth = Math.round(box.width * scaleFactor);
          const frameHeight = Math.round(box.height * scaleFactor);
          const frameLeft = (box.x - outerBox.x) * scaleFactor + finalOffsetX;
          const frameTop = (box.y - outerBox.y) * scaleFactor + finalOffsetY;
          addBox(frameLeft, frameTop, frameWidth, frameHeight);
        });

        toast({ title: "✅ AI layout detection complete!", description: `Found ${detectedBoxes.length} boxes.`, variant: "default" });

      } catch(err) {
        console.error("AI layout detection failed", err);
        toast({ title: "AI layout detection failed", description: "Please try another image.", variant: "destructive" });
      } finally {
        setIsAiProcessing(false);
      }
    };
    e.target.value = "";
  };


  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (!activeObject || !activeObject.data?.isCropGroup) {
      toast({ title: "No box selected", description: "Please select a box before uploading an image.", variant: "destructive"});
      return;
    };
    const group = activeObject as fabric.Group;
    const seen_frame = group.getObjects('rect')[0] as fabric.Rect;

    const file = e.target.files[0];
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const dataUrl = reader.result as string;
        
        fabric.Image.fromURL(dataUrl, (img) => {
            const oldUnseenFrame = group.getObjects('image')[0];
            if (oldUnseenFrame) {
                group.remove(oldUnseenFrame);
            }

            img.set({
              name: 'image',
              originX: 'center',
              originY: 'center',
              selectable: false,
              evented: false,
            });
            
            const frameWidth = seen_frame.width!;
            const frameHeight = seen_frame.height!;

            const scale = Math.max(frameWidth / img.width!, frameHeight / img.height!);
            img.scale(scale);

            group.addWithUpdate(img);
            img.sendToBack();
            
            canvas.requestRenderAll();
        }, { crossOrigin: 'anonymous' });
    };
    e.target.value = "";
  };
  
  const addBox = (left?: number, top?: number, width?: number, height?: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const rectWidth = width || 200;
    const rectHeight = height || 200;
    const rectLeft = left || (canvas.width! - rectWidth) / 2;
    const rectTop = top || (canvas.height! - rectHeight) / 2;

    const seen_frame = new fabric.Rect({
        name: 'rect',
        width: rectWidth,
        height: rectHeight,
        fill: 'transparent',
        stroke: '#ccc',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
    });

    fabric.Image.fromURL(`https://placehold.co/${Math.round(rectWidth)}x${Math.round(rectHeight)}.png`, (img) => {
        img.set({
            name: 'image',
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
        });
        
        const scale = Math.max(rectWidth / img.width!, rectHeight / img.height!);
        img.scale(scale);
        
        const group = new fabric.Group([seen_frame, img], {
            left: rectLeft,
            top: rectTop,
            selectable: true,
            evented: true,
            clipPath: seen_frame,
            data: { isCropGroup: true },
            controls: { ...fabric.Group.prototype.controls, cropControl: new fabric.Control({visible: false}) }
        });

        canvas.add(group);
        canvas.setActiveObject(group);
        canvas.renderAll();
    }, { crossOrigin: 'anonymous' });
  };
  
  const deleteActiveBox = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if(activeObject) {
        canvas.remove(activeObject);
        canvas.discardActiveObject();
        canvas.renderAll();
    }
  };

  const changeZIndex = (direction: 'front' | 'back') => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if(activeObject) {
        if(direction === 'front') {
            canvas.bringToFront(activeObject);
        } else {
            canvas.sendToBack(activeObject);
        }
        canvas.discardActiveObject();
        canvas.renderAll();
    }
  }

  const exportImage = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    // Ensure we are not in a cropping state
    const overlay = canvas.getObjects().find(o => o.data?.isCropOverlay);
    if(overlay) {
        toast({ title: "Please finish cropping first", variant: "destructive" });
        return;
    }
    
    canvas.discardActiveObject();
    canvas.renderAll();
    
    const dataUrl = canvas.toDataURL({ format: 'png', quality: 1.0 });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "layout-canvas.png";
    link.click();
  };

  const handleAddNewSize = () => {
    const width = parseInt(newSize.width);
    const height = parseInt(newSize.height);
    if (width > 0 && height > 0) {
      const key = `${width}x${height}`;
      if (!tempSizes[key]) {
        setTempSizes(prev => ({ ...prev, [key]: { width, height } }));
        setNewSize({ width: "", height: "" });
      } else {
        toast({ title: "Size already exists", variant: "destructive" });
      }
    } else {
      toast({ title: "Invalid dimensions", description: "Width and height must be positive numbers.", variant: "destructive" });
    }
  };

  const handleDeleteSize = (keyToDelete: string) => {
    if (Object.keys(tempSizes).length <= 1) {
      toast({ title: "Cannot delete last size", description: "You must have at least one canvas size.", variant: "destructive" });
      return;
    }
    const newSizes = { ...tempSizes };
    delete newSizes[keyToDelete];
    setTempSizes(newSizes);
  };

  const handleSaveSizes = () => {
    setCanvasSizes(tempSizes);
    if (!tempSizes[currentSizeKey]) {
      setCurrentSizeKey(Object.keys(tempSizes)[0] as CanvasSizeKey);
    }
    setIsEditSizesOpen(false);
  };
  
  return (
    <div className="flex flex-col h-full bg-gray-800 text-foreground font-body">
      <div className="flex flex-col flex-1 overflow-hidden">
        <main ref={canvasWrapperRef} className="flex-1 p-4 bg-muted/40 flex items-center justify-center relative">
            <canvas ref={canvasRef} className="shadow-2xl" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)'}} />
        </main>
        <TooltipProvider>
          <aside className="p-2 border-t bg-background">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex justify-center items-center space-x-2 pb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size="icon">
                      <MousePointer />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>Select / Move (V)</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isAiProcessing} onClick={() => templateInputRef.current?.click()}>
                            {isAiProcessing ? <Loader2 className="animate-spin" /> : <LayoutTemplate />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Detect Layout from Image</p></TooltipContent>
                </Tooltip>
                <input ref={templateInputRef} type="file" className="hidden" accept="image/*" onChange={handleTemplateFileChange} />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => addBox()}>
                            <PlusSquare />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Add Box</p></TooltipContent>
                </Tooltip>
                
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Crop />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Crop Image</p></TooltipContent>
                </Tooltip>

                <div className="flex-grow" />
                
                <Popover open={isSizePopoverOpen} onOpenChange={setIsSizePopoverOpen}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <RectangleHorizontal />
                                </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p>Canvas Size</p></TooltipContent>
                    </Tooltip>
                    <PopoverContent className="w-auto p-4">
                        <div className="grid gap-2">
                            <p className="text-sm font-medium text-center">Select your canvas size</p>
                            <div className="flex items-center gap-2">
                                <Select
                                    value={currentSizeKey}
                                    onValueChange={(value: CanvasSizeKey) => {
                                      setCurrentSizeKey(value);
                                      setIsSizePopoverOpen(false);
                                    }}
                                >
                                    <SelectTrigger className="w-[120px]">
                                    <SelectValue placeholder="Canvas size" />
                                    </SelectTrigger>
                                    <SelectContent>
                                    {Object.keys(canvasSizes).map(key => (
                                        <SelectItem key={key} value={key}>{key}</SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => {
                                            setTempSizes(canvasSizes);
                                            setIsEditSizesOpen(true);
                                        }}>
                                            <Settings className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Edit Sizes</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => colorInputRef.current?.click()}>
                            <Palette />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Canvas Background</p></TooltipContent>
                </Tooltip>
                <input ref={colorInputRef} type="color" className="hidden" value={canvasBgColor} onChange={(e) => setCanvasBgColor(e.target.value)} />
                
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isAiProcessing} onClick={() => imageInputRef.current?.click()}>
                            {isAiProcessing ? <Loader2 className="animate-spin" /> : <ImageUp />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Upload Image to Box</p></TooltipContent>
                </Tooltip>
                <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />

                <Tooltip>
                  <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => changeZIndex('front')}>
                          <BringToFront />
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>Bring to Front</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => changeZIndex('back')}>
                            <SendToBack />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Send to Back</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={deleteActiveBox}>
                            <Trash2 />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Delete Box</p></TooltipContent>
                </Tooltip>
                
                <div className="border-l h-8 mx-2" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={exportImage}>
                            <Download />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Export as PNG</p></TooltipContent>
                </Tooltip>
              </div>
              <ScrollBar orientation="horizontal" className="hidden" />
            </ScrollArea>
          </aside>
        </TooltipProvider>
      </div>

      <Dialog open={isEditSizesOpen} onOpenChange={setIsEditSizesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Canvas Sizes</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2">
              {Object.keys(tempSizes).map(key => (
                <div key={key} className="flex items-center gap-2">
                  <Input readOnly value={key} className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteSize(key)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2 border-t pt-4">
              <div className="grid gap-1.5">
                <Label htmlFor="width">Width</Label>
                <Input id="width" type="number" placeholder="e.g. 1920" value={newSize.width} onChange={e => setNewSize({...newSize, width: e.target.value})} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="height">Height</Label>
                <Input id="height" type="number" placeholder="e.g. 1080" value={newSize.height} onChange={e => setNewSize({...newSize, height: e.target.value})} />
              </div>
              <Button onClick={handleAddNewSize}>Add New Size</Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveSizes}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
