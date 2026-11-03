import { AlertTriangle, CheckCircle2, CircleDashed, Minus } from 'lucide-react';

function Group({ title, icon: Icon, tone, items, render, empty }) {
  const tones = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    slate: 'text-slate-500',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <Icon size={18} className={tones[tone]} /> {title}
        <span className="text-sm font-normal text-slate-400">({items.length})</span>
      </h3>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm">{items.map(render)}</ul>
      ) : (
        <p className="mt-3 text-sm text-slate-400">{empty}</p>
      )}
    </div>
  );
}

const ImportanceTag = ({ importance }) => (
  <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${importance === 'required' ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400'}`}>
    {importance}
  </span>
);

export default function SkillGroups({ skills }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Group
        title="Matched" icon={CheckCircle2} tone="emerald" items={skills.matched}
        empty="None of the required skills were found."
        render={(s) => (
          <li key={s.skill}>
            <span className="font-medium">{s.skill}</span>
            <ImportanceTag importance={s.importance} />
            {s.via && <span className="ml-2 text-xs text-slate-400">{s.via}</span>}
            {s.weakEvidence && <span className="ml-2 text-xs text-amber-600">only listed, not shown in use</span>}
          </li>
        )}
      />
      <Group
        title="Partial" icon={CircleDashed} tone="amber" items={skills.partial}
        empty="No related skills."
        render={(s) => (
          <li key={s.skill}>
            <span className="font-medium">{s.skill}</span>
            <ImportanceTag importance={s.importance} />
            <span className="ml-2 text-xs text-slate-400">related: {s.relatedTo}</span>
          </li>
        )}
      />
      <Group
        title="Missing" icon={AlertTriangle} tone="rose" items={skills.missing}
        empty="Nothing missing. Nice."
        render={(s) => (
          <li key={s.skill}>
            <span className="font-medium">{s.skill}</span>
            <ImportanceTag importance={s.importance} />
          </li>
        )}
      />
      <Group
        title="Additional" icon={Minus} tone="slate" items={skills.additional}
        empty="No extra skills."
        render={(name) => <li key={name} className="text-slate-600">{name}</li>}
      />
    </div>
  );
}
