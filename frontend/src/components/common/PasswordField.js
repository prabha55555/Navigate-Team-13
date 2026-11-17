import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import React, { forwardRef, useState } from 'react';

/** TextField with a show/hide toggle. Accepts every TextField prop. */
const PasswordField = forwardRef(({ InputProps, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Hide password' : 'Show password';

  return (
    <TextField
      {...props}
      inputRef={ref}
      type={visible ? 'text' : 'password'}
      InputProps={{
        ...InputProps,
        endAdornment: (
          <InputAdornment position="end">
            <Tooltip title={label}>
              <IconButton
                aria-label={label}
                aria-pressed={visible}
                onClick={() => setVisible((v) => !v)}
                onMouseDown={(e) => e.preventDefault()}
                edge="end"
                size="small"
              >
                {visible ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ),
      }}
    />
  );
});

PasswordField.displayName = 'PasswordField';

export default PasswordField;
