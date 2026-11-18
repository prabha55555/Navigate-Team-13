import { Box, Tab, Tabs } from '@mui/material';
import React, { Suspense, lazy } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import LoadingState from '../../components/common/LoadingState';
import PageHeader from '../../components/common/PageHeader';
import { settingsTabsFor } from '../../components/layout/navConfig';
import { useAuth } from '../../contexts/AuthContext';

const ProfileTab = lazy(() => import('./ProfileTab'));
const WorkspaceTab = lazy(() => import('./WorkspaceTab'));
const MembersTab = lazy(() => import('./MembersTab'));
const BillingTab = lazy(() => import('./BillingTab'));
const AuditLogTab = lazy(() => import('./AuditLogTab'));

const PANELS = {
  profile: ProfileTab,
  workspace: WorkspaceTab,
  members: MembersTab,
  billing: BillingTab,
  'audit-log': AuditLogTab,
};

const DESCRIPTIONS = {
  profile: 'Your name, appearance and password.',
  workspace: 'How your workspace looks and who can join it.',
  members: 'Everyone in your workspace, their roles, and invite links.',
  billing: 'Your plan, what you’ve used this month, and upgrades.',
  'audit-log': 'A record of important changes made in your workspace.',
};

/** /app/settings/:tab? — tabs are gated by role (admins and owners see workspace tabs). */
const Settings = () => {
  const { tab = 'profile' } = useParams();
  const navigate = useNavigate();
  const { currentUser, sessionVerified } = useAuth();
  const tabs = settingsTabsFor(currentUser?.role);

  if (!tabs.some((t) => t.value === tab)) {
    // The cached role may be stale (e.g. just promoted to admin): wait for /auth/me before redirecting.
    if (!sessionVerified) return <LoadingState minHeight="40vh" label="Checking your access…" />;
    return <Navigate to="/app/settings/profile" replace />;
  }

  const Panel = PANELS[tab];

  return (
    <Box>
      <PageHeader title="Settings" description={DESCRIPTIONS[tab]}>
        {tabs.length > 1 && (
          <Tabs
            value={tab}
            onChange={(_e, value) => navigate(`/app/settings/${value}`)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Settings sections"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            {tabs.map(({ value, label, Icon }) => (
              <Tab
                key={value}
                value={value}
                label={label}
                icon={<Icon fontSize="small" />}
                iconPosition="start"
                id={`settings-tab-${value}`}
                aria-controls={`settings-panel-${value}`}
              />
            ))}
          </Tabs>
        )}
      </PageHeader>
      <Box role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
        <Suspense fallback={<LoadingState minHeight="30vh" />}>
          <Panel />
        </Suspense>
      </Box>
    </Box>
  );
};

export default Settings;
