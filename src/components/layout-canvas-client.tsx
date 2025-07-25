"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import { autoBackgroundFill } from "@/ai/flows/auto-background-fill";
import { detectLayoutStructure } from "@/ai/flows/detect-layout-structure";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const RESIZE_HANDLE_SIZE = 8;
const CLICK_TOLERANCE = 5;

interface ImageState {
  instance: HTMLImageElement;
  x: number;
  y: number;
  scale: number;
  isFilling?: boolean;
}

interface Box {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  image?: ImageState;
  zIndex: number;
}

type Mode = "select";
type DragAction = "move" | "resize-br" | "resize-bl" | "resize-tr" | "resize-tl" | "resize-t" | "resize-b" | "resize-l" | "resize-r" | "move-image" | null;

const CANVAS_SIZES = {
    "1024x768": { width: 1024, height: 768 },
    "1280x720": { width: 1280, height: 720 },
    "1920x1080": { width: 1920, height: 1080 },
    "800x800": { width: 800, height: 800 },
    "400x600": { width: 400, height: 600 },
};
type CanvasSizeKey = keyof typeof CANVAS_SIZES;


export function LayoutCanvasClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [boxes, setBoxes] = useState<Box[]>([]);
  const [nextBoxId, setNextBoxId] = useState(1);
  const [canvasBgColor, setCanvasBgColor] = useState("#F8F8FF");
  const [mode, setMode] = useState<Mode>("select");
  const [activeBoxId, setActiveBoxId] = useState<number | null>(null);

  const [isDragging, setIsDragging] = useState<DragAction>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [loadedImages, setLoadedImages] = useState<{[src: string]: HTMLImageElement}>({});
  const [canvasSize, setCanvasSize] = useState(CANVAS_SIZES["1024x768"]);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);


  const getCanvasCoordinates = (event: React.MouseEvent<HTMLElement> | MouseEvent | WheelEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - offset.x) / scale;
    const y = (event.clientY - rect.top - offset.y) / scale;
    return { x, y };
  };

  const getBoxAt = (x: number, y: number): Box | null => {
    const sortedBoxes = [...boxes].sort((a, b) => b.zIndex - a.zIndex);
    const tolerance = CLICK_TOLERANCE / scale;
    return sortedBoxes.find(box => 
      x >= box.x - tolerance && 
      x <= box.x + box.width + tolerance && 
      y >= box.y - tolerance && 
      y <= box.y + box.height + tolerance
    ) || null;
  };
  
  const getResizeHandle = (x: number, y: number, box: Box): DragAction => {
      const handleSize = (RESIZE_HANDLE_SIZE * 2) / scale;
      const atTop = y >= box.y && y <= box.y + handleSize;
      const atBottom = y >= box.y + box.height - handleSize && y <= box.y + box.height;
      const atLeft = x >= box.x && x <= box.x + handleSize;
      const atRight = x >= box.x + box.width - handleSize && x <= box.x + box.width;

      if(atTop && atLeft) return 'resize-tl';
      if(atTop && atRight) return 'resize-tr';
      if(atBottom && atLeft) return 'resize-bl';
      if(atBottom && atRight) return 'resize-br';
      if(atTop) return 'resize-t';
      if(atBottom) return 'resize-b';
      if(atLeft) return 'resize-l';
      if(atRight) return 'resize-r';
      return null;
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    const { x, y } = getCanvasCoordinates(e);
    setStartPoint({ x: e.clientX, y: e.clientY });

    if (isSpacePressed) {
      setIsPanning(true);
      return;
    }
    
    if (mode === "select") {
        const clickedBox = getBoxAt(x, y);
        setActiveBoxId(clickedBox?.id || null);
        
        if (clickedBox) {
            const handle = getResizeHandle(x, y, clickedBox);
            if (handle) {
                setIsDragging(handle);
                setDragOffset({ x, y });
            } else {
                const image = clickedBox.image;
                if(image) {
                    const imgX = clickedBox.x + image.x;
                    const imgY = clickedBox.y + image.y;
                    const imgW = image.instance.width * image.scale;
                    const imgH = image.instance.height * image.scale;
                    if(x >= imgX && x <= imgX + imgW && y >= imgY && y <= imgY + imgH) {
                        setIsDragging("move-image");
                        setDragOffset({ x: x - imgX, y: y - imgY });
                        return;
                    }
                }
                setIsDragging("move");
                setDragOffset({ x: x - clickedBox.x, y: y - clickedBox.y });
            }
        }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!startPoint) return;
    
    if (isPanning) {
        setOffset(prev => ({
            x: prev.x + (e.clientX - startPoint.x),
            y: prev.y + (e.clientY - startPoint.y)
        }));
        setStartPoint({x: e.clientX, y: e.clientY});
        return;
    }

    const { x, y } = getCanvasCoordinates(e);

    if (isDragging && activeBoxId !== null && dragOffset) {
      setBoxes(prev => prev.map(box => {
        if (box.id !== activeBoxId) return box;
        
        let newBox = { ...box };
        const dx = x - dragOffset.x;
        const dy = y - dragOffset.y;
        
        switch (isDragging) {
            case "move":
                newBox.x = dx;
                newBox.y = dy;
                break;
            case "move-image":
                if (newBox.image) {
                    newBox.image.x = x - newBox.x - dragOffset.x;
                    newBox.image.y = y - newBox.y - dragOffset.y;
                }
                break;
            case "resize-br":
                newBox.width = x - newBox.x;
                newBox.height = y - newBox.y;
                break;
            case "resize-bl":
                newBox.width = newBox.x + newBox.width - x;
                newBox.height = y - newBox.y;
                newBox.x = x;
                break;
            case "resize-tr":
                newBox.width = x - newBox.x;
                newBox.height = newBox.y + newBox.height - y;
                newBox.y = y;
                break;
            case "resize-tl":
                newBox.width = newBox.x + newBox.width - x;
                newBox.height = newBox.y + newBox.height - y;
                newBox.x = x;
                newBox.y = y;
                break;
            case 'resize-t':
                newBox.height = newBox.y + newBox.height - y;
                newBox.y = y;
                break;
            case 'resize-b':
                newBox.height = y - newBox.y;
                break;
            case 'resize-l':
                newBox.width = newBox.x + newBox.width - x;
                newBox.x = x;
                break;
            case 'resize-r':
                newBox.width = x - newBox.x;
                break;
        }

        if (newBox.width < 0) {
            newBox.x += newBox.width;
            newBox.width *= -1;
        }
        if (newBox.height < 0) {
            newBox.y += newBox.height;
            newBox.height *= -1;
        }
        return newBox;
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
    setStartPoint(null);
    setDragOffset(null);
    setIsPanning(false);
  };

  const handleMouseWheel = (e: React.WheelEvent<HTMLElement>) => {
    e.preventDefault();
    const scaleAmount = -e.deltaY * 0.001;
    const { x, y } = getCanvasCoordinates(e);

    const newScale = Math.max(0.1, Math.min(10, scale + scaleAmount));

    const newOffsetX = offset.x + (x * (scale - newScale));
    const newOffsetY = offset.y + (y * (scale - newScale));
    
    setScale(newScale);
    setOffset({x: newOffsetX, y: newOffsetY});
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if(e.code === 'Space') {
            e.preventDefault();
            setIsSpacePressed(true);
        }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
        if(e.code === 'Space') {
            e.preventDefault();
            setIsSpacePressed(false);
            setIsPanning(false);
        }
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    }
  }, []);

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

        const scaleX = canvasSize.width / outerBox.width;
        const scaleY = canvasSize.height / outerBox.height;
        const scaleFactor = Math.min(scaleX, scaleY) * 0.9; 

        const scaledLayoutWidth = outerBox.width * scaleFactor;
        const scaledLayoutHeight = outerBox.height * scaleFactor;
        const offsetX = (canvasSize.width - scaledLayoutWidth) / 2;
        const offsetY = (canvasSize.height - scaledLayoutHeight) / 2;
          
        let currentId = nextBoxId;
        const newBoxes = detectedBoxes.map((b) => {
          const box: Box = {
            id: currentId,
            x: (b.x - outerBox.x) * scaleFactor + offsetX,
            y: (b.y - outerBox.y) * scaleFactor + offsetY,
            width: b.width * scaleFactor,
            height: b.height * scaleFactor,
            zIndex: currentId,
          };
          currentId++;
          return box;
        });
        
        setBoxes(prev => [...prev, ...newBoxes]);
        setNextBoxId(currentId);
        toast({ title: "✅ AI layout detection complete!", description: `Found ${newBoxes.length} boxes.`, variant: "default" });

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
    if (!e.target.files || e.target.files.length === 0 || activeBoxId === null) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const dataUrl = reader.result as string;
        const activeBox = boxes.find(b => b.id === activeBoxId);
        if(!activeBox) return;

        setIsAiProcessing(true);
        const img = new Image();
        img.src = dataUrl;
        img.onload = async () => {
            const needsFill = img.width < activeBox.width || img.height < activeBox.height;
            let finalDataUrl = dataUrl;
            
            if (needsFill) {
                try {
                    toast({ title: "🤖 AI is filling the background...", description: "This might take a moment." });
                    const result = await autoBackgroundFill({ imageDataUri: dataUrl, boxWidth: activeBox.width, boxHeight: activeBox.height });
                    finalDataUrl = result.filledImageDataUri;
                    toast({ title: "✅ AI background fill complete!", variant: "default" });
                } catch(err) {
                    console.error("AI background fill failed", err);
                    toast({ title: "AI background fill failed", description: "Using original image instead.", variant: "destructive" });
                }
            }

            const finalImg = new Image();
            finalImg.src = finalDataUrl;
            finalImg.onload = () => {
                setLoadedImages(prev => ({ ...prev, [finalDataUrl]: finalImg }));
                const imgScale = Math.max(activeBox.width / finalImg.width, activeBox.height / finalImg.height);
                setBoxes(prev => prev.map(box =>
                    box.id === activeBoxId
                        ? { ...box, image: { instance: finalImg, x: 0, y: 0, scale: imgScale, isFilling: needsFill } }
                        : box
                ));
                setIsAiProcessing(false);
            }
        };
    };
    e.target.value = "";
  };
  
  const addBox = () => {
    const newBox: Box = {
      id: nextBoxId,
      x: (canvasSize.width - 200) / 2,
      y: (canvasSize.height - 200) / 2,
      width: 200,
      height: 200,
      zIndex: boxes.length,
    };
    setBoxes(prev => [...prev, newBox]);
    setActiveBoxId(nextBoxId);
    setNextBoxId(prev => prev + 1);
  };
  
  const deleteActiveBox = () => {
    if (activeBoxId === null) return;
    setBoxes(prev => prev.filter(b => b.id !== activeBoxId));
    setActiveBoxId(null);
  };

  const changeZIndex = (direction: 'front' | 'back') => {
    if(activeBoxId === null) return;
    const activeBox = boxes.find(b => b.id === activeBoxId);
    if (!activeBox) return;

    let newZIndex = activeBox.zIndex;
    if (direction === 'front') {
        newZIndex = boxes.length;
    } else {
        newZIndex = -1;
    }
    
    setBoxes(prev => {
        const otherBoxes = prev.filter(b => b.id !== activeBoxId);
        otherBoxes.sort((a,b) => a.zIndex - b.zIndex).forEach((b, i) => b.zIndex = i);
        const updatedActiveBox = { ...activeBox, zIndex: newZIndex };
        const newBoxes = [...otherBoxes, updatedActiveBox];
        newBoxes.sort((a,b) => a.zIndex - b.zIndex).forEach((b, i) => b.zIndex = i);
        return newBoxes;
    })
  }

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const currentActiveBoxId = activeBoxId;
    setActiveBoxId(null);
    
    const currentScale = scale;
    const currentOffset = offset;
    setScale(1);
    setOffset({x:0, y:0});


    requestAnimationFrame(() => {
        draw(); 
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "layout-canvas.png";
        link.click();
        setActiveBoxId(currentActiveBoxId);
        
        setScale(currentScale);
        setOffset(currentOffset);
    });

  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    const sortedBoxes = [...boxes].sort((a, b) => a.zIndex - b.zIndex);
    
    sortedBoxes.forEach(box => {
      ctx.strokeStyle = box.id === activeBoxId ? "#D8BFD8" : "#ccc";
      ctx.lineWidth = box.id === activeBoxId ? 3 / scale : 1 / scale;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      if (box.image) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(box.x, box.y, box.width, box.height);
        ctx.clip();
        
        const img = box.image.instance;
        const imgX = box.x + box.image.x;
        const imgY = box.y + box.image.y;
        const imgW = img.width * box.image.scale;
        const imgH = img.height * box.image.scale;

        ctx.drawImage(img, imgX, imgY, imgW, imgH);
        ctx.restore();
      }
    });

    if (activeBoxId && mode === 'select') {
        const box = boxes.find(b => b.id === activeBoxId);
        if (box) {
            ctx.fillStyle = "#D8BFD8";
            const handleSize = RESIZE_HANDLE_SIZE / scale;
            const handles = [
                {x: box.x, y: box.y}, {x: box.x + box.width, y: box.y},
                {x: box.x, y: box.y + box.height}, {x: box.x + box.width, y: box.y + box.height},
                {x: box.x + box.width/2, y: box.y}, {x: box.x + box.width/2, y: box.y + box.height},
                {x: box.x, y: box.y + box.height/2}, {x: box.x + box.width, y: box.y + box.height/2},
            ];
            handles.forEach(h => {
                ctx.fillRect(h.x - handleSize/2, h.y - handleSize/2, handleSize, handleSize);
            })
        }
    }

    if(boxes.length === 0) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.fillStyle = '#a0a0a0';
        ctx.font = '24px "PT Sans"';
        ctx.textAlign = 'center';
        ctx.fillText("Welcome to Layout Canvas!", canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '16px "PT Sans"';
        ctx.fillText("Upload a template image to automatically detect the layout or add a box to start.", canvas.width / 2, canvas.height / 2 + 20);
        ctx.restore();
    }

    ctx.restore();
  }, [boxes, canvasBgColor, activeBoxId, mode, scale, offset]);
  
  useEffect(() => {
    draw();
  }, [draw, canvasSize]);

  const activeBox = boxes.find(b => b.id === activeBoxId);

  return (
    <div className="flex flex-col h-full bg-background text-foreground font-body">
      <div className="flex flex-col flex-1 overflow-hidden">
        <main 
            className={cn("flex-1 p-4 bg-muted/20 flex items-center justify-center overflow-auto", {
                'cursor-grab': isSpacePressed,
                'cursor-grabbing': isPanning,
                'cursor-default': !isSpacePressed && !isPanning,
            })}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleMouseWheel}
        >
          <Card className="shadow-lg overflow-hidden shrink-0 w-full h-full">
            <CardContent className="p-0 h-full">
              <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} />
            </CardContent>
          </Card>
        </main>
        <TooltipProvider>
          <aside className="p-2 border-t bg-secondary/30">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex justify-center items-center space-x-2 pb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={mode === 'select' ? 'secondary' : 'ghost'} size="icon" onClick={() => setMode('select')}>
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
                
                <Popover>
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
                    <PopoverContent className="w-auto p-2">
                         <Select
                            defaultValue="1024x768"
                            onValueChange={(value: CanvasSizeKey) => setCanvasSize(CANVAS_SIZES[value])}
                        >
                            <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Canvas size" />
                            </SelectTrigger>
                            <SelectContent>
                            {Object.keys(CANVAS_SIZES).map(key => (
                                <SelectItem key={key} value={key}>{key}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
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
                        <Button variant="ghost" size="icon" disabled={!activeBox || isAiProcessing} onClick={() => imageInputRef.current?.click()}>
                            {isAiProcessing ? <Loader2 className="animate-spin" /> : <ImageUp />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Upload Image to Box</p></TooltipContent>
                </Tooltip>
                <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={!activeBox} onClick={() => changeZIndex('front')}>
                            <BringToFront />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Bring to Front</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={!activeBox} onClick={() => changeZIndex('back')}>
                            <SendToBack />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Send to Back</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={!activeBox} onClick={deleteActiveBox}>
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
    </div>
  );
}
