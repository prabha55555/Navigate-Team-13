import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import CoPresentOutlinedIcon from '@mui/icons-material/CoPresentOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GradingOutlinedIcon from '@mui/icons-material/GradingOutlined';
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ManageSearchOutlinedIcon from '@mui/icons-material/ManageSearchOutlined';
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import { Box, Button, Chip, Container, Grid, LinearProgress, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { homePathFor } from '../auth/roles';
import LearningRoute from '../components/common/LearningRoute';
import ScoreRing from '../components/common/ScoreRing';
import { useAuth } from '../contexts/AuthContext';
import { tokens } from '../theme';
import { Eyebrow, FaqList, PUBLIC_PLANS, PlanCard, PlanCta, SiteFooter, SiteHeader, ghostButtonSx, lightButtonSx, onInkFocus } from './public/marketing';

/* -------------------------------------------------------------------------- */
/* Content — every claim here describes something the product actually does.  */
/* -------------------------------------------------------------------------- */

const STATS = [
  { value: '5', label: 'Question types', detail: 'Multiple choice, multi-select, true/false, short answer and essay' },
  { value: '5', label: 'Integrity signals', detail: 'Fullscreen exits, blocked shortcuts, tab switches, pastes and webcam presence' },
  { value: '4', label: 'Roles', detail: 'Owner, admin, instructor and student — each with its own permissions' },
  { value: '$0', label: 'To start', detail: '2 staff seats, 50 students and 25 AI generations every month' },
];

const STUDENT_FEATURES = [
  {
    Icon: RouteOutlinedIcon,
    title: 'Adaptive learning paths',
    text: 'Topic mastery from every graded attempt, with recommendations for the weakest topics first.',
  },
  {
    Icon: AutoAwesomeOutlinedIcon,
    title: 'Personal practice quizzes',
    text: 'Generate a practice set on the topics you need most — graded instantly, never counted toward your grade.',
  },
  {
    Icon: VideocamOutlinedIcon,
    title: 'Calm, fair proctoring',
    text: 'Fullscreen focus mode with clear warnings before anything counts, and answers that autosave as you go.',
  },
  {
    Icon: FactCheckOutlinedIcon,
    title: 'Results you can learn from',
    text: 'Question-by-question breakdowns, explanations when your instructor allows them, and a history of every attempt.',
  },
];

const INSTRUCTOR_FEATURES = [
  {
    Icon: UploadFileOutlinedIcon,
    title: 'Syllabus to assessment',
    text: 'Upload a PDF, DOCX or TXT syllabus. AI extracts topics and outcomes, then drafts questions you review and edit.',
  },
  {
    Icon: LibraryBooksOutlinedIcon,
    title: 'Question bank',
    text: 'Save good questions once and reuse them across courses, filtered by topic, type and difficulty.',
  },
  {
    Icon: PolicyOutlinedIcon,
    title: 'Integrity built in',
    text: 'Proctoring events and plagiarism checks on written answers appear right next to each submission.',
  },
  {
    Icon: InsightsOutlinedIcon,
    title: 'Analytics that find the gaps',
    text: 'At-risk students, topic mastery heatmaps, score distributions and item analysis for every question.',
  },
];

const FEATURES = [
  { Icon: AutoAwesomeOutlinedIcon, title: 'AI question generation', text: 'Draft questions from a syllabus or a topic list, then refine them with plain-language feedback.' },
  { Icon: QuizOutlinedIcon, title: 'Flexible assessments', text: 'Time limits, attempts, due dates, pass marks, shuffling, and when students see their results.' },
  { Icon: VideocamOutlinedIcon, title: 'Proctoring', text: 'Fullscreen enforcement, blocked shortcuts, tab-switch and paste detection, and optional webcam checks.' },
  { Icon: RouteOutlinedIcon, title: 'Adaptive learning', text: 'Mastery per topic, recommendations, and AI practice quizzes tailored to each student.' },
  { Icon: BarChartOutlinedIcon, title: 'Course analytics', text: 'Weekly trends, pass rates, score distributions and at-risk alerts across every course you teach.' },
  { Icon: ManageSearchOutlinedIcon, title: 'Item analysis', text: 'Difficulty and discrimination for each question, with flags for items that are too easy or misleading.' },
  { Icon: TableChartOutlinedIcon, title: 'Gradebook', text: 'Best attempt per student per assessment, missing work highlighted, and one-click CSV export.' },
  { Icon: GradingOutlinedIcon, title: 'Manual review', text: 'Regrade any question, override a score with a comment, and release results when you are ready.' },
  { Icon: AccountTreeOutlinedIcon, title: 'Curriculum mapping', text: 'Link assessments to course outcomes and Bloom’s levels to see what you are really measuring.' },
];

const TRUST = [
  { Icon: ShieldOutlinedIcon, title: 'Tenant isolation', text: 'Every query is scoped to your workspace. Another institution’s data is simply not reachable.' },
  { Icon: LockOutlinedIcon, title: 'Encrypted passwords', text: 'Passwords are hashed with bcrypt, sign-in is rate limited, and repeated failures lock the account.' },
  { Icon: AdminPanelSettingsOutlinedIcon, title: 'Role-based access', text: 'Owners, admins, instructors and students each see and change only what their role allows.' },
  { Icon: HistoryEduOutlinedIcon, title: 'Audit log', text: 'Role changes, plan changes, publishing, grading and exports are recorded for a year.' },
];

const STEPS = [
  {
    title: 'Create your workspace',
    text: 'Name your institution, invite instructors with a link, and set up your first course in a minute.',
    who: 'Admin',
  },
  {
    title: 'Build the assessment',
    text: 'Generate questions from a syllabus, pull from the bank, or write your own. Set the rules and publish.',
    who: 'AI + Instructor',
  },
  {
    title: 'Students take it, proctored',
    text: 'Students join with a 6-letter course code and take the test in a focused, autosaving exam mode.',
    who: 'Student',
  },
  {
    title: 'Analyse and adapt',
    text: 'Review results and item analysis; each student gets a learning path and practice for their weak topics.',
    who: 'AI + Student',
  },
];

const FAQ = [
  {
    q: 'Who is Navigate for?',
    a: 'Colleges, training institutes and corporate learning teams that run assessments for groups of learners. A workspace holds your staff, students, courses and results.',
  },
  {
    q: 'How do students join?',
    a: 'Each course has a 6-letter join code. Students enter it when they sign up (or later from “Join a course”) and are enrolled straight away. Admins can also send invite links.',
  },
  {
    q: 'What does the AI do — and what if it’s unavailable?',
    a: 'AI drafts questions from a syllabus, refines quizzes from your feedback, recommends study topics and builds practice quizzes. Everything it produces is editable. If the AI service is slow or down, you can keep writing questions manually and students get template recommendations instead.',
  },
  {
    q: 'What counts as an AI generation?',
    a: 'One syllabus analysis, one question-generation or quiz-refinement request, one AI feedback request, or one practice quiz. The counter resets at the start of each month.',
  },
  {
    q: 'How does proctoring work?',
    a: 'When proctoring is on, the test runs in fullscreen. Leaving fullscreen, switching tabs, pasting or using blocked shortcuts are recorded as integrity events. If you set a limit, reaching it submits the attempt automatically. Webcam checks are optional and per assessment.',
  },
  {
    q: 'Is our data separate from other institutions?',
    a: 'Yes. Every record belongs to exactly one workspace and every request is filtered by it. Anything outside your workspace is treated as if it doesn’t exist.',
  },
];

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

const PreviewCard = ({ sx }) => (
  <Box
    role="img"
    aria-label="Preview of a student result: 82 percent, passed, with concept mastery bars and the next step on the learning path."
    sx={{ position: 'relative', zIndex: 2, width: { xs: '100%', sm: 330 }, maxWidth: 360, ...sx }}
  >
    <Paper
      elevation={0}
      className="nv-float"
      aria-hidden="true"
      sx={{
        p: 2.25,
        borderRadius: '22px',
        border: '1px solid', borderColor: 'divider',
        boxShadow: '0 40px 80px -28px rgba(3,6,20,0.75), 0 0 0 1px rgba(14,22,48,0.05)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }}>
            Data Structures
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '0.98rem', letterSpacing: '-0.01em', mt: 0.25 }} noWrap>
            Unit 3 checkpoint
          </Typography>
        </Box>
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            flex: 'none',
            px: 1,
            py: 0.4,
            borderRadius: '999px',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'success.dark',
            bgcolor: alpha(tokens.success, 0.1),
            border: `1px solid ${alpha(tokens.success, 0.22)}`,
          }}
        >
          <span className="nv-live-dot" />
          Camera active
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mt: 2,
          p: 1.5,
          borderRadius: '16px',
          bgcolor: 'grey.50',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <ScoreRing value={82} size={66} thickness={9} />
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Passed</Typography>
            <Chip size="small" color="success" label="Pass mark 60%" />
          </Box>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
            18 of 22 correct · 14 min
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 2, display: 'grid', gap: 1.25 }}>
        {[
          { name: 'Binary trees', value: 92, color: 'primary' },
          { name: 'Recursion', value: 78, color: 'primary' },
          { name: 'Hash tables', value: 54, color: 'secondary' },
        ].map((row) => (
          <Box key={row.name}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{row.name}</Typography>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {row.value}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={row.value} color={row.color} sx={{ height: 6 }} />
          </Box>
        ))}
      </Box>

      <Box sx={{ mt: 2, pt: 1.75, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            flex: 'none',
            borderRadius: '10px',
            display: 'grid',
            placeItems: 'center',
            color: 'secondary.dark',
            bgcolor: alpha(tokens.saffron, 0.16),
          }}
        >
          <RouteOutlinedIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 600 }}>Next on your path</Typography>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }} noWrap>
            Hash tables · practice set
          </Typography>
        </Box>
        <ArrowForwardRoundedIcon sx={{ ml: 'auto', fontSize: 18, color: 'text.secondary' }} />
      </Box>
    </Paper>
  </Box>
);

