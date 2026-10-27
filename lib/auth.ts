/**
 * Length of the one-time codes Supabase emails. Must match Supabase → Authentication →
 * Providers → Email → "Email OTP Length"; the login boxes and the email hook read it.
 */
export const OTP_LENGTH = 6;
