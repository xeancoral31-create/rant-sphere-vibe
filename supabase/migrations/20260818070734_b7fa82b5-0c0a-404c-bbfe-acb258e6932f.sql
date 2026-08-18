DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_mutual') THEN
    REVOKE ALL ON FUNCTION public.is_mutual(uuid, uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.is_mutual(uuid, uuid) TO authenticated, service_role;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_view_author') THEN
    REVOKE ALL ON FUNCTION public.can_view_author(uuid, uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.can_view_author(uuid, uuid) TO authenticated, service_role;
  END IF;
END $$;