import { createContext, useContext, useEffect } from 'react';

/**
 * Lets a page put the current entity's name in the top-bar breadcrumb and document title.
 *
 *   useBreadcrumb(course?.title, { label: 'Courses', to: '/app/courses' });
 *   usePageTitle(assessment?.title);           // keeps the default parent crumb
 *
 * Pass a falsy title while loading — the default crumb ("Course") shows until it resolves.
 * The override is removed automatically when the page unmounts. Outside the app shell
 * (e.g. the exam screen) these hooks are no-ops.
 */
export const BreadcrumbContext = createContext(null);

export const useBreadcrumb = (title, parent) => {
  const setCrumb = useContext(BreadcrumbContext);
  const parentLabel = parent?.label;
  const parentTo = parent?.to;

  useEffect(() => {
    if (!setCrumb || !title) return undefined;
    const entry = { title: String(title), parent: parentLabel ? { label: parentLabel, to: parentTo || null } : null };
    setCrumb(entry);
    return () => setCrumb((current) => (current === entry ? null : current));
  }, [setCrumb, title, parentLabel, parentTo]);
};

export const usePageTitle = (title) => useBreadcrumb(title);