const Hero = ({ dashboardPath }) => (
  <Box
    component="section"
    aria-labelledby="hero-title"
    className="nv-ink nv-dots"
    sx={{ pt: { xs: 13, md: 17 }, overflow: 'hidden' }}
  >
    {/* Atmosphere: compass-blue haze and a faint saffron glow toward the destination */}
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        zIndex: -1,
        right: '-12%',
        top: '-18%',
        width: '75%',
        height: '95%',
        background: 'radial-gradient(closest-side, rgba(51,70,232,0.42), rgba(51,70,232,0))',
      }}
    />
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        zIndex: -1,
        right: '6%',
        top: '6%',
        width: '26%',
        height: '30%',
        background: 'radial-gradient(closest-side, rgba(242,169,59,0.16), rgba(242,169,59,0))',
      }}
    />
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        zIndex: -1,
        left: 0,
        right: 0,
        bottom: 0,
        height: 160,
        background: 'linear-gradient(180deg, rgba(14,22,48,0), rgba(10,16,36,0.65))',
      }}
    />

    <Container maxWidth="lg">
      <Grid container columnSpacing={{ md: 4, lg: 6 }} rowSpacing={{ xs: 6, md: 0 }} alignItems="center">
        <Grid item xs={12} md={5}>
          <Box
            className="nv-rise"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              mb: 3,
              pl: 0.75,
              pr: 1.5,
              py: 0.5,
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.12)',
              bgcolor: 'rgba(255,255,255,0.04)',
              color: '#C9CFEB',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: '999px', bgcolor: 'secondary.main', color: tokens.ink, fontWeight: 700, fontSize: '0.7rem' }}>
              AI
            </Box>
            Assessments · Proctoring · Analytics · Adaptive learning
          </Box>

          <Typography
            id="hero-title"
            variant="h1"
            className="nv-rise"
            style={{ '--nv-delay': '0.08s' }}
            sx={{ color: '#fff', fontSize: { xs: '2.75rem', sm: '3.6rem', lg: '4.35rem' }, lineHeight: 1.02, letterSpacing: '-0.03em' }}
          >
            Find your way through{' '}
            <Box component="em" sx={{ fontStyle: 'italic', fontWeight: 500, color: 'secondary.main' }}>
              every
            </Box>{' '}
            subject.
          </Typography>

          <Typography
            className="nv-rise"
            style={{ '--nv-delay': '0.16s' }}
            sx={{ color: '#C3C9E3', fontSize: { xs: '1.05rem', md: '1.15rem' }, lineHeight: 1.65, mt: 3, maxWidth: 470 }}
          >
            Navigate gives your institution one place to build AI-assisted assessments, run them with proctoring, analyse
            every result — and turn each one into a personal learning path.
          </Typography>

          <Box className="nv-rise" style={{ '--nv-delay': '0.24s' }} sx={{ mt: 4.5, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {dashboardPath ? (
              <Button component={RouterLink} to={dashboardPath} variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />} sx={lightButtonSx}>
                Go to dashboard
              </Button>
            ) : (
              <>
                <Button component={RouterLink} to="/register" variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />} sx={lightButtonSx}>
                  Create a free workspace
                </Button>
                <Button component={RouterLink} to="/register?mode=join" variant="outlined" size="large" sx={ghostButtonSx}>
                  Join with a code
                </Button>
              </>
            )}
          </Box>
        </Grid>

        <Grid item xs={12} md={7}>
          <Box className="nv-fade-in" style={{ '--nv-delay': '0.1s' }} sx={{ position: 'relative', mx: { xs: -0.5, sm: 0 } }}>
            <LearningRoute />
            <PreviewCard sx={{ mt: { xs: 3, sm: -4, md: -6, lg: -8 }, ml: { sm: 'auto' }, mr: { lg: -2 } }} />
          </Box>
        </Grid>
      </Grid>

      {/* Credibility strip */}
      <Box
        component="ul"
        aria-label="Navigate at a glance"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          mt: { xs: 8, md: 10 },
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {STATS.map((stat, i) => (
          <Box
            component="li"
            key={stat.label}
            sx={{
              py: { xs: 3, md: 4 },
              pr: 2,
              pl: { xs: i % 2 ? 2 : 0, md: i ? 3 : 0 },
              borderLeft: { xs: i % 2 ? '1px solid rgba(255,255,255,0.08)' : 0, md: i ? '1px solid rgba(255,255,255,0.08)' : 0 },
              borderTop: { xs: i > 1 ? '1px solid rgba(255,255,255,0.08)' : 0, md: 0 },
            }}
          >
            <Typography
              component="p"
              sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '2rem', md: '2.5rem' }, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}
            >
              {stat.value}
            </Typography>
            <Typography component="p" sx={{ color: '#E4E8F7', fontWeight: 600, fontSize: '0.9rem', mt: 1.25 }}>
              {stat.label}
            </Typography>
            <Typography component="p" sx={{ color: '#97A0C4', fontSize: '0.8125rem', lineHeight: 1.5, mt: 0.5, maxWidth: 240 }}>
              {stat.detail}
            </Typography>
          </Box>
        ))}
      </Box>
    </Container>
  </Box>
);

