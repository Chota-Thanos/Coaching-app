"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eraser,
  Highlighter,
  Monitor,
  MonitorOff,
  PenLine,
  Presentation,
  Trash2,
  Undo2,
  Video as VideoIcon
} from "lucide-react";

/**
 * What the host is teaching from, and everything drawn on top of it.
 *
 * The annotations are composited into the published video rather than sent
 * alongside it. That is a deliberate choice with one big consequence: the
 * installed Agora Web SDK (4.24) has no data-message API, so a separate
 * annotation channel would have meant a new dependency AND matching work in
 * the Flutter app before a single student on a phone saw a highlight. Drawing
 * into the frame instead means every viewer already subscribed to the host's
 * video — web and mobile alike — sees the annotations with no client changes
 * at all.
 *
 * The pipeline: a raw camera or screen MediaStream plays into a hidden
 * <video>, a requestAnimationFrame loop paints that frame onto a canvas, then
 * paints the strokes over it, then the picture-in-picture camera if the host
 * is sharing their screen. The canvas is captured as a MediaStream and handed
 * back to the room, which publishes it as a custom video track — one stable
 * track for the whole class, so switching between camera, screen and
 * whiteboard never renegotiates the stream or interrupts a viewer.
 */

export type StageMode = "camera" | "screen" | "whiteboard";
type Tool = "pen" | "highlighter" | "eraser";

/** Normalised (0-1) so a stroke lands in the same place at any canvas size. */
type Point = { x: number; y: number };
type Stroke = { tool: Exclude<Tool, "eraser">; color: string; width: number; points: Point[] };

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

const COLORS = ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#111827", "#ffffff"];

/** Eraser hit radius, in normalised units — about 18px on a 1280-wide canvas. */
const ERASE_RADIUS = 0.014;

