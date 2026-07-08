import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { format } from "date-fns";

export interface LightboxMeta {
  category?: string;
  quantityDead?: number;
  reason?: string | null;
  date?: string | Date | null;
  recordedBy?: string | null;
  batch?: string | null;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  urls: string[];
  startIndex?: number;
  meta?: LightboxMeta;
}

const PhotoLightbox = ({ open, onOpenChange, urls, startIndex = 0, meta }: Props) => {
  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => { if (open) { setIndex(startIndex); setScale(1); setOffset({ x: 0, y: 0 }); } }, [open, startIndex]);

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };
  const next = useCallback(() => { setIndex((i) => (i + 1) % urls.length); reset(); }, [urls.length]);
  const prev = useCallback(() => { setIndex((i) => (i - 1 + urls.length) % urls.length); reset(); }, [urls.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") onOpenChange(false);
      else if (e.key === "+" || e.key === "=") setScale((s) => Math.min(5, s + 0.25));
      else if (e.key === "-") setScale((s) => Math.max(1, s - 0.25));
      else if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev, onOpenChange]);

  if (!urls.length) return null;
  const url = urls[index];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] p-0 bg-background/95 backdrop-blur border-border/40 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/80 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Photo {index + 1} of {urls.length}</span>
            {meta?.quantityDead != null && <Badge variant="destructive">{meta.quantityDead} dead</Badge>}
            {meta?.category && <Badge variant="secondary">{meta.category}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setScale((s) => Math.max(1, s - 0.25))} title="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
            <span className="text-xs tabular-nums w-12 text-center">{Math.round(scale * 100)}%</span>
            <Button size="icon" variant="ghost" onClick={() => setScale((s) => Math.min(5, s + 0.25))} title="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={reset} title="Reset"><RotateCcw className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" asChild title="Open original"><a href={url} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a></Button>
            <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Image stage */}
        <div
          className="relative flex-1 overflow-hidden bg-black/80 select-none"
          onWheel={(e) => { e.preventDefault(); setScale((s) => Math.min(5, Math.max(1, s + (e.deltaY < 0 ? 0.15 : -0.15)))); }}
          onMouseDown={(e) => { if (scale > 1) setDragging({ x: e.clientX - offset.x, y: e.clientY - offset.y }); }}
          onMouseMove={(e) => { if (dragging) setOffset({ x: e.clientX - dragging.x, y: e.clientY - dragging.y }); }}
          onMouseUp={() => setDragging(null)}
          onMouseLeave={() => setDragging(null)}
          onDoubleClick={() => (scale > 1 ? reset() : setScale(2))}
          style={{ cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
        >
          <img
            src={url}
            alt="Evidence"
            draggable={false}
            className="absolute inset-0 m-auto max-w-full max-h-full object-contain transition-transform duration-100"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "center center" }}
          />

          {urls.length > 1 && (
            <>
              <Button size="icon" variant="secondary" onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"><ChevronLeft className="h-5 w-5" /></Button>
              <Button size="icon" variant="secondary" onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"><ChevronRight className="h-5 w-5" /></Button>
            </>
          )}
        </div>

        {/* Metadata footer */}
        {meta && (
          <div className="border-t bg-background/95 px-4 py-3 text-sm shrink-0 max-h-[28vh] overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {meta.date && <div><p className="text-xs text-muted-foreground">Date</p><p className="font-medium">{format(new Date(meta.date), "MMM dd, yyyy")}</p></div>}
              {meta.category && <div><p className="text-xs text-muted-foreground">Category</p><p className="font-medium">{meta.category}</p></div>}
              {meta.batch && <div><p className="text-xs text-muted-foreground">Batch</p><p className="font-medium">{meta.batch}</p></div>}
              {meta.recordedBy && <div><p className="text-xs text-muted-foreground">Recorded by</p><p className="font-medium">{meta.recordedBy}</p></div>}
              {meta.reason && <div className="col-span-2 md:col-span-4"><p className="text-xs text-muted-foreground">Reason</p><p>{meta.reason}</p></div>}
              {meta.notes && <div className="col-span-2 md:col-span-4"><p className="text-xs text-muted-foreground">Notes</p><p className="text-muted-foreground">{meta.notes}</p></div>}
            </div>
            {urls.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {urls.map((u, i) => (
                  <button key={i} onClick={() => { setIndex(i); reset(); }} className={`h-14 w-14 rounded border-2 overflow-hidden shrink-0 ${i === index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}>
                    <img src={u} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PhotoLightbox;
