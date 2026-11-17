import { alpha, createTheme } from '@mui/material/styles';

/*
 * Navigate — "North Star" design tokens.
 * Mirrored as CSS custom properties in styles/index.css for non-MUI use.
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

// Text-safe (AA on white) shade for each status colour, used wherever the colour carries text.
const inkFor = {
  primary: tokens.primaryDark,
  secondary: tokens.saffronInk,
  success: tokens.successInk,
  warning: tokens.warningInk,
  error: tokens.errorInk,
  info: tokens.infoInk,
};

const inkShadow = (a) => `rgba(14, 22, 48, ${a})`;

// Elevation 1–24 collapsed into five calm, layered steps.
const shadows = Array.from({ length: 25 }, (_, i) => {
  if (i === 0) return 'none';
  if (i <= 2) return `0 1px 2px ${inkShadow(0.05)}, 0 1px 3px ${inkShadow(0.03)}`;
  if (i <= 4) return `0 1px 2px ${inkShadow(0.04)}, 0 6px 16px -6px ${inkShadow(0.1)}`;
  if (i <= 8) return `0 2px 4px ${inkShadow(0.04)}, 0 14px 32px -10px ${inkShadow(0.18)}`;
  if (i <= 16) return `0 4px 10px ${inkShadow(0.06)}, 0 24px 48px -12px ${inkShadow(0.22)}`;
  return `0 8px 16px ${inkShadow(0.08)}, 0 32px 72px -16px ${inkShadow(0.3)}`;
});

const focusRing = {
  outline: `2px solid ${tokens.primary}`,
  outlineOffset: 2,
};

const base = createTheme({
  palette: {
    mode: 'light',
    primary: { main: tokens.primary, light: tokens.primaryLight, dark: tokens.primaryDark, contrastText: '#FFFFFF' },
    secondary: { main: tokens.saffron, light: tokens.saffronLight, dark: tokens.saffronDark, contrastText: tokens.ink },
    success: { main: tokens.success, light: '#5CCBAE', dark: tokens.successInk, contrastText: '#FFFFFF' },
    warning: { main: tokens.warning, light: '#F5B860', dark: tokens.warningInk, contrastText: tokens.ink },
    error: { main: tokens.error, light: '#F08A8D', dark: tokens.errorInk, contrastText: '#FFFFFF' },
    info: { main: tokens.info, light: '#7FB0FA', dark: tokens.infoInk, contrastText: '#FFFFFF' },
    text: { primary: tokens.text, secondary: tokens.muted, disabled: '#9A9EB0' },
    background: { default: tokens.canvas, paper: tokens.paper },
    divider: tokens.border,
    grey: {
      50: '#FBFAF7',
      100: '#F5F4EF',
      200: '#ECEAE3',
      300: '#DFDCD3',
      400: '#B9BAC4',
      500: '#8A8FA3',
      600: '#5B6178',
      700: '#41475F',
      800: '#283048',
      900: tokens.ink,
      A100: '#F1F0EB',
      A200: '#E4E2DA',
      A400: '#B9BAC4',
      A700: '#41475F',
    },
    action: {
      active: tokens.muted,
      hover: inkShadow(0.04),
      selected: alpha(tokens.primary, 0.08),
      focus: alpha(tokens.primary, 0.12),
      disabled: inkShadow(0.32),
      disabledBackground: inkShadow(0.07),
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
      fontFamily: tokens.fontDisplay,
      fontWeight: 600,
      fontSize: '2.625rem',
      lineHeight: 1.04,
      letterSpacing: '-0.025em',
      [up('md')]: { fontSize: '3.75rem' },
    },
    h2: {
      fontFamily: tokens.fontDisplay,
      fontWeight: 600,
      fontSize: '2rem',
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
      [up('md')]: { fontSize: '2.625rem' },
    },
    h3: {
      fontFamily: tokens.fontDisplay,
      fontWeight: 600,
      fontSize: '1.625rem',
      lineHeight: 1.15,
      letterSpacing: '-0.015em',
      [up('md')]: { fontSize: '2rem' },
    },
    // h4 is what the app pages use for their page titles, so it carries the serif too.
    h4: {
      fontFamily: tokens.fontDisplay,
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
        body: {
          backgroundColor: tokens.canvas,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
        },
        '::selection': { backgroundColor: alpha(tokens.primary, 0.18) },
      },
    },

    MuiTypography: {
      styleOverrides: {
        // Pages use coloured h4s for big numbers (completion %, counts, similarity scores);
        // numbers stay in the UI sans with tabular figures rather than the display serif.
        root: ({ ownerState }) =>
          ownerState.variant === 'h4' && ownerState.color
            ? { fontFamily: tokens.fontSans, fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }
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
          const textInk = color ? inkFor[color] : tokens.ink;
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
                backgroundColor: tokens.primary,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.16), 0 1px 2px ${inkShadow(0.14)}`,
                '&:hover': {
                  backgroundColor: tokens.primaryDark,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 16px -6px ${alpha(tokens.primary, 0.6)}`,
                },
              });
            } else if (color === 'secondary' || color === 'warning') {
              Object.assign(style, {
                backgroundColor: main,
                color: tokens.ink,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px ${inkShadow(0.12)}`,
                '&:hover': { backgroundColor: color === 'secondary' ? '#E99B26' : '#D27A06', boxShadow: `0 6px 16px -6px ${alpha(main, 0.7)}` },
              });
            } else if (color) {
              // success / error / info: deepen so white labels pass AA.
              Object.assign(style, {
                backgroundColor: inkFor[color],
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 1px 2px ${inkShadow(0.14)}`,
                '&:hover': { backgroundColor: alpha(inkFor[color], 0.9), boxShadow: `0 6px 16px -6px ${alpha(inkFor[color], 0.6)}` },
              });
            }
            Object.assign(style, {
              '&.Mui-disabled': { backgroundColor: '#ECEAE3', color: '#9A9EB0', boxShadow: 'none' },
            });
          }

          if (ownerState.variant === 'outlined') {
            // Primary/default outlined buttons read as calm neutral "secondary" actions;
            // status colours keep a tinted outline so intent stays legible.
            const neutral = !color || color === 'primary';
            Object.assign(style, {
              backgroundColor: tokens.paper,
              borderColor: neutral ? tokens.borderStrong : alpha(main, 0.42),
              color: neutral ? tokens.ink : textInk,
              padding: '7px 15px',
              boxShadow: `0 1px 1px ${inkShadow(0.04)}`,
              '&:hover': {
                borderColor: neutral ? alpha(tokens.primary, 0.55) : main,
                backgroundColor: neutral ? alpha(tokens.primary, 0.04) : alpha(main, 0.06),
                color: neutral ? tokens.primaryDark : textInk,
              },
              '&.Mui-disabled': { borderColor: tokens.border, color: '#9A9EB0', boxShadow: 'none' },
            });
          }

          if (ownerState.variant === 'text') {
            Object.assign(style, {
              color: color ? textInk : 'inherit',
              padding: '8px 12px',
              '&:hover': { backgroundColor: color ? alpha(main, 0.07) : inkShadow(0.05) },
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
                : inkShadow(0.06),
          },
        }),
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderColor: tokens.border, borderRadius: 10 },
      },
    },
    MuiFab: {
      styleOverrides: { root: { boxShadow: shadows[8], textTransform: 'none' } },
    },
    MuiLink: {
      defaultProps: { underline: 'hover' },
      styleOverrides: {
        root: { fontWeight: 600, color: tokens.primary, textUnderlineOffset: 3, '&.Mui-focusVisible, &:focus-visible': { ...focusRing, borderRadius: 4 } },
      },
    },

    /* ---------- Surfaces ---------- */
    MuiPaper: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          backgroundImage: 'none',
          ...(ownerState.variant === 'elevation' && ownerState.elevation > 0 && {
            border: `1px solid ${tokens.border}`,
          }),
        }),
        rounded: { borderRadius: 14 },
        outlined: { borderColor: tokens.border },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          borderRadius: 16,
          border: `1px solid ${tokens.border}`,
          boxShadow: ownerState.variant === 'outlined' || ownerState.elevation === 0 ? 'none' : shadows[3],
          transition: 'box-shadow .2s ease, border-color .2s ease, transform .2s ease',
          // Lift only cards that are actually clickable.
          '&:has(> .MuiCardActionArea-root):hover': {
            borderColor: tokens.borderStrong,
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
        subheader: { fontSize: '0.8125rem', color: tokens.muted },
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
            backgroundColor: alpha(tokens.primary, 0.06),
            '&:hover': { backgroundColor: alpha(tokens.primary, 0.11) },
          },
        },
      },
    },
    MuiCardActionArea: {
      styleOverrides: {
        root: { borderRadius: 'inherit', '&.Mui-focusVisible': { outline: `2px solid ${tokens.primary}`, outlineOffset: -2 } },
        focusHighlight: { opacity: 0 },
      },
    },
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.border}`,
          borderRadius: 14,
          backgroundColor: tokens.paper,
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
        expandIconWrapper: { color: tokens.muted },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: { root: { padding: '0 18px 18px', color: tokens.muted } },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: tokens.border } },
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
          const textInk = color ? inkFor[color] : '#2B3150';
          const filled = ownerState.variant !== 'outlined';
          return {
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '0.8125rem',
            letterSpacing: '-0.005em',
            height: 30,
            color: textInk,
            backgroundColor: filled ? (color ? alpha(main, color === 'secondary' ? 0.2 : 0.12) : '#EFEDE6') : tokens.paper,
            border: `1px solid ${filled ? (color ? alpha(main, 0.16) : 'transparent') : color ? alpha(main, 0.42) : tokens.borderStrong}`,
            '& .MuiChip-icon': { color: color ? (color === 'secondary' ? tokens.saffronDark : main) : tokens.muted, marginLeft: 8, marginRight: -2 },
            '& .MuiChip-deleteIcon': { color: alpha(color ? textInk : tokens.ink, 0.45), '&:hover': { color: color ? textInk : tokens.ink } },
            '&.MuiChip-clickable:hover': {
              backgroundColor: filled ? (color ? alpha(main, 0.2) : '#E5E2D9') : color ? alpha(main, 0.06) : tokens.sunken,
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
        colorDefault: { backgroundColor: '#E8EAFD', color: tokens.primaryDark },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: ({ ownerState }) => ({
          fontWeight: 700,
          fontSize: '0.6875rem',
          boxShadow: `0 0 0 2px ${tokens.paper}`,
          ...(ownerState.color && ['success', 'error', 'info'].includes(ownerState.color) && {
            backgroundColor: inkFor[ownerState.color],
          }),
        }),
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: {
          backgroundColor: tokens.ink,
          color: '#F4F5FA',
          fontSize: '0.75rem',
          fontWeight: 500,
          lineHeight: 1.45,
          padding: '6px 10px',
          borderRadius: 8,
          boxShadow: shadows[8],
        },
        arrow: { color: tokens.ink },
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        colorSecondary: { color: tokens.saffronDark },
      },
    },
    MuiList: {
      styleOverrides: { root: { paddingTop: 4, paddingBottom: 4 } },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          '&.Mui-selected': { backgroundColor: alpha(tokens.primary, 0.08), color: tokens.primaryDark },
          '&.Mui-selected:hover': { backgroundColor: alpha(tokens.primary, 0.12) },
          '&.Mui-focusVisible': { outline: `2px solid ${tokens.primary}`, outlineOffset: -2, backgroundColor: 'transparent' },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: { root: { minWidth: 40, color: tokens.muted } },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: { fontWeight: 500 },
        secondary: { color: tokens.muted, fontSize: '0.8125rem' },
      },
    },
    MuiListSubheader: {
      styleOverrides: {
        root: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.muted, lineHeight: '36px' },
      },
    },

    /* ---------- Tables ---------- */
    MuiTableContainer: {
      styleOverrides: { root: { borderRadius: 14 } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #EFEDE7',
          padding: '14px 16px',
          fontSize: '0.875rem',
          fontVariantNumeric: 'tabular-nums',
        },
        head: {
          backgroundColor: tokens.sunken,
          color: tokens.muted,
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          lineHeight: 1.4,
          paddingTop: 11,
          paddingBottom: 11,
          borderBottom: `1px solid ${tokens.border}`,
          whiteSpace: 'nowrap',
          '&:first-of-type': { borderTopLeftRadius: 10 },
          '&:last-of-type': { borderTopRightRadius: 10 },
        },
        sizeSmall: { padding: '10px 12px' },
        stickyHeader: { backgroundColor: tokens.sunken },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color .12s ease',
          '.MuiTableBody-root &:hover': { backgroundColor: '#FBFAF7' },
          '.MuiTableBody-root &:last-of-type > .MuiTableCell-root': { borderBottom: 0 },
          '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: alpha(tokens.primary, 0.06) },
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: { root: { borderTop: `1px solid ${tokens.border}` } },
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
        indicator: { height: 3, borderRadius: '3px 3px 0 0', backgroundColor: tokens.primary },
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
          color: tokens.muted,
          borderRadius: '10px 10px 0 0',
          transition: 'color .16s ease, background-color .16s ease',
          '&:hover': { color: tokens.ink, backgroundColor: inkShadow(0.03) },
          '&.Mui-selected': { color: tokens.ink },
          '&.Mui-focusVisible': { outline: `2px solid ${tokens.primary}`, outlineOffset: -2 },
          '&.Mui-disabled': { color: '#868BA0' },
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
          color: '#E4E2DA',
          width: 30,
          height: 30,
          '& .MuiStepIcon-text': { fill: tokens.muted, fontWeight: 700, fontSize: '0.75rem', fontFamily: tokens.fontSans },
          '&.Mui-active': { color: tokens.primary, filter: `drop-shadow(0 0 6px ${alpha(tokens.primary, 0.45)})` },
          '&.Mui-active .MuiStepIcon-text, &.Mui-completed .MuiStepIcon-text': { fill: '#FFFFFF' },
          '&.Mui-completed': { color: tokens.ink },
          '&.Mui-error': { color: tokens.error },
        },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: {
          fontWeight: 500,
          color: tokens.muted,
          '&.Mui-active': { color: tokens.ink, fontWeight: 700 },
          '&.Mui-completed': { color: tokens.ink, fontWeight: 600 },
        },
      },
    },
    MuiStepConnector: {
      styleOverrides: {
        line: { borderColor: tokens.borderStrong, borderTopWidth: 2, borderRadius: 2 },
        root: {
          '&.Mui-active .MuiStepConnector-line, &.Mui-completed .MuiStepConnector-line': { borderColor: tokens.primary },
        },
        alternativeLabel: { top: 15, left: 'calc(-50% + 22px)', right: 'calc(50% + 22px)' },
      },
    },
    MuiBreadcrumbs: {
      styleOverrides: { root: { fontSize: '0.8125rem', color: tokens.muted } },
    },

    /* ---------- Inputs ---------- */
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { fontSize: '0.9375rem' },
        input: {
          '&::placeholder': { color: tokens.faint, opacity: 1 },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          borderRadius: 10,
          backgroundColor: tokens.paper,
          transition: 'box-shadow .16s ease, background-color .16s ease',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#DCD9CF', transition: 'border-color .16s ease' },
          '&:hover:not(.Mui-disabled):not(.Mui-focused) .MuiOutlinedInput-notchedOutline': { borderColor: '#B8B4A7' },
          '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(tokens.primary, 0.14)}` },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: tokens.primary, borderWidth: 1 },
          '&.Mui-error.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(tokens.error, 0.14)}` },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: tokens.error },
          '&.Mui-disabled': { backgroundColor: tokens.sunken },
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
          backgroundColor: tokens.sunken,
          '&:hover': { backgroundColor: '#F2F0EA' },
          '&.Mui-focused': { backgroundColor: '#F2F0EA' },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: tokens.muted,
          fontWeight: 500,
          '&.Mui-focused': { color: tokens.primaryDark },
          '&.Mui-error': { color: tokens.errorInk },
        },
        // Re-centre the resting label for the slightly shorter (48px) inputs.
        outlined: ({ ownerState }) =>
          ownerState.size !== 'small' && !ownerState.shrink ? { transform: 'translate(14px, 13px) scale(1)' } : {},
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: { color: tokens.ink, fontWeight: 600, '&.Mui-focused': { color: tokens.ink } },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { marginLeft: 2, marginRight: 2, marginTop: 6, marginBottom: 4, lineHeight: 1.4, fontSize: '0.78rem', color: tokens.muted, '&.Mui-error': { color: tokens.errorInk } },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: { label: { fontSize: '0.9375rem' } },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: tokens.muted },
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
          '&:hover': { backgroundColor: inkShadow(0.045) },
          '&.Mui-selected': { backgroundColor: alpha(tokens.primary, 0.08), color: tokens.primaryDark, fontWeight: 600 },
          '&.Mui-selected:hover': { backgroundColor: alpha(tokens.primary, 0.12) },
          '&.Mui-focusVisible': { backgroundColor: alpha(tokens.primary, 0.1) },
          '& + .MuiDivider-root': { marginTop: 6, marginBottom: 6 },
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: { borderRadius: 12, border: `1px solid ${tokens.border}`, boxShadow: shadows[8] },
        option: { borderRadius: 8, margin: '0 6px' },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: { color: '#A3A7B7', borderRadius: 8, padding: 8 },
      },
    },
    MuiRadio: {
      styleOverrides: { root: { color: '#A3A7B7', padding: 8 } },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        track: { borderRadius: 11, backgroundColor: '#C9C6BC', opacity: 1 },
        thumb: { width: 16, height: 16, margin: 2, boxShadow: `0 1px 2px ${inkShadow(0.25)}` },
        switchBase: {
          '&.Mui-checked': { color: '#FFFFFF' },
          '&.Mui-checked + .MuiSwitch-track': { opacity: 1 },
          '&.Mui-disabled + .MuiSwitch-track': { opacity: 0.4 },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        thumb: { boxShadow: `0 0 0 4px ${alpha(tokens.primary, 0.16)}` },
        rail: { backgroundColor: '#DFDCD3', opacity: 1 },
      },
    },

    /* ---------- Feedback ---------- */
    MuiAlert: {
      styleOverrides: {
        root: ({ ownerState }) => {
          const severity = ownerState.severity || 'success';
          const color = ownerState.color || severity;
          const main = base.palette[color]?.main || tokens.info;
          const textInk = inkFor[color] || tokens.ink;
          const style = {
            borderRadius: 12,
            padding: '8px 14px',
            fontSize: '0.875rem',
            alignItems: 'flex-start',
            border: '1px solid transparent',
          };
          if (ownerState.variant === 'filled') {
            Object.assign(style, { backgroundColor: textInk, color: '#FFFFFF', '& .MuiAlert-icon': { color: '#FFFFFF' } });
          } else if (ownerState.variant === 'outlined') {
            Object.assign(style, { backgroundColor: tokens.paper, borderColor: alpha(main, 0.45), color: textInk, '& .MuiAlert-icon': { color: main } });
          } else {
            Object.assign(style, {
              backgroundColor: alpha(main, color === 'warning' ? 0.1 : 0.08),
              borderColor: alpha(main, 0.22),
              color: textInk,
              '& .MuiAlert-icon': { color: color === 'warning' ? tokens.warning : main },
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
            backgroundImage: `linear-gradient(90deg, ${tokens.primary}, ${tokens.primaryLight})`,
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
        root: { backgroundColor: '#ECEAE3' },
        rounded: { borderRadius: 10 },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: { root: { backgroundColor: tokens.ink, borderRadius: 12, border: 'none' } },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: ({ ownerState }) => (ownerState.invisible ? {} : { backgroundColor: 'rgba(14, 22, 48, 0.5)' }),
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
      styleOverrides: { root: { color: tokens.muted, fontSize: '0.9375rem' } },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: '12px 24px 20px', gap: 8, '& > :not(style) ~ :not(style)': { marginLeft: 0 } } },
    },
  },
});

export default theme;
