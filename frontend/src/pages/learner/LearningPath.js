import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import OndemandVideoOutlinedIcon from '@mui/icons-material/OndemandVideoOutlined';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import { Box, Button, CircularProgress, Collapse, Container, LinearProgress, Paper, Skeleton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { getCourse } from '../../api/courses';
import { getLearningPath } from '../../api/learningPath';
import { EmptyState, InlineCode, LearningRoute, PageHeader, ScoreRing, useAsync } from '../../components/common';
import { formatDateTime, formatPercent, pluralize } from '../../components/learner/format';
import PracticeDialog from '../../components/learner/PracticeDialog';
import dedupe from '../../components/learner/dedupe';
import { ErrorState, TimeLeftChip, ToneBar, ToneChip, TOPIC_STATUS } from '../../components/learner/ui';
import { useBreadcrumb } from '../../components/layout/breadcrumb';

const LEVEL = {
  beginner: { label: 'Beginner', tone: 'warning', copy: 'You are building the foundations. Follow the route below — your next focus is marked.' },
  intermediate: { label: 'Intermediate', tone: 'primary', copy: 'Solid progress. Close the gaps on the route below to reach advanced.' },
  advanced: { label: 'Advanced', tone: 'success', copy: 'Excellent command of this course. Keep your checkpoints sharp with a mixed review.' },
};

const RESOURCE_ICON = {
  video: <OndemandVideoOutlinedIcon />,
  reading: <MenuBookOutlinedIcon />,
  exercise: <FitnessCenterOutlinedIcon />,
  quiz: <QuizOutlinedIcon />,
};

const LOADING_MESSAGES = [
  'Personalising your path…',
  'Reviewing your graded work…',
  'Finding your strongest and weakest topics…',
  'Writing study tips for you…',
];

// Fixed checkpoint positions of the signature route (same geometry as the landing hero).
const MAP_POINTS = [
  { x: 64, y: 404, place: 'bottom' },
  { x: 236, y: 336, place: 'left' },
  { x: 168, y: 222, place: 'left' },
  { x: 364, y: 172, place: 'bottom-right' },
  { x: 530, y: 62, place: 'top' },
];

const short = (s, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * The study order: mastered checkpoints first, then the recommended focus topics (weakest first),
 * then the remaining developing/needs-work topics by mastery, then topics with no graded work yet.
 */
const buildJourney = (topics, recs) => {
  const byName = new Map(topics.map((t) => [t.topic, t]));
  const mastered = topics.filter((t) => t.status === 'mastered');
  const used = new Set(mastered.map((t) => t.topic));
  const focus = [];
  recs.forEach((r) => {
    const t = byName.get(r.topic);
    if (t && !used.has(t.topic)) {
      focus.push(t);
      used.add(t.topic);
    }
  });
  const rest = topics
    .filter((t) => !used.has(t.topic) && t.status !== 'not-assessed')
    .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0));
  rest.forEach((t) => used.add(t.topic));
  const unassessed = topics.filter((t) => !used.has(t.topic));
  return [...mastered, ...focus, ...rest, ...unassessed];
};

/** Five-stop overview map for the hero: cleared → you are here → next → later → mastery. */
const buildMapStops = (journey, hereIndex) => {
  const done = hereIndex === -1 ? journey.length : hereIndex;
  const ahead = hereIndex === -1 ? [] : journey.slice(hereIndex);
  const labels = [
    { label: done ? `${done} mastered` : 'Start', caption: done ? 'Checkpoints cleared' : 'Your first step' },
    ahead[0] ? { label: short(ahead[0].topic), caption: 'You are here', here: true } : { label: 'All topics', caption: 'Mastered' },
    ahead[1] ? { label: short(ahead[1].topic), caption: 'Then' } : { label: 'Review', caption: 'Keep it sharp' },
    ahead[2]
      ? { label: ahead.length > 3 ? `+${ahead.length - 2} more` : short(ahead[2].topic), caption: 'Later' }
      : { label: 'Challenge', caption: 'Mixed practice' },
    { label: 'Course mastery', caption: hereIndex === -1 ? 'You made it' : '80%+ on every topic', destination: true, here: hereIndex === -1 },
  ];
  // Labels must be unique (they key the nodes).
  const seen = new Set();
  return labels.map((l, i) => {
    let label = l.label;
    while (seen.has(label)) label = `${label} `;
    seen.add(label);
    return { ...MAP_POINTS[i], ...l, label };
  });
};

