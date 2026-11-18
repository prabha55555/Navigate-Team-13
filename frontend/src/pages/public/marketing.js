import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Container, Divider, Grid, IconButton, Link, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import BrandMark from '../../components/common/BrandMark';
import { useColorMode } from '../../contexts/ColorModeContext';
import { tokens } from '../../theme';

/*
 * Shared building blocks for the public marketing pages (landing, pricing).
 * The header sits on an always-ink hero, so it uses fixed on-ink colours.
 */

export const ON_INK = {
  text: '#C3C9E3',
  muted: '#97A0C4',
  strong: '#FFFFFF',
  link: '#B9C0DD',
  focus: '#9BA6FF',
};

export const onInkFocus = { '&.Mui-focusVisible, &:focus-visible': { outline: `2px solid ${ON_INK.focus}`, outlineOffset: 3 } };

export const lightButtonSx = {
  bgcolor: '#FFFFFF',
  color: tokens.ink,
  boxShadow: '0 10px 30px -12px rgba(107,123,255,0.8)',
  '&:hover': { bgcolor: '#E9ECFF', boxShadow: '0 12px 32px -12px rgba(107,123,255,0.95)' },
  ...onInkFocus,
};

export const ghostButtonSx = {
  color: '#E4E8F7',
  bgcolor: 'transparent',
  borderColor: 'rgba(255,255,255,0.26)',
  boxShadow: 'none',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.55)', color: '#FFFFFF' },
  ...onInkFocus,
};

export const Eyebrow = ({ children, onInk = false, sx }) => (
  <Typography
    component="p"
    sx={{
      fontSize: '0.75rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: onInk ? 'secondary.light' : (t) => t.nv.inkFor.primary,
      ...sx,
    }}
  >
    {children}
  </Typography>
);

/** Plan catalog mirrored from backend/config/plans.js (GET /api/workspace/plans needs auth). */
export const PUBLIC_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceDetail: 'forever',
    tagline: 'For a single instructor trying Navigate with one class.',
    limits: { staffSeats: 2, students: 50, aiGenerations: 25 },
    features: ['2 staff seats', 'Up to 50 students', '25 AI generations / month', 'Assessments, proctoring & analytics'],
    cta: { label: 'Start free', to: '/register' },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    priceDetail: 'per instructor / month',
    tagline: 'For departments running assessments across many courses.',
    limits: { staffSeats: 25, students: 2000, aiGenerations: 1000 },
    features: ['Everything in Free', '25 staff seats', 'Up to 2,000 students', '1,000 AI generations / month', 'Larger cohorts & faculty teams'],
    highlighted: true,
    cta: { label: 'Start with Pro', to: '/register' },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Contact sales',
    priceDetail: 'custom contract',
    tagline: 'For institutions that need scale, contracts and support.',
    limits: { staffSeats: null, students: null, aiGenerations: null },
    features: ['Unlimited seats & students', 'Unlimited AI generations', 'Custom branding', 'Dedicated onboarding & support'],
    // No public sales inbox yet: owners request Enterprise from Settings → Billing, which notifies sales.
    cta: { label: 'Start, then request', to: '/register' },
    note: 'Create a workspace, then request Enterprise from Settings → Billing.',
  },
];

export const PlanCard = ({ plan, current = false, action }) => (
  <Paper
    variant="outlined"
    sx={(t) => ({
      p: { xs: 3, md: 3.5 },
      height: '100%',
      borderRadius: '24px',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      borderColor: plan.highlighted ? 'primary.main' : 'divider',
      borderWidth: plan.highlighted ? 2 : 1,
      boxShadow: plan.highlighted ? `0 30px 60px -30px ${alpha(t.palette.primary.main, 0.55)}` : t.shadows[2],
    })}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
      <Typography variant="h5" component="h3" sx={{ flex: 1 }}>
        {plan.name}
      </Typography>
      {current ? <Chip size="small" color="primary" label="Current plan" /> : plan.highlighted && <Chip size="small" color="secondary" label="Most popular" />}
    </Box>
    {plan.tagline && (
      <Typography variant="body2" sx={{ color: 'text.secondary', minHeight: { md: 42 } }}>
        {plan.tagline}
      </Typography>
    )}
    <Box sx={{ my: 2.5 }}>
      <Typography component="p" sx={{ fontSize: plan.price.length > 6 ? '1.75rem' : '2.5rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        {plan.price}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {plan.priceDetail}
      </Typography>
    </Box>
    <Stack component="ul" spacing={1.25} sx={{ listStyle: 'none', p: 0, m: 0, mb: 3, flex: 1 }}>
      {plan.features.map((f) => (
        <Box component="li" key={f} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
          <CheckRoundedIcon fontSize="small" sx={{ color: 'success.main', mt: 0.25 }} />
          <Typography variant="body2">{f}</Typography>
        </Box>
      ))}
    </Stack>
    {action}
    {plan.note && (
      <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1.25, textAlign: 'center' }}>
        {plan.note}
      </Typography>
    )}
  </Paper>
);

export const PlanCta = ({ plan, signedIn }) => {
  const variant = plan.highlighted ? 'contained' : 'outlined';
  if (signedIn) {
    return (
      <Button component={RouterLink} to="/app/settings/billing" variant={variant} size="large" fullWidth>
        Manage plan
      </Button>
    );
  }
  return plan.cta.href ? (
    <Button href={plan.cta.href} variant={variant} size="large" fullWidth>
      {plan.cta.label}
    </Button>
  ) : (
    <Button component={RouterLink} to={plan.cta.to} variant={variant} size="large" fullWidth endIcon={<ArrowForwardRoundedIcon />}>
      {plan.cta.label}
    </Button>
  );
};