const AudiencePanel = ({ ink = false, id, eyebrow, Icon, title, text, features, cta }) => (
  <Box
    id={id}
    className={ink ? 'nv-ink nv-dots' : undefined}
    sx={{
      height: '100%',
      borderRadius: { xs: '22px', md: '28px' },
      p: { xs: 3, sm: 4, md: 5 },
      overflow: 'hidden',
      ...(ink
        ? { boxShadow: '0 30px 60px -30px rgba(14,22,48,0.6)' }
        : { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', boxShadow: (t) => t.shadows[4] }),
    }}
  >
    {ink && (
      <Box
        aria-hidden="true"
        sx={{ position: 'absolute', zIndex: -1, right: '-25%', top: '-30%', width: '80%', height: '70%', background: 'radial-gradient(closest-side, rgba(51,70,232,0.4), rgba(51,70,232,0))' }}
      />
    )}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
      <Box
        aria-hidden="true"
        sx={{
          width: 40,
          height: 40,
          borderRadius: '12px',
          display: 'grid',
          placeItems: 'center',
          color: ink ? tokens.ink : '#fff',
          bgcolor: ink ? 'secondary.main' : 'primary.main',
          boxShadow: ink ? '0 0 24px -4px rgba(242,169,59,0.7)' : '0 8px 20px -8px rgba(51,70,232,0.8)',
        }}
      >
        <Icon sx={{ fontSize: 22 }} />
      </Box>
      <Eyebrow onInk={ink}>{eyebrow}</Eyebrow>
    </Box>
    <Typography variant="h3" component="h3" sx={{ color: ink ? '#fff' : 'text.primary', maxWidth: '20ch' }}>
      {title}
    </Typography>
    <Typography sx={{ mt: 1.5, color: ink ? '#BAC1DE' : 'text.secondary', maxWidth: 480 }}>{text}</Typography>

    <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mt: 4 }}>
      {features.map(({ Icon: FeatureIcon, title: featureTitle, text: featureText }) => (
        <Box
          component="li"
          key={featureTitle}
          sx={{
            display: 'grid',
            gridTemplateColumns: '40px minmax(0, 1fr)',
            gap: 2,
            py: 2.25,
            borderTop: '1px solid',
            borderColor: ink ? 'rgba(255,255,255,0.09)' : 'divider',
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              display: 'grid',
              placeItems: 'center',
              color: ink ? '#B4BCFF' : 'primary.main',
              bgcolor: ink ? 'rgba(107,123,255,0.14)' : alpha(tokens.primary, 0.07),
              border: '1px solid',
              borderColor: ink ? 'rgba(155,166,255,0.22)' : alpha(tokens.primary, 0.12),
            }}
          >
            <FeatureIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography component="h4" sx={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em', color: ink ? '#fff' : 'text.primary' }}>
              {featureTitle}
            </Typography>
            <Typography sx={{ mt: 0.5, fontSize: '0.9rem', lineHeight: 1.6, color: ink ? '#AEB6D6' : 'text.secondary' }}>
              {featureText}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>

    <Button
      component={RouterLink}
      to={cta.to}
      endIcon={<ArrowForwardRoundedIcon />}
      sx={{
        mt: 2,
        ml: -1.5,
        ...(ink && { color: '#DDE1FF', '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#fff' }, ...onInkFocus }),
      }}
    >
      {cta.label}
    </Button>
  </Box>
);

const AudienceSection = ({ signedIn }) => (
  <Box component="section" id="features" aria-labelledby="features-title" sx={{ py: { xs: 10, md: 15 } }}>
    <Container maxWidth="lg">
      <Grid container spacing={3} alignItems="flex-end">
        <Grid item xs={12} md={7}>
          <Eyebrow>Built for both sides of the classroom</Eyebrow>
          <Typography id="features-title" variant="h2" sx={{ mt: 1.5, maxWidth: '16ch' }}>
            Two vantage points. One shared map.
          </Typography>
        </Grid>
        <Grid item xs={12} md={5}>
          <Typography sx={{ color: 'text.secondary', fontSize: '1.05rem', lineHeight: 1.65 }}>
            Students get a clear route forward. Instructors and administrators see the whole terrain — every course,
            result and integrity flag — in one workspace.
          </Typography>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: { xs: 5, md: 7 } }}>
        <Grid item xs={12} md={6}>
          <AudiencePanel
            eyebrow="For students"
            Icon={SchoolOutlinedIcon}
            title="A route you can actually follow."
            text="Join with a course code, take assessments in a calm exam mode, and get a learning path that adapts after every graded attempt."
            features={STUDENT_FEATURES}
            cta={signedIn ? { to: signedIn, label: 'Open your dashboard' } : { to: '/register?mode=join', label: 'Join a course with a code' }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <AudiencePanel
            ink
            id="instructors"
            eyebrow="For instructors"
            Icon={CoPresentOutlinedIcon}
            title="The whole terrain, at a glance."
            text="Go from syllabus to a published, proctored assessment quickly — then see exactly which students and topics need attention."
            features={INSTRUCTOR_FEATURES}
            cta={signedIn ? { to: signedIn, label: 'Open your dashboard' } : { to: '/register', label: 'Create a workspace' }}
          />
        </Grid>
      </Grid>
    </Container>
  </Box>
);

const StarGlyph = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 0.5 L14.1 9.9 L23.5 12 L14.1 14.1 L12 23.5 L9.9 14.1 L0.5 12 L9.9 9.9 Z" fill="#F2A93B" />
  </svg>
);

const HowItWorks = () => (
  <Box
    component="section"
    id="how-it-works"
    aria-labelledby="how-title"
    sx={{ py: { xs: 10, md: 14 }, bgcolor: 'background.paper', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}
  >
    <Container maxWidth="lg">
      <Box sx={{ maxWidth: 680 }}>
        <Eyebrow>How it works</Eyebrow>
        <Typography id="how-title" variant="h2" sx={{ mt: 1.5 }}>
          From sign-up to mastery in four checkpoints.
        </Typography>
      </Box>

      <Box
        component="ol"
        sx={{
          listStyle: 'none',
          p: 0,
          m: 0,
          mt: { xs: 6, md: 8 },
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(4, minmax(0, 1fr))' },
          columnGap: 4,
        }}
      >
        {/* The route connecting the checkpoints (desktop) */}
        <Box
          aria-hidden="true"
          sx={{
            display: { xs: 'none', md: 'block' },
            position: 'absolute',
            top: 25,
            left: 26,
            right: '18%',
            borderTop: '2px dashed',
            borderColor: 'grey.300',
          }}
        />
        {STEPS.map((step, i) => {
          const last = i === STEPS.length - 1;
          return (
            <Box
              component="li"
              key={step.title}
                        style={{ '--nv-delay': `${i * 0.09}s` }}
              sx={{ position: 'relative', pl: { xs: 9, md: 0 }, pb: { xs: last ? 0 : 5, md: 0 } }}
            >
              {!last && (
                <Box
                  aria-hidden="true"
                  sx={{
                    display: { md: 'none' },
                    position: 'absolute',
                    left: 25,
                    top: 56,
                    bottom: 4,
                    borderLeft: '2px dashed',
                    borderColor: 'grey.300',
                  }}
                />
              )}
              <Box
                aria-hidden="true"
                sx={{
                  position: { xs: 'absolute', md: 'relative' },
                  left: 0,
                  top: 0,
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--nv-font-display)',
                  fontWeight: 600,
                  fontSize: '1.35rem',
                  ...(last
                    ? { bgcolor: tokens.ink, boxShadow: '0 0 0 6px rgba(242,169,59,0.14), 0 10px 24px -8px rgba(14,22,48,0.6)' }
                    : { bgcolor: 'background.paper', color: 'text.primary', border: '1px solid', borderColor: 'grey.300', boxShadow: (t) => `0 0 0 6px ${t.palette.background.paper}` }),
                }}
              >
                {last ? <StarGlyph /> : i + 1}
              </Box>
              <Typography variant="overline" component="p" sx={{ display: 'block', color: 'text.secondary', mt: { md: 3 } }}>
                Step {i + 1}
              </Typography>
              <Typography variant="h6" component="h3" sx={{ mt: 0.25 }}>
                {step.title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, lineHeight: 1.65 }}>
                {step.text}
              </Typography>
              <Chip
                size="small"
                label={step.who}
                color={step.who.includes('Student') ? 'secondary' : 'primary'}
                variant={step.who.startsWith('AI') ? 'filled' : 'outlined'}
                sx={{ mt: 2 }}
              />
            </Box>
          );
        })}
      </Box>
    </Container>
  </Box>
);

