import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { Box, Button, Paper, Typography } from '@mui/material';
import React, { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import BrandMark from '../common/BrandMark';
import LearningRoute from '../common/LearningRoute';

/**
 * Split auth layout: form card on the left, ink "route" panel on the right (md+).
 * panel: { eyebrow, title, bullets: string[] }
 */
const AuthLayout = ({ title, subtitle, documentTitle, panel, footer, children }) => {
  useEffect(() => {
    if (documentTitle) document.title = `${documentTitle} · Navigate`;
  }, [documentTitle]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1.08fr)' },
        bgcolor: 'background.default',
      }}
    >
      <Box
        component="main"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          px: { xs: 2, sm: 5, lg: 8 },
          py: { xs: 2.5, sm: 4 },
        }}
      >
        <Box component="header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box
            component={RouterLink}
            to="/"
            aria-label="Navigate home"
            sx={{ color: 'text.primary', display: 'inline-flex', borderRadius: 2 }}
          >
            <BrandMark size={32} withWordmark wordmarkSize="1.35rem" />
          </Box>
          <Button component={RouterLink} to="/" color="inherit" size="small" startIcon={<ArrowBackRoundedIcon />} sx={{ color: 'text.secondary' }}>
            Back to home
          </Button>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: { xs: 3, sm: 5 } }}>
          <Box className="nv-rise" sx={{ width: '100%', maxWidth: 460 }}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2.5, sm: 4.5 },
                borderRadius: '24px',
                boxShadow: '0 1px 2px rgba(14,22,48,0.04), 0 24px 48px -28px rgba(14,22,48,0.22)',
              }}
            >
              <Typography variant="h3" component="h1">
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1 }}>
                  {subtitle}
                </Typography>
              )}
              <Box sx={{ mt: 3 }}>{children}</Box>
            </Paper>
            {footer && (
              <Typography variant="body2" sx={{ mt: 3, textAlign: 'center', color: 'text.secondary' }}>
                {footer}
              </Typography>
            )}
          </Box>
        </Box>

        <Typography variant="caption" component="p" sx={{ color: 'text.secondary', textAlign: { xs: 'center', md: 'left' } }}>
          © {new Date().getFullYear()} Navigate — Team 13 Capstone
        </Typography>
      </Box>

      {panel && (
        <Box
          component="aside"
          aria-label="About Navigate"
          sx={{ display: { xs: 'none', md: 'block' }, p: 2, pl: 0, position: 'sticky', top: 0, height: '100vh' }}
        >
          <Box
            className="nv-ink nv-dots nv-contours"
            sx={{
              height: '100%',
              borderRadius: '28px',
              overflow: 'hidden',
              px: { md: 5, lg: 7 },
              py: { md: 5, lg: 6 },
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                position: 'absolute',
                right: '-10%',
                top: '-15%',
                width: '70%',
                height: '60%',
                zIndex: -1,
                background: 'radial-gradient(closest-side, rgba(51,70,232,0.42), rgba(51,70,232,0))',
              }}
            />
            {panel.eyebrow && (
              <Typography
                component="p"
                sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'secondary.light', mb: 1.5 }}
              >
                {panel.eyebrow}
              </Typography>
            )}
            <Typography variant="h2" component="p" sx={{ color: '#fff', maxWidth: '16ch' }}>
              {panel.title}
            </Typography>

            {/* The route fills whatever height the headline and bullets leave, and may
                bleed slightly past the panel padding so it reads as the hero of the panel. */}
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                py: 1,
                mx: { md: -3, lg: -4 },
              }}
            >
              <LearningRoute
                compact
                drawDuration={1.8}
                sx={{ width: 'min(100%, 760px, max(320px, calc((100vh - 330px) * 1.3)))' }}
              />
            </Box>

            {panel.bullets?.length > 0 && (
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}>
                {panel.bullets.map((bullet) => (
                  <Box component="li" key={bullet} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, color: '#D5DAF0' }}>
                    <Box
                      component="span"
                      aria-hidden="true"
                      sx={{
                        mt: '1px',
                        width: 22,
                        height: 22,
                        flex: 'none',
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'rgba(107,123,255,0.18)',
                        border: '1px solid rgba(155,166,255,0.35)',
                        color: '#C7CEFF',
                      }}
                    >
                      <CheckRoundedIcon sx={{ fontSize: 14 }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.5 }}>{bullet}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AuthLayout;
