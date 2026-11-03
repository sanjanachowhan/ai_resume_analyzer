import { Link } from 'react-router-dom';
import {
  ArrowRight, FileSearch, Target, Lightbulb, BarChart3,
  Upload, ClipboardList, Cpu, FileCheck2, ShieldCheck, Zap, TrendingUp,
} from 'lucide-react';
import ApiStatus from '../components/ui/ApiStatus.jsx';

const features = [
  { icon: FileSearch, title: 'Smart resume parsing', text: 'Upload a PDF or DOCX and get clean, structured text in seconds.' },
  { icon: Target, title: 'Transparent match score', text: 'A weighted, explainable score across skills, keywords, experience and more.' },
  { icon: Lightbulb, title: 'AI gap analysis', text: 'See missing skills and weak areas, with advice grounded in your actual resume.' },
  { icon: BarChart3, title: 'Analysis history', text: 'Track every analysis and watch your match scores improve over time.' },
];

const steps = [
  { icon: Upload, title: 'Upload resume', text: 'Drag and drop your PDF or DOCX.' },
  { icon: ClipboardList, title: 'Add job description', text: 'Paste it or upload the document.' },
  { icon: Cpu, title: 'We analyze', text: 'Keyword matching plus AI gap analysis.' },
  { icon: FileCheck2, title: 'Get your report', text: 'Score, missing skills and improvements.' },
];

const benefits = [
  { icon: Zap, title: 'Save hours', text: 'Know exactly what to tailor before you apply.' },
  { icon: ShieldCheck, title: 'Honest by design', text: 'The AI never invents experience or metrics for you.' },
  { icon: TrendingUp, title: 'Apply with confidence', text: 'Target roles where you are strongest, and close the gaps on the rest.' },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <ApiStatus />
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Know how well your resume <span className="text-brand-600">matches the job</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            ResumeIQ compares your resume with any job description, scores the match, finds missing skills,
            and gives you specific, honest suggestions to improve.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
            >
              Analyze My Resume <ArrowRight size={18} />
            </Link>
            <a href="#how-it-works" className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50">
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-bold">Everything you need to tailor your resume</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                <Icon size={22} />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Icon size={24} />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-600">Step {i + 1}</p>
                <h3 className="mt-1 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-slate-900 p-8 text-white">
              <Icon className="text-brand-100" size={26} />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-slate-300">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
