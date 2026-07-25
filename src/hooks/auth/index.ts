// Central export for all auth hooks
export { useAuth } from './useAuth';
export type { UseAuthReturn } from './useAuth';

export { useLogin, useLoginWithPasskey } from './useLogin';

export { useSignInWithGithub, useGithubSignInNotice } from './useGithubSignIn';

export { useLogout, useLogoutAll } from './useLogout';

export { useChangePassword } from './useChangePassword';

export { useSessions } from './useSessions';
export type { UseSessionsReturn } from './useSessions';

export { useRegister } from './useRegister';

export { usePasskeys, useAddPasskey, useDeletePasskey } from './usePasskeys';

export {
  useLinkedGithubAccount,
  useConnectGithub,
  useDisconnectGithub,
} from './useGithubAccount';

export {
  useRequestPasswordReset,
  useResetPassword,
  useResendVerificationEmail,
  useVerifyEmail,
} from './usePasswordReset';

// Re-export defaults
export { default as useAuthDefault } from './useAuth';
export { default as useLoginDefault } from './useLogin';
export { default as useRegisterDefault } from './useRegister';
export { default as useLogoutDefault } from './useLogout';
