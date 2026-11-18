import { alpha, createTheme } from '@mui/material/styles';

/*
 * Navigate — "North Star" design tokens.
 * `tokens` are fixed brand values (used by art that is always ink, e.g. the landing hero).
 * App surfaces read mode-aware colours from the MUI theme built by createAppTheme(mode);
 * styles/index.css mirrors them as CSS custom properties for non-MUI markup.
 */
export const tokens = {
  ink: '#0E1630',
  ink2: '#18234A',
  ink3: '#243163',
  inkMuted: '#9AA3C7',

  primary: '#3346E8',
  primaryLight: '#6B7BFF',
  primaryDark: '#2232B8',

  saffron: '#F2A93B',
  saffronLight: '#F7C878',
  saffronDark: '#C9821A',
  saffronInk: '#6B4207',

  success: '#12A37F',
  successInk: '#0B7A5E',
  warning: '#E8890C',
  warningInk: '#9A5300',
  error: '#E5484D',
  errorInk: '#C4282D',
  info: '#3B82F6',
  infoInk: '#1F5FD1',

  canvas: '#F6F5F1',
  canvasDeep: '#EFEDE6',
  paper: '#FFFFFF',
  sunken: '#FAF9F6',
  border: '#E7E5DE',
  borderStrong: '#D9D6CC',
  text: '#0E1630',
  muted: '#5B6178',
  faint: '#8A8FA3',

  fontDisplay: '"Fraunces", "Iowan Old Style", Georgia, "Times New Roman", serif',
  fontSans: '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
};

// Solid fills that carry white text (AA) — the same in both modes except primary.
const SOLID = {
  primary: tokens.primary,
  secondary: tokens.saffronDark,
  success: tokens.successInk,
  warning: tokens.warningInk,
  error: tokens.errorInk,
  info: tokens.infoInk,
};

const lightColors = {
  mode: 'light',
  fontDisplay: tokens.fontDisplay,
  fontSans: tokens.fontSans,
  ink: tokens.ink,
  primary: tokens.primary,
  primaryLight: tokens.primaryLight,
  primaryDark: tokens.primaryDark,
  primaryButton: tokens.primary,
  primaryButtonHover: tokens.primaryDark,
  onPrimary: '#FFFFFF',
  onAccent: tokens.ink,
  saffron: tokens.saffron,
  saffronDark: tokens.saffronDark,
  success: tokens.success,
  warning: tokens.warning,
  error: tokens.error,
  errorInk: tokens.errorInk,
  info: tokens.info,
  canvas: tokens.canvas,
  paper: tokens.paper,
  sunken: tokens.sunken,
  border: tokens.border,
  borderStrong: tokens.borderStrong,
  text: tokens.text,
  muted: tokens.muted,
  faint: tokens.faint,
  disabledBg: '#ECEAE3',
  disabledText: '#8A8EA2',
  chipText: '#2B3150',
  chipBg: '#EFEDE6',
  chipBgHover: '#E5E2D9',
  avatarBg: '#E8EAFD',
  rowBorder: '#EFEDE7',
  rowHover: '#FBFAF7',
  stepIdle: '#E4E2DA',
  inputBorder: '#DCD9CF',
  inputBorderHover: '#B8B4A7',
  filledHover: '#F2F0EA',
  controlIdle: '#A3A7B7',
  switchTrack: '#C9C6BC',
  sliderRail: '#DFDCD3',
  secondaryHover: '#E99B26',
  warningHover: '#D27A06',
  tooltipBg: tokens.ink,
  tooltipText: '#F4F5FA',
  backdrop: 'rgba(14, 22, 48, 0.5)',
  overlay: (a) => `rgba(14, 22, 48, ${a})`,
  shadowColor: (a) => `rgba(14, 22, 48, ${a})`,
  // Text-safe (AA on paper) shade for each status colour, used wherever the colour carries text.
  inkFor: {
    primary: tokens.primaryDark,
    secondary: tokens.saffronInk,
    success: tokens.successInk,
    warning: tokens.warningInk,
    error: tokens.errorInk,
    info: tokens.infoInk,
  },
  solid: SOLID,
  grey: {
    50: '#FBFAF7', 100: '#F5F4EF', 200: '#ECEAE3', 300: '#DFDCD3', 400: '#B9BAC4', 500: '#8A8FA3',
    600: '#5B6178', 700: '#41475F', 800: '#283048', 900: tokens.ink,
    A100: '#F1F0EB', A200: '#E4E2DA', A400: '#B9BAC4', A700: '#41475F',
  },
  status: {
    success: { main: tokens.success, light: '#5CCBAE', dark: tokens.successInk },
    warning: { main: tokens.warning, light: '#F5B860', dark: tokens.warningInk },
    error: { main: tokens.error, light: '#F08A8D', dark: tokens.errorInk },
    info: { main: tokens.info, light: '#7FB0FA', dark: tokens.infoInk },
  },
};

