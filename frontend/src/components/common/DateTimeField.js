import { TextField } from '@mui/material';
import React, { forwardRef } from 'react';

const pad = (n) => String(n).padStart(2, '0');

/** ISO string / Date → value for <input type="datetime-local"> (local time) or "date". */
export const toLocalInputValue = (value, type = 'datetime-local') => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return type === 'date' ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Value from <input type="datetime-local"/"date"> → ISO string (or null when empty). */
export const fromLocalInputValue = (value) => {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * Themed native date/time field. Works with ISO strings in and out:
 *
 *   <DateTimeField label="Due date" value={dueDate} onChange={(iso) => setDueDate(iso)} />
 *
 * type: 'datetime-local' (default) | 'date'. `min`/`max` accept ISO strings too.
 * The label always sits above the value so the browser's placeholder (dd/mm/yyyy) never collides with it.
 */
const DateTimeField = forwardRef(({ value, onChange, type = 'datetime-local', min, max, inputProps, InputLabelProps, ...props }, ref) => (
  <TextField
    {...props}
    inputRef={ref}
    type={type}
    value={toLocalInputValue(value, type)}
    onChange={(e) => onChange?.(fromLocalInputValue(e.target.value), e)}
    InputLabelProps={{ shrink: true, ...InputLabelProps }}
    inputProps={{
      ...(min ? { min: toLocalInputValue(min, type) } : {}),
      ...(max ? { max: toLocalInputValue(max, type) } : {}),
      ...inputProps,
    }}
  />
));

DateTimeField.displayName = 'DateTimeField';

export default DateTimeField;