const FinalCta = ({ dashboardPath }) => (
  <Box component="section" aria-labelledby="cta-title" sx={{ py: { xs: 10, md: 14 } }}>
    <Container maxWidth="lg">
      <Box
            className="nv-ink nv-dots nv-contours"
        sx={{
          borderRadius: { xs: '24px', md: '32px' },
          overflow: 'hidden',
          px: { xs: 3, sm: 6, md: 9 },
          py: { xs: 6, md: 9 },
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.5fr) minmax(0, 1fr)' },
          gap: { xs: 4, md: 6 },
          alignItems: 'center',
          boxShadow: '0 40px 80px -40px rgba(14,22,48,0.7)',
        }}
      >
        <Box
          aria-hidden="true"
          sx={{ position: 'absolute', zIndex: -1, right: '-6%', top: '-40%', width: '55%', height: '140%', background: 'radial-gradient(closest-side, rgba(242,169,59,0.18), rgba(242,169,59,0))' }}
        />
        <Box>
          <Eyebrow onInk>Your destination</Eyebrow>
          <Typography id="cta-title" variant="h2" sx={{ color: '#fff', mt: 1.5, maxWidth: '15ch' }}>
            Your next checkpoint is one click away.
          </Typography>
          <Typography sx={{ color: '#BAC1DE', mt: 2, maxWidth: 480, fontSize: '1.05rem', lineHeight: 1.65 }}>
            Create a free workspace for your institution, or join your class with the code your instructor shared.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: { xs: 'stretch', sm: 'flex-start', md: 'flex-end' } }}>
          {dashboardPath ? (
            <Button component={RouterLink} to={dashboardPath} variant="contained" color="secondary" size="large" endIcon={<ArrowForwardRoundedIcon />} sx={onInkFocus}>
              Go to dashboard
            </Button>
          ) : (
            <>
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                color="secondary"
                size="large"
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{ boxShadow: '0 12px 32px -12px rgba(242,169,59,0.9)', ...onInkFocus }}
              >
                Create a free workspace
              </Button>
              <Button component={RouterLink} to="/register?mode=join" variant="outlined" size="large" sx={ghostButtonSx}>
                Join with a code
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Container>
  </Box>
);

