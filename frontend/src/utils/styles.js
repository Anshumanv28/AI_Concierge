/**
 * Style tokens for inline styles — "mono" design system.
 * One surface ramp (paper), one text ramp (ink), one accent hue (neon green,
 * reserved for the live/active moment and the single primary action), and a
 * small status set (success/warning/danger) used only for status.
 * Values are CSS variables defined in index.css.
 */

export const colors = {
  paper: {
    50: "var(--paper-50)",
    100: "var(--paper-100)",
    200: "var(--paper-200)",
    300: "var(--paper-300)",
    400: "var(--paper-400)",
  },
  ink: {
    400: "var(--ink-400)",
    500: "var(--ink-500)",
    600: "var(--ink-600)",
    700: "var(--ink-700)",
    900: "var(--ink-900)",
  },
  accent: {
    100: "var(--accent-100)",
    300: "var(--accent-300)",
    500: "var(--accent-500)",
    700: "var(--accent-700)",
    900: "var(--accent-900)",
    ink: "var(--accent-ink)",
  },
  success: {
    100: "var(--success-100)",
    600: "var(--success-600)",
    700: "var(--success-700)",
  },
  warning: {
    100: "var(--warning-100)",
    600: "var(--warning-600)",
    700: "var(--warning-700)",
  },
  danger: {
    100: "var(--danger-100)",
    600: "var(--danger-600)",
    700: "var(--danger-700)",
  },
};

// Responsive breakpoints
export const breakpoints = {
  mobile: 640,
  tablet: 1024,
  desktop: 1440,
};

// One radius scale — small, deliberate, never a pill except a true circle
export const borderRadius = {
  sm: "4px",
  md: "8px",
  full: "9999px",
};

// Compact density
export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
};

// Animation durations
export const transitions = {
  fast: "120ms",
  normal: "180ms",
  slow: "260ms",
};

// Monospace type, two faces: Space Mono for display/body, JetBrains Mono for small labels
export const fonts = {
  display: `"Space Mono", "JetBrains Mono", Menlo, Consolas, monospace`,
  label: `"JetBrains Mono", "Space Mono", Menlo, Consolas, monospace`,
};

// Helper function to get responsive styles
export const getResponsiveStyle = (mobile, tablet, desktop) => {
  return {
    "@media (max-width: 639px)": mobile,
    "@media (min-width: 640px) and (max-width: 1023px)": tablet,
    "@media (min-width: 1024px)": desktop,
  };
};

const styleUtils = {
  colors,
  breakpoints,
  borderRadius,
  spacing,
  transitions,
  fonts,
};

export default styleUtils;
