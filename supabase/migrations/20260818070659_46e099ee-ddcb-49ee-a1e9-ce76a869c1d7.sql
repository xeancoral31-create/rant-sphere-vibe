-- 1. follow request states
DO $$ BEGIN
  CREATE TYPE public.follow_status AS ENUM ('pending','accepted','declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS status public.follow_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.follows SET status = 'accepted' WHERE status = 'pending';

DROP POLICY IF EXISTS follows_delete_self ON public.follows;
DO $$ BEGIN
  CREATE POLICY follows_delete_either ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS follows_update_target ON public.follows;
DO $$ BEGIN
  CREATE POLICY follows_update_target ON public.follows FOR UPDATE TO authenticated
  USING (auth.uid() = following_id) WITH CHECK (auth.uid() = following_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. mutual connection helper
CREATE OR REPLACE FUNCTION public.is_mutual(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows f1
    JOIN public.follows f2
      ON f2.follower_id = f1.following_id AND f2.following_id = f1.follower_id
    WHERE f1.follower_id = _a AND f1.following_id = _b
      AND f1.status = 'accepted' AND f2.status = 'accepted'
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_author(_viewer uuid, _author uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer = _author
     OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _author AND p.is_private = false)
     OR public.is_mutual(_viewer, _author)
$$;

-- 3. post visibility enforced in the database
DROP POLICY IF EXISTS posts_select_all ON public.posts;
DO $$ BEGIN
  CREATE POLICY posts_select_visible ON public.posts FOR SELECT TO authenticated
  USING (
    auth.uid() = author_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.can_view_author(auth.uid(), author_id)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. per-account settings
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_visibility text NOT NULL DEFAULT 'public',
  post_default_audience text NOT NULL DEFAULT 'followers',
  show_followers boolean NOT NULL DEFAULT true,
  allow_messages_from text NOT NULL DEFAULT 'everyone',
  allow_tagging boolean NOT NULL DEFAULT true,
  searchable boolean NOT NULL DEFAULT true,
  notify_likes boolean NOT NULL DEFAULT true,
  notify_comments boolean NOT NULL DEFAULT true,
  notify_follows boolean NOT NULL DEFAULT true,
  notify_messages boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'en',
  region text NOT NULL DEFAULT 'PH',
  theme text NOT NULL DEFAULT 'dark',
  reduce_motion boolean NOT NULL DEFAULT false,
  larger_text boolean NOT NULL DEFAULT false,
  high_contrast boolean NOT NULL DEFAULT false,
  autoplay_video boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_own ON public.user_settings;
DO $$ BEGIN
  CREATE POLICY user_settings_own ON public.user_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS user_settings_touch ON public.user_settings;
DO $$ BEGIN
  CREATE TRIGGER user_settings_touch BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. exactly one admin account
CREATE UNIQUE INDEX IF NOT EXISTS one_admin_only
  ON public.user_roles ((role)) WHERE role = 'admin';