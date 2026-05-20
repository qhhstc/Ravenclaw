"use client";

import { useEffect } from "react";

const horizontalGestureThreshold = 12;

function isElement(node: EventTarget | null): node is Element {
  return node instanceof Element;
}

function canScrollHorizontally(element: Element, direction: number) {
  const style = window.getComputedStyle(element);
  const overflowX = style.overflowX;
  const scrollableOverflow = overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay";
  if (!scrollableOverflow || element.scrollWidth <= element.clientWidth + 1) return false;
  if (direction < 0) return element.scrollLeft > 0;
  return element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
}

function hasScrollableHorizontalTarget(target: EventTarget | null, direction: number) {
  if (!isElement(target)) return false;
  let element: Element | null = target;
  while (element && element !== document.body && element !== document.documentElement) {
    if (canScrollHorizontally(element, direction)) return true;
    element = element.parentElement;
  }
  return false;
}

export default function HorizontalGestureGuard() {
  useEffect(() => {
    function handleWheel(event: WheelEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
      const horizontalDelta = Math.abs(event.deltaX);
      const verticalDelta = Math.abs(event.deltaY);
      if (horizontalDelta < horizontalGestureThreshold || horizontalDelta <= verticalDelta) return;
      if (hasScrollableHorizontalTarget(event.target, event.deltaX)) return;
      event.preventDefault();
    }

    window.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () => window.removeEventListener("wheel", handleWheel, { capture: true });
  }, []);

  return null;
}
