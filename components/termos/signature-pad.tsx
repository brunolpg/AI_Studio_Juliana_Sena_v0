"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Eraser, PenTool, CheckCircle2 } from "lucide-react";

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string | null;
}

interface SignaturePadProps {
  onChange?: (hasSignature: boolean, dataUrl: string | null) => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  error?: string | null;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad(
    {
      onChange,
      disabled = false,
      label = "Assinatura do Paciente",
      helperText = "Assine usando a caneta do tablet (S-Pen/Stylus), toque ou mouse.",
      error = null,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<StrokePoint[][]>([]);
    const currentStrokeRef = useRef<StrokePoint[] | null>(null);
    const isDrawingRef = useRef(false);
    const activePointerIdRef = useRef<number | null>(null);
    const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

    const [hasSignature, setHasSignature] = useState(false);

    const drawStrokeOnContext = useCallback(
      (
        ctx: CanvasRenderingContext2D,
        stroke: StrokePoint[],
        strokeColor: string
      ) => {
        if (stroke.length === 0) return;

        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = strokeColor;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (stroke.length === 1) {
          const p = stroke[0];
          const radius = Math.max(1.2, (1.6 + p.pressure * 1.4) / 2);
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
          return;
        }

        for (let i = 1; i < stroke.length; i++) {
          const prev = stroke[i - 1];
          const curr = stroke[i];
          const midX = (prev.x + curr.x) / 2;
          const midY = (prev.y + curr.y) / 2;
          const prevMidX = i === 1 ? prev.x : (stroke[i - 2].x + prev.x) / 2;
          const prevMidY = i === 1 ? prev.y : (stroke[i - 2].y + prev.y) / 2;

          ctx.lineWidth = Math.max(1.5, Math.min(3.6, 1.6 + curr.pressure * 1.8));
          ctx.beginPath();
          ctx.moveTo(prevMidX, prevMidY);
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
          ctx.stroke();
        }

        const last = stroke[stroke.length - 1];
        const beforeLast = stroke[stroke.length - 2];
        ctx.lineWidth = Math.max(1.5, Math.min(3.6, 1.6 + last.pressure * 1.8));
        ctx.beginPath();
        ctx.moveTo((beforeLast.x + last.x) / 2, (beforeLast.y + last.y) / 2);
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      },
      []
    );

    const redrawCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const { width, height } = sizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const computedInk =
        typeof window !== "undefined"
          ? window.getComputedStyle(canvas).color || "#0f172a"
          : "#0f172a";

      for (const stroke of strokesRef.current) {
        drawStrokeOnContext(ctx, stroke, computedInk);
      }
      if (currentStrokeRef.current) {
        drawStrokeOnContext(ctx, currentStrokeRef.current, computedInk);
      }
    }, [drawStrokeOnContext]);

