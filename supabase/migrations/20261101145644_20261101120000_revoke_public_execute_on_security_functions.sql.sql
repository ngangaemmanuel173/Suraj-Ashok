/*
# Revoke public execute access on SECURITY DEFINER functions

## Purpose
The security advisor flagged that get_user_role(), handle_new_user(), and
protect_profile_privileges() are SECURITY DEFINER functions callable by the
anon and authenticated roles via the REST API. These are internal functions
(trigger functions + RLS helper) and should not be directly invoked by clients.

## Changes
1. Revoke EXECUTE on all three functions FROM PUBLIC, anon.
2. Revoke EXECUTE on handle_new_user() and protect_profile_privileges() FROM
   authenticated (trigger functions — only invoked by the database itself).
3. Keep EXECUTE on get_user_role() TO authenticated (RLS policies call it
   at the database level, but the grant is harmless and keeps the function
   available if needed).
*/

REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_privileges() FROM PUBLIC, anon, authenticated;