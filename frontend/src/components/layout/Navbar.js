import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
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
  Toolbar,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { homePathFor, isInstructorRole } from '../../auth/roles';
import { useAuth } from '../../contexts/AuthContext';
import BrandMark from '../common/BrandMark';
import { getPageMeta, initialsOf, roleLabel } from './navConfig';

// Non-interactive header inside the account menu; MenuList skips it for keyboard focus.
const MenuHeader = ({ children }) => <Box sx={{ px: 1.5, pt: 1.25, pb: 1.5 }}>{children}</Box>;
MenuHeader.muiSkipListHighlight = true;

const Navbar = ({ drawerWidth, handleDrawerToggle }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const meta = getPageMeta(pathname);
  const instructor = isInstructorRole(currentUser?.role);
  const name = currentUser?.name || 'Your account';
  const initials = initialsOf(currentUser?.name);

  const closeMenu = () => setAnchorEl(null);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { md: `calc(100% - ${drawerWidth}px)` },
        ml: { md: `${drawerWidth}px` },
        color: 'text.primary',
        bgcolor: 'rgba(246, 245, 241, 0.82)',
        backdropFilter: 'saturate(1.4) blur(14px)',
        WebkitBackdropFilter: 'saturate(1.4) blur(14px)',
        borderBottom: '1px solid rgba(14, 22, 48, 0.07)',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 60, sm: 64 }, px: { xs: 1.5, sm: 3, md: 4, lg: 5 }, gap: { xs: 1, sm: 1.5 } }}>
        <IconButton
          aria-label="Open navigation"
          onClick={handleDrawerToggle}
          sx={{ display: { md: 'none' }, color: 'text.primary' }}
        >
          <MenuRoundedIcon />
        </IconButton>

        <Box
          component={RouterLink}
          to={homePathFor(currentUser)}
          aria-label="Navigate — go to your dashboard"
          sx={{ display: { xs: 'none', sm: 'inline-flex', md: 'none' }, borderRadius: 2 }}
        >
          <BrandMark size={30} />
        </Box>

        {/* Quiet wayfinding breadcrumb; the page body owns the serif page title. */}
        <Box
          component="nav"
          aria-label="Breadcrumb"
          sx={{ minWidth: 0, flex: 1, ml: { sm: 0.5, md: 0 }, display: 'flex', alignItems: 'center', gap: 1 }}
        >
          {meta.section && (
            <>
              <Typography
                component="span"
                noWrap
                sx={{ display: { xs: 'none', sm: 'block' }, fontSize: '0.875rem', fontWeight: 500, color: 'text.secondary', flex: 'none' }}
              >
                {meta.section}
              </Typography>
              <ChevronRightRoundedIcon
                aria-hidden="true"
                sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 18, color: 'grey.400', flex: 'none' }}
              />
            </>
          )}
          <Typography
            component="span"
            aria-current="page"
            noWrap
            sx={{ fontSize: { xs: '1rem', sm: '0.875rem' }, fontWeight: { xs: 700, sm: 600 }, color: 'text.primary', minWidth: 0 }}
          >
            {meta.title}
          </Typography>
        </Box>

        <ButtonBase
          id="account-button"
          aria-label={`Account menu for ${name}`}
          aria-controls={menuOpen ? 'account-menu' : undefined}
          aria-haspopup="menu"
          aria-expanded={menuOpen ? 'true' : undefined}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            gap: 1.25,
            p: 0.5,
            pr: { xs: 0.5, sm: 1.25 },
            borderRadius: '999px',
            border: '1px solid transparent',
            transition: 'background-color .16s ease, border-color .16s ease',
            '&:hover, &[aria-expanded="true"]': { bgcolor: 'rgba(255,255,255,0.9)', borderColor: 'divider' },
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              fontSize: '0.8rem',
              color: '#fff',
              background: instructor
                ? 'linear-gradient(135deg, #3346E8, #18234A)'
                : 'linear-gradient(135deg, #18234A, #0E1630)',
              boxShadow: '0 0 0 2px #fff, 0 0 0 3px rgba(14,22,48,0.08)',
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left', minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.25, maxWidth: 160 }} noWrap>
              {name}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.25 }}>
              {roleLabel(currentUser?.role)}
            </Typography>
          </Box>
          <KeyboardArrowDownRoundedIcon
            sx={{
              display: { xs: 'none', sm: 'block' },
              fontSize: 18,
              color: 'text.secondary',
              transition: 'transform .2s ease',
              transform: menuOpen ? 'rotate(180deg)' : 'none',
            }}
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
          PaperProps={{ sx: { width: 264, mt: 1 } }}
        >
          <MenuHeader>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ width: 40, height: 40, fontSize: '0.85rem', bgcolor: 'var(--nv-ink)', color: '#fff' }}>
                {initials}
              </Avatar>
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
            <Chip
              size="small"
              label={roleLabel(currentUser?.role)}
              color={instructor ? 'primary' : 'secondary'}
              sx={{ mt: 1.25 }}
            />
          </MenuHeader>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem component={RouterLink} to={homePathFor(currentUser)} onClick={closeMenu}>
            <ListItemIcon>
              <SpaceDashboardOutlinedIcon fontSize="small" />
            </ListItemIcon>
            My dashboard
          </MenuItem>
          <MenuItem onClick={handleLogout} sx={{ color: 'error.dark', '& .MuiListItemIcon-root': { color: 'error.main' } }}>
            <ListItemIcon>
              <LogoutRoundedIcon fontSize="small" />
            </ListItemIcon>
            Log out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
