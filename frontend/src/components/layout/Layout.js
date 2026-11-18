import { Box } from '@mui/material';
import React, { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { isStaffRole } from '../../auth/roles';
import { useAuth } from '../../contexts/AuthContext';
import { InboxProvider } from '../../contexts/InboxContext';
import ErrorBoundary from '../common/ErrorBoundary';
import CommandPalette from './CommandPalette';
import { BreadcrumbContext } from './breadcrumb';
import Navbar from './Navbar';
import ShortcutsDialog from './ShortcutsDialog';
import Sidebar from './Sidebar';
import { getPageMeta } from './navConfig';

export const DRAWER_WIDTH = 264;
export { useBreadcrumb, usePageTitle } from './breadcrumb';

const ShellContext = createContext({ openPalette: () => {}, openShortcuts: () => {} });
/** Open the command palette / shortcuts dialog from any page inside the shell. */
export const useShell = () => useContext(ShellContext);

// "/app/courses/123/gradebook" -> "/app/courses/123": changes only when the page changes,
// so the enter animation never replays just because a tab changed.
const pageKey = (pathname) => pathname.split('/').filter(Boolean).slice(0, 3).join('/');

const isTypingTarget = (el) =>
  !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.getAttribute?.('role') === 'textbox');

const GO_TO = {
  d: '/app',
  n: '/app/notifications',
  s: '/app/settings',
};
const GO_TO_STAFF = { c: '/app/courses', q: '/app/question-bank' };
const GO_TO_LEARNER = { r: '/app/results', j: '/app/join' };

const Layout = ({ pageFallback = null }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { currentUser, workspace } = useAuth();
  const baseMeta = getPageMeta(pathname, currentUser?.role);
  // Pages can replace the generic crumb ("Course") with the entity name via useBreadcrumb().
  const [crumb, setCrumb] = useState(null);
  const meta = crumb
    ? {
        title: crumb.title,
        section: crumb.parent ? crumb.parent.label : baseMeta.section,
        sectionTo: crumb.parent ? crumb.parent.to : baseMeta.sectionTo,
      }
    : baseMeta;
  const { title } = meta;
  const pendingG = useRef(0);

  const handleDrawerToggle = useCallback(() => setMobileOpen((open) => !open), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openShortcuts = useCallback(() => {
    setPaletteOpen(false);
    setShortcutsOpen(true);
  }, []);

  useEffect(() => {
    const suffix = workspace?.name ? ` · ${workspace.name}` : ' · Navigate';
    document.title = `${title}${suffix}`;
  }, [title, workspace?.name]);

  // Global keyboard shortcuts.
  useEffect(() => {
    const goTo = { ...GO_TO, ...(isStaffRole(currentUser?.role) ? GO_TO_STAFF : GO_TO_LEARNER) };
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShortcutsOpen(false);
        setPaletteOpen((open) => !open);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || e.defaultPrevented) return;
      // Ignore while a dialog/menu is open (they own the keyboard).
      if (document.querySelector('.MuiModal-root:not(.MuiModal-hidden)')) return;

      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'g') {
        pendingG.current = Date.now();
        return;
      }
      if (pendingG.current && Date.now() - pendingG.current < 1200 && goTo[key]) {
        e.preventDefault();
        pendingG.current = 0;
        navigate(goTo[key]);
        return;
      }
      pendingG.current = 0;
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentUser?.role, navigate]);

  const shell = useMemo(() => ({ openPalette, openShortcuts }), [openPalette, openShortcuts]);

  return (
    <ShellContext.Provider value={shell}>
      <BreadcrumbContext.Provider value={setCrumb}>
      <InboxProvider>
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
          <a className="nv-skip-link" href="#main-content">
            Skip to content
          </a>
          <Navbar
            drawerWidth={DRAWER_WIDTH}
            handleDrawerToggle={handleDrawerToggle}
            onOpenPalette={openPalette}
            onShowShortcuts={openShortcuts}
            meta={meta}
          />
          <Sidebar drawerWidth={DRAWER_WIDTH} mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} />

          <Box
            component="main"
            id="main-content"
            tabIndex={-1}
            sx={{
              flexGrow: 1,
              minWidth: 0,
              width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
              // Toolbar is 60/64px: leave ~28-32px of breathing room above every page header.
              pt: { xs: '88px', sm: '96px' },
              pb: { xs: 6, md: 8 },
              px: { xs: 2, sm: 3, md: 4, lg: 5 },
              '&:focus': { outline: 'none' },
            }}
          >
            <Box
              key={pageKey(pathname)}
              className="nv-page-enter"
              sx={{ maxWidth: 1240, mx: 'auto', '& > .MuiContainer-root': { px: 0 } }}
            >
              <ErrorBoundary resetKey={pathname}>
                <Suspense fallback={pageFallback}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </Box>
          </Box>
        </Box>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onShowShortcuts={openShortcuts} />
        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </InboxProvider>
      </BreadcrumbContext.Provider>
    </ShellContext.Provider>
  );
};

export default Layout;
