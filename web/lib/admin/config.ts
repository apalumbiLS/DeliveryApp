/**
 * Whether the admin console can do its job.
 *
 * User creation and the directory both go through `auth.admin.*`, which needs
 * the secret key. Route-group code checks this and renders a notice rather than
 * importing the secret-key module directly — see
 * docs/architecture/10-auth-and-permissions.md#service-role-usage.
 */
export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
  );
}
