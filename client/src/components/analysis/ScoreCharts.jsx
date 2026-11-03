import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { COMPONENT_LABELS } from '../../utils/analysisHelpers.js';

const barColor = (score) => (score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#f43f5e');

function BreakdownTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow">
      <p className="font-semibold">{d.name}: {d.score}%</p>
      <p className="text-slate-500">Counts for {d.weight}% of the overall score</p>
      {d.note && <p className="mt-1 max-w-[220px] text-slate-500">{d.note}</p>}
    </div>
  );
}

export default function ScoreCharts({ analysis }) {
  const components = analysis.components ?? {};
  const entries = Object.entries(COMPONENT_LABELS).map(([key, name]) => ({ key, name, c: components[key] }));

  const barData = entries
    .filter(({ c }) => c?.status === 'scored')
    .map(({ name, c }) => ({ name, score: c.score, weight: Math.round(c.effectiveWeight * 100), note: c.note }));
  const left = entries.filter(({ c }) => c && c.status !== 'scored');

  const { matched, partial, missing } = analysis.skills;
  const skillData = [
    { name: 'Matched', value: matched.length, color: '#10b981' },
    { name: 'Partial', value: partial.length, color: '#f59e0b' },
    { name: 'Missing', value: missing.length, color: '#f43f5e' },
  ].filter((d) => d.value > 0);
  const totalSkills = matched.length + partial.length + missing.length;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-3">
        <h2 className="font-semibold">Score breakdown</h2>
        <div className="mt-4" style={{ height: Math.max(180, barData.length * 52) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 13 }} />
              <Tooltip content={<BreakdownTooltip />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={22} background={{ fill: '#f1f5f9', radius: 8 }}>
                {barData.map((d) => <Cell key={d.name} fill={barColor(d.score)} />)}
                <LabelList dataKey="score" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 12, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {left.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {left.map(({ key, name, c }) => (
              <li key={key}>
                <span className="font-medium text-slate-600">{name}</span> not counted: {c.note}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
        <h2 className="font-semibold">Skill coverage</h2>
        {totalSkills === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No recognizable skills in this job description.</p>
        ) : (
          <>
            <div className="relative mt-2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={skillData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
                    {skillData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{totalSkills}</span>
                <span className="text-xs text-slate-500">job skills</span>
              </div>
            </div>
            <ul className="mt-2 flex justify-center gap-4 text-xs">
              {skillData.map((d) => (
                <li key={d.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /> {d.name} ({d.value})
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
