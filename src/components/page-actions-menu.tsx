"use client";
import { useEffect, useRef, type ReactNode } from "react";

export function PageActionsMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = (restoreFocus = false) => {
    const details = ref.current;
    if (!details) return;
    details.open = false;
    if (restoreFocus)
      details.querySelector("summary")?.focus({ preventScroll: true });
  };
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !ref.current?.contains(event.target) &&
        ref.current
      )
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return (
    <details
      ref={ref}
      className="more-menu"
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("button"))
          close(true);
      }}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && event.currentTarget.open) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
          return;
        if (
          !event.currentTarget.open &&
          !["ArrowDown", "ArrowUp"].includes(event.key)
        )
          return;
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ),
        );
        if (!buttons.length) return;
        event.preventDefault();
        event.currentTarget.open = true;
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : event.key === "ArrowDown"
                ? (index + 1) % buttons.length
                : index <= 0
                  ? buttons.length - 1
                  : index - 1;
        buttons[next].focus();
      }}
    >
      <summary aria-label="More page actions">•••</summary>
      {children}
    </details>
  );
}