// ---------------------------------------------------------------------------
// Data: the path renders as soon as the server answers. While AI tips are still being written
// (recommendationsStatus 'pending') it re-fetches every 5 s for up to a minute and swaps them in.
// A module-level in-flight map collapses duplicate requests (StrictMode double effects, quick remounts).
// ---------------------------------------------------------------------------
const POLL_MS = 5000;
const POLL_MAX_MS = 60000;
const inflight = new Map();

const fetchPath = (courseId) => {
  if (inflight.has(courseId)) return inflight.get(courseId);
  const promise = getLearningPath(courseId).finally(() => inflight.delete(courseId));
  inflight.set(courseId, promise);
  return promise;
};

const useLearningPathData = (courseId) => {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const started = Date.now();
    setState((s) => ({ data: s.data?.courseId === courseId ? s.data : null, error: null, loading: true }));

    const run = (isPoll) => {
      fetchPath(courseId)
        .then((data) => {
          if (cancelled) return;
          setState({ data, error: null, loading: false });
          if (data?.recommendationsStatus === 'pending' && Date.now() - started < POLL_MAX_MS) {
            timer = setTimeout(() => run(true), POLL_MS);
          }
        })
        .catch((error) => {
          if (cancelled) return;
          // A failed refresh keeps what is already on screen.
          if (isPoll) setState((s) => ({ ...s, loading: false }));
          else setState({ data: null, error, loading: false });
        });
    };
    run(false);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [courseId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, reload };
};

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
const PathSkeleton = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % LOADING_MESSAGES.length), 2600);
    return () => clearInterval(id);
  }, []);
  return (
    <Box aria-busy="true">
      <Paper
        variant="outlined"
        className="nv-ink nv-dots"
        sx={{ bgcolor: 'var(--nv-ink)', backgroundImage: 'none', color: 'common.white', borderRadius: 5, p: { xs: 2.5, sm: 4 }, mb: 3, display: 'flex', gap: 3, alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' }, overflow: 'hidden' }}
      >
        <Box sx={{ position: 'relative', width: 112, height: 112, flex: 'none', display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={112} thickness={2.5} sx={{ color: 'primary.light' }} />
          <AutoAwesomeOutlinedIcon sx={{ position: 'absolute', fontSize: 34, color: 'secondary.main' }} aria-hidden="true" />
        </Box>
        <Box sx={{ flex: 1, width: '100%' }}>
          <Typography variant="h5" component="p" role="status" aria-live="polite" sx={{ mb: 1 }}>
            {LOADING_MESSAGES[i]}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.72, mb: 2 }}>
            This only takes a moment — we're mapping your results onto the course topics.
          </Typography>
          <LinearProgress sx={{ borderRadius: 4, height: 6 }} />
        </Box>
      </Paper>
      {[0, 1, 2, 3].map((n) => (
        <Box key={n} sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Skeleton variant="circular" width={36} height={36} sx={{ flex: 'none' }} />
          <Skeleton variant="rounded" height={n === 1 ? 180 : 76} sx={{ borderRadius: 4, flex: 1 }} />
        </Box>
      ))}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Route nodes
// ---------------------------------------------------------------------------
const Tips = ({ rec, dense }) => {
  const theme = useTheme();
  if (!rec) return null;
  return (
    <Box>
      {Array.isArray(rec.tips) && rec.tips.length > 0 && (
        <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5, display: 'grid', gap: 0.75 }}>
          {rec.tips.slice(0, dense ? 3 : 5).map((tip) => (
            <Typography component="li" variant="body2" key={tip}>
              <InlineCode text={tip} />
            </Typography>
          ))}
        </Box>
      )}
      {Array.isArray(rec.resources) && rec.resources.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {rec.resources.map((r) => (
            <Box
              key={`${r.type}-${r.title}`}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.75,
                borderRadius: 2,
                fontSize: '0.8125rem',
                maxWidth: '100%',
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.16),
                '& svg': { fontSize: 16, color: 'primary.main', flex: 'none' },
              }}
            >
              {RESOURCE_ICON[r.type] || <MenuBookOutlinedIcon />}
              <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <InlineCode text={r.title} />
              </Box>
              <Typography component="span" variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize', flex: 'none' }}>
                · {r.type}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

const SourceChip = ({ rec }) =>
  rec ? (
    <ToneChip
      tone={rec.source === 'ai' ? 'secondary' : 'default'}
      icon={rec.source === 'ai' ? <AutoAwesomeOutlinedIcon /> : <LightbulbOutlinedIcon />}
      label={rec.source === 'ai' ? 'AI-generated' : 'Suggested'}
    />
  ) : null;

/** One stop on the vertical route: marker on the rail + content. */
const RouteStop = ({ step, t, state, rec, isLast, onPractise, pending }) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const st = TOPIC_STATUS[t.status] || TOPIC_STATUS['not-assessed'];
  const tone = st.tone === 'default' ? 'primary' : st.tone;
  const here = state === 'here';
  const done = state === 'done';
  const unassessed = t.status === 'not-assessed';

  const marker = (
    <Box
      aria-hidden="true"
      sx={{
        position: 'relative',
        zIndex: 1,
        width: here ? 40 : 32,
        height: here ? 40 : 32,
        mt: here ? 2.25 : 1.5,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: '0.8rem',
        fontVariantNumeric: 'tabular-nums',
        ...(done && { bgcolor: 'success.main', color: 'success.contrastText' }),
        ...(here && {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          boxShadow: `0 0 0 6px ${alpha(theme.palette.primary.main, 0.18)}, 0 0 22px 4px ${alpha(theme.palette.primary.main, 0.35)}`,
        }),
        ...(!done && !here && {
          bgcolor: 'background.paper',
          color: 'text.secondary',
          border: '2px solid',
          borderColor: unassessed ? 'divider' : alpha(theme.palette[tone].main, 0.6),
          borderStyle: unassessed ? 'dashed' : 'solid',
        }),
      }}
    >
      {done ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : step}
    </Box>
  );

  return (
    <Box component="li" sx={{ listStyle: 'none', display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr)', columnGap: { xs: 1.5, sm: 2 }, position: 'relative' }}>
      {/* Rail */}
      <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            top: 0,
            bottom: isLast ? 'auto' : 0,
            height: isLast ? 24 : 'auto',
            left: '50%',
            width: 3,
            ml: '-1.5px',
            borderRadius: 3,
            ...(done
              ? { bgcolor: 'success.main' }
              : { backgroundImage: `linear-gradient(${theme.palette.divider} 50%, transparent 0)`, backgroundSize: '3px 10px' }),
          }}
        />
        {marker}
      </Box>

      {/* Content */}
      <Box sx={{ pb: 2, minWidth: 0 }}>
        {here ? (
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 4,
              p: { xs: 2, sm: 3 },
              borderColor: alpha(theme.palette.primary.main, 0.45),
              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.035),
              boxShadow: theme.shadows[4],
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
              <ToneChip tone="primary" label="You are here · next focus" />
              <ToneChip tone={st.tone} label={st.label} />
              <SourceChip rec={rec} />
            </Box>
            <Typography variant="h5" component="h3" sx={{ mt: 1, mb: 1.5, overflowWrap: 'anywhere' }}>
              {t.topic}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Box sx={{ flex: 1 }}>
                <ToneBar value={t.mastery ?? 0} tone={tone} label={`${t.topic} mastery`} />
              </Box>
              <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
                {t.mastery == null ? 'Not assessed' : formatPercent(t.mastery)}
              </Typography>
            </Box>
            {rec ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="overline" component="p" sx={{ color: 'text.secondary' }}>
                    How to get there
                  </Typography>
                  {pending && (
                    <Typography variant="caption" role="status" sx={{ color: 'text.secondary', display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                      <CircularProgress size={12} thickness={5} color="inherit" aria-hidden="true" />
                      Personalising your tips…
                    </Typography>
                  )}
                </Box>
                <Tips rec={rec} />
              </>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {unassessed
                  ? 'You have no graded work on this topic yet. A short practice quiz is a good way to find your level.'
                  : 'Review your missed questions on this topic, then practise until you reach 80%.'}
              </Typography>
            )}
            <Button variant="contained" startIcon={<AutoAwesomeOutlinedIcon />} onClick={() => onPractise([t.topic])} sx={{ mt: 2.5 }}>
              Practise {short(t.topic, 28)}
            </Button>
          </Paper>
        ) : (
          <Box
            sx={{
              borderRadius: 3,
              px: { xs: 1.5, sm: 2 },
              py: 1.25,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              opacity: done ? 0.92 : 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 600, flex: '1 1 160px', minWidth: 0, overflowWrap: 'anywhere' }}>{t.topic}</Typography>
              <ToneChip tone={st.tone} label={st.label} />
              <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'right' }}>
                {t.mastery == null ? '—' : formatPercent(t.mastery)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
              <Box sx={{ flex: 1 }}>
                <ToneBar value={t.mastery ?? 0} tone={tone} height={6} label={`${t.topic} mastery`} />
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', flex: 'none' }}>
                {t.attempts ? pluralize(t.attempts, 'graded question') : 'No graded work yet'}
              </Typography>
            </Box>
            {rec && (
              <>
                <Button
                  size="small"
                  onClick={() => setOpen((o) => !o)}
                  aria-expanded={open}
                  endIcon={<ExpandMoreRoundedIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
                  sx={{ mt: 0.75, ml: -1 }}
                >
                  Study tips
                </Button>
                <Collapse in={open} unmountOnExit>
                  <Box sx={{ pt: 1 }}>
                    <Box sx={{ mb: 1 }}>
                      <SourceChip rec={rec} />
                    </Box>
                    <Tips rec={rec} dense />
                  </Box>
                </Collapse>
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

const Destination = ({ reached }) => {
  const theme = useTheme();
  return (
    <Box component="li" sx={{ listStyle: 'none', display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr)', columnGap: { xs: 1.5, sm: 2 }, alignItems: 'center' }}>
      <Box
        aria-hidden="true"
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: 'secondary.main',
          bgcolor: alpha(theme.palette.secondary.main, 0.16),
          boxShadow: reached ? `0 0 18px 4px ${alpha(theme.palette.secondary.main, 0.45)}` : 'none',
        }}
      >
        <EmojiEventsOutlinedIcon />
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700 }}>Course mastery</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {reached ? 'Every assessed topic is at 80% or more. Brilliant work.' : 'Destination: 80% or more on every topic.'}
        </Typography>
      </Box>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LearningPath() {
  const { courseId } = useParams();
  const theme = useTheme();
  const [params, setParams] = useSearchParams();
  const course = useAsync(() => dedupe(`course-meta:${courseId}`, () => getCourse(courseId)), [courseId]);
  const path = useLearningPathData(courseId);
  const [practice, setPractice] = useState({ open: false, topics: null });

  useBreadcrumb(course.data?.title ? 'Learning path' : null, course.data?.title ? { label: course.data.title, to: `/app/courses/${courseId}` } : undefined);

  const data = path.data;
  const topics = useMemo(() => (Array.isArray(data?.topics) ? data.topics : []), [data]);
  const recs = useMemo(() => (Array.isArray(data?.recommendations) ? data.recommendations : []), [data]);
  const recByTopic = useMemo(() => new Map(recs.map((r) => [r.topic, r])), [recs]);
  const journey = useMemo(() => buildJourney(topics, recs), [topics, recs]);
  const hereIndex = useMemo(() => journey.findIndex((t) => t.status !== 'mastered'), [journey]);
  const mapStops = useMemo(() => (journey.length ? buildMapStops(journey, hereIndex) : null), [journey, hereIndex]);

  const counts = useMemo(() => {
    const c = { mastered: 0, developing: 0, 'needs-work': 0, 'not-assessed': 0 };
    topics.forEach((t) => {
      c[t.status] = (c[t.status] || 0) + 1;
    });
    return c;
  }, [topics]);
  const weakCount = counts.developing + counts['needs-work'];
  const mode = weakCount > 0 ? 'weak' : 'mixed';

  const defaultTopics = useMemo(() => {
    const fromUrl = (params.get('topics') || '').split('|').filter(Boolean);
    const known = new Set(topics.map((t) => t.topic));
    const picked = fromUrl.filter((t) => known.has(t));
    if (picked.length) return picked.slice(0, 5);
    return topics
      .filter((t) => t.mastery != null && t.status !== 'mastered')
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3)
      .map((t) => t.topic);
  }, [topics, params]);

  // Stable reference: the dialog resets its selection whenever this changes while open.
  const dialogTopics = useMemo(
    () => practice.topics || (mode === 'weak' ? defaultTopics : []),
    [practice.topics, mode, defaultTopics]
  );

  // Deep link from results / course page: ?practice=1 opens the practice dialog once the path loads.
  useEffect(() => {
    if (data && params.get('practice') === '1') setPractice({ open: true, topics: null });
  }, [data, params]);

  const openPractice = (topicList) => setPractice({ open: true, topics: topicList || null });
  const closePractice = () => {
    setPractice({ open: false, topics: null });
    if (params.get('practice') || params.get('topics')) setParams(new URLSearchParams(), { replace: true });
  };

  const practiceCta =
    data && topics.length > 0 ? (
      mode === 'weak' ? (
        <Button variant="contained" startIcon={<AutoAwesomeOutlinedIcon />} onClick={() => openPractice()}>
          Practice my weak topics
        </Button>
      ) : (
        <Button variant="outlined" startIcon={<AutoAwesomeOutlinedIcon />} onClick={() => openPractice()}>
          Challenge yourself
        </Button>
      )
    ) : null;

  const header = (
    <PageHeader
      eyebrow={course.data?.title || 'Learning path'}
      title="My learning path"
      description="Your route through this course: what you've mastered, where you are now, and what to study next."
      actions={
        <>
          <Button component={RouterLink} to={`/app/courses/${courseId}`} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>
            Course
          </Button>
          {practiceCta}
        </>
      }
    />
  );

  if (path.loading && !data) {
    return (
      <Container maxWidth="lg">
        {header}
        <PathSkeleton />
      </Container>
    );
  }

  if (path.error && !data) {
    const nf = path.error.status === 404 || path.error.status === 403;
    return (
      <Container maxWidth="lg">
        {header}
        <ErrorState
          error={nf ? { message: "This course doesn't exist or you're not enrolled in it." } : path.error}
          title={nf ? 'Course not found' : "We couldn't build your learning path"}
          onRetry={nf ? null : path.reload}
        />
      </Container>
    );
  }

  const level = LEVEL[data.level] || LEVEL.beginner;
  const hasData = data.overallMastery != null;
  const white = theme.palette.common.white;
  const focus = hereIndex >= 0 ? journey[hereIndex] : null;

  return (
    <Container maxWidth="lg">
      {header}

      {/* Hero: overview + route map on the brand ink surface */}
      <Paper
        component="section"
        aria-label="Overview"
        className="nv-ink nv-dots"
        sx={{
          borderRadius: 5,
          overflow: 'hidden',
          mb: 3,
          p: { xs: 2.5, sm: 4 },
          // Brand ink surface in both colour modes (same as the sidebar and the landing route art).
          bgcolor: 'var(--nv-ink)',
          backgroundImage: 'none',
          color: 'common.white',
          border: '1px solid',
          borderColor: alpha(white, 0.08),
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 5fr) minmax(0, 7fr)' },
          gap: { xs: 3, md: 4 },
          alignItems: 'center',
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', mb: 2 }}>
            <ScoreRing
              value={data.overallMastery ?? 0}
              size={104}
              thickness={8}
              tone={level.tone}
              track={alpha(white, 0.12)}
              label={<Box component="span" sx={{ color: 'common.white' }}>{hasData ? formatPercent(data.overallMastery) : '—'}</Box>}
              sublabel="overall mastery"
            />
            <Box>
              <Typography variant="overline" component="p" sx={{ opacity: 0.7 }}>
                Overall mastery
              </Typography>
              <ToneChip tone={level.tone} label={level.label} sx={{ mt: 0.5, color: `${level.tone}.light`, bgcolor: alpha(theme.palette[level.tone].main, 0.2) }} />
            </Box>
          </Box>
          <Typography sx={{ opacity: 0.82, mb: 2.5, maxWidth: 460 }}>
            {hasData ? level.copy : 'Take your first graded assessment in this course to start your route.'}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, maxWidth: 420 }}>
            {Object.entries(TOPIC_STATUS).map(([key, st]) => (
              <Box key={key}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: '1.35rem',
                    fontVariantNumeric: 'tabular-nums',
                    color: st.tone === 'default' ? alpha(white, 0.7) : `${st.tone}.light`,
                  }}
                >
                  {counts[key] || 0}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 600, lineHeight: 1.2, display: 'block' }}>
                  {st.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
        {mapStops && (
          <Box sx={{ px: { xs: 4, sm: 6 }, py: { xs: 2, sm: 1 } }}>
            <LearningRoute stops={mapStops} compact drawDuration={2} ariaLabel={`Your route: ${journey.map((t) => t.topic).join(', ')}.`} />
          </Box>
        )}
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
        {/* The route */}
        <Box component="section" aria-labelledby="route-heading">
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Typography id="route-heading" variant="h6" component="h2">
              Your route
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {topics.length
                ? `${counts.mastered} of ${pluralize(topics.length, 'topic')} mastered`
                : ''}
            </Typography>
          </Box>
          {journey.length ? (
            <Box component="ol" sx={{ p: 0, m: 0 }}>
              {journey.map((t, i) => (
                <RouteStop
                  key={t.topic}
                  step={i + 1}
                  t={t}
                  state={hereIndex === -1 || i < hereIndex ? 'done' : i === hereIndex ? 'here' : 'ahead'}
                  rec={recByTopic.get(t.topic)}
                  onPractise={openPractice}
                  pending={data.recommendationsStatus === 'pending'}
                />
              ))}
              <Destination reached={hereIndex === -1} />
            </Box>
          ) : (
            <EmptyState compact title="No topics yet" description="Your instructor hasn't added topics to this course yet." />
          )}
        </Box>

        {/* Side panel */}
        <Box sx={{ display: 'grid', gap: 2, position: { md: 'sticky' }, top: { md: 88 } }}>
          {data.nextAssessment && (
            <Paper variant="outlined" sx={{ borderRadius: 4, p: 2.5 }}>
              <Typography variant="caption" component="p" sx={{ color: 'text.secondary', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <EventAvailableOutlinedIcon sx={{ fontSize: 16 }} aria-hidden="true" /> Next assessment
              </Typography>
              <Typography sx={{ fontWeight: 600, my: 0.75 }}>{data.nextAssessment.title}</Typography>
              {data.nextAssessment.dueDate && (
                <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mb: 1.25 }}>
                  Due {formatDateTime(data.nextAssessment.dueDate)}
                </Typography>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <TimeLeftChip dueDate={data.nextAssessment.dueDate} />
                <Button size="small" variant="contained" component={RouterLink} to={`/app/take/${data.nextAssessment.id}`}>
                  Open
                </Button>
              </Box>
            </Paper>
          )}
          {topics.length > 0 && (
            <Paper variant="outlined" sx={{ borderRadius: 4, p: 2.5 }}>
              <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{mode === 'weak' ? 'Practise what you missed' : 'Challenge yourself'}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                {mode === 'weak'
                  ? `A private quiz on ${focus ? focus.topic : 'your weakest topics'}${weakCount > 1 ? ' and your other weak topics' : ''}. Answers show right away and it never affects your grade.`
                  : 'Nothing is weak right now. A mixed review keeps your mastered topics sharp — it never affects your grade.'}
              </Typography>
              <Button fullWidth variant={mode === 'weak' ? 'contained' : 'outlined'} startIcon={<AutoAwesomeOutlinedIcon />} onClick={() => openPractice()}>
                {mode === 'weak' ? 'Practice my weak topics' : 'Start a mixed review'}
              </Button>
            </Paper>
          )}
          <Paper variant="outlined" sx={{ borderRadius: 4, p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              How your route works
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.25, color: 'text.secondary', display: 'grid', gap: 0.5 }}>
              <Typography component="li" variant="body2">
                Topics at 80% or more become cleared checkpoints.
              </Typography>
              <Typography component="li" variant="body2">
                Your next focus is the topic that will lift your mastery most.
              </Typography>
              <Typography component="li" variant="body2">
                The route updates after every graded assessment.
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>

      {topics.length > 0 && (
        <PracticeDialog
          open={practice.open}
          onClose={closePractice}
          courseId={courseId}
          topics={topics}
          initialTopics={dialogTopics}
          mode={mode}
        />
      )}
    </Container>
  );
}
