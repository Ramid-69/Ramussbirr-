'use client';

import React, { useEffect, useRef } from 'react';

interface PinchZoomContainerProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  resetKey?: string | number;
}

interface TransformState {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.2;

export default function PinchZoomContainer({
  children,
  className = '',
  contentClassName = '',
  resetKey,
}: PinchZoomContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<TransformState>({ scale: 1, x: 0, y: 0 });
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyTransformToDom = (next: TransformState, animate: boolean) => {
    const container = containerRef.current;
    const content = contentRef.current;
    transformRef.current = next;
    if (!container || !content) return;

    const isZoomed = next.scale > 1.001;
    container.style.touchAction = isZoomed ? 'none' : 'pan-y';
    container.style.overflow = isZoomed ? 'hidden' : '';

    content.style.transformOrigin = '0 0';
    content.style.transition = animate ? 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    content.style.transform = isZoomed
      ? `translate3d(${next.x}px, ${next.y}px, 0) scale(${next.scale})`
      : 'none';

    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    if (animate) {
      animTimerRef.current = setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.style.transition = 'none';
        }
      }, 190);
    }
  };

  useEffect(() => {
    applyTransformToDom({ scale: 1, x: 0, y: 0 }, false);
  }, [resetKey]);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    container.style.touchAction = 'pan-y';

    let mode: 'none' | 'pinch' | 'pan' = 'none';
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let pinchLocalX = 0;
    let pinchLocalY = 0;
    let panStartClientX = 0;
    let panStartClientY = 0;
    let panStartX = 0;
    let panStartY = 0;

    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const getBaseMetrics = () => {
      const containerRect = container.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const cur = transformRef.current;
      const baseLeft = contentRect.left - containerRect.left - cur.x;
      const baseTop = contentRect.top - containerRect.top - cur.y;
      const baseW = content.offsetWidth || contentRect.width / cur.scale;
      const baseH = content.offsetHeight || contentRect.height / cur.scale;
      return {
        containerRect,
        contentRect,
        baseLeft,
        baseTop,
        baseW,
        baseH,
        cW: containerRect.width,
        cH: containerRect.height,
      };
    };

    const clampTransform = (scale: number, x: number, y: number): TransformState => {
      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
      if (clampedScale <= 1.001) {
        return { scale: 1, x: 0, y: 0 };
      }

      const { baseLeft, baseTop, baseW, baseH, cW, cH } = getBaseMetrics();
      const scaledW = baseW * clampedScale;
      const scaledH = baseH * clampedScale;

      let clampedX = x;
      if (scaledW <= cW) {
        clampedX = (cW - scaledW) / 2 - baseLeft;
      } else {
        const minX = cW - scaledW - baseLeft;
        const maxX = 0 - baseLeft;
        clampedX = Math.min(maxX, Math.max(minX, x));
      }

      let clampedY = y;
      if (scaledH <= cH) {
        const minY = 0 - baseTop;
        const maxY = cH - scaledH - baseTop;
        clampedY = Math.min(maxY, Math.max(minY, y));
      } else {
        const minY = cH - scaledH - baseTop;
        const maxY = 0 - baseTop;
        clampedY = Math.min(maxY, Math.max(minY, y));
      }

      return { scale: clampedScale, x: clampedX, y: clampedY };
    };

    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        mode = 'pinch';
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        pinchStartDist = Math.max(1, getTouchDist(t1, t2));
        const cur = transformRef.current;
        pinchStartScale = cur.scale;

        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const contentRect = content.getBoundingClientRect();
        pinchLocalX = (midX - contentRect.left) / cur.scale;
        pinchLocalY = (midY - contentRect.top) / cur.scale;
        return;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();
        const dt = now - lastTapTime;
        const tapDist = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY);

        if (dt > 0 && dt < 280 && tapDist < 28) {
          e.preventDefault();
          lastTapTime = 0;
          mode = 'none';
          const cur = transformRef.current;
          if (cur.scale > 1.05) {
            applyTransformToDom({ scale: 1, x: 0, y: 0 }, true);
          } else {
            const { containerRect, contentRect, baseLeft, baseTop } = getBaseMetrics();
            const localX = (touch.clientX - contentRect.left) / cur.scale;
            const localY = (touch.clientY - contentRect.top) / cur.scale;
            const targetX = touch.clientX - containerRect.left - baseLeft - localX * DOUBLE_TAP_SCALE;
            const targetY = touch.clientY - containerRect.top - baseTop - localY * DOUBLE_TAP_SCALE;
            applyTransformToDom(clampTransform(DOUBLE_TAP_SCALE, targetX, targetY), true);
          }
          return;
        }

        lastTapTime = now;
        lastTapX = touch.clientX;
        lastTapY = touch.clientY;

        if (transformRef.current.scale > 1.01) {
          mode = 'pan';
          panStartClientX = touch.clientX;
          panStartClientY = touch.clientY;
          panStartX = transformRef.current.x;
          panStartY = transformRef.current.y;
        } else {
          mode = 'none';
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = getTouchDist(t1, t2);
        const rawScale = pinchStartScale * (dist / pinchStartDist);
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));

        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const { containerRect, baseLeft, baseTop } = getBaseMetrics();

        const rawX = midX - containerRect.left - baseLeft - pinchLocalX * newScale;
        const rawY = midY - containerRect.top - baseTop - pinchLocalY * newScale;
        applyTransformToDom(clampTransform(newScale, rawX, rawY), false);
        return;
      }

      if (mode === 'pan' && e.touches.length === 1 && transformRef.current.scale > 1.01) {
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - panStartClientX;
        const dy = touch.clientY - panStartClientY;
        applyTransformToDom(
          clampTransform(transformRef.current.scale, panStartX + dx, panStartY + dy),
          false
        );
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 1 && transformRef.current.scale > 1.01) {
        const touch = e.touches[0];
        mode = 'pan';
        panStartClientX = touch.clientX;
        panStartClientY = touch.clientY;
        panStartX = transformRef.current.x;
        panStartY = transformRef.current.y;
        return;
      }

      if (e.touches.length === 0) {
        mode = 'none';
        if (transformRef.current.scale <= 1.03 && transformRef.current.scale !== 1) {
          applyTransformToDom({ scale: 1, x: 0, y: 0 }, true);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const cur = transformRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cur.scale * factor));
      if (newScale <= 1.02) {
        applyTransformToDom({ scale: 1, x: 0, y: 0 }, false);
        return;
      }
      const { containerRect, contentRect, baseLeft, baseTop } = getBaseMetrics();
      const localX = (e.clientX - contentRect.left) / cur.scale;
      const localY = (e.clientY - contentRect.top) / cur.scale;
      const rawX = e.clientX - containerRect.left - baseLeft - localX * newScale;
      const rawY = e.clientY - containerRect.top - baseTop - localY * newScale;
      applyTransformToDom(clampTransform(newScale, rawX, rawY), false);
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      container.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <div ref={containerRef} className={className}>
      <div ref={contentRef} className={contentClassName}>
        {children}
      </div>
    </div>
  );
}
