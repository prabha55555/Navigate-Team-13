import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import {
  AppBar,
  Avatar,
  Box,
  ButtonBase,
  Chip,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { isStaffRole } from '../../auth/roles';
import { useAuth } from '../../contexts/AuthContext';
import { useColorMode } from '../../contexts/ColorModeContext';
import BrandMark from '../common/BrandMark';
import NotificationBell from './NotificationBell';
import { getPageMeta, initialsOf, roleLabel } from './navConfig';
import { MOD_KEY } from './ShortcutsDialog';

// Non-interactive blocks inside the account menu; MenuList skips them for keyboard focus.
const MenuBlock = ({ children, sx }) => <Box sx={{ px: 1.5, pt: 1.25, pb: 1.5, ...sx }}>{children}</Box>;
MenuBlock.muiSkipListHighlight = true;

/** Light / dark / system segmented control (used in the user menu and Settings → Profile). */
export const ThemeModeSwitch = ({ size = 'small', fullWidth = true }) => {
  const { mode, setMode } = useColorMode();
  return (
    <ToggleButtonGroup
      value={mode}
      exclusive
      size={size}
      fullWidth={fullWidth}
      onChange={(_e, value) => value && setMode(value)}
      aria-label="Colour theme"
    >
      <ToggleButton value="light" aria-label="Light theme">
        <LightModeOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} /> Light
      </ToggleButton>
      <ToggleButton value="dark" aria-label="Dark theme">
        <DarkModeOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} /> Dark
      </ToggleButton>
      <ToggleButton value="system" aria-label="Match system theme">
        <SettingsBrightnessOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} /> Auto
      </ToggleButton>
    </ToggleButtonGroup>
  );
};

