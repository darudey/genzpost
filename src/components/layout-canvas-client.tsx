
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
} from "lucide-react";
import { autoBackgroundFill } from "@/ai/flows/auto-background-fill";
import { detectLayoutStructure } from "@/ai/flows/detect-layout-structure";
import { useToast } from "@/hooks/use-toast";

const INITIAL_CANVAS_SIZES = {
    "1024x768": { width: 1024, height: 768 },
    "1280x720": { width: 1280, height: 720 },
    "1920x1080": { width: 1920, height: 1080 },
    "800x800": { width: 800, height: 800 },
    "400x600": { width: 400, height: 600 },
};

type CanvasSizeKey = keyof typeof INITIAL_CANVAS_SIZES;


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
  const [canvasSizes, setCanvasSizes] = useState(INITIAL_CANVAS_SIZES);
  const [currentSizeKey, setCurrentSizeKey] = useState<string>("1024x768");
  const [isEditSizesOpen, setIsEditSizesOpen] = useState(false);
  const [isSizePopoverOpen, setIsSizePopoverOpen] = useState(false);
  const [tempSizes, setTempSizes] = useState(canvasSizes);
  const [newSize, setNewSize] = useState({ width: "", height: "" });
  
  const canvasSize = canvasSizes[currentSizeKey as CanvasSizeKey];

  const initCanvas = useCallback(() => {
    const canvas = new fabric.Canvas(canvasRef.current, {
        width: canvasSize.width,
        height: canvasSize.height,
        backgroundColor: canvasBgColor,
        selection: true,
        controlsAboveOverlay: true,
    });
    fabricCanvasRef.current = canvas;
    
    canvas.on('mouse:wheel', function(opt) {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.01) zoom = 0.01;
      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    let lastPosX: number, lastPosY: number;
    let isDragging: boolean;
    let touchStartPos: { x: number; y: number } | null = null;
    
    canvas.on('mouse:down', function(opt) {
      const evt = opt.e;
      if (evt.altKey === true) {
        isDragging = true;
        this.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
      touchStartPos = { x: evt.clientX, y: evt.clientY };
    });
    
    canvas.on('mouse:move', function(opt) {
      if (isDragging) {
        const e = opt.e;
        const vpt = this.viewportTransform;
        if (vpt) {
            vpt[4] += e.clientX - lastPosX;
            vpt[5] += e.clientY - lastPosY;
            this.requestRenderAll();
            lastPosX = e.clientX;
            lastPosY = e.clientY;
        }
      }
    });

    canvas.on('mouse:up', function(opt) {
      if (isDragging) {
        this.setViewportTransform(this.viewportTransform);
        isDragging = false;
        this.selection = true;
      }
       if (touchStartPos) {
        const touchEndPos = opt.e;
        const distance = Math.sqrt(
            Math.pow(touchEndPos.clientX - touchStartPos.x, 2) +
            Math.pow(touchEndPos.clientY - touchStartPos.y, 2)
        );

        if (distance < 10) { 
            const target = canvas.findTarget(opt.e, false);
            if (target) {
                canvas.setActiveObject(target);
            } else {
                canvas.discardActiveObject();
            }
            canvas.renderAll();
        }
      }
      touchStartPos = null;
    });

    canvas.on('touch:gesture', function(opt: any) {
        if (opt.e.touches && opt.e.touches.length == 2) {
            isDragging = false; 
            const e = opt.e;
            if (opt.state == 'start') {
                // @ts-ignore
                this.zoomStartScale = this.getZoom();
            }
            // @ts-ignore
            let scale = this.zoomStartScale * opt.scale;
            if (scale > 20) scale = 20;
            if (scale < 0.01) scale = 0.01;
            // @ts-ignore
            this.zoomToPoint({ x: opt.mid.x, y: opt.mid.y }, scale);
        }
    });

    canvas.on('touch:drag', function(opt: any) {
        const e = opt.e;
        if (e.touches && e.touches.length == 1) {
            if (!isDragging) {
                isDragging = true;
                this.selection = false;
                lastPosX = e.touches[0].clientX;
                lastPosY = e.touches[0].clientY;
                if (!touchStartPos) { 
                    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
            } else {
                const vpt = this.viewportTransform;
                if (vpt) {
                    vpt[4] += e.touches[0].clientX - lastPosX;
                    vpt[5] += e.touches[0].clientY - lastPosY;
                    this.requestRenderAll();
                    lastPosX = e.touches[0].clientX;
                    lastPosY = e.touches[0].clientY;
                }
            }
        }
    });

    return canvas;
  }, []);

  const fitCanvasToContainer = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const container = canvasWrapperRef.current;

    if (canvas && container) {
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;

      const scaleX = containerWidth / canvasSize.width;
      const scaleY = containerHeight / canvasSize.height;
      const scale = Math.min(scaleX, scaleY) * 0.9;

      canvas.setWidth(canvasSize.width * scale);
      canvas.setHeight(canvasSize.height * scale);
      canvas.setZoom(scale);
      
      const vpt = canvas.viewportTransform;
      if (vpt) {
        vpt[4] = (containerWidth - (canvasSize.width * scale)) / 2;
        vpt[5] = (containerHeight - (canvasSize.height * scale)) / 2;
      }
      
      canvas.renderAll();
    }
  }, [canvasSize]);


  useEffect(() => {
    const canvas = initCanvas();
    fabricCanvasRef.current = canvas;
    fitCanvasToContainer();
    setIsSizePopoverOpen(true);
    
    window.addEventListener('resize', fitCanvasToContainer);

    return () => {
      window.removeEventListener('resize', fitCanvasToContainer);
      if(fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    }
  }, [initCanvas, fitCanvasToContainer]);
  
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.setDimensions({ width: canvasSize.width, height: canvasSize.height });
      fitCanvasToContainer();
    }
  }, [canvasSize, fitCanvasToContainer]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if(canvas) {
        canvas.backgroundColor = canvasBgColor;
        canvas.renderAll();
    }
  }, [canvasBgColor]);

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

        const detectedBoxes = result.boxes;
        
        const outerBoxX1 = Math.min(...detectedBoxes.map(b => b.x));
        const outerBoxY1 = Math.min(...detectedBoxes.map(b => b.y));
        const outerBoxX2 = Math.max(...detectedBoxes.map(b => b.x + b.width));
        const outerBoxY2 = Math.max(...detectedBoxes.map(b => b.y + b.height));
        
        const outerBox = {
          x: outerBoxX1,
          y: outerBoxY1,
          width: outerBoxX2 - outerBoxX1,
          height: outerBoxY2 - outerBoxY1,
        };

        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const canvasLogicalWidth = canvasSize.width;
        const canvasLogicalHeight = canvasSize.height;

        const scaleX = canvasLogicalWidth / outerBox.width;
        const scaleY = canvasLogicalHeight / outerBox.height;
        const scaleFactor = Math.min(scaleX, scaleY) * 0.9; 

        const scaledLayoutWidth = outerBox.width * scaleFactor;
        const scaledLayoutHeight = outerBox.height * scaleFactor;
        const finalOffsetX = (canvasLogicalWidth - scaledLayoutWidth) / 2;
        const finalOffsetY = (canvasLogicalHeight - scaledLayoutHeight) / 2;
          
        detectedBoxes.forEach((b) => {
          const placeholderWidth = Math.round(b.width * scaleFactor);
          const placeholderHeight = Math.round(b.height * scaleFactor);

          fabric.Image.fromURL(`https://picsum.photos/${placeholderWidth}/${placeholderHeight}?grayscale&blur=2`, (img) => {
              if (img.getElement() === null) {
                  console.error("Failed to load placeholder image");
                  return;
              }
              const rect = new fabric.Rect({
                left: (b.x - outerBox.x) * scaleFactor + finalOffsetX,
                top: (b.y - outerBox.y) * scaleFactor + finalOffsetY,
                width: placeholderWidth,
                height: placeholderHeight,
                fill: 'transparent',
                stroke: '#ccc',
                strokeWidth: 2,
                selectable: true,
              });

              rect.set('fill', new fabric.Pattern({
                source: img.getElement(),
                repeat: 'no-repeat',
              }));
              
              canvas.add(rect);
              canvas.renderAll();
          }, { crossOrigin: 'anonymous' });
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
    if (!activeObject || activeObject.type !== 'rect') {
      toast({ title: "No box selected", description: "Please select a box before uploading an image.", variant: "destructive"});
      return;
    };

    const file = e.target.files[0];
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const dataUrl = reader.result as string;
        
        const box = activeObject as fabric.Rect;
        
        setIsAiProcessing(true);
        const img = new Image();
        img.src = dataUrl;
        img.onload = async () => {
            const needsFill = img.width < box.width! || img.height < box.height!;
            let finalDataUrl = dataUrl;
            
            if (needsFill) {
                try {
                    toast({ title: "🤖 AI is filling the background...", description: "This might take a moment." });
                    const result = await autoBackgroundFill({ imageDataUri: dataUrl, boxWidth: box.width!, boxHeight: box.height! });
                    finalDataUrl = result.filledImageDataUri;
                    toast({ title: "✅ AI background fill complete!", variant: "default" });
                } catch(err) {
                    console.error("AI background fill failed", err);
                    toast({ title: "AI background fill failed", description: "Using original image instead.", variant: "destructive" });
                }
            }

            fabric.Image.fromURL(finalDataUrl, (fabricImg) => {
                const scale = Math.max(box.width! / fabricImg.width!, box.height! / fabricImg.height!);
                
                box.set('fill', new fabric.Pattern({
                  source: fabricImg.getElement(),
                  repeat: 'no-repeat',
                }));

                const pattern = box.fill as fabric.Pattern;
                pattern.offsetX = (box.width! - fabricImg.width! * scale) / 2;
                pattern.offsetY = (box.height! - fabricImg.height! * scale) / 2;
                
                fabricImg.scaleX = scale;
                fabricImg.scaleY = scale;

                canvas?.renderAll();
                setIsAiProcessing(false);
            });
        };
    };
    e.target.value = "";
  };
  
  const addBox = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const rectWidth = 200;
    const rectHeight = 200;
    
    fabric.Image.fromURL(`https://picsum.photos/${rectWidth}/${rectHeight}?grayscale&blur=2`, (img) => {
        if (img.getElement() === null) {
            console.error("Failed to load placeholder image");
            return;
        }

        const rect = new fabric.Rect({
            left: (canvasSize.width - rectWidth) / 2,
            top: (canvasSize.height - rectHeight) / 2,
            width: rectWidth,
            height: rectHeight,
            fill: 'transparent',
            stroke: '#ccc',
            strokeWidth: 2,
        });

        rect.set('fill', new fabric.Pattern({
            source: img.getElement(),
            repeat: 'no-repeat',
        }));
        
        canvas.add(rect);
        canvas.setActiveObject(rect);
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
    
    const originalZoom = canvas.getZoom();
    const originalWidth = canvas.getWidth();
    const originalHeight = canvas.getHeight();
    const originalVpt = canvas.viewportTransform;
    
    canvas.setZoom(1);
    canvas.setWidth(canvasSize.width);
    canvas.setHeight(canvasSize.height);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    
    const dataUrl = canvas.toDataURL({ format: 'png', quality: 1.0 });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "layout-canvas.png";
    link.click();

    canvas.setWidth(originalWidth);
    canvas.setHeight(originalHeight);
    canvas.setViewportTransform(originalVpt!);
    canvas.setZoom(originalZoom);
  };

  const handleAddNewSize = () => {
    const width = parseInt(newSize.width);
    const height = parseInt(newSize.height);
    if (width > 0 && height > 0) {
      const key = `${width}x${height}`;
      if (!tempSizes[key as CanvasSizeKey]) {
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
    delete newSizes[keyToDelete as CanvasSizeKey];
    setTempSizes(newSizes);
  };

  const handleSaveSizes = () => {
    setCanvasSizes(tempSizes);
    if (!tempSizes[currentSizeKey as CanvasSizeKey]) {
      setCurrentSizeKey(Object.keys(tempSizes)[0]);
    }
    setIsEditSizesOpen(false);
  };
  
  return (
    <div className="flex flex-col h-full bg-background text-foreground font-body">
      <div className="flex flex-col flex-1 overflow-hidden">
        <main ref={canvasWrapperRef} className="flex-1 p-4 bg-muted/40 flex items-center justify-center">
            <canvas ref={canvasRef} />
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
                        <Button variant="ghost" size="icon" onClick={addBox}>
                            <PlusSquare />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Add Box</p></TooltipContent>
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
                                    onValueChange={(value: string) => {
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

    