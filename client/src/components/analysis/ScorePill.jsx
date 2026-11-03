const tone = (score) =>
  score >= 75 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : score >= 50 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-rose-50 text-rose-700 ring-rose-200';

export default function ScorePill({ score }) {
  return (
    <span className={`inline-flex min-w-[3.25rem] justify-center rounded-full px-3 py-1 text-sm font-bold ring-1 ${tone(score)}`}>
      {score}%
    </span>
  );
}
