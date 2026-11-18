import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { listAssessments } from '../../../api/assessments';
import { updateCourse } from '../../../api/courses';
import { useNotify } from '../../../contexts/NotificationContext';
import { EmptyState } from '../../common';
import { ErrorState, SectionCard } from '../StaffUI';
import { BLOOM_LEVELS } from '../staffUtils';
import useApiData from '../useApiData';
import usePlanError from '../usePlanError';

const newOutcomeId = () => `o-${Math.random().toString(36).slice(2, 10)}`;
const linkKey = (o, a) => `${o}:${a}`;

export default function CourseCurriculumTab({ course, courseId, patchCourse }) {
  const notify = useNotify();
  const handleError = usePlanError();
  const assessments = useApiData(() => listAssessments({ courseId, pageSize: 100 }), [courseId]);
  const [outcomes, setOutcomes] = useState([]);
  const [links, setLinks] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const initial = useMemo(
    () => ({
      outcomes: (course.outcomes || []).map((o) => ({ id: o.id, code: o.code || '', description: o.description || '', bloomLevel: o.bloomLevel || '' })),
      links: new Set((course.curriculumMap?.links || []).map((l) => linkKey(l.outcomeId, l.assessmentId))),
    }),
    [course.outcomes, course.curriculumMap]
  );

  useEffect(() => {
    setOutcomes(initial.outcomes);
    setLinks(new Set(initial.links));
    setTouched(false);
  }, [initial]);

  const dirty =
    JSON.stringify(outcomes) !== JSON.stringify(initial.outcomes) ||
    links.size !== initial.links.size ||
    [...links].some((k) => !initial.links.has(k));

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const cols = useMemo(() => (assessments.data?.items || []).filter((a) => a.status !== 'archived'), [assessments.data]);
  const invalid = outcomes.some((o) => !o.description.trim());

  const update = (id, patch) => setOutcomes((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const addOutcome = () =>
    setOutcomes((list) => [...list, { id: newOutcomeId(), code: `LO${list.length + 1}`, description: '', bloomLevel: '' }]);
  const removeOutcome = (id) => {
    setOutcomes((list) => list.filter((o) => o.id !== id));
    setLinks((set) => new Set([...set].filter((k) => !k.startsWith(`${id}:`))));
  };
  const toggleLink = (o, a) =>
    setLinks((set) => {
      const next = new Set(set);
      const k = linkKey(o, a);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const save = async () => {
    setTouched(true);
    if (invalid) return;
    setSaving(true);
    const outcomeIds = new Set(outcomes.map((o) => o.id));
    const colIds = new Set(cols.map((a) => a.id));
    const body = {
      outcomes: outcomes.map((o) => ({ id: o.id, code: o.code.trim(), description: o.description.trim(), bloomLevel: o.bloomLevel })),
      curriculumMap: {
        links: [...links]
          .map((k) => {
            const [outcomeId, assessmentId] = k.split(':');
            return { outcomeId, assessmentId };
          })
          .filter((l) => outcomeIds.has(l.outcomeId) && colIds.has(l.assessmentId)),
      },
    };
    try {
      const saved = await updateCourse(courseId, body);
      patchCourse({ outcomes: saved.outcomes, curriculumMap: saved.curriculumMap });
      notify('Curriculum saved', 'success');
    } catch (err) {
      handleError(err, 'Could not save the curriculum');
    } finally {
      setSaving(false);
    }
  };

  const coverage = useMemo(
    () => new Map(outcomes.map((o) => [o.id, cols.filter((a) => links.has(linkKey(o.id, a.id))).length])),
    [outcomes, cols, links]
  );
  const uncovered = outcomes.filter((o) => o.description.trim() && !coverage.get(o.id)).length;

  return (
    <Box sx={{ display: 'grid', gap: 3, pb: dirty ? 10 : 0 }}>
      <SectionCard
        title="Learning outcomes"
        subtitle="What students should be able to do by the end of the course."
        action={
          <Button startIcon={<AddRoundedIcon />} onClick={addOutcome} variant="outlined" size="small">
            Add outcome
          </Button>
        }
      >
        {outcomes.length === 0 ? (
          <EmptyState
            compact
            icon={<SchoolOutlinedIcon />}
            title="No learning outcomes yet"
            description="Outcomes let you show which assessment measures which skill — often required for accreditation and programme reviews."
            action={
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={addOutcome}>
                Add the first outcome
              </Button>
            }
          />
        ) : (
          <Box sx={{ display: 'grid', gap: 2, pt: 1 }}>
            {outcomes.map((o, i) => (
              <Box
                key={o.id}
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: '1fr 1fr auto', md: '110px 1fr 170px auto' },
                  alignItems: 'start',
                }}
              >
                <TextField
                  size="small"
                  label="Code"
                  value={o.code}
                  onChange={(e) => update(o.id, { code: e.target.value })}
                  inputProps={{ maxLength: 20 }}
                />
                <TextField
                  size="small"
                  label="Description"
                  value={o.description}
                  onChange={(e) => update(o.id, { description: e.target.value })}
                  error={touched && !o.description.trim()}
                  helperText={touched && !o.description.trim() ? 'Describe the outcome' : undefined}
                  multiline
                  autoFocus={i === outcomes.length - 1 && !o.description}
                  sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, gridRow: { xs: 2, md: 'auto' } }}
                />
                <FormControl size="small">
                  <Select
                    value={o.bloomLevel}
                    displayEmpty
                    onChange={(e) => update(o.id, { bloomLevel: e.target.value })}
                    inputProps={{ 'aria-label': `Bloom level for ${o.code || `outcome ${i + 1}`}` }}
                  >
                    <MenuItem value="">
                      <em>Bloom level</em>
                    </MenuItem>
                    {BLOOM_LEVELS.map((b) => (
                      <MenuItem key={b} value={b}>
                        {b}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Tooltip title="Delete outcome">
                  <IconButton aria-label={`Delete outcome ${o.code || i + 1}`} onClick={() => removeOutcome(o.id)}>
                    <DeleteOutlineRoundedIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}
      </SectionCard>

      <SectionCard
        title="Outcome ↔ assessment map"
        subtitle="Tick the assessments that measure each outcome."
      >
        {assessments.error ? (
          <ErrorState error={assessments.error} onRetry={assessments.reload} />
        ) : assessments.loading ? (
          <Skeleton variant="rounded" height={180} />
        ) : !outcomes.length ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Add learning outcomes above to start mapping.
          </Typography>
        ) : !cols.length ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            This course has no assessments yet.
          </Typography>
        ) : (
          <>
            {uncovered > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {uncovered} outcome{uncovered === 1 ? ' is' : 's are'} not measured by any assessment yet.
              </Alert>
            )}
            <Box sx={{ overflowX: 'auto' }}>
              <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%', minWidth: 200 + cols.length * 110 }}>
                <caption style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                  Which assessments measure which learning outcomes
                </caption>
                <thead>
                  <tr>
                    <Box component="th" scope="col" sx={{ textAlign: 'left', p: 1, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                        Outcome
                      </Typography>
                    </Box>
                    {cols.map((a) => (
                      <Box component="th" scope="col" key={a.id} sx={{ p: 1, maxWidth: 130, verticalAlign: 'bottom' }}>
                        <Typography variant="caption" component="div" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                          {a.title}
                        </Typography>
                      </Box>
                    ))}
                    <Box component="th" scope="col" sx={{ p: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        Coverage
                      </Typography>
                    </Box>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.map((o) => (
                    <Box component="tr" key={o.id} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box component="th" scope="row" sx={{ textAlign: 'left', p: 1, maxWidth: 280, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {o.code || '—'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          {o.description || 'No description'}
                        </Typography>
                      </Box>
                      {cols.map((a) => {
                        const checked = links.has(linkKey(o.id, a.id));
                        return (
                          <Box
                            component="td"
                            key={a.id}
                            sx={(t) => ({ textAlign: 'center', bgcolor: checked ? alpha(t.palette.primary.main, 0.06) : 'transparent' })}
                          >
                            <Checkbox
                              checked={checked}
                              onChange={() => toggleLink(o.id, a.id)}
                              inputProps={{ 'aria-label': `${o.code || 'Outcome'} is measured by ${a.title}` }}
                            />
                          </Box>
                        );
                      })}
                      <Box component="td" sx={{ textAlign: 'center', p: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700, color: coverage.get(o.id) ? 'success.main' : 'warning.main', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {coverage.get(o.id)}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </tbody>
              </Box>
            </Box>
          </>
        )}
      </SectionCard>

      {dirty && (
        <Paper
          elevation={8}
          role="region"
          aria-label="Unsaved curriculum changes"
          sx={{
            position: 'sticky',
            bottom: 16,
            zIndex: 5,
            borderRadius: 3,
            px: 2.5,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            You have unsaved changes
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              color="inherit"
              onClick={() => {
                setOutcomes(initial.outcomes);
                setLinks(new Set(initial.links));
                setTouched(false);
              }}
              disabled={saving}
            >
              Discard
            </Button>
            <Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}>
              Save curriculum
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
