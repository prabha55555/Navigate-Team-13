import { Box, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { barDataset, useChartTheme } from '../charts';

/** Histogram of scores in 10-point buckets ([{ bucket: '0-9', count }]). */
export default function ScoreDistributionChart({ distribution = [], height = 240, passingScore }) {
  const { base, colors } = useChartTheme();
  const rows = useMemo(() => distribution || [], [distribution]);
  const total = rows.reduce((s, r) => s + (r.count || 0), 0);

  const data = useMemo(
    () => ({
      labels: rows.map((r) => String(r.bucket).replace('-', '–')),
      datasets: [
        barDataset(colors, {
          label: 'Students',
          data: rows.map((r) => r.count),
          // Buckets below the pass mark use the error hue so failing scores stand out.
          backgroundColor: rows.map((r) => {
            const lower = Number(String(r.bucket).split('-')[0]);
            return passingScore !== undefined && lower + 9 < passingScore ? colors.error : colors.primarySoft;
          }),
          hoverBackgroundColor: colors.primary,
        }),
      ],
    }),
    [rows, colors, passingScore],
  );
  const options = useMemo(
    () => ({
      ...base,
      interaction: { mode: 'nearest', intersect: false, axis: 'x' },
      scales: {
        ...base.scales,
        x: {
          ...base.scales.x,
          // Label every bucket; Chart.js rotates them when the chart is narrow.
          ticks: { ...base.scales.x.ticks, autoSkip: false, maxRotation: 45, minRotation: 0, font: { ...base.scales.x.ticks.font, size: 11 } },
          title: { display: true, text: 'Score (%)', color: base.scales.x.ticks.color, font: base.scales.x.ticks.font },
        },
      },
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins.tooltip,
          callbacks: {
            title: (items) => `Score ${items[0].label}%`,
            label: (ctx) => ` ${ctx.parsed.y} student${ctx.parsed.y === 1 ? '' : 's'}`,
          },
        },
      },
    }),
    [base],
  );

  if (!total) {
    return (
      <Box sx={{ height, display: 'grid', placeItems: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No graded submissions yet
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ height, position: 'relative' }}>
        <Bar data={data} options={options} aria-hidden="true" />
      </Box>
      <Box
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        <table>
          <caption>Score distribution</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bucket}>
                <th scope="row">{r.bucket}%</th>
                <td>{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Box>
  );
}
