-- A função só deve rodar pelo gatilho de cadastro, nunca pela API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
