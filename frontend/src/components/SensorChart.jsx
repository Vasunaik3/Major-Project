import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ChartTooltip({ active, payload, label, unit, color }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span>{formatTime(label)}</span>
      <strong style={{ color }}>
        {Number(payload[0].value).toFixed(1)}{unit}
      </strong>
    </div>
  );
}

export default function SensorChart({
  title,
  description,
  data,
  dataKey,
  unit,
  color,
  gradientId,
  rangeLabel = 'RECENT HISTORY',
}) {
  return (
    <article className="panel chart-panel">
      <div className="panel-heading chart-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="chart-range">{rangeLabel}</span>
      </div>

      <div className="chart-wrap">
        {data.length === 0 ? (
          <div className="chart-empty">Waiting for simulated sensor readings…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={color} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E5EAE3" vertical={false} strokeDasharray="0" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#89938B', fontSize: 10, fontFamily: 'Inter, sans-serif' }}
                minTickGap={40}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#89938B', fontSize: 10, fontFamily: 'Inter, sans-serif' }}
                width={42}
              />
              <Tooltip content={<ChartTooltip unit={unit} color={color} />} />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2.2}
                fill={`url(#${gradientId})`}
                activeDot={{ r: 4, strokeWidth: 0, fill: color }}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </article>
  );
}
