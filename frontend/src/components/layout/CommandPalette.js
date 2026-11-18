import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Box, CircularProgress, Dialog, InputBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAssessments } from '../../api/assessments';
import { listCourses } from '../../api/courses';
import { isAdminRole, isStaffRole } from '../../auth/roles';
import { useAuth } from '../../contexts/AuthContext';
import { useColorMode } from '../../contexts/ColorModeContext';
import { NOTIFICATIONS_ITEM, navFor, settingsTabsFor } from './navConfig';

const normalise = (s = '') => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
const matches = (item, query) => {
  if (!query) return true;
  const haystack = normalise(`${item.label} ${item.hint || ''} ${item.keywords || ''}`);
  return normalise(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
};

const Kbd = ({ children }) => (
  <Box
    component="kbd"
    sx={{
      fontFamily: 'inherit',
      fontSize: '0.6875rem',
      fontWeight: 600,
      px: 0.75,
      py: 0.1,
      borderRadius: 1,
      border: 1,
      borderColor: 'divider',
      color: 'text.secondary',
      bgcolor: 'background.default',
    }}
  >
    {children}
  </Box>
);

/** Ctrl/⌘+K palette: jump to pages, courses, recent assessments, and run actions. */
const CommandPalette = ({ open, onClose, onShowShortcuts }) => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { resolvedMode, toggleMode } = useColorMode();
  const role = currentUser?.role;
  const staff = isStaffRole(role);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState({ courses: [], assessments: [], loading: false, loaded: false });
  const listRef = useRef(null);

  // Fetch courses (and recent assessments for staff) the first time the palette opens.
  useEffect(() => {
    if (!open || remote.loaded || remote.loading) return;
    setRemote((r) => ({ ...r, loading: true }));
    Promise.all([
      listCourses({ pageSize: 100 }).catch(() => null),
      staff ? listAssessments({ pageSize: 8, sort: '-updatedAt' }).catch(() => null) : Promise.resolve(null),
    ]).then(([courses, assessments]) => {
      setRemote({ courses: courses?.items || [], assessments: assessments?.items || [], loading: false, loaded: true });
    });
  }, [open, remote.loaded, remote.loading, staff]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const groups = useMemo(() => {
    const go = (path) => () => navigate(path);
    const pages = [
      ...[...navFor(role), NOTIFICATIONS_ITEM].map((item) => ({
        id: `page:${item.path}`,
        label: item.label,
        hint: 'Page',
        Icon: item.Icon,
        run: go(item.path),
      })),
      ...settingsTabsFor(role).map((tab) => ({
        id: `page:/app/settings/${tab.value}`,
        label: tab.value === 'profile' ? 'Settings' : tab.label,
        hint: tab.value === 'profile' ? 'Profile, theme, password' : 'Settings',
        keywords: 'settings preferences',
        Icon: tab.Icon,
        run: go(`/app/settings/${tab.value}`),
      })),
    ];

    const actions = [];
    if (staff) {
      actions.push(
        { id: 'act:new-course', label: 'Create course', keywords: 'new add class', Icon: AddCircleOutlineRoundedIcon, run: go('/app/courses?new=1') },
        { id: 'act:new-assessment', label: 'New assessment', keywords: 'create quiz exam test', Icon: NoteAddOutlinedIcon, run: go('/app/assessments/new') }
      );
    } else {
      actions.push({ id: 'act:join', label: 'Join a course with a code', keywords: 'enrol enroll', Icon: AddCircleOutlineRoundedIcon, run: go('/app/join') });
    }
    if (isAdminRole(role)) {
      actions.push({ id: 'act:invite', label: 'Invite a colleague', keywords: 'member invite link add user', Icon: PersonAddAlt1OutlinedIcon, run: go('/app/settings/members') });
    }
    actions.push(
      {
        id: 'act:theme',
        label: resolvedMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        keywords: 'toggle theme dark light mode appearance',
        Icon: resolvedMode === 'dark' ? LightModeOutlinedIcon : DarkModeOutlinedIcon,
        run: toggleMode,
      },
      { id: 'act:shortcuts', label: 'Keyboard shortcuts', keywords: 'help keys hotkeys', Icon: KeyboardOutlinedIcon, run: onShowShortcuts },
      {
        id: 'act:logout',
        label: 'Sign out',
        keywords: 'log out logout',
        Icon: LogoutRoundedIcon,
        run: async () => {
          await logout();
          navigate('/login', { replace: true });
        },
      }
    );

    const courses = remote.courses.map((c) => ({
      id: `course:${c.id}`,
      label: c.title,
      hint: [c.code, c.term].filter(Boolean).join(' · ') || 'Course',
      keywords: c.code,
      Icon: AutoStoriesOutlinedIcon,
      run: go(`/app/courses/${c.id}`),
    }));

    const assessments = remote.assessments.map((a) => ({
      id: `assessment:${a.id}`,
      label: a.title,
      hint: [a.courseTitle, a.status].filter(Boolean).join(' · '),
      Icon: QuizOutlinedIcon,
      run: go(`/app/assessments/${a.id}`),
    }));

    return [
      { heading: 'Actions', items: actions },
      { heading: 'Pages', items: pages },
      { heading: 'Courses', items: courses, loading: remote.loading },
      ...(staff ? [{ heading: 'Recent assessments', items: assessments, loading: remote.loading }] : []),
    ]
      .map((g) => ({ ...g, items: g.items.filter((item) => matches(item, query)).slice(0, query ? 8 : 6) }))
      .filter((g) => g.items.length || (g.loading && !query));
  }, [role, staff, resolvedMode, toggleMode, onShowShortcuts, logout, navigate, remote, query]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const runItem = (item) => {
    if (!item) return;
    onClose();
    // Let the dialog close before navigating/opening anything else.
    setTimeout(() => item.run?.(), 0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runItem(flat[active]);
    }
  };

  let index = -1;
  const activeId = flat[active] ? `nv-cmd-${flat[active].id.replace(/[^\w-]/g, '-')}` : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-label="Command palette"
      PaperProps={{ sx: { alignSelf: 'flex-start', mt: { xs: 2, sm: '12vh' }, borderRadius: 4, overflow: 'hidden', mx: { xs: 1.5, sm: 4 }, width: { xs: 'calc(100% - 24px)', sm: undefined } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <SearchRoundedIcon sx={{ color: 'text.secondary' }} />
        <InputBase
          autoFocus
          fullWidth
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={staff ? 'Search pages, courses, assessments, actions…' : 'Search pages, courses, actions…'}
          inputProps={{
            'aria-label': 'Search commands',
            role: 'combobox',
            'aria-expanded': true,
            'aria-controls': 'nv-cmd-list',
            'aria-activedescendant': activeId,
            'aria-autocomplete': 'list',
          }}
          sx={{ fontSize: '1rem' }}
        />
        <Kbd>Esc</Kbd>
      </Box>
      <Box ref={listRef} id="nv-cmd-list" role="listbox" aria-label="Results" sx={{ maxHeight: 'min(440px, 60vh)', overflowY: 'auto', p: 1 }}>
        {flat.length === 0 && !groups.some((g) => g.loading) && (
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 5 }}>
            No results for “{query}”
          </Typography>
        )}
        {groups.map((group) => (
          <Box key={group.heading} role="group" aria-label={group.heading} sx={{ mb: 0.5 }}>
            <Typography variant="overline" component="p" sx={{ px: 1.5, pt: 1, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
              {group.heading}
              {group.loading && <CircularProgress size={10} thickness={6} />}
            </Typography>
            {group.items.map((item) => {
              index += 1;
              const i = index;
              const selected = i === active;
              const { Icon } = item;
              return (
                <Box
                  key={item.id}
                  id={`nv-cmd-${item.id.replace(/[^\w-]/g, '-')}`}
                  role="option"
                  aria-selected={selected}
                  data-index={i}
                  onMouseMove={() => active !== i && setActive(i)}
                  onClick={() => runItem(item)}
                  sx={(t) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    cursor: 'pointer',
                    bgcolor: selected ? alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.18 : 0.08) : 'transparent',
                  })}
                >
                  {Icon && <Icon fontSize="small" sx={{ color: selected ? 'primary.main' : 'text.secondary' }} />}
                  <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
                    {item.label}
                  </Typography>
                  {item.hint && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize', maxWidth: '45%' }} noWrap>
                      {item.hint}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 2, px: 2, py: 1, borderTop: 1, borderColor: 'divider', color: 'text.secondary' }}>
        <Typography variant="caption" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> to move
        </Typography>
        <Typography variant="caption" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Kbd>Enter</Kbd> to open
        </Typography>
        <Typography variant="caption" sx={{ display: 'flex', gap: 0.5, alignItems: 'center', ml: 'auto' }}>
          <Kbd>?</Kbd> all shortcuts
        </Typography>
      </Box>
    </Dialog>
  );
};

export { Kbd };
export default CommandPalette;