    const exportPngDataUrl = useCallback((): string | null => {
      if (strokesRef.current.length === 0) return null;
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) {
        const canvas = canvasRef.current;
        return canvas ? canvas.toDataURL("image/png") : null;
      }

      // Exporta sempre com tinta escura nítida em alta resolução sobre fundo transparente para o PDF A4
      const exportScale = Math.max(window.devicePixelRatio || 1, 2);
      const offscreen = document.createElement("canvas");
      offscreen.width = Math.round(width * exportScale);
      offscreen.height = Math.round(height * exportScale);

      const ctx = offscreen.getContext("2d");
      if (!ctx) return null;

      ctx.setTransform(exportScale, 0, 0, exportScale, 0, 0);
      for (const stroke of strokesRef.current) {
        drawStrokeOnContext(ctx, stroke, "#0f172a");
      }

      return offscreen.toDataURL("image/png");
    }, [drawStrokeOnContext]);

    const handleClear = useCallback(() => {
      strokesRef.current = [];
      currentStrokeRef.current = null;
      isDrawingRef.current = false;
      activePointerIdRef.current = null;
      setHasSignature(false);
      redrawCanvas();
      onChange?.(false, null);
    }, [onChange, redrawCanvas]);

    useImperativeHandle(
      ref,
      () => ({
        clear: handleClear,
        isEmpty: () => strokesRef.current.length === 0,
        toDataURL: exportPngDataUrl,
      }),
      [exportPngDataUrl, handleClear]
    );

    // Sincroniza dimensões físicas do canvas com devicePixelRatio e resize/rotação de tablet
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const syncSize = () => {
        const rect = container.getBoundingClientRect();
        const nextW = Math.max(1, Math.floor(rect.width));
        const nextH = Math.max(1, Math.floor(rect.height));
        const dpr = window.devicePixelRatio || 1;

        if (
          sizeRef.current.width !== nextW ||
          sizeRef.current.height !== nextH ||
          canvas.width !== Math.round(nextW * dpr) ||
          canvas.height !== Math.round(nextH * dpr)
        ) {
          sizeRef.current = { width: nextW, height: nextH };
          canvas.width = Math.round(nextW * dpr);
          canvas.height = Math.round(nextH * dpr);
          redrawCanvas();
        }
      };

      syncSize();
      const observer = new ResizeObserver(syncSize);
      observer.observe(container);
      window.addEventListener("resize", syncSize);

      return () => {
        observer.disconnect();
        window.removeEventListener("resize", syncSize);
      };
    }, [redrawCanvas]);

    const getPointFromEvent = (
      e: React.PointerEvent<HTMLCanvasElement>
    ): StrokePoint => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const rawPressure =
        e.pointerType === "pen" && typeof e.pressure === "number" && e.pressure > 0
          ? e.pressure
          : 0.45;
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: rawPressure,
      };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointerIdRef.current = e.pointerId;
      isDrawingRef.current = true;

      const point = getPointFromEvent(e);
      currentStrokeRef.current = [point];
      redrawCanvas();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (
        !isDrawingRef.current ||
        activePointerIdRef.current !== e.pointerId ||
        !currentStrokeRef.current
      ) {
        return;
      }

      e.preventDefault();
      const nativeEvt = e.nativeEvent as PointerEvent;
      const coalesced =
        typeof nativeEvt.getCoalescedEvents === "function"
          ? nativeEvt.getCoalescedEvents()
          : null;

      if (coalesced && coalesced.length > 0) {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        for (const ptEvt of coalesced) {
          const pressure =
            ptEvt.pointerType === "pen" && ptEvt.pressure > 0
              ? ptEvt.pressure
              : 0.45;
          currentStrokeRef.current.push({
            x: ptEvt.clientX - rect.left,
            y: ptEvt.clientY - rect.top,
            pressure,
          });
        }
      } else {
        currentStrokeRef.current.push(getPointFromEvent(e));
      }

      redrawCanvas();
    };

    const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || activePointerIdRef.current !== e.pointerId) {
        return;
      }

      e.preventDefault();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Liberação segura
      }

      if (currentStrokeRef.current && currentStrokeRef.current.length > 0) {
        strokesRef.current.push(currentStrokeRef.current);
      }

      currentStrokeRef.current = null;
      isDrawingRef.current = false;
      activePointerIdRef.current = null;

      const signed = strokesRef.current.length > 0;
      setHasSignature(signed);
      redrawCanvas();
      onChange?.(signed, signed ? exportPngDataUrl() : null);
    };

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PenTool className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
              {label}
            </span>
            {hasSignature && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md-full text-[11px] font-semibold bg-success-container text-on-success-container">
                <CheckCircle2 className="w-3 h-3" />
                Assinada
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || !hasSignature}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3.5 rounded-md-full text-xs font-semibold text-on-surface-variant bg-surface-container hover:bg-surface-container-high border border-outline-variant transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Eraser className="w-3.5 h-3.5 shrink-0" />
            <span>Limpar</span>
          </button>
        </div>

        <p className="text-xs text-on-surface-variant">{helperText}</p>

        <div
          ref={containerRef}
          className={`relative w-full h-48 sm:h-56 rounded-md-lg bg-surface-container-lowest border-2 border-dashed overflow-hidden select-none transition-colors ${
            error
              ? "border-error"
              : hasSignature
                ? "border-primary/60"
                : "border-outline-variant"
          } ${disabled ? "opacity-60 pointer-events-none" : ""}`}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            style={{ touchAction: "none" }}
            className="w-full h-full block text-on-surface cursor-crosshair"
            aria-label="Área de assinatura digital do paciente"
          />

          {/* Linha guia e indicação visual */}
          <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-outline-variant/80" />
          {!hasSignature && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
              <span className="text-xs font-medium text-on-surface-variant/70 text-center">
                Assine aqui acima da linha
              </span>
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs font-medium text-error">{error}</p>
        )}
      </div>
    );
  }
);
