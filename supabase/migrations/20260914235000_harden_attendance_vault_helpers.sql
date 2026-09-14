-- Final SECURITY DEFINER search-path hardening for service-only attendance
-- worker Vault helpers. Both functions explicitly reference vault.decrypted_secrets.
-- Execute grants remain service_role-only.

alter function public.get_attendance_worker_config()
  set search_path = '';

alter function public.verify_attendance_worker_secret(text)
  set search_path = '';
