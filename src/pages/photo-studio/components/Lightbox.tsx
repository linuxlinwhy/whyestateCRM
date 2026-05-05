import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface LightboxProps {
  beforeUrl: string;
  afterUrl: string | null;
  onClose: () => void;
}

// Fullscreen before/after compare. Drag horizontally to reveal the BEFORE image.
// Defaults to AFTER fully visible (split = 0%).
export default function Lightbox({ beforeUrl, afterUrl, onClose }: LightboxProps) {
  const [split, setSplit] = useState(0);
  const compareRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setFromX = (clientX: number) => {
    const el = compareRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const v = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(0, Math.min(100, v)));
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.95)", padding: 20 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        onClick={onClose}
        title="Close (Esc)"
        className="absolute top-4 right-4 z-[101] w-10 h-10 rounded-full flex items-center justify-center transition-colors"
        style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: 0 }}
      >
        <X size={20} />
      </button>

      {afterUrl ? (
        <>
          <div
            ref={compareRef}
            className="relative inline-block max-w-full select-none"
            style={{
              maxHeight: "calc(100vh - 80px)",
              touchAction: "none",
              cursor: "ew-resize",
            }}
            onPointerDown={(e) => {
              dragging.current = true;
              try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
              setFromX(e.clientX);
            }}
            onPointerMove={(e) => {
              if (dragging.current) setFromX(e.clientX);
            }}
            onPointerUp={() => { dragging.current = false; }}
            onPointerCancel={() => { dragging.current = false; }}
            onPointerLeave={() => { dragging.current = false; }}
          >
            <img
              src={afterUrl}
              alt="after"
              draggable={false}
              className="block"
              style={{
                maxWidth: "calc(100vw - 80px)",
                maxHeight: "calc(100vh - 80px)",
                width: "auto",
                height: "auto",
                pointerEvents: "none",
                userSelect: "none",
              }}
            />
            {/* BEFORE clipped overlay */}
            <div
              className="absolute inset-0"
              style={{
                clipPath: `polygon(0 0, ${split}% 0, ${split}% 100%, 0 100%)`,
                zIndex: 2,
              }}
            >
              <img
                src={beforeUrl}
                alt="before"
                draggable={false}
                className="absolute inset-0"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "fill",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            </div>
            {/* Divider */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: `${split}%`,
                width: 2,
                background: "rgba(255,255,255,0.95)",
                transform: "translateX(-1px)",
                zIndex: 3,
                boxShadow: "0 0 8px rgba(0,0,0,0.6)",
              }}
            >
              <span
                className="absolute"
                style={{
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.98)",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                }}
              />
              <span
                className="absolute font-bold"
                style={{
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  color: "#0e1014",
                  fontSize: 16,
                  zIndex: 4,
                }}
              >
                ⇿
              </span>
            </div>
            {/* Labels */}
            <span
              className="absolute pointer-events-none"
              style={{
                top: 12, left: 12,
                padding: "4px 10px",
                background: "rgba(0,0,0,0.65)",
                color: "white",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.6px",
                borderRadius: 3,
                zIndex: 4,
              }}
            >BEFORE</span>
            <span
              className="absolute pointer-events-none"
              style={{
                top: 12, right: 12,
                padding: "4px 10px",
                background: "rgba(0,0,0,0.65)",
                color: "white",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.6px",
                borderRadius: 3,
                zIndex: 4,
              }}
            >AFTER</span>
          </div>
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              color: "rgba(255,255,255,0.6)",
              fontSize: 11,
              zIndex: 102,
            }}
          >
            Drag right to reveal BEFORE • Esc closes
          </div>
        </>
      ) : (
        <img
          src={beforeUrl}
          alt=""
          onClick={onClose}
          className="max-w-full max-h-full object-contain cursor-zoom-out"
        />
      )}
    </div>
  );
}
