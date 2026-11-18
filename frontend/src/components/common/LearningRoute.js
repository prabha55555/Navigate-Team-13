import { Box } from '@mui/material';
import React, { useId, useMemo } from 'react';

const VIEW_W = 600;
const VIEW_H = 460;
const DRAW_START = 0.35; // s — keep in sync with .nv-route__draw in index.css
const DEFAULT_DRAW_DURATION = 2.6; // s

export const DEFAULT_STOPS = [
  { label: 'Syllabus', caption: 'PDF, DOCX or TXT', x: 64, y: 404, place: 'bottom-right' },
  { label: 'AI Assessment', caption: '5 question types', x: 236, y: 336, place: 'right' },
  { label: 'Insights', caption: 'Analytics & item analysis', x: 168, y: 222, place: 'left' },
  { label: 'Adaptive Path', caption: 'You are here', x: 364, y: 172, place: 'bottom-right', here: true },
  { label: 'Mastery', caption: 'Destination', x: 530, y: 62, place: 'top', destination: true },
];

// Catmull-Rom spline through every stop, expressed as cubic Bézier segments.
const toSegments = (points) => {
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    segments.push(`C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x} ${p2.y}`);
  }
  return segments;
};

// The draw uses an ease-out curve; invert an ease-out-cubic to time each checkpoint
// so it pops in roughly as the pen reaches it.
const arrivalTime = (fraction, duration) => DRAW_START + duration * (1 - Math.cbrt(1 - Math.min(1, fraction)));

const StarGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 0.5 L14.1 9.9 L23.5 12 L14.1 14.1 L12 23.5 L9.9 14.1 L0.5 12 L9.9 9.9 Z" fill="#F2A93B" />
    <circle cx="12" cy="12" r="2.2" fill="#FFF4DE" />
  </svg>
);

/**
 * The signature "learning route": a path that draws itself through checkpoints,
 * a glowing "you are here" marker and a saffron destination star.
 * Pure SVG + CSS (see .nv-route* in styles/index.css); motion respects reduced-motion.
 */
const LearningRoute = ({ stops = DEFAULT_STOPS, compact = false, drawDuration = DEFAULT_DRAW_DURATION, sx, ariaLabel }) => {
  const gradientId = `nv-route-${useId().replace(/:/g, '')}`;

  const { fullPath, travelledPath, delays, label } = useMemo(() => {
    const segments = toSegments(stops);
    const start = `M ${stops[0].x} ${stops[0].y}`;
    const hereIndex = Math.max(0, stops.findIndex((s) => s.here));

    // Chord lengths approximate how far along the route each stop sits.
    const lengths = stops.map((s, i) => (i === 0 ? 0 : Math.hypot(s.x - stops[i - 1].x, s.y - stops[i - 1].y)));
    const cumulative = lengths.reduce((acc, len, i) => [...acc, (acc[i - 1] || 0) + len], []);
    const travelledLength = cumulative[hereIndex] || 1;

    return {
      fullPath: `${start} ${segments.join(' ')}`,
      travelledPath: `${start} ${segments.slice(0, hereIndex).join(' ')}`,
      delays: stops.map((s, i) =>
        i <= hereIndex
          ? arrivalTime(cumulative[i] / travelledLength, drawDuration) - 0.08
          : DRAW_START + drawDuration + 0.15 * (i - hereIndex)
      ),
      label:
        ariaLabel ||
        `Learning route: ${stops.map((s) => (s.here ? `${s.label} (you are here)` : s.label)).join(', then ')}.`,
    };
  }, [stops, ariaLabel, drawDuration]);

  return (
    <Box
      role="img"
      aria-label={label}
      className={`nv-route${compact ? ' nv-route--compact' : ''}`}
      style={{ '--nv-draw-duration': `${drawDuration}s` }}
      sx={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, ...sx }}
    >
      <svg className="nv-route__svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#6B7BFF" />
            <stop offset="0.65" stopColor="#A6B0FF" />
            <stop offset="1" stopColor="#F2A93B" />
          </linearGradient>
        </defs>

        {/* Topographic contours around the destination */}
        <g fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth="1">
          {[56, 104, 156, 214, 278].map((r) => (
            <ellipse
              key={r}
              cx={stops[stops.length - 1].x}
              cy={stops[stops.length - 1].y}
              rx={r * 1.3}
              ry={r}
              transform={`rotate(-24 ${stops[stops.length - 1].x} ${stops[stops.length - 1].y})`}
            />
          ))}
        </g>

        {/* The planned trail, end to end */}
        <path
          d={fullPath}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="0.5 9"
        />

        {/* The distance already travelled: soft glow + bright line */}
        <path
          className="nv-route__draw"
          d={travelledPath}
          pathLength="1"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeOpacity="0.22"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          className="nv-route__draw"
          d={travelledPath}
          pathLength="1"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </svg>

      {stops.map((stop, i) => {
        const done = !stop.here && !stop.destination && i < stops.findIndex((s) => s.here);
        let marker = <span className={`nv-route__dot${done ? ' nv-route__dot--done' : ''}`} />;
        if (stop.here) marker = <span className="nv-route__here" />;
        if (stop.destination) {
          marker = (
            <span className="nv-route__star">
              <StarGlyph />
            </span>
          );
        }

        return (
          <div
            key={stop.label}
            className="nv-route__node"
            aria-hidden="true"
            style={{
              left: `${(stop.x / VIEW_W) * 100}%`,
              top: `${(stop.y / VIEW_H) * 100}%`,
              '--nv-delay': `${delays[i].toFixed(2)}s`,
            }}
          >
            {marker}
            <span className={`nv-route__label nv-route__label--${stop.place || 'right'}`}>
              <span className="nv-route__label-inner">
                <span className="nv-route__step">{String(i + 1).padStart(2, '0')}</span>
                <span className="nv-route__name">{stop.label}</span>
                {stop.caption && (
                  <span className={`nv-route__caption${stop.here ? ' nv-route__caption--here' : ''}`}>
                    {stop.caption}
                  </span>
                )}
              </span>
            </span>
          </div>
        );
      })}
    </Box>
  );
};

export default LearningRoute;
