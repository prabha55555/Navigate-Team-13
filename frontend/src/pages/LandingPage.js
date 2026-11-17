import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CoPresentOutlinedIcon from '@mui/icons-material/CoPresentOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import { Box, Button, Chip, Container, Divider, Grid, LinearProgress, Link, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { homePathFor } from '../auth/roles';
import BrandMark from '../components/common/BrandMark';
import LearningRoute from '../components/common/LearningRoute';
import ScoreRing from '../components/common/ScoreRing';
import { useAuth } from '../contexts/AuthContext';
import { tokens } from '../theme';

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'For instructors', href: '#instructors' },
];

const STATS = [
  { value: '4', label: 'Question types', detail: 'Multiple choice, multi-select, true/false, short answer' },
  { value: '3', label: 'Proctoring signals', detail: 'Fullscreen, keyboard activity and webcam presence' },
  { value: '2', label: 'Syllabus formats', detail: 'PDF and DOCX, parsed into topics and outcomes' },
  { value: '2', label: 'AI model families', detail: 'Gemini and GPT for generation and feedback' },
];

const STUDENT_FEATURES = [
  {
    Icon: RouteOutlinedIcon,
    title: 'Adaptive learning paths',
    text: 'Every attempt re-plots your route — strengths are confirmed, weak concepts become your next checkpoints.',
  },
  {
    Icon: VideocamOutlinedIcon,
    title: 'Calm, proctored assessments',
    text: 'A fullscreen focus mode with keyboard and webcam checks, so a fair test never feels like a trap.',
  },
  {
    Icon: FactCheckOutlinedIcon,
    title: 'Instant, transparent grading',
    text: 'Auto-graded results with clear pass/fail criteria and a question-by-question breakdown.',
  },
  {
    Icon: PsychologyOutlinedIcon,
    title: 'AI expert-panel feedback',
    text: 'Perspectives from several simulated subject experts — what went well, and what to study next.',
  },
];

const INSTRUCTOR_FEATURES = [
  {
    Icon: UploadFileOutlinedIcon,
    title: 'Syllabus to assessment',
    text: 'Upload a PDF or DOCX. AI extracts topics, outcomes and Bloom’s levels, then drafts the questions.',
  },
  {
    Icon: QuizOutlinedIcon,
    title: 'Your mix of question types',
    text: 'Choose a pattern of multiple choice, multi-select, true/false and short answer; set points, time and pass mark.',
  },
  {
    Icon: AccountTreeOutlinedIcon,
    title: 'Curriculum mapping',
    text: 'See how each assessment lines up with learning outcomes and competency levels across the course.',
  },
  {
    Icon: PolicyOutlinedIcon,
    title: 'Integrity built in',
    text: 'Proctoring violations and AI plagiarism detection surface right next to each submission.',
  },
  {
    Icon: InsightsOutlinedIcon,
    title: 'Class-wide analytics',
    text: 'Pass rates, struggling concepts and individual progress, all from one results view.',
  },
];

