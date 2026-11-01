import { useState, useEffect, CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { PortalConfig, PORTALS } from '@/lib/portals';
import { Lock, Mail, User, Building, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export function AuthPage({ portal }: { portal?: PortalConfig }) {
  const [activePortal, setActivePortal] = useState<PortalConfig>(portal ?? PORTALS.master);
  const { showToast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [subAccount, setSubAccount] = useState('mcl');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const p = activePortal;
  const isMasterPortal = p.slug === 'master';
  const accentVars = { '--accent': p.color } as CSSProperties;
  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-[color:var(--accent)]';

  // 1. Capture token, set session, and dynamically switch to the user's specific sub-account portal
  useEffect(() => {
    const handleRecovery = async () => {
      const hash = window.location.hash;
      if (hash.includes('access_token')) {
        setIsRecoveryMode(true);
        
        const params = new URLSearchParams(hash.replace('#', ''));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!error && data.user) {
            // Fetch user's profile to see which sub-account they belong to
            const { data: profile } = await supabase
              .from('profiles')
              .select('sub_account')
              .eq('id', data.user.id)
              .single();

            if (profile && profile.sub_account) {
              const matchedPortal = Object.values(PORTALS).find(
                (portalObj) => portalObj.slug === profile.sub_account
              );
              if (matchedPortal) {
                setActivePortal(matchedPortal);
              }
            }
          }
          // Clean hash so it doesn't loop
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    };

    handleRecovery();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setErrorMsg('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const switchMode = (signUp: boolean) => {
    setIsSignUp(signUp);
    setIsForgotPassword(false);
    setIsRecoveryMode(false);
    setErrorMsg('');
    setResetSent(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });

      if (error) throw error;

      setResetSent(true);
      showToast('Password reset instructions sent to your email!', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to send reset email';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      showToast('Password updated successfully! You can now sign in.', 'success');
      setIsRecoveryMode(false);
      setNewPassword('');
    } catch (err: any) {
      const msg = err?.message || 'Failed to update password';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              sub_account: isMasterPortal ? subAccount : p.slug,
              role: 'employee',
            },
          },
        });
        if (error) throw error;
        showToast('Account created successfully! You can now sign in.', 'success');
        setIsSignUp(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('sub_account, role')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          throw new Error('Unable to verify account credentials. Please try again.');
        }

        const userSubAccount = profile.sub_account as string;
        const portalSlug = p.slug;

        if (portalSlug === 'master' && userSubAccount !== 'master') {
          await supabase.auth.signOut();
          throw new Error(
            'Invalid credentials for this portal. Please sign in through your correct portal.'
          );
        }

        if (portalSlug !== 'master' && userSubAccount !== portalSlug) {
          await supabase.auth.signOut();
          throw new Error(
            'Invalid credentials for this portal. Please sign in through your correct portal.'
          );
        }

        showToast('Signed in successfully!', 'success');
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 animate-fade-in"
      style={{ background: p.colorDark, ...accentVars }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-8 py-9 text-center text-white" style={{ background: p.color }}>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg overflow-hidden p-1">
            <img src="/sal-logo.jpeg" alt="Suraj Ashok Limited" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">{p.fullName}</h1>
          <p className="mt-1 text-sm text-white/70">Fleet Management System</p>
        </div>

        <div className="space-y-5 p-8">
          {!isForgotPassword && !isRecoveryMode && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchMode(false)}
                className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                  !isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode(true)}
                className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                  isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* RECOVERY MODE: Dynamic Sub-Account Recovery Theme */}
          {isRecoveryMode ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-900">Set New Password</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter your new password below for your <strong>{p.fullName}</strong> account.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className={`${inputClass} pr-10`}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-3 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: p.color }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          ) : isForgotPassword ? (
            /* FORGOT PASSWORD FORM */
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-900">Reset Password</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter your email address and we&apos;ll send you instructions to reset your password.
                </p>
              </div>

              {resetSent ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-xs text-green-700">
                  Password recovery instructions have been sent to <strong>{email}</strong>. Check your inbox!
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      className={inputClass}
                      placeholder="name@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMsg}
                </div>
              )}

              {!resetSent && (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg py-3 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: p.color }}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setErrorMsg('');
                  setResetSent(false);
                }}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors pt-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </button>
            </form>
          ) : (
            /* STANDARD SIGN IN / SIGN UP FORM */
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      className={inputClass}
                      placeholder="John Doe"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {isSignUp && isMasterPortal && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Sub-Account / Portal</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      className={inputClass}
                      value={subAccount}
                      onChange={e => setSubAccount(e.target.value)}
                    >
                      <option value="master">MASTER</option>
                      <option value="mcl">MCL</option>
                      <option value="tarmal">TARMAL</option>
                      <option value="csl">CSL</option>
                      <option value="pn_mashru">PN_MASHRU</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    className={inputClass}
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setErrorMsg('');
                      }}
                      className="text-xs font-medium text-slate-500 hover:text-[color:var(--accent)] transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    className={`${inputClass} pr-10`}
                    placeholder="Your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-3 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: p.color }}
              >
                {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
