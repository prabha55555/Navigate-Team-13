import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import { Box, Drawer, LinearProgress, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import React from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { isAdminRole, isStaffRole } from '../../auth/roles';
import { useAuth } from '../../contexts/AuthContext';
import BrandMark from '../common/BrandMark';
import { getLearnerContext, isItemActive, navFor, settingsNavFor } from './navConfig';

// The sidebar is an always-ink surface in both colour modes, so it uses fixed on-ink colours.
const ON_INK = {
  label: '#8790BA',
  text: '#C1C8E4',
  icon: '#8B95BF',
  strong: '#FFFFFF',
  focus: '#9BA6FF',
};

const PLAN_LABEL = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' };

const SectionLabel = ({ children }) => (
  <Typography
    component="p"
    sx={{ px: 1.5, pt: 2.5, pb: 1, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ON_INK.label }}
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
        color: ON_INK.text,
        transition: 'background-color .16s ease, color .16s ease, box-shadow .2s ease',
        '& .MuiListItemIcon-root': { minWidth: 34, color: ON_INK.icon, transition: 'color .16s ease' },
        '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: ON_INK.strong, '& .MuiListItemIcon-root': { color: '#E1E5FF' } },
        '&.Mui-selected, &.Mui-selected:hover': {
          color: ON_INK.strong,
          background: 'linear-gradient(90deg, rgba(107,123,255,0.26) 0%, rgba(107,123,255,0.08) 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(155,166,255,0.28), 0 10px 28px -14px rgba(107,123,255,0.9)',
          '& .MuiListItemIcon-root': { color: '#B4BCFF' },
        },
        '&.Mui-focusVisible': { outline: `2px solid ${ON_INK.focus}`, outlineOffset: -2, bgcolor: 'rgba(255,255,255,0.06)' },
      }}
    >
      <ListItemIcon>
        <Icon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: active ? 600 : 500, noWrap: true }} />
      {active && (
        <Box
          component="span"
          aria-hidden="true"
          sx={{ width: 6, height: 6, ml: 1, flex: 'none', borderRadius: '50%', bgcolor: 'secondary.main', boxShadow: '0 0 0 3px rgba(242,169,59,0.18), 0 0 10px rgba(242,169,59,0.9)' }}
        />
      )}
    </ListItemButton>
  );
};

const WorkspaceCard = ({ workspace, onNavigate, canManage }) => {
  const plan = workspace?.plan || 'free';
  const content = (
    <>
      <Box
        aria-hidden="true"
        sx={{
          width: 32,
          height: 32,
          flex: 'none',
          borderRadius: '9px',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 800,
          fontSize: '0.85rem',
          color: '#fff',
          background: /^#[0-9a-f]{6}$/i.test(workspace?.branding?.primaryColor || '') ? workspace.branding.primaryColor : 'linear-gradient(135deg, rgba(107,123,255,0.9), rgba(51,70,232,0.9))',
        }}
      >
        {(workspace?.name || 'W').trim().charAt(0).toUpperCase()}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: ON_INK.strong, lineHeight: 1.3 }} noWrap title={workspace?.name}>
          {workspace?.name || 'Your workspace'}
        </Typography>
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            mt: 0.25,
            px: 0.75,
            borderRadius: '6px',
            fontSize: '0.66rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: plan === 'free' ? '#C9CFEB' : '#1A1206',
            bgcolor: plan === 'free' ? 'rgba(255,255,255,0.1)' : 'secondary.main',
          }}
        >
          {PLAN_LABEL[plan] || plan} plan
        </Box>
      </Box>
    </>
  );
  const sx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1.25,
    p: 1.25,
    borderRadius: '12px',
    bgcolor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    textDecoration: 'none',
  };
  return canManage ? (
    <Box
      component={RouterLink}
      to="/app/settings/workspace"
      onClick={onNavigate}
      aria-label={`Workspace settings for ${workspace?.name || 'your workspace'}`}
      sx={{ ...sx, transition: 'background-color .16s ease', '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' }, '&:focus-visible': { outline: `2px solid ${ON_INK.focus}`, outlineOffset: 2 } }}
    >
      {content}
    </Box>
  ) : (
    <Box sx={sx}>{content}</Box>
  );
};