export const FaqList = ({ items }) => (
  <Box>
    {items.map((item, i) => (
      <Accordion key={item.q} defaultExpanded={i === 0}>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} aria-controls={`faq-${i}-content`} id={`faq-${i}-header`}>
          <Typography component="h3" sx={{ fontWeight: 600 }}>
            {item.q}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
            {item.a}
          </Typography>
        </AccordionDetails>
      </Accordion>
    ))}
  </Box>
);

const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Security', href: '/#security' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'FAQ', href: '/#faq' },
];

const ThemeToggle = () => {
  const { resolvedMode, toggleMode } = useColorMode();
  const label = resolvedMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={toggleMode} sx={{ color: ON_INK.link, '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#fff' }, ...onInkFocus }}>
        {resolvedMode === 'dark' ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
};

/** Header for pages whose first section is an ink hero. */
export const SiteHeader = ({ dashboardPath }) => (
  <Box component="header" sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3 }}>
    <Container maxWidth="lg" sx={{ height: { xs: 68, md: 84 }, display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 2 } }}>
      <Box component={RouterLink} to="/" aria-label="Navigate home" sx={{ color: '#fff', display: 'inline-flex', borderRadius: 2, flex: 'none', ...onInkFocus }}>
        <BrandMark size={34} tone="blue" withWordmark wordmarkSize="1.4rem" />
      </Box>

      <Box component="nav" aria-label="Primary" sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, ml: 4 }}>
        {NAV_LINKS.map((link) => (
          <Box
            key={link.label}
            component={link.to ? RouterLink : 'a'}
            to={link.to}
            href={link.href}
            sx={{
              px: 1.5,
              py: 1,
              borderRadius: 2,
              fontSize: '0.9rem',
              fontWeight: 500,
              color: ON_INK.link,
              transition: 'color .16s ease, background-color .16s ease',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
              '&:focus-visible': { outline: `2px solid ${ON_INK.focus}`, outlineOffset: 2 },
            }}
          >
            {link.label}
          </Box>
        ))}
      </Box>

      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: { xs: 0.25, sm: 1 } }}>
        <ThemeToggle />
        {dashboardPath ? (
          <Button component={RouterLink} to={dashboardPath} variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={lightButtonSx}>
            Dashboard
          </Button>
        ) : (
          <>
            <Button
              component={RouterLink}
              to="/login"
              color="inherit"
              sx={{ color: '#E4E8F7', px: { xs: 1, sm: 1.75 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' }, ...onInkFocus }}
            >
              Sign in
            </Button>
            <Button component={RouterLink} to="/register" variant="contained" sx={{ ...lightButtonSx, px: { xs: 1.5, sm: 2.25 }, whiteSpace: 'nowrap' }}>
              Start free
            </Button>
          </>
        )}
      </Box>
    </Container>
  </Box>
);

const FooterColumn = ({ title, children }) => (
  <Box component="nav" aria-label={title}>
    <Typography component="h2" sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'text.secondary', mb: 1.5 }}>
      {title}
    </Typography>
    <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 1 }}>
      {children}
    </Box>
  </Box>
);

const FooterLink = ({ to, href, children }) => (
  <li>
    <Link component={to ? RouterLink : 'a'} to={to} href={href} sx={{ color: 'text.primary', fontWeight: 500, fontSize: '0.9rem', '&:hover': { color: 'primary.main' } }}>
      {children}
    </Link>
  </li>
);

export const SiteFooter = ({ dashboardPath }) => (
  <Box component="footer" sx={{ pt: { xs: 7, md: 9 }, pb: 5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
    <Container maxWidth="lg">
      <Grid container spacing={4}>
        <Grid item xs={12} md={5}>
          <BrandMark size={32} withWordmark wordmarkSize="1.35rem" />
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2, maxWidth: 360, lineHeight: 1.65 }}>
            AI-assisted assessment, proctoring, analytics and adaptive learning for colleges, training institutes and corporate
            learning teams.
          </Typography>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <FooterColumn title="Product">
            <FooterLink href="/#features">Features</FooterLink>
            <FooterLink href="/#how-it-works">How it works</FooterLink>
            <FooterLink to="/pricing">Pricing</FooterLink>
          </FooterColumn>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <FooterColumn title="Trust">
            <FooterLink href="/#security">Security</FooterLink>
            <FooterLink href="/#faq">FAQ</FooterLink>
          </FooterColumn>
        </Grid>
        <Grid item xs={12} sm={4} md={3}>
          <FooterColumn title="Account">
            {dashboardPath ? (
              <FooterLink to={dashboardPath}>Dashboard</FooterLink>
            ) : (
              <>
                <FooterLink to="/login">Sign in</FooterLink>
                <FooterLink to="/register">Create a workspace</FooterLink>
                <FooterLink to="/register?mode=join">Join with a code</FooterLink>
              </>
            )}
          </FooterColumn>
        </Grid>
      </Grid>
      <Divider sx={{ my: 4 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          © {new Date().getFullYear()} Navigate. All rights reserved.
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', fontFamily: 'var(--nv-font-display)', fontSize: '0.85rem' }}>
          Find your way through every subject.
        </Typography>
      </Box>
    </Container>
  </Box>
);