const SectionIntro = ({ id, eyebrow, title, text }) => (
  <Grid container spacing={3} alignItems="flex-end">
    <Grid item xs={12} md={7}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Typography id={id} variant="h2" sx={{ mt: 1.5, maxWidth: '18ch' }}>
        {title}
      </Typography>
    </Grid>
    {text && (
      <Grid item xs={12} md={5}>
        <Typography sx={{ color: 'text.secondary', fontSize: '1.05rem', lineHeight: 1.65 }}>{text}</Typography>
      </Grid>
    )}
  </Grid>
);

const IconTile = ({ Icon }) => (
  <Box
    aria-hidden="true"
    sx={(t) => ({
      width: 44,
      height: 44,
      borderRadius: '12px',
      display: 'grid',
      placeItems: 'center',
      color: 'primary.main',
      bgcolor: alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.08),
      border: `1px solid ${alpha(t.palette.primary.main, 0.16)}`,
    })}
  >
    <Icon sx={{ fontSize: 22 }} />
  </Box>
);

const FeatureGrid = () => (
  <Box component="section" id="platform" aria-labelledby="platform-title" sx={{ pb: { xs: 10, md: 14 } }}>
    <Container maxWidth="lg">
      <SectionIntro
        id="platform-title"
        eyebrow="The platform"
        title="Everything an assessment program needs, in one place."
        text="No more stitching together a quiz tool, a proctoring add-on, a spreadsheet gradebook and a reporting script."
      />
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          p: 0,
          m: 0,
          mt: { xs: 5, md: 7 },
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        {FEATURES.map((f) => (
          <Paper component="li" variant="outlined" key={f.title} sx={{ p: 3, borderRadius: '20px' }}>
            <IconTile Icon={f.Icon} />
            <Typography variant="h6" component="h3" sx={{ mt: 2 }}>
              {f.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, lineHeight: 1.65 }}>
              {f.text}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Container>
  </Box>
);

const TrustStrip = () => (
  <Box component="section" id="security" aria-labelledby="security-title" sx={{ py: { xs: 10, md: 14 } }}>
    <Container maxWidth="lg">
      <SectionIntro
        id="security-title"
        eyebrow="Security & trust"
        title="Built for institutions that answer for their data."
        text="The safeguards below are part of the product today, not a roadmap."
      />
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          p: 0,
          m: 0,
          mt: { xs: 5, md: 7 },
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          gap: { xs: 3, md: 4 },
        }}
      >
        {TRUST.map((item) => (
          <Box component="li" key={item.title} sx={{ borderTop: 2, borderColor: 'primary.main', pt: 2.5 }}>
            <item.Icon sx={{ color: 'primary.main' }} aria-hidden="true" />
            <Typography variant="subtitle1" component="h3" sx={{ mt: 1 }}>
              {item.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, lineHeight: 1.65 }}>
              {item.text}
            </Typography>
          </Box>
        ))}
      </Box>
    </Container>
  </Box>
);

