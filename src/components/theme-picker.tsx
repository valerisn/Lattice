"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";

const choices = [
  { value: "light", label: "Light", detail: "A little daylight", icon: Sun },
  { value: "dark", label: "Dark", detail: "After the sun sets", icon: Moon },
  {
    value: "system",
    label: "System",
    detail: "In step with your device",
    icon: Monitor,
  },
] as const;
type Theme = (typeof choices)[number]["value"];
let fallback: Theme = "system";
const subscribe = (callback: () => void) => {
  window.addEventListener("lattice-theme", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("lattice-theme", callback);
    window.removeEventListener("storage", callback);
  };
};
const snapshot = (): Theme => {
  try {
    const value = localStorage.getItem("lattice-theme");
    return choices.find((choice) => choice.value === value)?.value || fallback;
  } catch {
    return fallback;
  }
};
export function ThemePicker() {
  const theme = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "system" as Theme,
  );
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = choices.find((choice) => choice.value === theme)!;
  const Icon = selected.icon;
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    if (!open) return;
    const position = () => {
      const anchor = trigger.current!.getBoundingClientRect();
      const panel = menu.current!;
      const height = panel.offsetHeight;
      const viewportWidth = document.documentElement.clientWidth;
      const above = window.innerHeight - anchor.bottom < height + 16;
      panel.style.left = `${Math.max(12, Math.min(anchor.left, viewportWidth - panel.offsetWidth - 12))}px`;
      panel.style.top = `${Math.max(12, above ? anchor.top - height - 10 : anchor.bottom + 10)}px`;
      panel.dataset.placement = above ? "above" : "below";
    };
    position();
    menu.current
      ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("pointerdown", dismiss);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [open]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="theme-picker">
      <span id={`${id}-label`}>Appearance</span>
      <button
        ref={trigger}
        type="button"
        className="theme-trigger"
        aria-label={`Appearance: ${selected.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Icon size={14} aria-hidden="true" />
        {selected.label}
        <ChevronDown size={12} className="theme-chevron" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            className="theme-menu"
            role="menu"
            aria-labelledby={`${id}-label`}
            onBlur={(event) => {
              if (
                event.relatedTarget !== trigger.current &&
                !event.currentTarget.contains(event.relatedTarget as Node)
              )
                setOpen(false);
            }}
            onKeyDown={(event) => {
              const items = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  '[role="menuitemradio"]',
                ),
              ];
              const index = items.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : (index +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          items.length) %
                        items.length;
                items[next].focus();
              } else if (event.key === "Escape") {
                event.preventDefault();
                close();
              } else if (event.key === "Tab") close();
            }}
          >
            <div className="theme-menu-heading" role="presentation">
              <span>MAKE YOURSELF AT HOME</span>
              <strong>A change of light.</strong>
            </div>
            {choices.map(({ value, label, detail, icon: OptionIcon }) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={theme === value}
                aria-label={label}
                tabIndex={-1}
                className="theme-option"
                onClick={() => {
                  fallback = value;
                  try {
                    localStorage.setItem("lattice-theme", value);
                  } catch {
                    /* Keep the preference for this session when storage is blocked. */
                  }
                  window.dispatchEvent(new Event("lattice-theme"));
                  close();
                }}
              >
                <span
                  className={`theme-swatch theme-swatch-${value}`}
                  aria-hidden="true"
                >
                  <i />
                  <i />
                  <i />
                </span>
                <span className="theme-option-copy">
                  <strong>
                    <OptionIcon size={13} aria-hidden="true" />
                    {label}
                  </strong>
                  <small>{detail}</small>
                </span>
                {theme === value && (
                  <Check size={15} className="theme-check" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
