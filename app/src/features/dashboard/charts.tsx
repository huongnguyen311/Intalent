import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface Slice {
  name: string;
  value: number;
  color: string;
}

/** Top Tech Stacks: solid pie, counter-clockwise from 3 o'clock, white separators. */
export function StackPie({ data }: { data: Slice[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} cx="50%" cy="50%" isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/** English Level: donut starting at 12 o'clock, clockwise. */
export function EnglishDonut({ data }: { data: Slice[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={65}
          outerRadius={85}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          cx="50%"
          cy="50%"
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/**
 * Generic donut, 12 o'clock clockwise. Slices are split by a 2px gap in the surface colour
 * (`currentColor`, so the wrapper's text colour sets it for light and dark).
 */
export function Donut({ data, onHover }: { data: Slice[]; onHover?: (name: string | undefined) => void }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="68%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
          stroke="currentColor"
          strokeWidth={2}
          cx="50%"
          cy="50%"
          isAnimationActive={false}
          onMouseEnter={(d: { name?: string }) => onHover?.(d.name)}
          onMouseLeave={() => onHover?.(undefined)}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

const FROM = [252, 165, 165];
const TO = [239, 81, 37];

/** Light-to-brand-orange ramp across the bars, like the mockup. */
function ramp(i: number, n: number): string {
  const t = n > 1 ? i / (n - 1) : 1;
  const [r, g, b] = FROM.map((f, k) => Math.round(f + (TO[k] - f) * t));
  return `rgb(${r},${g},${b})`;
}

export function SeniorityBars({ data }: { data: { name: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} />
        <YAxis axisLine={false} tickLine={false} tickCount={3} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
        <Tooltip
          cursor={{ fill: 'transparent' }}
          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12, fontWeight: 'bold' }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={24} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={ramp(i, data.length)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