const PricingTeaser = ({ signedIn }) => (
  <Box
    component="section"
    id="pricing"
    aria-labelledby="pricing-title"
    sx={{ py: { xs: 10, md: 14 }, bgcolor: 'background.paper', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}
  >
    <Container maxWidth="lg">
      <SectionIntro
        id="pricing-title"
        eyebrow="Pricing"
        title="Start free. Upgrade when your program grows."
        text="Every plan includes assessments, proctoring, analytics and adaptive learning. Plans differ in seats, students and monthly AI generations."
      />
      <Grid container spacing={2.5} sx={{ mt: { xs: 4, md: 6 } }}>
        {PUBLIC_PLANS.map((plan) => (
          <Grid item xs={12} md={4} key={plan.id}>
            <PlanCard plan={plan} action={<PlanCta plan={plan} signedIn={signedIn} />} />
          </Grid>
        ))}
      </Grid>
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button component={RouterLink} to="/pricing" endIcon={<ArrowForwardRoundedIcon />}>
          Compare plans in detail
        </Button>
      </Box>
    </Container>
  </Box>
);

const FaqSection = () => (
  <Box component="section" id="faq" aria-labelledby="faq-title" sx={{ pt: { xs: 10, md: 14 } }}>
    <Container maxWidth="md">
      <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
        <Eyebrow>FAQ</Eyebrow>
        <Typography id="faq-title" variant="h2" sx={{ mt: 1.5 }}>
          Questions, answered.
        </Typography>
      </Box>
      <FaqList items={FAQ} />
    </Container>
  </Box>
);

/* -------------------------------------------------------------------------- */

const LandingPage = () => {
  const { currentUser } = useAuth();
  const dashboardPath = currentUser ? homePathFor(currentUser) : null;

  useEffect(() => {
    document.title = 'Navigate — AI assessment & adaptive learning for institutions';
  }, []);

  return (
    <Box sx={{ position: 'relative', bgcolor: 'background.default', overflowX: 'clip' }}>
      <a className="nv-skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader dashboardPath={dashboardPath} />
      <Box component="main" id="main-content" tabIndex={-1} sx={{ '&:focus': { outline: 'none' } }}>
        <Hero dashboardPath={dashboardPath} />
        <AudienceSection signedIn={dashboardPath} />
        <FeatureGrid />
        <HowItWorks />
        <TrustStrip />
        <PricingTeaser signedIn={Boolean(dashboardPath)} />
        <FaqSection />
        <FinalCta dashboardPath={dashboardPath} />
      </Box>
      <SiteFooter dashboardPath={dashboardPath} />
    </Box>
  );
};

export default LandingPage;
