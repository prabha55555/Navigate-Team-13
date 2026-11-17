import { Box } from '@mui/material';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { getPageMeta } from './navConfig';

export const DRAWER_WIDTH = 264;

// "/instructor/courses/123" -> "/instructor/courses": changes only when the page changes,
// so the enter animation never remounts a page just because its params changed.
const pageKey = (pathname) => {
  const parts = pathname.split('/').filter(Boolean);
  return `/${parts[0] === 'instructor' ? parts.slice(0, 2).join('/') : parts[0] || ''}`;
};

const Layout = ({ pageFallback = null }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const { title } = getPageMeta(pathname);

  const handleDrawerToggle = useCallback(() => setMobileOpen((open) => !open), []);

  useEffect(() => {
    document.title = title === 'Navigate' ? 'Navigate' : `${title} · Navigate`;
  }, [title]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <a className="nv-skip-link" href="#main-content">
        Skip to content
      </a>
      <Navbar drawerWidth={DRAWER_WIDTH} handleDrawerToggle={handleDrawerToggle} />
      <Sidebar drawerWidth={DRAWER_WIDTH} mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} />

      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          pt: { xs: '68px', sm: '72px' },
          pb: { xs: 6, md: 8 },
          px: { xs: 2, sm: 3, md: 4, lg: 5 },
          '&:focus': { outline: 'none' },
        }}
      >
        <Box
          key={pageKey(pathname)}
          className="nv-page-enter"
          sx={{
            maxWidth: 1240,
            mx: 'auto',
            // Pages wrap themselves in a <Container>; the shell already provides the gutter.
            '& > .MuiContainer-root': { px: 0 },
          }}
        >
          <Suspense fallback={pageFallback}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
