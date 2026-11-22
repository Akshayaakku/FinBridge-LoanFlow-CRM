import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { Modal } from './Primitives';

const passwordSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function PasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { userProfile, hasPasswordProvider, setAccountPassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema) as never,
  });

  const handleClose = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    reset();
    onClose();
  };

  const onSubmit = async (values: PasswordFormValues) => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await setAccountPassword(values.password);
      setSuccessMsg(
        `Login password saved for ${userProfile?.email}. You can now sign in with either Google or Email & Password.`
      );
      reset();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      maxWidth="max-w-md"
      title={hasPasswordProvider ? 'Update Login Password' : 'Set Login Password'}
      subtitle={userProfile?.email ? `Account: ${userProfile.email}` : undefined}
    >
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5 leading-relaxed">
          <KeyRound className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            {hasPasswordProvider
              ? 'Update the password linked to your FinBridge account without waiting for a reset email.'
              : 'Link an Email & Password credential directly to your verified Google account so you can sign in with email and password too.'}
          </span>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="acct-new-password">
              New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="acct-new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                {...register('password')}
                className="crm-input pl-9 pr-10 min-h-[42px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-500 hover:text-slate-800"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-rose-600 mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="acct-confirm-password">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="acct-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                {...register('confirmPassword')}
                className="crm-input pl-9 min-h-[42px]"
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-rose-600 mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button type="button" onClick={handleClose} className="crm-btn-secondary">
              Close
            </button>
            <button type="submit" disabled={saving} className="crm-btn-primary">
              {saving ? 'Saving...' : hasPasswordProvider ? 'Update Password' : 'Save Password'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
