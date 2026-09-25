-- Emergency rollback of the Data API MFA pre-request gate.
-- The gate introduced a global PostgREST dependency that blocked normal LTG
-- application traffic when request-role EXECUTE privileges did not align with
-- PostgREST role switching.
--
-- MFA hardening must be reintroduced only after isolated staging regression
-- testing across Planner, Attendance, Time Clock, Gradebook, Classroom, and
-- owner/admin workflows.

begin;

alter role authenticator reset pgrst.db_pre_request;

update private.security_runtime_settings
set enabled = false
where setting_key = 'require_authenticated_aal2';

notify pgrst, 'reload config';

commit;
