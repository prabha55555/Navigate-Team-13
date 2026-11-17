import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import { Box, Button, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import React from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { homePathFor, isInstructorRole } from '../../auth/roles';
import { useAuth } from '../../contexts/AuthContext';
import BrandMark from '../common/BrandMark';
import { INSTRUCTOR_NAV, STUDENT_NAV, getStudentContext, isPathActive, roleLabel } from './navConfig';

const SectionLabel = ({ children }) => (
  <Typography
    component="p"
    sx={{
      px: 1.5,
      pt: 2.5,
      pb: 1,
      fontSize: '0.6875rem',
      fontWeight: 700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: '#8790BA',
    }}
  >
    {children}
  </Typography>
);

const NavItem = ({ item, active, onNavigate }) => {
  const { Icon } = item;
  return (
    <ListItemButton
      component={RouterLink}
      to={item.path}
      selected={active}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      sx={{
        mb: 0.5,
        px: 1.5,
        py: 1,
        borderRadius: '10px',
        color: '#C1C8E4',
        transition: 'background-color .16s ease, color .16s ease, box-shadow .2s ease',
        '& .MuiListItemIcon-root': { minWidth: 34, color: '#8B95BF', transition: 'color .16s ease' },
        '&:hover': {
          bgcolor: 'rgba(255,255,255,0.06)',
          color: '#fff',
          '& .MuiListItemIcon-root': { color: '#E1E5FF' },
        },
        '&.Mui-selected, &.Mui-selected:hover': {
          color: '#fff',
          background: 'linear-gradient(90deg, rgba(107,123,255,0.26) 0%, rgba(107,123,255,0.08) 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(155,166,255,0.28), 0 10px 28px -14px rgba(107,123,255,0.9)',
          '& .MuiListItemIcon-root': { color: '#B4BCFF' },
        },
        '&.Mui-focusVisible': { outline: '2px solid #9BA6FF', outlineOffset: -2, bgcolor: 'rgba(255,255,255,0.06)' },
      }}
    >
      <ListItemIcon>
        <Icon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary={item.label}
        primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: active ? 600 : 500, noWrap: true }}
      />
      {active && (
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            width: 6,
            height: 6,
            ml: 1,
            flex: 'none',
            borderRadius: '50%',
            bgcolor: 'secondary.main',
            boxShadow: '0 0 0 3px rgba(242,169,59,0.18), 0 0 10px rgba(242,169,59,0.9)',
          }}
        />
      )}
    </ListItemButton>
  );
};

const TipCard = ({ instructor, onNavigate }) => (
  <Box
    sx={{
      p: 2,
      borderRadius: '14px',
      bgcolor: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, color: 'secondary.light' }}>
      {instructor ? <ExploreOutlinedIcon sx={{ fontSize: 18 }} /> : <VideocamOutlinedIcon sx={{ fontSize: 18 }} />}
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fff' }}>
        {instructor ? 'Start from a syllabus' : 'Before a proctored test'}
      </Typography>
    </Box>
    <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.5, color: '#A9B1D3' }}>
      {instructor
        ? 'Upload a PDF or DOCX to a course and let AI draft your next assessment.'
        : 'Tests open in fullscreen with webcam checks. Find a quiet spot and keep this tab in focus.'}
    </Typography>
    {instructor && (
      <Button
        component={RouterLink}
        to="/instructor/courses"
        onClick={onNavigate}
        size="small"
        endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: '16px !important' }} />}
        sx={{
          mt: 1.25,
          ml: -1,
          color: '#DDE1FF',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: '#fff' },
          '&.Mui-focusVisible': { outline: '2px solid #9BA6FF' },
        }}
      >
        Open courses
      </Button>
    )}
  </Box>
);

const SidebarContent = ({ onNavigate }) => {
  const { pathname } = useLocation();
  const { currentUser } = useAuth();
  const instructor = isInstructorRole(currentUser?.role);
  const items = instructor ? INSTRUCTOR_NAV : STUDENT_NAV;
  const context = instructor ? null : getStudentContext(pathname);

  return (
    <Box
      className="nv-ink nv-dots"
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Soft compass-blue glow behind the brand */}
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          inset: '-120px -80px auto -80px',
          height: 280,
          zIndex: -1,
          pointerEvents: 'none',
          background: 'radial-gradient(closest-side, rgba(51,70,232,0.35), rgba(51,70,232,0))',
        }}
      />

      <Box sx={{ height: 64, px: 2.5, display: 'flex', alignItems: 'center', flex: 'none' }}>
        <Box
          component={RouterLink}
          to={homePathFor(currentUser)}
          onClick={onNavigate}
          aria-label="Navigate — go to your dashboard"
          sx={{ color: '#fff', display: 'inline-flex', borderRadius: 2, '&:focus-visible': { outline: '2px solid #9BA6FF', outlineOffset: 4 } }}
        >
          <BrandMark size={32} tone="blue" withWordmark wordmarkSize="1.35rem" />
        </Box>
      </Box>

      <Box sx={{ px: 2.5, pb: 0.5, flex: 'none' }}>
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.4,
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 600,
            color: '#C9CFEB',
            bgcolor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: instructor ? 'primary.light' : 'success.light' }} />
          {instructor ? `${roleLabel(currentUser?.role)} workspace` : 'Student space'}
        </Box>
      </Box>

      <Box component="nav" aria-label="Main navigation" sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 2 }}>
        <SectionLabel>Workspace</SectionLabel>
        <List disablePadding>
          {items.map((item) => (
            <NavItem key={item.path} item={item} active={isPathActive(pathname, item.path)} onNavigate={onNavigate} />
          ))}
        </List>

        {context && (
          <>
            <SectionLabel>{context.heading}</SectionLabel>
            <List disablePadding>
              {context.items.map((item) => (
                <NavItem key={item.path} item={item} active={pathname === item.path} onNavigate={onNavigate} />
              ))}
            </List>
          </>
        )}
      </Box>

      <Box sx={{ px: 2, pb: 2, flex: 'none' }}>
        <TipCard instructor={instructor} onNavigate={onNavigate} />
        <Typography sx={{ mt: 1.5, px: 0.5, fontSize: '0.7rem', color: '#7C86B2' }}>
          Navigate · Team 13 Capstone
        </Typography>
      </Box>
    </Box>
  );
};

const paperSx = (drawerWidth) => ({
  boxSizing: 'border-box',
  width: drawerWidth,
  bgcolor: 'var(--nv-ink)',
  border: 'none',
});

const Sidebar = ({ drawerWidth, mobileOpen, handleDrawerToggle }) => {
  const closeOnNavigate = () => {
    if (mobileOpen) handleDrawerToggle();
  };

  return (
    <Box component="aside" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
      {/* Mobile / tablet: temporary drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': paperSx(drawerWidth) }}
      >
        <SidebarContent onNavigate={closeOnNavigate} />
      </Drawer>

      {/* Desktop: permanent drawer */}
      <Drawer
        variant="permanent"
        open
        sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': paperSx(drawerWidth) }}
      >
        <SidebarContent />
      </Drawer>
    </Box>
  );
};

export default Sidebar;
