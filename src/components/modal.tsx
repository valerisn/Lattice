"use client";
import {
  useEffect,
  useRef,
  type ReactNode,
  type KeyboardEventHandler,
} from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  fullScreen = false,
  closeDisabled = false,
  onKeyDown,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  fullScreen?: boolean;
  closeDisabled?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""} ${fullScreen ? "full-screen" : ""}`}
      onKeyDownCapture={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        if (!closeDisabled) onClose();
      }}
      onClick={(e) => {
        if (!closeDisabled && e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
      aria-label={title}
    >
      <header className="row spread">
        <h2>{title}</h2>
        <button
          className="icon-button ghost"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