const Navbar = ({ drawerWidth, handleDrawerToggle, onOpenPalette, onShowShortcuts, meta: metaProp }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const meta = metaProp || getPageMeta(pathname, currentUser?.role);
  const staff = isStaffRole(currentUser?.role);
  const name = currentUser?.name || 'Your account';
  const initials = initialsOf(currentUser?.name);

  const closeMenu = () => setAnchorEl(null);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate('/login', { replace: true });
  };

  const avatarSx = {
    color: '#fff',
    bgcolor: currentUser?.avatarColor || 'primary.main',
    fontWeight: 700,
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={(t) => ({
        width: { md: `calc(100% - ${drawerWidth}px)` },
        ml: { md: `${drawerWidth}px` },
        color: 'text.primary',
        bgcolor: alpha(t.palette.background.default, 0.82),
        backdropFilter: 'saturate(1.4) blur(14px)',
        WebkitBackdropFilter: 'saturate(1.4) blur(14px)',
        borderBottom: `1px solid ${t.palette.divider}`,
      })}
    >
      <Toolbar sx={{ minHeight: { xs: 60, sm: 64 }, px: { xs: 1, sm: 3, md: 4, lg: 5 }, gap: { xs: 0.5, sm: 1.5 } }}>
        <IconButton aria-label="Open navigation" onClick={handleDrawerToggle} sx={{ display: { md: 'none' }, color: 'text.primary' }}>
          <MenuRoundedIcon />
        </IconButton>

        <Box
          component={RouterLink}
          to="/app"
          aria-label="Navigate — go to your dashboard"
          sx={{ display: { xs: 'none', sm: 'inline-flex', md: 'none' }, borderRadius: 2 }}
        >
          <BrandMark size={30} />
        </Box>

        <Box component="nav" aria-label="Breadcrumb" sx={{ minWidth: 0, flex: 1, ml: { sm: 0.5, md: 0 }, display: 'flex', alignItems: 'center', gap: 1 }}>
          {meta.section && (
            <>
              <Typography
                component={meta.sectionTo ? RouterLink : 'span'}
                to={meta.sectionTo || undefined}
                noWrap
                sx={(t) => ({
                  display: { xs: 'none', sm: 'block' },
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'text.secondary',
                  flex: 'none',
                  maxWidth: 220,
                  textDecoration: 'none',
                  borderRadius: 1,
                  ...(meta.sectionTo && {
                    '&:hover': { color: 'text.primary', textDecoration: 'underline', textUnderlineOffset: '3px' },
                    '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
                  }),
                })}
              >
                {meta.section}
              </Typography>
              <ChevronRightRoundedIcon aria-hidden="true" sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 18, color: 'text.disabled', flex: 'none' }} />
            </>
          )}
          <Typography
            component="span"
            aria-current="page"
            noWrap
            title={meta.title}
            sx={{ fontSize: { xs: '1rem', sm: '0.875rem' }, fontWeight: { xs: 700, sm: 600 }, color: 'text.primary', minWidth: 0, maxWidth: { sm: 420 } }}
          >
            {meta.title}
          </Typography>
        </Box>

        {/* Command palette trigger */}
        <ButtonBase
          onClick={onOpenPalette}
          aria-label={`Search and commands (${MOD_KEY}+K)`}
          sx={(t) => ({
            display: { xs: 'none', md: 'inline-flex' },
            alignItems: 'center',
            gap: 1,
            height: 38,
            pl: 1.25,
            pr: 0.75,
            minWidth: 220,
            borderRadius: '10px',
            border: `1px solid ${t.palette.divider}`,
            bgcolor: 'background.paper',
            color: 'text.secondary',
            fontSize: '0.875rem',
            transition: 'border-color .16s ease',
            '&:hover': { borderColor: t.nv.borderStrong },
            '&.Mui-focusVisible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
          })}
        >
          <SearchRoundedIcon fontSize="small" />
          <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>
            Search…
          </Box>
          <Box
            component="kbd"
            sx={{ fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 600, px: 0.75, py: 0.1, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'background.default' }}
          >
            {MOD_KEY} K
          </Box>
        </ButtonBase>
        <Tooltip title="Search">
          <IconButton aria-label="Search and commands" onClick={onOpenPalette} sx={{ display: { md: 'none' }, color: 'text.secondary' }}>
            <SearchRoundedIcon />
          </IconButton>
        </Tooltip>

        <NotificationBell />

        <ButtonBase
          id="account-button"
          aria-label={`Account menu for ${name}`}
          aria-controls={menuOpen ? 'account-menu' : undefined}
          aria-haspopup="menu"
          aria-expanded={menuOpen ? 'true' : undefined}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={(t) => ({
            gap: 1.25,
            p: 0.5,
            pr: { xs: 0.5, sm: 1.25 },
            borderRadius: '999px',
            border: '1px solid transparent',
            transition: 'background-color .16s ease, border-color .16s ease',
            '&:hover, &[aria-expanded="true"]': { bgcolor: 'background.paper', borderColor: 'divider' },
            '&.Mui-focusVisible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
          })}
        >
          <Avatar sx={{ ...avatarSx, width: 34, height: 34, fontSize: '0.78rem' }}>{initials}</Avatar>
          <Box sx={{ display: { xs: 'none', lg: 'block' }, textAlign: 'left', minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.25, maxWidth: 160 }} noWrap>
              {name}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.25 }}>{roleLabel(currentUser?.role)}</Typography>
          </Box>
          <KeyboardArrowDownRoundedIcon
            sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 18, color: 'text.secondary', transition: 'transform .2s ease', transform: menuOpen ? 'rotate(180deg)' : 'none' }}
          />
        </ButtonBase>

        <Menu
          id="account-menu"
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={closeMenu}
          MenuListProps={{ 'aria-labelledby': 'account-button' }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { width: 300, maxWidth: 'calc(100vw - 24px)', mt: 1 } }}
        >
          <MenuBlock>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ ...avatarSx, width: 40, height: 40, fontSize: '0.85rem' }}>{initials}</Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3 }} noWrap>
                  {name}
                </Typography>
                {currentUser?.email && (
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1.3 }} noWrap>
                    {currentUser.email}
                  </Typography>
                )}
              </Box>
            </Box>
            <Chip size="small" label={roleLabel(currentUser?.role)} color={staff ? 'primary' : 'secondary'} sx={{ mt: 1.25 }} />
          </MenuBlock>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem component={RouterLink} to="/app/settings/profile" onClick={closeMenu}>
            <ListItemIcon>
              <PersonOutlineRoundedIcon fontSize="small" />
            </ListItemIcon>
            Profile
          </MenuItem>
          <MenuItem component={RouterLink} to="/app/settings" onClick={closeMenu}>
            <ListItemIcon>
              <SettingsOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Settings
          </MenuItem>
          <MenuItem
            onClick={() => {
              closeMenu();
              onShowShortcuts();
            }}
          >
            <ListItemIcon>
              <KeyboardOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Keyboard shortcuts
            <Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary' }}>
              ?
            </Typography>
          </MenuItem>
          <Divider sx={{ my: 0.5 }} />
          <MenuBlock sx={{ pt: 0.75, pb: 1 }}>
            <Typography variant="caption" component="p" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.75 }}>
              Theme
            </Typography>
            <ThemeModeSwitch />
          </MenuBlock>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={handleLogout} sx={(t) => ({ color: t.nv.inkFor.error, '& .MuiListItemIcon-root': { color: t.nv.inkFor.error } })}>
            <ListItemIcon>
              <LogoutRoundedIcon fontSize="small" />
            </ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