const UsageCard = ({ workspace }) => {
  const used = workspace?.usage?.aiGenerations ?? 0;
  const max = workspace?.limits?.aiGenerations;
  if (max == null) return null;
  const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  return (
    <Box sx={{ p: 1.75, borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'secondary.light' }}>
        <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: ON_INK.strong, flex: 1 }}>AI generations</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: ON_INK.text, fontVariantNumeric: 'tabular-nums' }}>
          {used} / {max}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'primary'}
        aria-label={`${used} of ${max} AI generations used this month`}
        sx={{ height: 6, bgcolor: 'rgba(255,255,255,0.1)' }}
      />
    </Box>
  );
};

const LearnerTip = () => (
  <Box sx={{ p: 2, borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, color: 'secondary.light' }}>
      <VideocamOutlinedIcon sx={{ fontSize: 18 }} />
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: ON_INK.strong }}>Before a proctored test</Typography>
    </Box>
    <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.5, color: '#A9B1D3' }}>
      Some tests open in fullscreen with webcam checks. Find a quiet spot and keep the tab in focus.
    </Typography>
  </Box>
);

const SidebarContent = ({ onNavigate }) => {
  const { pathname } = useLocation();
  const { currentUser, workspace } = useAuth();
  const role = currentUser?.role;
  const staff = isStaffRole(role);
  const items = navFor(role);
  const settingsItems = settingsNavFor(role);
  const context = staff ? null : getLearnerContext(pathname);

  return (
    <Box className="nv-ink nv-dots" sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          to="/app"
          onClick={onNavigate}
          aria-label="Navigate — go to your dashboard"
          sx={{ color: '#fff', display: 'inline-flex', borderRadius: 2, '&:focus-visible': { outline: `2px solid ${ON_INK.focus}`, outlineOffset: 4 } }}
        >
          <BrandMark size={32} tone="blue" withWordmark wordmarkSize="1.35rem" />
        </Box>
      </Box>

      <Box sx={{ px: 1.5, pb: 0.5, flex: 'none' }}>
        <WorkspaceCard workspace={workspace} onNavigate={onNavigate} canManage={isAdminRole(role)} />
      </Box>

      <Box component="nav" aria-label="Main navigation" sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 2 }}>
        <SectionLabel>{staff ? 'Teach' : 'Learn'}</SectionLabel>
        <List disablePadding>
          {items.map((item) => (
            <NavItem key={item.path} item={item} active={isItemActive(pathname, item)} onNavigate={onNavigate} />
          ))}
        </List>

        {context && (
          <>
            <SectionLabel>{context.heading}</SectionLabel>
            <List disablePadding>
              {context.items.map((item) => (
                <NavItem key={item.path} item={item} active={isItemActive(pathname, item)} onNavigate={onNavigate} />
              ))}
            </List>
          </>
        )}

        <SectionLabel>Workspace</SectionLabel>
        <List disablePadding>
          {settingsItems.map((item) => (
            <NavItem key={item.path} item={item} active={isItemActive(pathname, item)} onNavigate={onNavigate} />
          ))}
        </List>
      </Box>

      <Box sx={{ px: 1.5, pb: 2, flex: 'none' }}>{staff ? <UsageCard workspace={workspace} /> : <LearnerTip />}</Box>
    </Box>
  );
};

const paperSx = (drawerWidth) => (t) => ({
  boxSizing: 'border-box',
  width: drawerWidth,
  bgcolor: 'var(--nv-ink)',
  border: 'none',
  // In dark mode the ink panel sits next to an ink canvas: a hairline keeps them apart.
  borderRight: t.palette.mode === 'dark' ? `1px solid ${t.palette.divider}` : 'none',
});

const Sidebar = ({ drawerWidth, mobileOpen, handleDrawerToggle }) => {
  const closeOnNavigate = () => {
    if (mobileOpen) handleDrawerToggle();
  };

  return (
    <Box component="aside" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': paperSx(drawerWidth) }}
      >
        <SidebarContent onNavigate={closeOnNavigate} />
      </Drawer>
      <Drawer variant="permanent" open sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': paperSx(drawerWidth) }}>
        <SidebarContent />
      </Drawer>
    </Box>
  );
};

export default Sidebar;
