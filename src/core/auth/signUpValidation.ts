// Create account's field checks, one problem per field. Username
// availability is checked separately (live, against the server); this
// only covers what can be known locally.

// Loose on purpose — the emailed code is the real check. Mirrors the
// server's own pattern (internal/account).
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6;

export type SignUpErrors = {
  username?: 'required';
  email?: 'required' | 'invalid';
  password?: 'required' | 'too-short';
  confirmPassword?: 'required' | 'mismatch';
};

export function signUpErrors(form: { username: string; email: string; password: string; confirmPassword: string }): SignUpErrors {
  const errors: SignUpErrors = {};
  if (!form.username) errors.username = 'required';
  const email = form.email.trim();
  if (!email) errors.email = 'required';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'invalid';
  if (!form.password) errors.password = 'required';
  else if (form.password.length < MIN_PASSWORD_LENGTH) errors.password = 'too-short';
  if (!form.confirmPassword) errors.confirmPassword = 'required';
  else if (form.confirmPassword !== form.password) errors.confirmPassword = 'mismatch';
  return errors;
}
