import {
  Alert,
  Box,
  FormControlLabel,
  FormHelperText,
  InputAdornment,
  Radio,
  RadioGroup,
  Slider,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React, { useId } from 'react';
import { SectionCard } from '../StaffUI';
import DateTimeField from '../../common/DateTimeField';
import { RESULTS_POLICIES } from '../staffUtils';

function SwitchRow({ checked, onChange, label, hint, disabled }) {
  const id = useId();
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, py: 1 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} component="span" id={`${id}-label`}>
          {label}
        </Typography>
        {hint && (
          <Typography id={`${id}-hint`} variant="caption" component="p" sx={{ color: 'text.secondary' }}>
            {hint}
          </Typography>
        )}
      </Box>
      <Switch
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        inputProps={{ 'aria-labelledby': `${id}-label`, 'aria-describedby': hint ? `${id}-hint` : undefined }}
      />
    </Box>
  );
}

/** Availability, timing, grading, results and proctoring settings. */
export default function SettingsStep({ form, set, errors = {} }) {
  const p = form.proctoring || {};
  const setP = (patch) => set({ proctoring: { ...p, ...patch } });

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <SectionCard title="Availability" subtitle="When students can start. Times are in your local time zone.">
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <DateTimeField
            label="Opens"
            value={form.availableFrom}
            onChange={(iso) => set({ availableFrom: iso })}
            helperText="Leave empty to open as soon as it’s published."
          />
          <DateTimeField
            label="Due"
            value={form.dueDate}
            min={form.availableFrom || undefined}
            onChange={(iso) => set({ dueDate: iso })}
            error={!!errors.dueDate}
            helperText={errors.dueDate || 'Attempts end at the due date even if time remains.'}
          />
        </Box>
      </SectionCard>

      <SectionCard title="Attempts & grading">
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField
            label="Time limit"
            type="number"
            value={form.timeLimit ?? 0}
            onChange={(e) => set({ timeLimit: Math.max(0, Math.min(1440, Number(e.target.value) || 0)) })}
            InputProps={{ endAdornment: <InputAdornment position="end">minutes</InputAdornment> }}
            inputProps={{ min: 0, max: 1440 }}
            helperText="0 means no time limit."
          />
          <TextField
            label="Attempts allowed"
            type="number"
            value={form.maxAttempts ?? 1}
            onChange={(e) => set({ maxAttempts: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
            inputProps={{ min: 1, max: 100 }}
            helperText="The gradebook keeps each student’s best attempt."
          />
        </Box>
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} id="passing-label">
            Pass mark: {form.passingScore ?? 50}%
          </Typography>
          <Slider
            value={Number(form.passingScore ?? 50)}
            onChange={(_, v) => set({ passingScore: v })}
            step={5}
            min={0}
            max={100}
            marks={[0, 25, 50, 75, 100].map((v) => ({ value: v, label: `${v}%` }))}
            valueLabelDisplay="auto"
            aria-labelledby="passing-label"
            sx={{ maxWidth: 480, ml: 1 }}
          />
        </Box>
        <Box sx={{ mt: 1 }}>
          <SwitchRow
            label="Shuffle question order"
            hint="Each student gets the questions in a different order."
            checked={form.shuffleQuestions}
            onChange={(v) => set({ shuffleQuestions: v })}
          />
          <SwitchRow
            label="Shuffle answer options"
            hint="Choice options appear in a different order for each student."
            checked={form.shuffleOptions}
            onChange={(v) => set({ shuffleOptions: v })}
          />
        </Box>
      </SectionCard>

      <SectionCard title="Results" subtitle="When students see their score.">
        <RadioGroup value={form.resultsPolicy || 'immediate'} onChange={(e) => set({ resultsPolicy: e.target.value })} aria-label="Results policy">
          {RESULTS_POLICIES.map((r) => (
            <FormControlLabel
              key={r.value}
              value={r.value}
              control={<Radio />}
              sx={{ alignItems: 'flex-start', my: 0.5, '& .MuiRadio-root': { pt: 0.5 } }}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {r.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {r.hint}
                  </Typography>
                </Box>
              }
            />
          ))}
        </RadioGroup>
        {form.resultsPolicy === 'after-due' && !form.dueDate && (
          <FormHelperText sx={{ color: 'warning.main' }}>Set a due date, otherwise results will never be shown automatically.</FormHelperText>
        )}
        <Box sx={{ mt: 1 }}>
          <SwitchRow
            label="Show correct answers"
            hint="Once results are visible, students also see the answer key and explanations."
            checked={form.showCorrectAnswers}
            onChange={(v) => set({ showCorrectAnswers: v })}
          />
        </Box>
      </SectionCard>

      <SectionCard title="Proctoring" subtitle="Discourage cheating and record suspicious behaviour.">
        <SwitchRow
          label="Enable proctoring"
          hint="Integrity events are always recorded; with proctoring on, too many violations end the attempt."
          checked={p.enabled}
          onChange={(v) => setP({ enabled: v, ...(v && !p.fullscreen && !p.blockShortcuts && !p.webcam ? { fullscreen: true, blockShortcuts: true } : {}) })}
        />
        {p.enabled && (
          <Box sx={{ pl: { sm: 2 }, borderLeft: { sm: '2px solid' }, borderColor: { sm: 'divider' }, mt: 1 }}>
            <SwitchRow label="Require full screen" hint="Leaving full screen counts as a violation." checked={p.fullscreen} onChange={(v) => setP({ fullscreen: v })} />
            <SwitchRow label="Block copy, paste and shortcuts" hint="Blocked attempts are recorded." checked={p.blockShortcuts} onChange={(v) => setP({ blockShortcuts: v })} />
            <SwitchRow label="Webcam check" hint="Students must keep their camera on; losing the camera counts as a violation." checked={p.webcam} onChange={(v) => setP({ webcam: v })} />
            <TextField
              label="Violations before the attempt ends"
              type="number"
              value={p.maxViolations ?? 5}
              onChange={(e) => setP({ maxViolations: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
              inputProps={{ min: 1, max: 100 }}
              sx={{ mt: 2, maxWidth: 320 }}
              fullWidth
              helperText="The attempt is submitted automatically, graded on what was answered."
            />
          </Box>
        )}
        {p.enabled && p.webcam && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Let students know in the instructions that a webcam is required.
          </Alert>
        )}
      </SectionCard>
    </Box>
  );
}