export function HostStage({
  mode,
  onModeChange,
  onCanvasStream,
  cameraEnabled
}: {
  mode: StageMode;
  onModeChange: (mode: StageMode) => void;
  onCanvasStream: (stream: MediaStream) => void;
  cameraEnabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]!);
  const [width, setWidth] = useState(4);
  const [sourceError, setSourceError] = useState<string | null>(null);

  // The paint loop reads these every frame, so it must see current values
  // rather than whatever was captured when the effect first ran.
  const strokesRef = useRef<Stroke[]>([]);
  const modeRef = useRef<StageMode>(mode);
  const cameraEnabledRef = useRef(cameraEnabled);
  const drawingRef = useRef<Stroke | null>(null);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    cameraEnabledRef.current = cameraEnabled;
  }, [cameraEnabled]);

  /** A hidden <video> is the only way to get decodable frames onto a canvas. */
  const attachStream = (stream: MediaStream, ref: React.MutableRefObject<HTMLVideoElement | null>) => {
    if (!ref.current) {
      const element = document.createElement("video");
      element.muted = true;
      element.playsInline = true;
      ref.current = element;
    }
    ref.current.srcObject = stream;
    void ref.current.play().catch(() => {
      // Autoplay of a muted, script-created element is allowed; if a browser
      // still refuses, the canvas simply keeps its last frame.
    });
  };

  const startCamera = useCallback(async () => {
    if (cameraStreamRef.current) return cameraStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    cameraStreamRef.current = stream;
    attachStream(stream, cameraVideoRef);
    return stream;
  }, []);

  const startScreenShare = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 } });
    screenStreamRef.current = stream;
    attachStream(stream, screenVideoRef);
    // Chrome's own "Stop sharing" bar bypasses this UI entirely, so the mode
    // has to follow the track rather than the button that started it.
    const [videoTrack] = stream.getVideoTracks();
    videoTrack?.addEventListener("ended", () => {
      screenStreamRef.current = null;
      onModeChange("camera");
    });
    return stream;
  }, [onModeChange]);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
  }, []);

  /**
   * Picking a source. Screen capture is acquired HERE rather than in an effect
   * reacting to `mode`, because getDisplayMedia needs the user gesture that
   * opened it — by the time an effect runs, that activation may already be
   * spent, and Safari in particular refuses.
   */
  const chooseMode = async (next: StageMode) => {
    setSourceError(null);
    if (next === "screen") {
      try {
        if (!screenStreamRef.current) await startScreenShare();
      } catch (error) {
        // Dismissing the picker is a normal thing to do, not a failure worth
        // shouting about — stay where we were and say nothing.
        const name = error instanceof DOMException ? error.name : "";
        if (name !== "NotAllowedError" && name !== "AbortError") {
          setSourceError("That screen could not be shared. Try again, or pick a different window.");
        }
        return;
      }
    } else {
      stopScreenShare();
    }
    onModeChange(next);
  };

  // The camera is needed for camera mode and for the picture-in-picture while
  // sharing, so it is acquired whenever it could be shown.
  useEffect(() => {
    if (mode === "whiteboard" && !cameraEnabled) return;
    void startCamera().catch(() => setSourceError("Your camera could not be opened."));
  }, [mode, cameraEnabled, startCamera]);

  // The paint loop, started once and left running for the life of the room.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return;

    onCanvasStream(canvas.captureStream(30));

    let frame = 0;
    const paint = () => {
      frame = requestAnimationFrame(paint);
      const currentMode = modeRef.current;

      context.fillStyle = currentMode === "whiteboard" ? "#ffffff" : "#0b0f19";
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const source =
        currentMode === "screen" ? screenVideoRef.current : currentMode === "camera" ? cameraVideoRef.current : null;

      if (source && source.readyState >= 2) {
        drawContained(context, source, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // The teacher's face stays visible while they present something else.
      const camera = cameraVideoRef.current;
      if (currentMode === "screen" && cameraEnabledRef.current && camera && camera.readyState >= 2) {
        const pipWidth = CANVAS_WIDTH * 0.2;
        const pipHeight = (pipWidth * 9) / 16;
        const x = CANVAS_WIDTH - pipWidth - 24;
        const y = CANVAS_HEIGHT - pipHeight - 24;
        context.save();
        context.fillStyle = "#000";
        context.fillRect(x - 3, y - 3, pipWidth + 6, pipHeight + 6);
        drawContained(context, camera, x, y, pipWidth, pipHeight);
        context.restore();
      }

      const all = drawingRef.current ? [...strokesRef.current, drawingRef.current] : strokesRef.current;
      for (const stroke of all) paintStroke(context, stroke);
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [onCanvasStream]);

  // Release every device when the room closes — a camera light left on after
  // a class is the kind of thing people notice and do not forgive.
  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    };
  };

  const eraseAt = (point: Point) => {
    setStrokes((current) =>
      current.filter(
        (stroke) =>
          !stroke.points.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < ERASE_RADIUS)
      )
    );
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    if (tool === "eraser") {
      eraseAt(point);
      return;
    }
    drawingRef.current = { tool, color, width, points: [point] };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.buttons === 0) return;
    const point = pointFromEvent(event);
    if (tool === "eraser") {
      eraseAt(point);
      return;
    }
    drawingRef.current?.points.push(point);
  };

  const onPointerUp = () => {
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (stroke && stroke.points.length > 1) setStrokes((current) => [...current, stroke]);
  };

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="relative flex-1 overflow-hidden rounded-2xl bg-black">
        <canvas
          className={`h-full w-full touch-none ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}
          onPointerDown={onPointerDown}
          onPointerLeave={onPointerUp}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          ref={canvasRef}
        />
        {sourceError && (
          <p className="absolute inset-x-4 top-4 rounded-lg bg-rose-500/90 px-3 py-2 text-xs font-bold text-white">
            {sourceError}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
        <div className="flex items-center gap-1 rounded-xl bg-black/30 p-1">
          {(
            [
              { value: "camera", label: "Camera", icon: VideoIcon },
              { value: "screen", label: "Share screen", icon: mode === "screen" ? MonitorOff : Monitor },
              { value: "whiteboard", label: "Whiteboard", icon: Presentation }
            ] as const
          ).map((entry) => {
            const Icon = entry.icon;
            const active = mode === entry.value;
            return (
              <button
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black transition-colors ${
                  active ? "bg-white text-slate-900" : "text-white/70 hover:bg-white/10"
                }`}
                key={entry.value}
                onClick={() => void chooseMode(entry.value === "screen" && mode === "screen" ? "camera" : entry.value)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {entry.value === "screen" && mode === "screen" ? "Stop sharing" : entry.label}
              </button>
            );
          })}
        </div>

        <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />

        <div className="flex items-center gap-1 rounded-xl bg-black/30 p-1">
          {(
            [
              { value: "pen", label: "Pen", icon: PenLine },
              { value: "highlighter", label: "Highlighter", icon: Highlighter },
              { value: "eraser", label: "Eraser", icon: Eraser }
            ] as const
          ).map((entry) => {
            const Icon = entry.icon;
            const active = tool === entry.value;
            return (
              <button
                aria-label={entry.label}
                className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${
                  active ? "bg-white text-slate-900" : "text-white/70 hover:bg-white/10"
                }`}
                key={entry.value}
                onClick={() => setTool(entry.value)}
                title={entry.label}
                type="button"
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          {COLORS.map((entry) => (
            <button
              aria-label={`Colour ${entry}`}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${
                color === entry ? "border-white scale-110" : "border-white/25"
              }`}
              key={entry}
              onClick={() => {
                setColor(entry);
                if (tool === "eraser") setTool("pen");
              }}
              style={{ background: entry }}
              type="button"
            />
          ))}
        </div>

        <label className="flex items-center gap-2 text-[11px] font-bold text-white/60">
          Size
          <input
            className="w-20"
            max={16}
            min={2}
            onChange={(event) => setWidth(Number(event.target.value))}
            type="range"
            value={width}
          />
        </label>

        <div className="ml-auto flex items-center gap-1">
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black text-white/70 hover:bg-white/10 disabled:opacity-40"
            disabled={strokes.length === 0}
            onClick={() => setStrokes((current) => current.slice(0, -1))}
            type="button"
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </button>
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black text-white/70 hover:bg-white/10 disabled:opacity-40"
            disabled={strokes.length === 0}
            onClick={() => setStrokes([])}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

/** Fit a source into a box without distorting it (CSS `object-fit: contain`). */
function drawContained(
  context: CanvasRenderingContext2D,
  source: HTMLVideoElement,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number
) {
  const sourceWidth = source.videoWidth || boxWidth;
  const sourceHeight = source.videoHeight || boxHeight;
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  context.drawImage(source, boxX + (boxWidth - width) / 2, boxY + (boxHeight - height) / 2, width, height);
}

function paintStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) return;
  context.save();
  context.strokeStyle = stroke.color;
  context.lineCap = "round";
  context.lineJoin = "round";
  // A highlighter is a fat, translucent pen — same path, different weight.
  context.lineWidth = stroke.tool === "highlighter" ? stroke.width * 3 : stroke.width;
  context.globalAlpha = stroke.tool === "highlighter" ? 0.35 : 1;
  context.beginPath();
  stroke.points.forEach((point, index) => {
    const x = point.x * CANVAS_WIDTH;
    const y = point.y * CANVAS_HEIGHT;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.restore();
}
