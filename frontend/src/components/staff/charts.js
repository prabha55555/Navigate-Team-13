import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { alpha, decomposeColor, getContrastRatio, recomposeColor, useTheme } from '@mui/material/styles';
import { useMemo } from 'react';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler);

/**
 * Theme-driven chart styling: one axis per chart (never dual-axis), recessive
 * grid, thin marks, rounded bar ends, tooltips in the theme's paper colours.
 */
export function useChartTheme() {
  const theme = useTheme();
  return useMemo(() => {
    const dark = theme.palette.mode === 'dark';
    const text = theme.palette.text.secondary;
    const grid = alpha(theme.palette.text.primary, dark ? 0.1 : 0.07);
    const font = { family: theme.typography.fontFamily, size: 12 };
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.palette.background.paper,
          titleColor: theme.palette.text.primary,
          bodyColor: theme.palette.text.secondary,
          borderColor: theme.palette.divider,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          boxPadding: 4,
          titleFont: { ...font, weight: '700' },
          bodyFont: font,
          usePointStyle: true,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: grid },
          ticks: { color: text, font, maxRotation: 0, autoSkipPadding: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: grid, drawTicks: false },
          border: { display: false },
          ticks: { color: text, font, padding: 8, precision: 0 },
        },
      },
    };
    return {
      base,
      colors: {
        primary: theme.palette.primary.main,
        // Solid, lighter step in dark mode so bars hold their own next to the error hue.
        primarySoft: dark ? theme.palette.primary.light : alpha(theme.palette.primary.main, 0.75),
        secondary: theme.palette.secondary.main,
        success: theme.palette.success.main,
        error: theme.palette.error.main,
        warning: theme.palette.warning.main,
        surface: theme.palette.background.paper,
        area: alpha(theme.palette.primary.main, 0.08),
      },
    };
  }, [theme]);
}

/** Colour of `fg` at opacity `a` laid over `bg` (both opaque CSS colours). */
export const blend = (fg, bg, a) => {
  const f = decomposeColor(fg).values;
  const b = decomposeColor(bg).values;
  return recomposeColor({ type: 'rgb', values: [0, 1, 2].map((i) => Math.round(f[i] * a + b[i] * (1 - a))) });
};

/** Whichever of the candidate text colours has the higher contrast on `bg`. */
export const readableOn = (bg, candidates) =>
  candidates.reduce((best, c) => (getContrastRatio(c, bg) > getContrastRatio(best, bg) ? c : best), candidates[0]);

/** Bar dataset defaults: rounded data-end, 2px surface gap between bars. */
export const barDataset = (colors, overrides = {}) => ({
  borderRadius: 4,
  borderSkipped: 'start',
  borderWidth: 0,
  maxBarThickness: 36,
  categoryPercentage: 0.8,
  barPercentage: 0.9,
  ...overrides,
});

/** Line dataset defaults: 2px line, ≥8px markers ringed with the surface colour. */
export const lineDataset = (colors, color, overrides = {}) => ({
  borderColor: color,
  backgroundColor: color,
  borderWidth: 2,
  pointRadius: 4,
  pointHoverRadius: 6,
  pointBorderWidth: 2,
  pointBorderColor: colors.surface,
  tension: 0.3,
  spanGaps: true,
  ...overrides,
});
