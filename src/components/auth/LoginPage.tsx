import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { FinBridgeLogo } from '../ui/FinBridgeLogo';

const loginSchema = z.object({
  email: z.string().email('Enter a valid work email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const {
    signInWithGoogle,
    signInWithEmail,
    resetPassword,
    resendVerification,
    authError,
    unverifiedEmail,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [demoOpen, setDemoOpen] = useState(true);

  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    setFocus,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema) as never,
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    setVerificationSent(false);
    try {
      await signInWithEmail(values.email, values.password);
    } catch {
      // Error surfaced via authError in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleBusy(true);
    setVerificationSent(false);
    clearAuthError();
    try {
      await signInWithGoogle();
    } catch {
      // Error surfaced via authError in context
    } finally {
      setGoogleBusy(false);
    }
  };

  const openForgotMode = () => {
    clearAuthError();
    setResetError(null);
    setResetSentTo(null);
    setResetEmail(getValues('email') || '');
    setMode('forgot');
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = resetEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setResetError('Enter a valid work email address.');
      return;
    }
    setResetError(null);
    setResetSentTo(null);
    setResetBusy(true);
    try {
      await resetPassword(trimmed);
      setResetSentTo(trimmed);
    } catch {
      // Error surfaced via authError in context
    } finally {
      setResetBusy(false);
    }
  };

  const fillDemoEmail = (demoEmail: string) => {
    clearAuthError();
    setValue('email', demoEmail, { shouldValidate: true });
    if (mode !== 'login') setMode('login');
    setTimeout(() => setFocus('password'), 50);
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-[100dvh] bg-[#F6F8FB] grid lg:grid-cols-12">
      {/* Left Brand & Architectural Split */}
      <div className="hidden lg:flex lg:col-span-6 relative bg-[#0B1220] text-white overflow-hidden items-stretch">
        {!imgError ? (
          <img
            src="/src/assets/images/login_fintech_architecture_1795325977463.jpg"
            alt="FinBridge institutional architecture"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0B1220] to-blue-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060A12] via-[#0B1220]/75 to-[#0B1220]/60" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Distinctive FinBridge Brand Lockup */}
          <div className="flex items-center gap-3">
            <FinBridgeLogo size="lg" variant="dark" />
            <div>
              <span className="text-xl font-bold tracking-tight font-display block leading-none">
                FinBridge CRM
              </span>
              <span className="text-xs text-blue-300/90 font-medium mt-1 block">
                Loan Origination &amp; Call Operations
              </span>
            </div>
          </div>

          <div className="max-w-lg space-y-6">
            <h1 className="text-4xl font-semibold tracking-tight leading-[1.14] text-balance font-display">
              Loan origination and call centre execution in one unified workspace.
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Manage inbound borrower pipelines, distribute leads across 20+ sales specialists, verify KYC documentation, and track partner bank disbursements from first call to sanction.
            </p>

            {/* Minimalist Financial Origination Bridge Schematic */}
            <div className="rounded-2xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.10] p-4">
              <svg
                viewBox="0 0 460 74"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-auto"
                aria-hidden="true"
              >
                <path
                  d="M52 30 C115 10, 175 10, 230 30 C285 10, 345 10, 408 30"
                  stroke="url(#bridgeGrad)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                <defs>
                  <linearGradient id="bridgeGrad" x1="52" y1="30" x2="408" y2="30" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#60A5FA" />
                    <stop offset="0.5" stopColor="#34D399" />
                    <stop offset="1" stopColor="#93C5FD" />
                  </linearGradient>
                </defs>
                {/* Node 1: Lead Intake */}
                <rect x="8" y="16" width="96" height="44" rx="10" fill="#0F172A" fillOpacity="0.85" stroke="white" strokeOpacity="0.16" />
                <circle cx="24" cy="32" r="4" fill="#60A5FA" />
                <text x="34" y="35" fill="white" fontSize="10.5" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">Lead Intake</text>
                <text x="20" y="50" fill="#94A3B8" fontSize="9.5" fontFamily="DM Sans, sans-serif">AI Priority Score</text>

                {/* Node 2: KYC & Call Desk */}
                <rect x="182" y="16" width="96" height="44" rx="10" fill="#0F172A" fillOpacity="0.85" stroke="#34D399" strokeOpacity="0.35" />
                <circle cx="198" cy="32" r="4" fill="#34D399" />
                <text x="208" y="35" fill="white" fontSize="10.5" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">KYC Review</text>
                <text x="194" y="50" fill="#94A3B8" fontSize="9.5" fontFamily="DM Sans, sans-serif">Call &amp; Follow-up</text>

                {/* Node 3: Bank Sanction */}
                <rect x="356" y="16" width="96" height="44" rx="10" fill="#0F172A" fillOpacity="0.85" stroke="white" strokeOpacity="0.16" />
                <circle cx="372" cy="32" r="4" fill="#93C5FD" />
                <text x="382" y="35" fill="white" fontSize="10.5" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">Sanction</text>
                <text x="368" y="50" fill="#94A3B8" fontSize="9.5" fontFamily="DM Sans, sans-serif">Bank Disbursement</text>
              </svg>
            </div>

            <div className="grid grid-cols-3 pt-5 border-t border-white/15 divide-x divide-white/15">
              <div className="pr-5">
                <p className="text-2xl font-semibold font-display tabular-nums">100+</p>
                <p className="text-xs text-slate-300/90 mt-0.5">Active Lead Pipeline</p>
              </div>
              <div className="px-5">
                <p className="text-2xl font-semibold font-display tabular-nums">6 Banks</p>
                <p className="text-xs text-slate-300/90 mt-0.5">12 Loan Schemes</p>
              </div>
              <div className="pl-5">
                <p className="text-2xl font-semibold font-display tabular-nums">9 Stages</p>
                <p className="text-xs text-slate-300/90 mt-0.5">Underwriting Audit</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            FinBridge Financial Services · Role-Based Access Control
          </p>
        </div>
      </div>

      {/* Right Authentication Workspace */}
      <div className="lg:col-span-6 flex flex-col justify-between p-5 sm:p-10 lg:p-12">
        <div className="w-full max-w-md mx-auto my-auto space-y-5 py-4">
          {/* Mobile Brand Header */}
          <div className="lg:hidden flex items-center gap-3">
            <FinBridgeLogo size="md" variant="light" />
            <div>
              <span className="text-lg font-bold text-slate-900 font-display block leading-none">
                FinBridge CRM
              </span>
              <span className="text-xs text-slate-500 mt-1 block">
                Loan Origination &amp; Call Operations
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold font-display text-slate-900 tracking-tight">
              {mode === 'login' ? 'Sign in to your workspace' : 'Reset your password'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {mode === 'login'
                ? 'Access the Admin Console, Mobile Admin, or Staff Call Centre Portal.'
                : 'Enter your registered work email and we will send a Firebase password recovery link.'}
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/90 text-xs text-rose-800 leading-relaxed space-y-2"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
              {unverifiedEmail && (
                <div className="pl-6">
                  {verificationSent ? (
                    <span className="text-emerald-700 font-medium">
                      Verification link dispatched to {unverifiedEmail}.
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await resendVerification();
                        setVerificationSent(true);
                      }}
                      className="font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2"
                    >
                      Resend verification email
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Refined Auth Card */}
          <div className="bg-white border border-slate-200/95 ring-1 ring-slate-950/[0.03] rounded-2xl p-6 sm:p-7 shadow-[0_14px_40px_-10px_rgba(15,23,42,0.10),0_2px_8px_-2px_rgba(15,23,42,0.04)] space-y-5">
            {mode === 'login' ? (
              <>
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={googleBusy}
                  className="w-full min-h-[44px] flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200/95 bg-white text-slate-800 text-sm font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  {googleBusy ? 'Connecting to Google...' : 'Continue with Google'}
                </button>

                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="px-3 text-xs font-medium text-slate-500">or sign in with work email</span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="login-email">
                      Work Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        placeholder="name@loancrm.com"
                        {...register('email', {
                          onChange: () => {
                            if (authError) clearAuthError();
                          },
                        })}
                        className="crm-input pl-9 min-h-[44px] text-base sm:text-sm"
                      />
                    </div>
                    {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700" htmlFor="login-password">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={openForgotMode}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        {...register('password', {
                          onChange: () => {
                            if (authError) clearAuthError();
                          },
                        })}
                        className="crm-input pl-9 pr-10 min-h-[44px] text-base sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-rose-600 mt-1">{errors.password.message}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-[0_2px_6px_rgba(37,99,235,0.28)] hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
              </>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600 pb-2 border-b border-slate-100">
                  <KeyRound className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Password Recovery via Firebase Authentication</span>
                </div>

                {resetSentTo && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      Recovery instructions sent to <strong>{resetSentTo}</strong>. Check your inbox and spam folder, then sign in with your new password.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="reset-email">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        if (resetError) setResetError(null);
                        if (authError) clearAuthError();
                      }}
                      placeholder="name@loancrm.com"
                      className="crm-input pl-9 min-h-[44px] text-base sm:text-sm"
                    />
                  </div>
                  {resetError && <p className="text-xs text-rose-600 mt-1">{resetError}</p>}
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      clearAuthError();
                      setResetError(null);
                      setMode('login');
                    }}
                    className="crm-btn-secondary min-h-[44px] px-4"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={resetBusy}
                    className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {resetBusy ? 'Sending link...' : 'Send Recovery Link'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Evaluator & Demo Access Guide */}
          <div className="bg-white/80 border border-slate-200/85 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setDemoOpen((o) => !o)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Interview Evaluator &amp; Demo Access</span>
              </span>
              {demoOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {demoOpen && (
              <div className="px-4 pb-3.5 pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-2.5">
                <p className="leading-relaxed">
                  <strong className="text-slate-800">Google OAuth (Recommended):</strong>{' '}
                  <span className="font-mono text-[11px] text-slate-700">b03328764@gmail.com</span> grants Admin Console access (with built-in Staff Portal switcher). Any other verified Google account opens the scoped Staff Portal.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500">
                    Email/Password quick-fill (if enabled in Firebase Auth):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fillDemoEmail('admin@loancrm.com')}
                      className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      Fill Admin Email
                    </button>
                    <button
                      type="button"
                      onClick={() => fillDemoEmail('staff@loancrm.com')}
                      className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      Fill Staff Email
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Minimalist Copyright & Company Branding Footer */}
        <footer className="w-full max-w-md mx-auto pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>&copy; {currentYear} FinBridge Financial Services Pvt. Ltd.</span>
          <span>All rights reserved</span>
        </footer>
      </div>
    </div>
  );
}
