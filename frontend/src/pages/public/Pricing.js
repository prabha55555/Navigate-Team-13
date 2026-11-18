import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import {
  Box,
  Container,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { listPlans } from '../../api/workspace';
import { useAuth } from '../../contexts/AuthContext';
import { Eyebrow, FaqList, ON_INK, PUBLIC_PLANS, PlanCard, PlanCta, SiteFooter, SiteHeader } from './marketing';

const fmtLimit = (n, unit) => (n == null ? 'Unlimited' : `${n.toLocaleString()}${unit ? ` ${unit}` : ''}`);

// Feature comparison: true = included, false = not included, string = detail.
const COMPARISON = [
  { group: 'Limits', rows: [
    { label: 'Staff seats (owners, admins, instructors)', get: (p) => fmtLimit(p.limits.staffSeats) },
    { label: 'Students', get: (p) => fmtLimit(p.limits.students) },
    { label: 'AI generations per month', get: (p) => fmtLimit(p.limits.aiGenerations) },
  ] },
  { group: 'Assessments', rows: [
    { label: 'Courses, join codes and rosters', get: () => true },
    { label: '5 question types, timers, attempts and due dates', get: () => true },
    { label: 'AI question generation from a syllabus', get: () => true },
    { label: 'Question bank', get: () => true },
    { label: 'Manual grading and score overrides', get: () => true },
  ] },
  { group: 'Integrity', rows: [
    { label: 'Fullscreen, shortcut, tab-switch and paste detection', get: () => true },
    { label: 'Optional webcam presence checks', get: () => true },
    { label: 'Plagiarism check on written answers', get: () => true },
  ] },
  { group: 'Insight', rows: [
    { label: 'Dashboards, at-risk alerts and course analytics', get: () => true },
    { label: 'Item analysis (difficulty & discrimination)', get: () => true },
    { label: 'Gradebook with CSV export', get: () => true },
    { label: 'Adaptive learning paths & practice quizzes', get: () => true },
  ] },
  { group: 'Administration', rows: [
    { label: 'Role-based access and invite links', get: () => true },
    { label: 'Audit log (365 days)', get: () => true },
    { label: 'Contract & invoicing', get: (p) => p.id === 'enterprise' },
    { label: 'Dedicated support', get: (p) => p.id === 'enterprise' },
  ] },
];

const FAQ = [
  { q: 'Is there a free trial of Pro?', a: 'The Free plan never expires, so you can set up courses and run real assessments before upgrading. Owners can change plans at any time from Settings → Billing.' },
  { q: 'What happens if we hit a limit?', a: 'Nothing you’ve already created is affected. Actions that would go over the limit — like adding another instructor or generating more questions with AI this month — are paused with a prompt to upgrade. AI generations reset on the 1st of each month.' },
  { q: 'How is Pro billed?', a: 'Pro is priced per instructor per month. Online card payments aren’t live yet — during early access, plan changes are handled with our team and nothing is charged automatically.' },
  { q: 'Can we downgrade?', a: 'Yes, as long as your current number of staff and students fits within the smaller plan. Navigate tells you exactly what to change if it doesn’t.' },
  { q: 'Do students need to pay?', a: 'No. Students join free with a course code or invite link; they count toward your workspace’s student limit.' },
];

const Cell = ({ value }) => {
  if (value === true) return <CheckRoundedIcon sx={{ color: 'success.main' }} aria-label="Included" />;
  if (value === false) return <RemoveRoundedIcon sx={{ color: 'text.disabled' }} aria-label="Not included" />;
  return <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>;
};

/** /pricing — public plan cards (live catalog when signed in), comparison table and FAQ. */
const Pricing = () => {
  const { currentUser } = useAuth();
  const [live, setLive] = useState(null);

  useEffect(() => {
    document.title = 'Pricing · Navigate';
  }, []);

  // Signed-in users get the live catalog (and their current plan); everyone else sees the mirrored copy.
  useEffect(() => {
    if (!currentUser) return undefined;
    let cancelled = false;
    listPlans()
      .then((data) => !cancelled && setLive(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const plans = useMemo(() => {
    if (!live?.plans?.length) return PUBLIC_PLANS;
    return live.plans.map((p) => ({ ...(PUBLIC_PLANS.find((s) => s.id === p.id) || {}), ...p }));
  }, [live]);

  return (
    <Box sx={{ bgcolor: 'background.default', overflowX: 'clip' }}>
      <a className="nv-skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader dashboardPath={currentUser ? '/app' : null} />
      <Box component="main" id="main-content" tabIndex={-1} sx={{ '&:focus': { outline: 'none' } }}>
        <Box component="section" aria-labelledby="pricing-title" className="nv-ink nv-dots" sx={{ pt: { xs: 14, md: 18 }, pb: { xs: 18, md: 22 }, textAlign: 'center' }}>
          <Box
            aria-hidden="true"
            sx={{ position: 'absolute', zIndex: -1, left: '20%', top: '-20%', width: '60%', height: '90%', background: 'radial-gradient(closest-side, rgba(51,70,232,0.42), rgba(51,70,232,0))' }}
          />
          <Container maxWidth="md">
            <Eyebrow onInk>Pricing</Eyebrow>
            <Typography id="pricing-title" variant="h1" sx={{ color: ON_INK.strong, mt: 1.5, fontSize: { xs: '2.5rem', md: '3.5rem' } }}>
              Simple plans that grow with your program.
            </Typography>
            <Typography sx={{ color: ON_INK.text, mt: 2.5, fontSize: '1.1rem', lineHeight: 1.65, maxWidth: 560, mx: 'auto' }}>
              Every plan includes assessments, proctoring, analytics and adaptive learning. Pay for seats and AI capacity, not features.
            </Typography>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ mt: { xs: -12, md: -15 }, position: 'relative' }}>
          <Grid container spacing={2.5}>
            {plans.map((plan) => (
              <Grid item xs={12} md={4} key={plan.id}>
                <PlanCard plan={plan} current={live?.currentPlan === plan.id} action={<PlanCta plan={plan} signedIn={Boolean(currentUser)} />} />
              </Grid>
            ))}
          </Grid>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mt: 3 }}>
            Prices in USD. Online payments are not live yet — no card is required to start.
          </Typography>
        </Container>

        <Container maxWidth="lg" component="section" aria-labelledby="compare-title" sx={{ py: { xs: 10, md: 14 } }}>
          <Eyebrow>Compare</Eyebrow>
          <Typography id="compare-title" variant="h2" sx={{ mt: 1.5, mb: 4 }}>
            Plan comparison
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: '20px', overflow: 'hidden' }}>
            <TableContainer sx={{ borderRadius: 0 }}>
              <Table aria-label="Plan comparison" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '40%' }}>Feature</TableCell>
                    {plans.map((p) => (
                      <TableCell key={p.id} align="center">
                        {p.name}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {COMPARISON.map((group) => (
                    <React.Fragment key={group.group}>
                      <TableRow>
                        <TableCell colSpan={plans.length + 1} sx={{ bgcolor: 'action.hover', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
                          {group.group}
                        </TableCell>
                      </TableRow>
                      {group.rows.map((row) => (
                        <TableRow key={row.label}>
                          <TableCell component="th" scope="row">
                            {row.label}
                          </TableCell>
                          {plans.map((p) => (
                            <TableCell key={p.id} align="center">
                              <Cell value={row.get(p)} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Container>

        <Container maxWidth="md" component="section" aria-labelledby="pricing-faq-title" sx={{ pb: { xs: 10, md: 14 } }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Eyebrow>FAQ</Eyebrow>
            <Typography id="pricing-faq-title" variant="h2" sx={{ mt: 1.5 }}>
              Pricing questions
            </Typography>
          </Box>
          <FaqList items={FAQ} />
        </Container>
      </Box>
      <SiteFooter dashboardPath={currentUser ? '/app' : null} />
    </Box>
  );
};

export default Pricing;