const STEPS = [
  {
    title: 'Upload the syllabus',
    text: 'Drop in a PDF or DOCX. Navigate pulls out the topics, learning outcomes and cognitive levels.',
    who: 'Instructor',
  },
  {
    title: 'Generate the assessment',
    text: 'AI drafts questions to your chosen pattern. Review, adjust the pass criteria and publish.',
    who: 'AI + Instructor',
  },
  {
    title: 'Take it, proctored',
    text: 'Students sit the test in fullscreen with keyboard and webcam checks. Grading is instant.',
    who: 'Student',
  },
  {
    title: 'Follow the adaptive path',
    text: 'Results feed expert-panel feedback and a personal route to the next checkpoint.',
    who: 'AI + Student',
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const onInkFocus = { '&.Mui-focusVisible, &:focus-visible': { outline: '2px solid #9BA6FF', outlineOffset: 3 } };

const lightButtonSx = {
  bgcolor: '#FFFFFF',
  color: tokens.ink,
  boxShadow: '0 10px 30px -12px rgba(107,123,255,0.8)',
  '&:hover': { bgcolor: '#E9ECFF', boxShadow: '0 12px 32px -12px rgba(107,123,255,0.95)' },
  ...onInkFocus,
};

const ghostButtonSx = {
  color: '#E4E8F7',
  bgcolor: 'transparent',
  borderColor: 'rgba(255,255,255,0.26)',
  boxShadow: 'none',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.55)', color: '#FFFFFF' },
  ...onInkFocus,
};

const Eyebrow = ({ children, onInk = false, sx }) => (
  <Typography
    component="p"
    sx={{
      fontSize: '0.75rem',
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: onInk ? 'secondary.light' : 'primary.dark',
      ...sx,
    }}
  >
    {children}
  </Typography>
);

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

const SiteHeader = ({ dashboardPath }) => (
  <Box component="header" sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3 }}>
    <Container maxWidth="lg" sx={{ height: { xs: 68, md: 84 }, display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
      <Box
        component={RouterLink}
        to="/"
        aria-label="Navigate home"
        sx={{ color: '#fff', display: 'inline-flex', borderRadius: 2, flex: 'none', ...onInkFocus }}
      >
        <BrandMark size={34} tone="blue" withWordmark wordmarkSize="1.4rem" />
      </Box>

      <Box component="nav" aria-label="Primary" sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, ml: 5 }}>
        {NAV_LINKS.map((link) => (
          <Box
            key={link.href}
            component="a"
            href={link.href}
            sx={{
              px: 1.5,
              py: 1,
              borderRadius: 2,
              fontSize: '0.9rem',
              fontWeight: 500,
              color: '#B9C0DD',
              transition: 'color .16s ease, background-color .16s ease',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
              '&:focus-visible': { outline: '2px solid #9BA6FF', outlineOffset: 2 },
            }}
          >
            {link.label}
          </Box>
        ))}
      </Box>

      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
        {dashboardPath ? (
          <Button component={RouterLink} to={dashboardPath} variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={lightButtonSx}>
            Go to dashboard
          </Button>
        ) : (
          <>
            <Button
              component={RouterLink}
              to="/login"
              color="inherit"
              sx={{ color: '#E4E8F7', px: { xs: 1.25, sm: 1.75 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' }, ...onInkFocus }}
            >
              Log in
            </Button>
            <Button component={RouterLink} to="/register" variant="contained" sx={{ ...lightButtonSx, px: { xs: 1.75, sm: 2.25 } }}>
              Get started
            </Button>
          </>
        )}
      </Box>
    </Container>
  </Box>
);

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
        border: '1px solid rgba(255,255,255,0.7)',
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
            Assessment · Proctoring · Adaptive paths
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
            Navigate turns a course syllabus into AI-generated, proctored assessments — then turns every result into a
            personal route to mastery.
          </Typography>

          <Box className="nv-rise" style={{ '--nv-delay': '0.24s' }} sx={{ mt: 4.5, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {dashboardPath ? (
              <Button component={RouterLink} to={dashboardPath} variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />} sx={lightButtonSx}>
                Go to dashboard
              </Button>
            ) : (
              <>
                <Button component={RouterLink} to="/register" variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />} sx={lightButtonSx}>
                  Start your route
                </Button>
                <Button component={RouterLink} to="/register?role=instructor" variant="outlined" size="large" sx={ghostButtonSx}>
                  I teach a course
                </Button>
              </>
            )}
          </Box>
        </Grid>

        <Grid item xs={12} md={7}>
          <Box className="nv-fade-in" style={{ '--nv-delay': '0.1s' }} sx={{ position: 'relative', mx: { xs: -0.5, sm: 0 } }}>
            <LearningRoute />
            <PreviewCard sx={{ mt: { xs: 3, sm: -10, md: -12, lg: -15 }, ml: { sm: 'auto' }, mr: { lg: -2 } }} />
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
        : { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', boxShadow: '0 1px 2px rgba(14,22,48,0.04), 0 24px 48px -32px rgba(14,22,48,0.25)' }),
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
            Students see a clear route forward. Instructors see the whole terrain — every outcome, every result, every
            integrity flag — without stitching tools together.
          </Typography>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: { xs: 5, md: 7 } }}>
        <Grid item xs={12} md={6}>
          <AudiencePanel
            eyebrow="For students"
            Icon={SchoolOutlinedIcon}
            title="A route you can actually follow."
            text="Assessments built from your real syllabus, results you can understand, and a path that adapts after every attempt."
            features={STUDENT_FEATURES}
            cta={signedIn ? { to: signedIn, label: 'Open your dashboard' } : { to: '/register', label: 'Join as a student' }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <AudiencePanel
            ink
            id="instructors"
            eyebrow="For instructors"
            Icon={CoPresentOutlinedIcon}
            title="The whole terrain, at a glance."
            text="Go from syllabus to a published, proctored assessment in minutes — then see exactly where the class is struggling."
            features={INSTRUCTOR_FEATURES}
            cta={signedIn ? { to: signedIn, label: 'Open your dashboard' } : { to: '/register?role=instructor', label: 'Join as an instructor' }}
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
          From syllabus to mastery in four checkpoints.
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
                    : { bgcolor: 'background.paper', color: tokens.ink, border: '1px solid', borderColor: 'grey.300', boxShadow: '0 0 0 6px #fff' }),
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
            Create an account as a student or an instructor and start from wherever you are today.
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
                Create your account
              </Button>
              <Button component={RouterLink} to="/login" variant="outlined" size="large" sx={ghostButtonSx}>
                I already have an account
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Container>
  </Box>
);

