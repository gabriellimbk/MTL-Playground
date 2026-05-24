import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Brain,
  Clock,
  FileText,
  History,
  Loader2,
  Lock,
  LogOut,
  Play,
  Unlock,
} from 'lucide-react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { requireSupabaseConfig, supabase } from './lib/supabase';

type PlaygroundRun = {
  id: number;
  essay_title: string;
  essay_description: string;
  writing_text: string;
  ai_prompt: string;
  model: string;
  feedback_text: string;
  created_at: string;
};

const DEFAULT_PROMPT = `Generate concise, specific feedback for this student's writing.

Structure the feedback with:
1. What is working
2. What is missing or weak
3. One concrete revision action

Base the feedback only on the essay title, description, and student writing.`;

const DEFAULT_ESSAY_TITLE = 'H2 MLL Paper 1 Practice: Bahasa dan Identiti';

const DEFAULT_ESSAY_DESCRIPTION = `Soalan esei latihan:

"Bahasa ibunda masih memainkan peranan penting dalam pembentukan identiti generasi muda di Singapura." Bincangkan.`;

const DEFAULT_WRITING_TEXT = `Pada pendapat saya, bahasa ibunda memang penting kerana semua orang mesti tahu bahasa sendiri. Kalau kita tidak tahu bahasa sendiri, kita tidak akan tahu siapa diri kita. Ini menunjukkan bahasa ibunda sangat penting dalam kehidupan.

Pertama sekali, bahasa ibunda digunakan di rumah. Contohnya, ibu bapa bercakap dengan anak-anak dalam bahasa Melayu. Jadi anak-anak akan rasa dekat dengan keluarga. Selain itu, bahasa ibunda juga digunakan semasa Hari Raya dan majlis kahwin. Ini membuktikan bahawa bahasa ibunda sangat penting kerana banyak orang masih menggunakannya.

Namun begitu, bahasa Inggeris juga penting. Di Singapura, semua orang menggunakan bahasa Inggeris di sekolah dan di tempat kerja. Kalau kita tidak pandai bahasa Inggeris, susah untuk mendapat kerja. Oleh itu, bahasa Inggeris lebih penting daripada bahasa ibunda. Tetapi bahasa ibunda tetap penting juga.

Selain itu, generasi muda sekarang suka menggunakan media sosial. Mereka banyak menggunakan bahasa rojak dan singkatan. Ini tidak bagus kerana bahasa ibunda akan hilang. Kerajaan sudah membuat banyak kempen seperti Bulan Bahasa. Sekolah juga mengajar bahasa ibunda. Jadi masalah ini boleh diselesaikan.

Kesimpulannya, bahasa ibunda penting untuk identiti generasi muda. Kita harus menggunakan bahasa ibunda supaya bahasa itu tidak pupus. Semua pihak harus bekerjasama. Jika tidak, generasi muda akan lupa budaya sendiri dan ini amat menyedihkan.`;

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { user, loading, isTeacher } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f5f2]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!user || !isTeacher) {
    return <LoginScreen />;
  }

  return <Playground />;
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Password1');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleTeacherSignIn(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith('@ri.edu.sg')) {
      setMessage('Teacher email must end with @ri.edu.sg.');
      setLoading(false);
      return;
    }

    try {
      requireSupabaseConfig();
    } catch (error: any) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const firstAttempt = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (!firstAttempt.error) {
      setLoading(false);
      return;
    }

    const provisionResponse = await fetch('/api/teacher/provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });

    if (!provisionResponse.ok) {
      const body = await provisionResponse.json().catch(() => ({}));
      setMessage(body.error || firstAttempt.error.message);
      setLoading(false);
      return;
    }

    const secondAttempt = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (secondAttempt.error) {
      setMessage(secondAttempt.error.message);
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f4f5f2] flex items-center justify-center p-6">
      <section className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-lg bg-brand-500 text-white flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">MTL Playground</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Teacher Prompt Lab</p>
          </div>
        </div>

        <form onSubmit={handleTeacherSignIn} className="space-y-4">
          <input
            type="email"
            required
            placeholder="name@ri.edu.sg"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3.5 text-sm font-medium outline-none focus:bg-white focus:border-brand-500"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3.5 text-sm font-medium outline-none focus:bg-white focus:border-brand-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 text-white rounded-lg px-4 py-4 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log In'}
          </button>
          {message && (
            <p className="text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              {message}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}

function Playground() {
  const { user, signOut } = useAuth();
  const [essayTitle, setEssayTitle] = useState(DEFAULT_ESSAY_TITLE);
  const [essayDescription, setEssayDescription] = useState(DEFAULT_ESSAY_DESCRIPTION);
  const [writingText, setWritingText] = useState(DEFAULT_WRITING_TEXT);
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_PROMPT);
  const [contextLocked, setContextLocked] = useState(false);
  const [writingLocked, setWritingLocked] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [model, setModel] = useState('');
  const [runs, setRuns] = useState<PlaygroundRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const wordCount = useMemo(() => {
    return writingText.trim().split(/\s+/).filter(Boolean).length;
  }, [writingText]);

  useEffect(() => {
    loadRuns();
  }, []);

  async function getTeacherToken() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Please sign in again before continuing.');
    return token;
  }

  async function loadRuns() {
    setLoadingRuns(true);
    setErrorMessage('');

    try {
      const token = await getTeacherToken();
      const response = await fetch('/api/playground/runs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not load saved playground runs.');
      setRuns(body.runs || []);
    } catch (error: any) {
      setErrorMessage(error.message);
    }

    setLoadingRuns(false);
  }

  async function requestFeedback() {
    setErrorMessage('');
    setFeedback('');
    setModel('');
    setSelectedRunId(null);

    if (!essayTitle.trim() || !writingText.trim() || !aiPrompt.trim()) {
      setErrorMessage('Essay title, writing text, and AI prompt are required.');
      return;
    }

    setLoadingFeedback(true);

    try {
      const token = await getTeacherToken();
      const response = await fetch('/api/playground/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          essayTitle,
          essayDescription,
          writingText,
          aiPrompt,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not generate feedback.');

      const run = body.run as PlaygroundRun;
      setFeedback(run.feedback_text || '');
      setModel(run.model || '');
      setRuns(current => [run, ...current.filter(item => item.id !== run.id)].slice(0, 50));
      setSelectedRunId(run.id);
    } catch (error: any) {
      setErrorMessage(error.message);
    }

    setLoadingFeedback(false);
  }

  function loadRun(run: PlaygroundRun) {
    setEssayTitle(run.essay_title || '');
    setEssayDescription(run.essay_description || '');
    setWritingText(run.writing_text || '');
    setAiPrompt(run.ai_prompt || '');
    setFeedback(run.feedback_text || '');
    setModel(run.model || '');
    setSelectedRunId(run.id);
    setErrorMessage('');
  }

  return (
    <div className="min-h-screen bg-[#f4f5f2] text-slate-900 flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-brand-500 text-white flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-black uppercase tracking-tight truncate">MTL Feedback Playground</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-200 flex items-center gap-2 text-xs font-black uppercase tracking-widest"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </header>

      <main className="flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-0 overflow-hidden">
        <section className="p-4 md:p-6 overflow-y-auto">
          {errorMessage && (
            <div className="mb-4 bg-red-50 border border-red-100 text-red-700 rounded-lg px-4 py-3 text-sm font-semibold flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel
              number="01"
              title="Essay Context"
              action={
                <LockButton locked={contextLocked} onClick={() => setContextLocked(value => !value)} />
              }
            >
              <div className="space-y-3">
                <input
                  disabled={contextLocked}
                  value={essayTitle}
                  onChange={(event) => setEssayTitle(event.target.value)}
                  placeholder="Essay title"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-brand-500 disabled:bg-slate-100 disabled:text-slate-500"
                />
                <textarea
                  disabled={contextLocked}
                  value={essayDescription}
                  onChange={(event) => setEssayDescription(event.target.value)}
                  placeholder="Essay description or question details"
                  className="w-full min-h-[132px] resize-y rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:bg-white focus:border-brand-500 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>
            </Panel>

            <Panel
              number="02"
              title="Student Writing"
              action={
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{wordCount} words</span>
                  <LockButton locked={writingLocked} onClick={() => setWritingLocked(value => !value)} />
                </div>
              }
            >
              <textarea
                disabled={writingLocked}
                value={writingText}
                onChange={(event) => setWritingText(event.target.value)}
                placeholder="Paste the essay or paragraph to analyse"
                className="w-full min-h-[210px] resize-y rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:bg-white focus:border-brand-500 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </Panel>

            <Panel number="03" title="AI Prompt">
              <textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="Type the exact prompt to test with the AI"
                className="w-full min-h-[300px] resize-y rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[13px] leading-6 outline-none focus:bg-white focus:border-brand-500"
              />
              <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Saved after each generation
                </div>
                <button
                  type="button"
                  onClick={requestFeedback}
                  disabled={loadingFeedback}
                  className="h-11 px-5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest"
                >
                  {loadingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Request Feedback
                </button>
              </div>
            </Panel>

            <Panel
              number="04"
              title="AI Feedback"
              action={model ? <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{model}</span> : null}
            >
              <div className="min-h-[300px] max-h-[620px] overflow-y-auto feedback-scroll rounded-lg border border-slate-200 bg-white p-4">
                {loadingFeedback ? (
                  <div className="h-[260px] flex items-center justify-center text-slate-400">
                    <Loader2 className="w-7 h-7 animate-spin" />
                  </div>
                ) : feedback ? (
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-800">{feedback}</pre>
                ) : (
                  <div className="h-[260px] flex flex-col items-center justify-center text-center text-slate-400">
                    <FileText className="w-8 h-8 mb-3" />
                    <p className="text-sm font-semibold">Generated feedback will appear here.</p>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </section>

        <aside className="border-t xl:border-t-0 xl:border-l border-slate-200 bg-white p-4 md:p-5 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-brand-500" />
              <h2 className="text-sm font-black uppercase tracking-tight">Saved Runs</h2>
            </div>
            <button
              type="button"
              onClick={loadRuns}
              disabled={loadingRuns}
              className="h-8 px-3 rounded-lg border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-brand-300 disabled:opacity-60"
            >
              {loadingRuns ? 'Loading' : 'Refresh'}
            </button>
          </div>

          <div className="space-y-2">
            {runs.map(run => (
              <button
                type="button"
                key={run.id}
                onClick={() => loadRun(run)}
                className={[
                  "w-full text-left rounded-lg border p-3 transition-colors",
                  selectedRunId === run.id
                    ? "border-brand-300 bg-brand-50"
                    : "border-slate-200 bg-white hover:bg-slate-50",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-sm font-black truncate">{run.essay_title || 'Untitled'}</span>
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">#{run.id}</span>
                </div>
                <p className="line-clamp-2 text-xs leading-5 text-slate-500 mb-2">{run.ai_prompt}</p>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(run.created_at)}</span>
                </div>
              </button>
            ))}

            {!loadingRuns && runs.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-400">
                <History className="w-7 h-7 mx-auto mb-3" />
                <p className="text-sm font-semibold">No saved runs yet.</p>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function Panel({
  number,
  title,
  action,
  children,
}: {
  number: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 md:p-5 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[11px] font-black text-brand-500">{number}</span>
          <h2 className="text-sm font-black uppercase tracking-tight truncate">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function LockButton({ locked, onClick }: { locked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={locked ? 'Unlock input' : 'Lock input'}
      className={[
        "h-8 w-8 rounded-lg border flex items-center justify-center transition-colors",
        locked
          ? "border-brand-300 bg-brand-50 text-brand-700"
          : "border-slate-200 bg-white text-slate-400 hover:text-slate-700",
      ].join(" ")}
    >
      {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
    </button>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat('en-SG', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