// Deep-ink night canvas (not pure black); brand blue lifted for contrast, saffron unchanged.
const darkColors = {
  mode: 'dark',
  fontDisplay: tokens.fontDisplay,
  fontSans: tokens.fontSans,
  ink: '#E8EBF7',
  primary: '#8391FF',
  primaryLight: '#A9B3FF',
  primaryDark: '#B4BCFF',
  primaryButton: '#4A5AF0',
  primaryButtonHover: '#5B6AF5',
  onPrimary: '#FFFFFF',
  onAccent: tokens.ink,
  saffron: tokens.saffron,
  saffronDark: tokens.saffron,
  success: '#2FCB9F',
  warning: '#F5A524',
  error: '#FF6B70',
  errorInk: '#FF8F93',
  info: '#60A5FA',
  canvas: '#0A1022',
  paper: '#111933',
  sunken: '#0D152C',
  border: '#232D50',
  borderStrong: '#323E68',
  text: '#E8EBF7',
  muted: '#A3ABCB',
  faint: '#7B84A8',
  disabledBg: '#1C2545',
  disabledText: '#6E7799',
  chipText: '#D5DAF0',
  chipBg: '#1C2546',
  chipBgHover: '#253058',
  avatarBg: '#252F5E',
  rowBorder: '#1C2647',
  rowHover: '#141D3A',
  stepIdle: '#283258',
  inputBorder: '#2C3760',
  inputBorderHover: '#46527F',
  filledHover: '#18213F',
  controlIdle: '#6E7799',
  switchTrack: '#3A4570',
  sliderRail: '#2C3760',
  secondaryHover: '#F7BE62',
  warningHover: '#F7B444',
  tooltipBg: '#E8EBF7',
  tooltipText: tokens.ink,
  backdrop: 'rgba(3, 6, 16, 0.72)',
  overlay: (a) => `rgba(232, 235, 247, ${Math.min(a * 1.5, 0.2)})`,
  shadowColor: (a) => `rgba(0, 0, 0, ${Math.min(a * 2.4, 0.7)})`,
  inkFor: {
    primary: '#A9B3FF',
    secondary: tokens.saffronLight,
    success: '#5BE0BA',
    warning: '#F8BC5A',
    error: '#FF9599',
    info: '#8CC0FF',
  },
  solid: { ...SOLID, primary: '#4A5AF0' },
  grey: {
    50: '#141C38', 100: '#18213F', 200: '#1E2849', 300: '#2A3560', 400: '#46527F', 500: '#7B84A8',
    600: '#A3ABCB', 700: '#C3C9E2', 800: '#DCE0F0', 900: '#F1F3FA',
    A100: '#18213F', A200: '#232D50', A400: '#46527F', A700: '#C3C9E2',
  },
  status: {
    success: { main: '#2FCB9F', light: '#5BE0BA', dark: '#12A37F' },
    warning: { main: '#F5A524', light: '#F8BC5A', dark: '#C9821A' },
    error: { main: '#FF6B70', light: '#FF9599', dark: '#E5484D' },
    info: { main: '#60A5FA', light: '#8CC0FF', dark: '#3B82F6' },
  },
};

/** Mode-aware raw colours (also available as `theme.nv`). */
export const colorsFor = (mode) => (mode === 'dark' ? darkColors : lightColors);

