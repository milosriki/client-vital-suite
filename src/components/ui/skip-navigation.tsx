/**
 * Skip Navigation Component
 * Enterprise accessibility per WCAG 2.1 AA
 *
 * Provides keyboard users a way to skip to main content
 */

export function SkipNavigation() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:border focus:border-border focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Skip to main content
    </a>
  );
}

export default SkipNavigation;
