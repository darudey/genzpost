
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
  CheckSquare,
} from "lucide-react";
import { autoBackgroundFill } from "@/ai/flows/auto-background-fill";
import { detectLayoutStructure } from "@/ai/flows/detect-layout-structure";
import { useToast } from "@/hooks/use-toast";

const INITIAL_CANVAS_SIZES = {
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
  const [currentSizeKey, setCurrentSizeKey] = useState<string>("400x600");
  const [isEditSizesOpen, setIsEditSizesOpen] = useState(false);
  const [isSizePopoverOpen, setIsSizePopoverOpen] = useState(false);
  const [tempSizes, setTempSizes] = useState(canvasSizes);
  const [newSize, setNewSize] = useState({ width: "", height: "" });
  const [isCropMode, setIsCropMode] = useState(false);
  
  const canvasSize = canvasSizes[currentSizeKey as CanvasSizeKey];

  const enterCropMode = (targetGroup: fabric.Group) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !targetGroup.data?.isCropGroup) return;

    setIsCropMode(true);
    canvas.discardActiveObject();
    
    const seen_frame = targetGroup.getObjects('rect')[0] as fabric.Rect;
    const unseen_frame = targetGroup.getObjects('image')[0] as fabric.Image;
    
    targetGroup.set({ selectable: false, evented: false });
    
    seen_frame.set({ evented: false });
    unseen_frame.set({ evented: true, selectable: true });
    
    canvas.add(unseen_frame);
    canvas.setActiveObject(unseen_frame);

    canvas.renderAll();
  }

  const exitCropMode = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeImage = canvas.getActiveObject() as fabric.Image;
    if (!activeImage || !activeImage.clipPath || !activeImage.data?.group) {
        setIsCropMode(false); // Failsafe
        return;
    }
    
    const group = activeImage.data.group as fabric.Group;
    canvas.remove(activeImage);
    group.addWithUpdate(activeImage);
    
    group.set({ selectable: true, evented: true });
    
    canvas.discardActiveObject();
    canvas.setActiveObject(group);
    
    setIsCropMode(false);
    canvas.renderAll();
  }


  const initCanvas = useCallback(() => {
    const canvas = new fabric.Canvas(canvasRef.current, {
        width: canvasSize.width,
        height: canvasSize.height,
        backgroundColor: canvasBgColor,
        selection: true,
        controlsAboveOverlay: true,
    });
    fabricCanvasRef.current = canvas;
    
    let lastTapTime = 0;
    let lastTapTarget: fabric.Object | undefined;

    const handleDoubleClick = (opt: fabric.IEvent<MouseEvent>) => {
      if (opt.target && opt.target.data?.isCropGroup && !isCropMode) {
        enterCropMode(opt.target as fabric.Group);
      }
    };

    const handleTap = (opt: fabric.IEvent<MouseEvent>) => {
        const now = new Date().getTime();
        const timeSinceLastTap = now - lastTapTime;

        if (opt.target && opt.target.data?.isCropGroup && !isCropMode && timeSinceLastTap < 500 && lastTapTarget === opt.target) {
          enterCropMode(opt.target as fabric.Group);
          lastTapTime = 0; // Reset tap time
          return;
        }
        lastTapTime = now;
        lastTapTarget = opt.target;
    };
    
    canvas.on('mouse:dblclick', handleDoubleClick);
    canvas.on('mouse:up', handleTap);

    return canvas;
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const resizeObserver = new ResizeObserver(() => {
        fitCanvasToContainer();
    });
    if (canvasWrapperRef.current) {
        resizeObserver.observe(canvasWrapperRef.current);
    }
    
    fitCanvasToContainer();

    return () => {
      if (canvasWrapperRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        resizeObserver.unobserve(canvasWrapperRef.current);
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
        
        // Use the first box to determine overall scaling for the layout
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
            group.remove(oldUnseenFrame);

            img.set({
              originX: 'center',
              originY: 'center',
              data: { group }
            });
            
            const frameWidth = seen_frame.width!;
            const frameHeight = seen_frame.height!;

            const scale = Math.max(frameWidth / img.width!, frameHeight / img.height!);
            img.scale(scale);

            img.clipPath = seen_frame;
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
        left: 0,
        top: 0,
        width: rectWidth,
        height: rectHeight,
        fill: 'transparent',
        stroke: '#ccc',
        strokeWidth: 2,
        // This is crucial for clipPath to work correctly on a group
        absolutePositioned: true, 
    });

    fabric.Image.fromURL(`https://placehold.co/${rectWidth}x${rectHeight}.png`, (img) => {
        img.set({
            originX: 'center',
            originY: 'center',
        });
        
        const scale = Math.max(rectWidth / img.width!, rectHeight / img.height!);
        img.scale(scale);
        
        img.clipPath = seen_frame;
        
        const group = new fabric.Group([seen_frame, img], {
            left: rectLeft,
            top: rectTop,
            data: { isCropGroup: true },
        });

        // Set references for later
        img.data = { group };

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

    if (isCropMode) exitCropMode();
    
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
    <div className="flex flex-col h-full bg-gray-800 text-foreground font-body">
      <div className="flex flex-col flex-1 overflow-hidden">
        <main ref={canvasWrapperRef} className="flex-1 p-4 bg-muted/40 flex items-center justify-center relative">
            <canvas ref={canvasRef} className="shadow-2xl" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)'}} />
            {isCropMode && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
                <Button onClick={exitCropMode} variant="secondary">
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Done
                </Button>
              </div>
            )}
        </main>
        <TooltipProvider>
          <aside className="p-2 border-t bg-background">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex justify-center items-center space-x-2 pb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size="icon" disabled={isCropMode}>
                      <MousePointer />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>Select / Move (V)</p></TooltipContent>
                </Tooltip>
                
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isAiProcessing || isCropMode} onClick={() => templateInputRef.current?.click()}>
                            {isAiProcessing ? <Loader2 className="animate-spin" /> : <LayoutTemplate />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Detect Layout from Image</p></TooltipContent>
                </Tooltip>
                <input ref={templateInputRef} type="file" className="hidden" accept="image/*" onChange={handleTemplateFileChange} />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => addBox()} disabled={isCropMode}>
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
                                <Button variant="ghost" size="icon" disabled={isCropMode}>
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
                        <Button variant="ghost" size="icon" onClick={() => colorInputRef.current?.click()} disabled={isCropMode}>
                            <Palette />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Canvas Background</p></TooltipContent>
                </Tooltip>
                <input ref={colorInputRef} type="color" className="hidden" value={canvasBgColor} onChange={(e) => setCanvasBgColor(e.target.value)} />
                
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isAiProcessing || isCropMode} onClick={() => imageInputRef.current?.click()}>
                            {isAiProcessing ? <Loader2 className="animate-spin" /> : <ImageUp />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Upload Image to Box</p></TooltipContent>
                </Tooltip>
                <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => changeZIndex('front')} disabled={isCropMode}>
                            <BringToFront />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Bring to Front</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => changeZIndex('back')} disabled={isCropMode}>
                            <SendToBack />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Send to Back</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={deleteActiveBox} disabled={isCropMode}>
                            <Trash2 />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Delete Box</p></TooltipContent>
                </Tooltip>
                
                <div className="border-l h-8 mx-2" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={exportImage} disabled={isCropMode}>
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