/** Build the MUI theme for 'light' | 'dark'. */
export const createAppTheme = (mode = 'light') => {
  const c = colorsFor(mode);
  const dark = mode === 'dark';

  // Elevation 1–24 collapsed into five calm, layered steps.
  const shadows = Array.from({ length: 25 }, (_, i) => {
    if (i === 0) return 'none';
    if (i <= 2) return `0 1px 2px ${c.shadowColor(0.05)}, 0 1px 3px ${c.shadowColor(0.03)}`;
    if (i <= 4) return `0 1px 2px ${c.shadowColor(0.04)}, 0 6px 16px -6px ${c.shadowColor(0.1)}`;
    if (i <= 8) return `0 2px 4px ${c.shadowColor(0.04)}, 0 14px 32px -10px ${c.shadowColor(0.18)}`;
    if (i <= 16) return `0 4px 10px ${c.shadowColor(0.06)}, 0 24px 48px -12px ${c.shadowColor(0.22)}`;
    return `0 8px 16px ${c.shadowColor(0.08)}, 0 32px 72px -16px ${c.shadowColor(0.3)}`;
  });

  const focusRing = { outline: `2px solid ${c.primary}`, outlineOffset: 2 };

  const base = createTheme({
    palette: {
      mode,
      primary: { main: c.primary, light: c.primaryLight, dark: dark ? '#5B6AF5' : tokens.primaryDark, contrastText: dark ? tokens.ink : '#FFFFFF' },
      secondary: { main: tokens.saffron, light: tokens.saffronLight, dark: tokens.saffronDark, contrastText: tokens.ink },
      success: { ...c.status.success, contrastText: dark ? tokens.ink : '#FFFFFF' },
      warning: { ...c.status.warning, contrastText: tokens.ink },
      error: { ...c.status.error, contrastText: dark ? tokens.ink : '#FFFFFF' },
      info: { ...c.status.info, contrastText: dark ? tokens.ink : '#FFFFFF' },
      text: { primary: c.text, secondary: c.muted, disabled: c.disabledText },
      background: { default: c.canvas, paper: c.paper },
      divider: c.border,
      grey: c.grey,
      action: {
        active: c.muted,
        hover: c.overlay(0.04),
        selected: alpha(c.primary, dark ? 0.16 : 0.08),
        focus: alpha(c.primary, 0.12),
        disabled: dark ? 'rgba(232, 235, 247, 0.3)' : c.overlay(0.32),
        disabledBackground: dark ? 'rgba(232, 235, 247, 0.08)' : c.overlay(0.07),
      },
    },
    shape: { borderRadius: 8 },
    shadows,
    typography: {
      fontFamily: tokens.fontSans,
      fontWeightLight: 400,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
    },
  });

  const { breakpoints } = base;
  const up = (key) => breakpoints.up(key);

  const theme = createTheme(base, {
    typography: {
      h1: {
        fontFamily: c.fontDisplay,
        fontWeight: 600,
        fontSize: '2.625rem',
        lineHeight: 1.04,
        letterSpacing: '-0.025em',
        [up('md')]: { fontSize: '3.75rem' },
      },
      h2: {
        fontFamily: c.fontDisplay,
        fontWeight: 600,
        fontSize: '2rem',
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        [up('md')]: { fontSize: '2.625rem' },
      },
      h3: {
        fontFamily: c.fontDisplay,
        fontWeight: 600,
        fontSize: '1.625rem',
        lineHeight: 1.15,
        letterSpacing: '-0.015em',
        [up('md')]: { fontSize: '2rem' },
      },
      // h4 is what the app pages use for their page titles, so it carries the serif too.
      h4: {
        fontFamily: c.fontDisplay,
        fontWeight: 600,
        fontSize: '1.625rem',
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
        [up('md')]: { fontSize: '2rem' },
      },
      h5: {
        fontWeight: 700,
        fontSize: '1.25rem',
        lineHeight: 1.3,
        letterSpacing: '-0.018em',
        fontVariantNumeric: 'tabular-nums',
      },
      h6: {
        fontWeight: 700,
        fontSize: '1.0625rem',
        lineHeight: 1.4,
        letterSpacing: '-0.01em',
      },
      subtitle1: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.5, letterSpacing: '-0.005em' },
      subtitle2: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.45 },
      body1: { fontSize: '1rem', lineHeight: 1.6 },
      body2: { fontSize: '0.875rem', lineHeight: 1.55 },
      button: { fontWeight: 600, fontSize: '0.875rem', textTransform: 'none', letterSpacing: '-0.005em' },
      caption: { fontSize: '0.75rem', lineHeight: 1.45, letterSpacing: '0.01em' },
      overline: { fontWeight: 700, fontSize: '0.6875rem', lineHeight: 1.6, letterSpacing: '0.14em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { colorScheme: mode },
          body: {
            backgroundColor: c.canvas,
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility',
          },
          '::selection': { backgroundColor: alpha(c.primary, 0.18) },
        },
      },

      MuiTypography: {
        styleOverrides: {
          // Pages use coloured h4s for big numbers (completion %, counts, similarity scores);
          // numbers stay in the UI sans with tabular figures rather than the display serif.
          root: ({ ownerState }) =>
            ownerState.variant === 'h4' && ownerState.color
              ? { fontFamily: c.fontSans, fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }
              : {},
        },
      },

      /* ---------- Buttons ---------- */
      MuiButtonBase: {
        defaultProps: { disableRipple: true },
        styleOverrides: {
          root: { '&.Mui-focusVisible': focusRing },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ ownerState }) => {
            const color = ownerState.color && ownerState.color !== 'inherit' ? ownerState.color : null;
            const main = color ? base.palette[color].main : null;
            const textInk = color ? c.inkFor[color] : c.ink;
            const style = {
              borderRadius: 10,
              fontWeight: 600,
              padding: '8px 16px',
              minHeight: 38,
              transition: 'background-color .16s ease, border-color .16s ease, color .16s ease, box-shadow .16s ease, transform .16s ease',
              '&:active:not(.Mui-disabled)': { transform: 'translateY(0.5px)' },
            };

            if (ownerState.variant === 'contained') {
              if (color === 'primary') {
                Object.assign(style, {
                  backgroundColor: c.primaryButton,
                  color: c.onPrimary,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.16), 0 1px 2px ${c.shadowColor(0.14)}`,
                  '&:hover': {
                    backgroundColor: c.primaryButtonHover,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 16px -6px ${alpha(c.primary, 0.6)}`,
                  },
                });
              } else if (color === 'secondary' || color === 'warning') {
                Object.assign(style, {
                  backgroundColor: main,
                  color: c.onAccent,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px ${c.shadowColor(0.12)}`,
                  '&:hover': { backgroundColor: color === 'secondary' ? c.secondaryHover : c.warningHover, boxShadow: `0 6px 16px -6px ${alpha(main, 0.7)}` },
                });
              } else if (color) {
                // success / error / info: deepen so white labels pass AA.
                Object.assign(style, {
                  backgroundColor: c.solid[color],
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 1px 2px ${c.shadowColor(0.14)}`,
                  '&:hover': { backgroundColor: alpha(c.solid[color], 0.9), boxShadow: `0 6px 16px -6px ${alpha(c.solid[color], 0.6)}` },
                });
              }
              Object.assign(style, {
                '&.Mui-disabled': { backgroundColor: c.disabledBg, color: c.disabledText, boxShadow: 'none' },
              });
            }

            if (ownerState.variant === 'outlined') {
              // Primary/default outlined buttons read as calm neutral "secondary" actions;
              // status colours keep a tinted outline so intent stays legible.
              const neutral = !color || color === 'primary';
              Object.assign(style, {
                backgroundColor: c.paper,
                borderColor: neutral ? c.borderStrong : alpha(main, 0.42),
                color: neutral ? c.ink : textInk,
                padding: '7px 15px',
                boxShadow: `0 1px 1px ${c.shadowColor(0.04)}`,
                '&:hover': {
                  borderColor: neutral ? alpha(c.primary, 0.55) : main,
                  backgroundColor: neutral ? alpha(c.primary, 0.04) : alpha(main, 0.06),
                  color: neutral ? c.primaryDark : textInk,
                },
                '&.Mui-disabled': { borderColor: c.border, color: c.disabledText, boxShadow: 'none' },
              });
            }

            if (ownerState.variant === 'text') {
              Object.assign(style, {
                color: color ? textInk : 'inherit',
                padding: '8px 12px',
                '&:hover': { backgroundColor: color ? alpha(main, 0.07) : c.overlay(0.05) },
              });
            }

            if (ownerState.size === 'small') {
              Object.assign(style, {
                minHeight: 32,
                fontSize: '0.8125rem',
                borderRadius: 8,
                padding: ownerState.variant === 'outlined' ? '4px 11px' : '5px 12px',
              });
            }
            if (ownerState.size === 'large') {
              Object.assign(style, {
                minHeight: 48,
                fontSize: '0.975rem',
                borderRadius: 12,
                padding: ownerState.variant === 'outlined' ? '11px 21px' : '12px 22px',
              });
            }
            return style;
          },
          startIcon: { marginRight: 6 },
          endIcon: { marginLeft: 6 },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            borderRadius: 10,
            transition: 'background-color .16s ease, color .16s ease',
            '&:hover': {
              backgroundColor:
                ownerState.color && ownerState.color !== 'default' && ownerState.color !== 'inherit'
                  ? alpha(base.palette[ownerState.color].main, 0.08)
                  : c.overlay(0.06),
            },
          }),
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderColor: c.border,
            borderRadius: 10,
            color: c.muted,
            // Selected = tinted Compass-Blue fill + inset ring, unmistakable in both modes.
            '&.Mui-selected, &.Mui-selected:hover': {
              color: c.inkFor.primary,
              backgroundColor: alpha(c.primary, dark ? 0.2 : 0.1),
              boxShadow: `inset 0 0 0 1.5px ${alpha(c.primary, dark ? 0.75 : 0.6)}`,
              zIndex: 1,
            },
            '&.Mui-focusVisible': { outline: `2px solid ${c.primary}`, outlineOffset: 2, zIndex: 2 },
          },
        },
      },
      MuiFab: {
        styleOverrides: { root: { boxShadow: shadows[8], textTransform: 'none' } },
      },
      MuiLink: {
        defaultProps: { underline: 'hover' },
        styleOverrides: {
          root: { fontWeight: 600, color: c.primary, textUnderlineOffset: 3, '&.Mui-focusVisible, &:focus-visible': { ...focusRing, borderRadius: 4 } },
        },
      },

      /* ---------- Surfaces ---------- */
      MuiPaper: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            backgroundImage: 'none',
            ...(ownerState.variant === 'elevation' && ownerState.elevation > 0 && {
              border: `1px solid ${c.border}`,
            }),
          }),
          rounded: { borderRadius: 14 },
          outlined: { borderColor: c.border },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            borderRadius: 16,
            border: `1px solid ${c.border}`,
            boxShadow: ownerState.variant === 'outlined' || ownerState.elevation === 0 ? 'none' : shadows[3],
            transition: 'box-shadow .2s ease, border-color .2s ease, transform .2s ease',
            // Lift only cards that are actually clickable.
            '&:has(> .MuiCardActionArea-root):hover': {
              borderColor: c.borderStrong,
              boxShadow: shadows[8],
              transform: 'translateY(-2px)',
            },
          }),
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: 20, '&:last-child': { paddingBottom: 20 } },
        },
      },
      MuiCardHeader: {
        styleOverrides: {
          root: { padding: '18px 20px 0' },
          title: { fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' },
          subheader: { fontSize: '0.8125rem', color: c.muted },
        },
      },
      MuiCardActions: {
        styleOverrides: {
          root: {
            padding: '4px 20px 18px',
            gap: 8,
            '& > :not(style) ~ :not(style)': { marginLeft: 0 },
            // Text-button labels line up with the card's text edge instead of sitting 12px in.
            '& > .MuiButton-text:first-of-type:not(.MuiButton-fullWidth)': { marginLeft: -12 },
            // A full-width text action reads as a deliberate card footer.
            '& > .MuiButton-text.MuiButton-fullWidth': {
              backgroundColor: alpha(c.primary, 0.06),
              '&:hover': { backgroundColor: alpha(c.primary, 0.11) },
            },
          },
        },
      },
      MuiCardActionArea: {
        styleOverrides: {
          root: { borderRadius: 'inherit', '&.Mui-focusVisible': { outline: `2px solid ${c.primary}`, outlineOffset: -2 } },
          focusHighlight: { opacity: 0 },
        },
      },
      MuiAccordion: {
        defaultProps: { disableGutters: true, elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            backgroundColor: c.paper,
            '&::before': { display: 'none' },
            '& + &': { marginTop: 10 },
            '&:first-of-type, &:last-of-type': { borderRadius: 14 },
          },
        },
      },
      MuiAccordionSummary: {
        styleOverrides: {
          root: { padding: '4px 18px', minHeight: 52, fontWeight: 600, borderRadius: 14 },
          content: { margin: '10px 0' },
          expandIconWrapper: { color: c.muted },
        },
      },
      MuiAccordionDetails: {
        styleOverrides: { root: { padding: '0 18px 18px', color: c.muted } },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: c.border } },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'inherit' },
        styleOverrides: { root: { border: 'none', borderRadius: 0 } },
      },
      MuiDrawer: {
        styleOverrides: { paper: { border: 'none', borderRadius: 0 } },
      },

      /* ---------- Data display ---------- */
      MuiChip: {
        styleOverrides: {
          root: ({ ownerState }) => {
            const color = ownerState.color && ownerState.color !== 'default' ? ownerState.color : null;
            const main = color ? base.palette[color].main : null;
            const textInk = color ? c.inkFor[color] : c.chipText;
            const filled = ownerState.variant !== 'outlined';
            return {
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '0.8125rem',
              letterSpacing: '-0.005em',
              height: 30,
              color: textInk,
              backgroundColor: filled ? (color ? alpha(main, color === 'secondary' ? 0.2 : 0.12) : c.chipBg) : c.paper,
              border: `1px solid ${filled ? (color ? alpha(main, 0.16) : 'transparent') : color ? alpha(main, 0.42) : c.borderStrong}`,
              '& .MuiChip-icon': { color: color ? (color === 'secondary' ? c.saffronDark : main) : c.muted, marginLeft: 8, marginRight: -2 },
              '& .MuiChip-deleteIcon': { color: alpha(color ? textInk : c.ink, 0.45), '&:hover': { color: color ? textInk : c.ink } },
              '&.MuiChip-clickable:hover': {
                backgroundColor: filled ? (color ? alpha(main, 0.2) : c.chipBgHover) : color ? alpha(main, 0.06) : c.sunken,
              },
              '& .MuiChip-avatar': { marginLeft: 4 },
            };
          },
          sizeSmall: { height: 24, fontSize: '0.75rem', borderRadius: 7 },
          label: { paddingLeft: 10, paddingRight: 10 },
          labelSmall: { paddingLeft: 8, paddingRight: 8 },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: { fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.01em' },
          rounded: { borderRadius: 12 },
          colorDefault: { backgroundColor: c.avatarBg, color: c.primaryDark },
        },
      },
      MuiBadge: {
        styleOverrides: {
          badge: ({ ownerState }) => ({
            fontWeight: 700,
            fontSize: '0.6875rem',
            boxShadow: `0 0 0 2px ${c.paper}`,
            ...(ownerState.color && ['success', 'error', 'info'].includes(ownerState.color) && {
              backgroundColor: c.solid[ownerState.color],
            }),
          }),
        },
      },
      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: {
            backgroundColor: c.tooltipBg,
            color: c.tooltipText,
            fontSize: '0.75rem',
            fontWeight: 500,
            lineHeight: 1.45,
            padding: '6px 10px',
            borderRadius: 8,
            boxShadow: shadows[8],
          },
          arrow: { color: c.tooltipBg },
        },
      },
      MuiSvgIcon: {
        styleOverrides: {
          colorSecondary: { color: c.saffronDark },
        },
      },
      MuiList: {
        styleOverrides: { root: { paddingTop: 4, paddingBottom: 4 } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            '&.Mui-selected': { backgroundColor: alpha(c.primary, 0.08), color: c.primaryDark },
            '&.Mui-selected:hover': { backgroundColor: alpha(c.primary, 0.12) },
            '&.Mui-focusVisible': { outline: `2px solid ${c.primary}`, outlineOffset: -2, backgroundColor: 'transparent' },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: { root: { minWidth: 40, color: c.muted } },
      },
      MuiListItemText: {
        styleOverrides: {
          primary: { fontWeight: 500 },
          secondary: { color: c.muted, fontSize: '0.8125rem' },
        },
      },
      MuiListSubheader: {
        styleOverrides: {
          root: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.muted, lineHeight: '36px' },
        },
      },

      /* ---------- Tables ---------- */
      MuiTableContainer: {
        styleOverrides: { root: { borderRadius: 14 } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${c.rowBorder}`,
            padding: '14px 16px',
            fontSize: '0.875rem',
            fontVariantNumeric: 'tabular-nums',
          },
          head: {
            backgroundColor: c.sunken,
            color: c.muted,
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            lineHeight: 1.4,
            paddingTop: 11,
            paddingBottom: 11,
            borderBottom: `1px solid ${c.border}`,
            whiteSpace: 'nowrap',
            '&:first-of-type': { borderTopLeftRadius: 10 },
            '&:last-of-type': { borderTopRightRadius: 10 },
          },
          sizeSmall: { padding: '10px 12px' },
          stickyHeader: { backgroundColor: c.sunken },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color .12s ease',
            '.MuiTableBody-root &:hover': { backgroundColor: c.rowHover },
            '.MuiTableBody-root &:last-of-type > .MuiTableCell-root': { borderBottom: 0 },
            '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: alpha(c.primary, 0.06) },
          },
        },
      },
      MuiTablePagination: {
        styleOverrides: { root: { borderTop: `1px solid ${c.border}` } },
      },
      MuiPaginationItem: {
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 600 },
        },
      },

      /* ---------- Navigation ---------- */
      MuiTabs: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            minHeight: 44,
            // A full-width row of many tabs can't fit narrow screens: let it swipe instead of clipping.
            ...(ownerState.variant === 'fullWidth' && {
              [breakpoints.down('lg')]: {
                '& .MuiTabs-scroller': { overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } },
              },
            }),
          }),
          indicator: { height: 3, borderRadius: '3px 3px 0 0', backgroundColor: c.primary },
          flexContainer: { gap: 4 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            minHeight: 44,
            minWidth: 0,
            padding: '10px 14px',
            color: c.muted,
            borderRadius: '10px 10px 0 0',
            transition: 'color .16s ease, background-color .16s ease',
            '&:hover': { color: c.ink, backgroundColor: c.overlay(0.03) },
            '&.Mui-selected': { color: c.ink },
            '&.Mui-focusVisible': { outline: `2px solid ${c.primary}`, outlineOffset: -2 },
            '&.Mui-disabled': { color: c.disabledText },
            '&.MuiTab-labelIcon': { minHeight: 44, paddingTop: 10 },
            '& > .MuiTab-iconWrapper': { marginBottom: 0, fontSize: 20 },
            // Full-width tab rows: one line per label, sized to content. Where a long row
            // wouldn't fit, icons drop out first; below lg the row scrolls sideways (see MuiTabs).
            '&.MuiTab-fullWidth': {
              flex: '1 1 auto',
              whiteSpace: 'nowrap',
              fontSize: '0.875rem',
              paddingLeft: 12,
              paddingRight: 12,
              '&.MuiTab-labelIcon > .MuiTab-iconWrapper': { marginRight: 6 },
              '@media (max-width: 1365.95px)': { '&.MuiTab-labelIcon > .MuiTab-iconWrapper': { display: 'none' } },
              [breakpoints.down('lg')]: { flex: '0 0 auto' },
            },
          },
        },
      },
      MuiStepper: {
        styleOverrides: { root: { padding: 0 } },
      },
      MuiStepIcon: {
        styleOverrides: {
          root: {
            color: c.stepIdle,
            width: 30,
            height: 30,
            '& .MuiStepIcon-text': { fill: c.muted, fontWeight: 700, fontSize: '0.75rem', fontFamily: c.fontSans },
            '&.Mui-active': { color: c.primary, filter: `drop-shadow(0 0 6px ${alpha(c.primary, 0.45)})` },
            '&.Mui-active .MuiStepIcon-text': { fill: c.onPrimary },
            '&.Mui-completed .MuiStepIcon-text': { fill: c.paper },
            '&.Mui-completed': { color: c.ink },
            '&.Mui-error': { color: c.error },
          },
        },
      },
      MuiStepLabel: {
        styleOverrides: {
          label: {
            fontWeight: 500,
            color: c.muted,
            '&.Mui-active': { color: c.ink, fontWeight: 700 },
            '&.Mui-completed': { color: c.ink, fontWeight: 600 },
          },
        },
      },
      MuiStepConnector: {
        styleOverrides: {
          line: { borderColor: c.borderStrong, borderTopWidth: 2, borderRadius: 2 },
          root: {
            '&.Mui-active .MuiStepConnector-line, &.Mui-completed .MuiStepConnector-line': { borderColor: c.primary },
          },
          alternativeLabel: { top: 15, left: 'calc(-50% + 22px)', right: 'calc(50% + 22px)' },
        },
      },
      MuiBreadcrumbs: {
        styleOverrides: { root: { fontSize: '0.8125rem', color: c.muted } },
      },

      /* ---------- Inputs ---------- */
      MuiTextField: {
        defaultProps: { variant: 'outlined' },
      },
      MuiInputBase: {
        styleOverrides: {
          root: { fontSize: '0.9375rem' },
          input: {
            '&::placeholder': { color: c.faint, opacity: 1 },
            // Native date/time pickers: match the field typography and give the picker icon a hover target.
            '&[type="date"], &[type="datetime-local"], &[type="time"], &[type="month"]': {
              fontVariantNumeric: 'tabular-nums',
              minHeight: '1.4375em',
              '&::-webkit-datetime-edit': { color: c.text, padding: 0 },
              '&::-webkit-datetime-edit-fields-wrapper': { padding: 0 },
              '&::-webkit-datetime-edit-text': { color: c.faint, padding: '0 1px' },
              '&::-webkit-calendar-picker-indicator': {
                cursor: 'pointer',
                opacity: 0.65,
                padding: 4,
                marginRight: -4,
                borderRadius: 6,
                transition: 'opacity .16s ease, background-color .16s ease',
                '&:hover': { opacity: 1, backgroundColor: c.overlay(0.06) },
              },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ ownerState }) => ({
            borderRadius: 10,
            backgroundColor: c.paper,
            // Floating-label notch: same size/weight as the shrunk label, with a little extra air.
            '& .MuiOutlinedInput-notchedOutline legend': { fontWeight: 600, '& > span': { paddingLeft: 6, paddingRight: 6 } },
            transition: 'box-shadow .16s ease, background-color .16s ease',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: c.inputBorder, transition: 'border-color .16s ease' },
            '&:hover:not(.Mui-disabled):not(.Mui-focused) .MuiOutlinedInput-notchedOutline': { borderColor: c.inputBorderHover },
            '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(c.primary, 0.14)}` },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: c.primary, borderWidth: 1 },
            '&.Mui-error.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(c.error, 0.14)}` },
            '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: c.error },
            '&.Mui-disabled': { backgroundColor: c.sunken },
            ...(ownerState.multiline && ownerState.size !== 'small' && { paddingTop: 13.5, paddingBottom: 13.5 }),
          }),
          // Vertical padding only, so MUI's adornment / multiline padding logic stays intact.
          input: ({ ownerState }) =>
            !ownerState.multiline && ownerState.size !== 'small' ? { paddingTop: 13.5, paddingBottom: 13.5 } : {},
        },
      },
      MuiFilledInput: {
        styleOverrides: {
          root: {
            borderRadius: '10px 10px 0 0',
            backgroundColor: c.sunken,
            '&:hover': { backgroundColor: c.filledHover },
            '&.Mui-focused': { backgroundColor: c.filledHover },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: c.muted,
            fontWeight: 500,
            // Same size as the input text, so the outline notch (sized from the input) fits the label exactly.
            fontSize: '0.9375rem',
            '&.Mui-focused': { color: c.primaryDark },
            '&.Mui-error': { color: c.errorInk },
          },
          // Re-centre the resting label for the slightly shorter (48px) inputs.
          outlined: ({ ownerState }) => {
            if (ownerState.shrink) return { transform: 'translate(15px, -9px) scale(0.75)', fontWeight: 600 };
            return ownerState.size !== 'small' ? { transform: 'translate(14px, 13px) scale(1)' } : {};
          },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: { color: c.ink, fontWeight: 600, '&.Mui-focused': { color: c.ink } },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: { marginLeft: 2, marginRight: 2, marginTop: 6, marginBottom: 4, lineHeight: 1.4, fontSize: '0.78rem', color: c.muted, '&.Mui-error': { color: c.errorInk } },
        },
      },
      MuiFormControlLabel: {
        styleOverrides: { label: { fontSize: '0.9375rem' } },
      },
      MuiSelect: {
        styleOverrides: {
          icon: { color: c.muted },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: 12, marginTop: 6, minWidth: 180 },
          list: { padding: 6 },
        },
      },
      MuiPopover: {
        styleOverrides: { paper: { borderRadius: 12 } },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontSize: '0.9rem',
            minHeight: 38,
            padding: '8px 12px',
            '&:hover': { backgroundColor: c.overlay(0.045) },
            '&.Mui-selected': { backgroundColor: alpha(c.primary, 0.08), color: c.primaryDark, fontWeight: 600 },
            '&.Mui-selected:hover': { backgroundColor: alpha(c.primary, 0.12) },
            '&.Mui-focusVisible': { backgroundColor: alpha(c.primary, 0.1) },
            '& + .MuiDivider-root': { marginTop: 6, marginBottom: 6 },
          },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: { borderRadius: 12, border: `1px solid ${c.border}`, boxShadow: shadows[8] },
          option: { borderRadius: 8, margin: '0 6px' },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: { color: c.controlIdle, borderRadius: 8, padding: 8 },
        },
      },
      MuiRadio: {
        styleOverrides: { root: { color: c.controlIdle, padding: 8 } },
      },
      MuiSwitch: {
        styleOverrides: {
          root: { padding: 8 },
          track: { borderRadius: 11, backgroundColor: c.switchTrack, opacity: 1 },
          thumb: { width: 16, height: 16, margin: 2, boxShadow: `0 1px 2px ${c.shadowColor(0.25)}` },
          switchBase: {
            '&.Mui-checked': { color: '#FFFFFF' },
            '&.Mui-checked + .MuiSwitch-track': { opacity: 1 },
            '&.Mui-disabled + .MuiSwitch-track': { opacity: 0.4 },
          },
        },
      },
      MuiSlider: {
        styleOverrides: {
          thumb: { boxShadow: `0 0 0 4px ${alpha(c.primary, 0.16)}` },
          rail: { backgroundColor: c.sliderRail, opacity: 1 },
        },
      },

      /* ---------- Feedback ---------- */
      MuiAlert: {
        styleOverrides: {
          root: ({ ownerState }) => {
            const severity = ownerState.severity || 'success';
            const color = ownerState.color || severity;
            const main = base.palette[color]?.main || c.info;
            const textInk = c.inkFor[color] || c.ink;
            const style = {
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: '0.875rem',
              alignItems: 'flex-start',
              border: '1px solid transparent',
            };
            if (ownerState.variant === 'filled') {
              Object.assign(style, { backgroundColor: c.solid[color] || c.solid.info, color: '#FFFFFF', '& .MuiAlert-icon': { color: '#FFFFFF' } });
            } else if (ownerState.variant === 'outlined') {
              Object.assign(style, { backgroundColor: c.paper, borderColor: alpha(main, 0.45), color: textInk, '& .MuiAlert-icon': { color: main } });
            } else {
              Object.assign(style, {
                backgroundColor: alpha(main, color === 'warning' ? 0.1 : 0.08),
                borderColor: alpha(main, 0.22),
                color: textInk,
                '& .MuiAlert-icon': { color: color === 'warning' ? c.warning : main },
              });
            }
            return style;
          },
          icon: { padding: '8px 0', marginRight: 10, opacity: 1 },
          message: { padding: '8px 0', lineHeight: 1.5 },
          action: { paddingTop: 2 },
        },
      },
      MuiAlertTitle: {
        styleOverrides: { root: { fontWeight: 700, marginBottom: 2, fontSize: '0.9rem' } },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: ({ ownerState }) => {
            const color = ownerState.color && ownerState.color !== 'inherit' ? ownerState.color : 'primary';
            return {
              height: 8,
              borderRadius: 999,
              backgroundColor: alpha(base.palette[color].main, 0.13),
            };
          },
          bar: ({ ownerState }) => ({
            borderRadius: 999,
            ...((!ownerState.color || ownerState.color === 'primary') && {
              backgroundImage: `linear-gradient(90deg, ${c.primary}, ${c.primaryLight})`,
            }),
          }),
        },
      },
      MuiCircularProgress: {
        defaultProps: { thickness: 4.2 },
        styleOverrides: { circle: { strokeLinecap: 'round' } },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: { backgroundColor: c.disabledBg },
          rounded: { borderRadius: 10 },
        },
      },
      MuiSnackbarContent: {
        styleOverrides: { root: { backgroundColor: c.tooltipBg, color: c.tooltipText, borderRadius: 12, border: 'none' } },
      },
      MuiBackdrop: {
        styleOverrides: {
          root: ({ ownerState }) => (ownerState.invisible ? {} : { backgroundColor: c.backdrop }),
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 20, border: 'none', boxShadow: shadows[24] },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.015em', padding: '22px 24px 10px' },
        },
      },
      MuiDialogContent: {
        styleOverrides: { root: { padding: '8px 24px 16px' } },
      },
      MuiDialogContentText: {
        styleOverrides: { root: { color: c.muted, fontSize: '0.9375rem' } },
      },
      MuiDialogActions: {
        styleOverrides: { root: { padding: '12px 24px 20px', gap: 8, '& > :not(style) ~ :not(style)': { marginLeft: 0 } } },
      },
    },
  });
  theme.nv = c;
  return theme;
};

/** Default (light) theme, for tests and non-React consumers. */
const theme = createAppTheme('light');
export default theme;
