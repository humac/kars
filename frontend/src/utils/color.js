/**
 * Color utility functions
 */

/**
 * Converts a hex color string to HSL values
 * @param {string} hex - Hex color string (with or without #)
 * @returns {{ h: number, s: number, l: number }} HSL values (h: 0-360, s: 0-100, l: 0-100)
 */
export const hexToHSL = (hex) => {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

/**
 * Applies a primary color to the document's CSS custom properties
 * @param {string} hexColor - Hex color string
 */
export const applyPrimaryColor = (hexColor) => {
  const { h, s, l } = hexToHSL(hexColor);

  // Set primary color as HSL for Tailwind
  document.documentElement.style.setProperty('--primary', `${h} ${s}% ${l}%`);

  // Set hover state with reduced lightness (10% darker)
  const hoverLightness = Math.max(0, l - 10);
  document.documentElement.style.setProperty('--primary-hover', `${h} ${s}% ${hoverLightness}%`);
};
