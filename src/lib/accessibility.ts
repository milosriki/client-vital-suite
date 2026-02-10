/**
 * Accessibility Utilities
 * Enterprise ARIA helpers per ui-ux-pro-max skill
 *
 * Provides:
 * - Screen reader announcements (aria-live)
 * - Focus management helpers
 * - prefers-reduced-motion support
 * - Skip navigation component
 */

import { useEffect, useRef, useCallback, useState } from "react";

// ============================================================================
// SCREEN READER ANNOUNCEMENTS
// ============================================================================

/**
 * Hook to announce messages to screen readers via aria-live region
 *
 * @example
 * const announce = useAnnounce();
 * announce("3 new clients loaded");
 */
export function useAnnounce() {
  const regionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create a persistent aria-live region if it doesn't exist
    if (!document.getElementById("sr-announcer")) {
      const region = document.createElement("div");
      region.id = "sr-announcer";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");
      region.style.cssText = `
        position: absolute; width: 1px; height: 1px;
        padding: 0; margin: -1px; overflow: hidden;
        clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
      `;
      document.body.appendChild(region);
      regionRef.current = region;
    } else {
      regionRef.current = document.getElementById(
        "sr-announcer",
      ) as HTMLDivElement;
    }
  }, []);

  return useCallback((message: string) => {
    if (regionRef.current) {
      regionRef.current.textContent = "";
      // Small delay to ensure the screen reader picks up the change
      requestAnimationFrame(() => {
        if (regionRef.current) regionRef.current.textContent = message;
      });
    }
  }, []);
}

// ============================================================================
// FOCUS MANAGEMENT
// ============================================================================

/**
 * Hook to trap focus within a container (for modals, dialogs)
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    firstFocusable.focus();

    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [isActive]);

  return containerRef;
}

// ============================================================================
// REDUCED MOTION
// ============================================================================

/**
 * Hook to respect prefers-reduced-motion
 * Per ui-ux-pro-max: "Support prefers-reduced-motion"
 *
 * @example
 * const prefersReduced = usePrefersReducedMotion();
 * const spring = prefersReduced ? { duration: 0 } : { duration: 300 };
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefersReduced;
}

// ============================================================================
// ARIA HELPERS
// ============================================================================

/**
 * Generate ARIA props for a loading state
 */
export function ariaLoading(isLoading: boolean) {
  return {
    "aria-busy": isLoading,
    "aria-live": "polite" as const,
  };
}

/**
 * Generate ARIA props for a table with sorting
 */
export function ariaSortable(
  column: string,
  currentSort: string,
  direction: "asc" | "desc",
) {
  return {
    "aria-sort":
      column === currentSort
        ? ((direction === "asc" ? "ascending" : "descending") as const)
        : ("none" as const),
    role: "columnheader" as const,
  };
}

/**
 * Visually hidden text for screen readers only
 */
export function srOnly(text: string) {
  return { className: "sr-only", children: text };
}
