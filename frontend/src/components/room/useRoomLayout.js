import { useState, useCallback, useRef } from "react";

export const DEFAULT_LAYOUT = {
  horizontal: [400],
  outputHeight: 220,
};

export const LAYOUT_STORAGE_KEY = "codesync:roomLayout";

export const loadLayout = () => {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);

    let horizontal = Array.isArray(parsed.horizontal) ? parsed.horizontal : [];
    if (horizontal.length >= 3) {
      horizontal = [horizontal[0]];
    } else if (horizontal.length === 0) {
      horizontal = DEFAULT_LAYOUT.horizontal;
    } else {
      horizontal = [horizontal[0]];
    }

    const outputHeight =
      typeof parsed.outputHeight === "number" && parsed.outputHeight >= 100
        ? parsed.outputHeight
        : DEFAULT_LAYOUT.outputHeight;

    return { horizontal, outputHeight };
  } catch {
    return DEFAULT_LAYOUT;
  }
};

export const saveLayout = (layout) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore storage errors
  }
};

export function useResizableLayout() {
  const [layout, setLayout] = useState(loadLayout);

  const updateLayout = useCallback((updater) => {
    setLayout((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveLayout(next);
      return next;
    });
  }, []);

  return [layout, updateLayout];
}

export const useRoomLayout = useResizableLayout;

export function useDrag({ axis, onMove, onDragEnd }) {
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const stateRef = useRef(null);

  const handlePointerDown = useCallback(
    (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();

      const pointerId = e.pointerId;
      const target = e.currentTarget;

      stateRef.current = {
        startCoord: axis === "x" ? e.clientX : e.clientY,
        pointerId,
        target,
      };

      try {
        if (target && pointerId !== undefined) {
          target.setPointerCapture(pointerId);
        }
      } catch {
        // Ignore capture failure in environments that don't support it
      }

      document.body.classList.add("room-dragging");
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      const handlePointerMove = (ev) => {
        if (!stateRef.current) return;
        const coord = axis === "x" ? ev.clientX : ev.clientY;
        const delta = coord - stateRef.current.startCoord;
        stateRef.current.startCoord = coord;
        if (onMoveRef.current) {
          onMoveRef.current(delta);
        }
      };

      const handlePointerUp = (ev) => {
        if (!stateRef.current) return;
        try {
          if (stateRef.current.target && stateRef.current.pointerId !== undefined) {
            stateRef.current.target.releasePointerCapture(stateRef.current.pointerId);
          }
        } catch {
          // Ignore release failure
        }
        stateRef.current = null;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        document.body.classList.remove("room-dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (onDragEndRef.current) onDragEndRef.current();
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [axis]
  );

  return { handlePointerDown };
}