const FooterColumn = ({ title, children }) => (
  <Box component="nav" aria-label={title}>
    <Typography component="h2" sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'text.secondary', mb: 1.5 }}>
      {title}
    </Typography>
    <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 1 }}>
      {children}
    </Box>
  </Box>
);

const FooterLink = ({ to, href, children }) => (
  <li>
    <Link
      component={to ? RouterLink : 'a'}
      to={to}
      href={href}
      sx={{ color: 'text.primary', fontWeight: 500, fontSize: '0.9rem', '&:hover': { color: 'primary.main' } }}
    >
      {children}
    </Link>
  </li>
);

const SiteFooter = ({ dashboardPath }) => (
  <Box component="footer" sx={{ pt: { xs: 7, md: 9 }, pb: 5, borderTop: '1px solid', borderColor: 'divider' }}>
    <Container maxWidth="lg">
      <Grid container spacing={4}>
        <Grid item xs={12} md={5}>
          <BrandMark size={32} withWordmark wordmarkSize="1.35rem" />
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2, maxWidth: 360, lineHeight: 1.65 }}>
            An AI-powered assessment and adaptive learning platform, built as a university capstone project by Team 13.
          </Typography>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <FooterColumn title="Product">
            <FooterLink href="#features">Features</FooterLink>
            <FooterLink href="#how-it-works">How it works</FooterLink>
            <FooterLink href="#instructors">For instructors</FooterLink>
          </FooterColumn>
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <FooterColumn title="Account">
            {dashboardPath ? (
              <FooterLink to={dashboardPath}>Dashboard</FooterLink>
            ) : (
              <>
                <FooterLink to="/login">Log in</FooterLink>
                <FooterLink to="/register">Create account</FooterLink>
              </>
            )}
          </FooterColumn>
        </Grid>
        <Grid item xs={12} sm={4} md={3}>
          <Typography component="h2" sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'text.secondary', mb: 1.5 }}>
            Built with
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.75 }}>
            React &amp; Material UI · Node.js &amp; Express · MongoDB · Google Gemini &amp; OpenAI
          </Typography>
        </Grid>
      </Grid>
      <Divider sx={{ my: 4 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          © {new Date().getFullYear()} Navigate — Team 13 Capstone
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', fontFamily: 'var(--nv-font-display)', fontSize: '0.85rem' }}>
          Find your way through every subject.
        </Typography>
      </Box>
    </Container>
  </Box>
);

/* -------------------------------------------------------------------------- */

const LandingPage = () => {
  const { currentUser } = useAuth();
  const dashboardPath = currentUser ? homePathFor(currentUser) : null;

  useEffect(() => {
    document.title = 'Navigate — AI assessment & adaptive learning';
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
        <HowItWorks />
        <FinalCta dashboardPath={dashboardPath} />
      </Box>
      <SiteFooter dashboardPath={dashboardPath} />
    </Box>
  );
};

export default LandingPage;
