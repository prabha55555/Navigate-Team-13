import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined';
import { isAdminRole, isStaffRole } from '../../auth/roles';

export { initialsOf, roleLabel } from '../../auth/roles';

/** Main navigation for a role. */
export const navFor = (role) =>
  isStaffRole(role)
    ? [
        { label: 'Dashboard', path: '/app', exact: true, Icon: SpaceDashboardOutlinedIcon, shortcut: 'G D' },
        { label: 'Courses', path: '/app/courses', Icon: AutoStoriesOutlinedIcon, shortcut: 'G C', also: ['/app/assessments', '/app/submissions'] },
        { label: 'Question bank', path: '/app/question-bank', Icon: LibraryBooksOutlinedIcon, shortcut: 'G Q' },
      ]
    : [
        { label: 'Dashboard', path: '/app', exact: true, Icon: SpaceDashboardOutlinedIcon, shortcut: 'G D' },
        { label: 'My results', path: '/app/results', Icon: AssignmentTurnedInOutlinedIcon, shortcut: 'G R' },
        { label: 'Join a course', path: '/app/join', Icon: AddCircleOutlineRoundedIcon, shortcut: 'G J' },
      ];

/** Settings tabs visible to a role (order = tab order). */
export const settingsTabsFor = (role) => {
  const tabs = [{ value: 'profile', label: 'Profile', Icon: PersonOutlineRoundedIcon }];
  if (isAdminRole(role)) {
    tabs.push(
      { value: 'workspace', label: 'Workspace', Icon: WorkspacesOutlinedIcon },
      { value: 'members', label: 'Members', Icon: GroupOutlinedIcon },
      { value: 'billing', label: 'Billing', Icon: CreditCardOutlinedIcon },
      { value: 'audit-log', label: 'Audit log', Icon: HistoryRoundedIcon }
    );
  }
  return tabs;
};

/** Secondary nav ("Settings" section) for a role. */
// One entry: Members, Billing etc. are role-gated tabs inside Settings, so they are not repeated here.
export const settingsNavFor = () => [{ label: 'Settings', path: '/app/settings', Icon: SettingsOutlinedIcon, shortcut: 'G S' }];

/** True when `item` should show as the current page. */
export const isItemActive = (pathname, item) => {
  const match = (p) => pathname === p || (!item.exact && pathname.startsWith(`${p}/`));
  if (match(item.path)) return true;
  return (item.also || []).some((p) => pathname === p || pathname.startsWith(`${p}/`));
};

const COURSE_TAB_LABELS = {
  overview: 'Overview',
  assessments: 'Assessments',
  students: 'Students',
  gradebook: 'Gradebook',
  analytics: 'Analytics',
  curriculum: 'Curriculum',
  'learning-path': 'Learning path',
};

/** Breadcrumb section + page title for the top bar and document.title. */
export const getPageMeta = (pathname, role) => {
  const staff = isStaffRole(role);
  const parts = pathname.split('/').filter(Boolean); // ['app', ...]
  const [, section, id, tab] = parts;
  switch (section) {
    case undefined:
      return { section: '', title: 'Dashboard' };
    case 'courses':
      if (!id) return { section: '', title: 'Courses' };
      return staff
        ? { section: 'Courses', sectionTo: '/app/courses', title: COURSE_TAB_LABELS[tab] || 'Course' }
        : { section: 'Dashboard', sectionTo: '/app', title: COURSE_TAB_LABELS[tab] || 'Course' };
    case 'assessments':
      if (id === 'new') return { section: 'Courses', sectionTo: '/app/courses', title: 'New assessment' };
      return { section: 'Courses', sectionTo: '/app/courses', title: tab === 'edit' ? 'Edit assessment' : 'Assessment' };
    case 'submissions':
      return { section: 'Courses', sectionTo: '/app/courses', title: 'Submission review' };
    case 'question-bank':
      return { section: '', title: 'Question bank' };
    case 'results':
      return id ? { section: 'My results', sectionTo: '/app/results', title: 'Result' } : { section: '', title: 'My results' };
    case 'join':
      return { section: '', title: 'Join a course' };
    case 'notifications':
      return { section: '', title: 'Notifications' };
    case 'settings': {
      const label = settingsTabsFor('owner').find((t) => t.value === id)?.label;
      return { section: 'Settings', sectionTo: '/app/settings', title: label || 'Profile' };
    }
    default:
      return { section: '', title: 'Navigate' };
  }
};

/** Contextual sidebar group for a student inside a course. */
export const getLearnerContext = (pathname) => {
  const course = pathname.match(/^\/app\/courses\/([^/]+)/);
  if (!course) return null;
  const id = course[1];
  return {
    heading: 'Current course',
    items: [
      { label: 'Course overview', path: `/app/courses/${id}`, exact: true, Icon: AutoStoriesOutlinedIcon },
      { label: 'Learning path', path: `/app/courses/${id}/learning-path`, Icon: RouteOutlinedIcon },
    ],
  };
};

export const NOTIFICATIONS_ITEM = { label: 'Notifications', path: '/app/notifications', Icon: NotificationsNoneRoundedIcon, shortcut: 'G N' };
