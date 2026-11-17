import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';

export const STUDENT_NAV = [{ label: 'Dashboard', path: '/dashboard', Icon: SpaceDashboardOutlinedIcon }];

export const INSTRUCTOR_NAV = [
  { label: 'Dashboard', path: '/instructor/dashboard', Icon: SpaceDashboardOutlinedIcon },
  { label: 'Courses', path: '/instructor/courses', Icon: AutoStoriesOutlinedIcon },
  { label: 'Assessment Studio', path: '/instructor/assessment', Icon: AutoAwesomeOutlinedIcon },
  { label: 'Student Results', path: '/instructor/student-results', Icon: InsightsOutlinedIcon },
  { label: 'Curriculum Map', path: '/instructor/curriculum', Icon: AccountTreeOutlinedIcon },
];

/** True for the path itself and anything nested under it (/instructor/courses/123). */
export const isPathActive = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`);

const PAGES = [
  { path: '/instructor/dashboard', title: 'Dashboard', section: 'Instructor workspace' },
  { path: '/instructor/courses', title: 'Courses', section: 'Instructor workspace' },
  { path: '/instructor/assessment', title: 'Assessment Studio', section: 'Instructor workspace' },
  { path: '/instructor/student-results', title: 'Student Results', section: 'Instructor workspace' },
  { path: '/instructor/curriculum', title: 'Curriculum Map', section: 'Instructor workspace' },
  { path: '/dashboard', title: 'Dashboard', section: 'Your learning' },
  { path: '/course', title: 'Course overview', section: 'Your learning' },
  { path: '/learning-path', title: 'Learning path', section: 'Your learning' },
  { path: '/assessment', title: 'Assessment', section: 'Proctored session' },
  { path: '/results', title: 'Results', section: 'Your learning' },
];

export const getPageMeta = (pathname) =>
  PAGES.find((page) => isPathActive(pathname, page.path)) || { title: 'Navigate', section: '' };

/**
 * Student pages that need an id aren't global nav items, but while a student is on
 * one we surface where they are (and the sibling page for the same course).
 */
export const getStudentContext = (pathname) => {
  const course = pathname.match(/^\/(course|learning-path)\/([^/]+)/);
  if (course) {
    const id = course[2];
    return {
      heading: 'Current course',
      items: [
        { label: 'Course overview', path: `/course/${id}`, Icon: AutoStoriesOutlinedIcon },
        { label: 'Learning path', path: `/learning-path/${id}`, Icon: RouteOutlinedIcon },
      ],
    };
  }
  if (/^\/assessment\/[^/]+/.test(pathname)) {
    return { heading: 'In progress', items: [{ label: 'Assessment', path: pathname, Icon: QuizOutlinedIcon }] };
  }
  if (/^\/results\/[^/]+/.test(pathname)) {
    return { heading: 'Just finished', items: [{ label: 'Results', path: pathname, Icon: AssignmentTurnedInOutlinedIcon }] };
  }
  return null;
};

export const roleLabel = (role) => {
  if (role === 'admin') return 'Administrator';
  if (role === 'instructor') return 'Instructor';
  return 'Student';
};

export const initialsOf = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
