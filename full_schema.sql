
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.post_type AS ENUM ('text', 'image', 'video', 'poll');
CREATE TYPE public.notification_type AS ENUM ('like', 'comment', 'follow', 'mention', 'reply', 'share', 'story_view', 'message');
CREATE TYPE public.report_status AS ENUM ('pending', 'resolved', 'dismissed');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  post_type public.post_type NOT NULL DEFAULT 'text',
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  poll_options JSONB,
  reposted_from UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_posts_author ON public.posts(author_id);
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_comments_post ON public.comments(post_id);

-- Reactions
CREATE TABLE public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, reaction)
);
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Follows
CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Stories (MyDay)
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  background TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.story_views (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read, created_at DESC);

-- Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN NOT NULL DEFAULT false,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Helper for messaging RLS to avoid recursion
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conv_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = _conv_id AND user_id = _user_id)
$$;

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at);

-- Hashtags
CREATE TABLE public.hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.post_hashtags (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status public.report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- profiles: public read, self update
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "roles_select_self_or_admin" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- posts
CREATE POLICY "posts_select_all" ON public.posts FOR SELECT USING (true);
CREATE POLICY "posts_insert_self" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_update_self" ON public.posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "posts_delete_self_or_admin" ON public.posts FOR DELETE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- comments
CREATE POLICY "comments_select_all" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_self" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_delete_self_or_admin" ON public.comments FOR DELETE USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- reactions
CREATE POLICY "reactions_select_all" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert_self" ON public.reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete_self" ON public.reactions FOR DELETE USING (auth.uid() = user_id);

-- follows
CREATE POLICY "follows_select_all" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_self" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_self" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- stories
CREATE POLICY "stories_select_active" ON public.stories FOR SELECT USING (expires_at > now() OR auth.uid() = author_id);
CREATE POLICY "stories_insert_self" ON public.stories FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "stories_delete_self" ON public.stories FOR DELETE USING (auth.uid() = author_id);

-- story_views
CREATE POLICY "story_views_select_owner_or_viewer" ON public.story_views FOR SELECT USING (
  auth.uid() = viewer_id OR auth.uid() IN (SELECT author_id FROM public.stories WHERE id = story_id)
);
CREATE POLICY "story_views_insert_self" ON public.story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- notifications
CREATE POLICY "notifications_select_self" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_authed" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = actor_id);
CREATE POLICY "notifications_update_self" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_delete_self" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- conversations
CREATE POLICY "conv_select_participant" ON public.conversations FOR SELECT USING (public.is_conversation_participant(id, auth.uid()));
CREATE POLICY "conv_insert_authed" ON public.conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- conversation_participants
CREATE POLICY "cp_select_participant" ON public.conversation_participants FOR SELECT USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "cp_insert_authed" ON public.conversation_participants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- messages
CREATE POLICY "msg_select_participant" ON public.messages FOR SELECT USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "msg_insert_participant" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "msg_update_self" ON public.messages FOR UPDATE USING (auth.uid() = sender_id);

-- hashtags
CREATE POLICY "hashtags_select_all" ON public.hashtags FOR SELECT USING (true);
CREATE POLICY "hashtags_insert_authed" ON public.hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "ph_select_all" ON public.post_hashtags FOR SELECT USING (true);
CREATE POLICY "ph_insert_authed" ON public.post_hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- reports
CREATE POLICY "reports_insert_self" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_select_admin" ON public.reports FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator') OR auth.uid() = reporter_id);
CREATE POLICY "reports_update_admin" ON public.reports FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_username TEXT;
BEGIN
  new_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1) || '_' || substring(NEW.id::text, 1, 6)
  );
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    new_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', new_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER conv_touch BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;

-- Storage buckets for media
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('covers', 'covers', true),
  ('posts', 'posts', true),
  ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "media_public_read" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars','covers','posts','stories'));
CREATE POLICY "media_authed_upload" ON storage.objects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND bucket_id IN ('avatars','covers','posts','stories'));
CREATE POLICY "media_owner_update" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "media_owner_delete" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS ai_score real;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS ai_flags jsonb;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS ai_score real;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS ai_flags jsonb;

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  option_index int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pv_select_all ON public.poll_votes;
DROP POLICY IF EXISTS pv_insert_self ON public.poll_votes;
DROP POLICY IF EXISTS pv_delete_self ON public.poll_votes;
CREATE POLICY pv_select_all ON public.poll_votes FOR SELECT USING (true);
CREATE POLICY pv_insert_self ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY pv_delete_self ON public.poll_votes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.bookmarks (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bm_select_self ON public.bookmarks;
DROP POLICY IF EXISTS bm_insert_self ON public.bookmarks;
DROP POLICY IF EXISTS bm_delete_self ON public.bookmarks;
CREATE POLICY bm_select_self ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY bm_insert_self ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY bm_delete_self ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hashtags_tag_unique') THEN
    ALTER TABLE public.hashtags ADD CONSTRAINT hashtags_tag_unique UNIQUE (tag);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.extract_hashtags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tag_match text;
  tag_id uuid;
BEGIN
  IF NEW.content IS NULL THEN RETURN NEW; END IF;
  FOR tag_match IN
    SELECT DISTINCT lower(substring(m[1] from 2))
    FROM regexp_matches(NEW.content, '(#[A-Za-z0-9_]{2,40})', 'g') AS m
  LOOP
    INSERT INTO public.hashtags (tag) VALUES (tag_match)
      ON CONFLICT (tag) DO NOTHING;
    SELECT id INTO tag_id FROM public.hashtags WHERE tag = tag_match;
    INSERT INTO public.post_hashtags (post_id, hashtag_id)
      VALUES (NEW.id, tag_id) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_extract_hashtags ON public.posts;
CREATE TRIGGER trg_extract_hashtags
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.extract_hashtags();

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-stories') THEN
    PERFORM cron.unschedule('cleanup-expired-stories');
  END IF;
END $$;
SELECT cron.schedule(
  'cleanup-expired-stories',
  '0 * * * *',
  $$ DELETE FROM public.stories WHERE expires_at < now(); $$
);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

REVOKE EXECUTE ON FUNCTION public.extract_hashtags() FROM PUBLIC, anon, authenticated;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_note text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_key ON public.profiles (phone) WHERE phone IS NOT NULL;

-- Only ONE admin account may ever exist
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_admin ON public.user_roles ((role)) WHERE role = 'admin';

-- Nobody can self-assign roles from the app: revoke write access
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks" ON public.blocks FOR ALL TO authenticated
  USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

CREATE TABLE IF NOT EXISTS public.mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (muter_id, muted_id)
);
GRANT SELECT, INSERT, DELETE ON public.mutes TO authenticated;
GRANT ALL ON public.mutes TO service_role;
ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mutes" ON public.mutes FOR ALL TO authenticated
  USING (auth.uid() = muter_id) WITH CHECK (auth.uid() = muter_id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated, anon;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads settings" ON public.platform_settings FOR SELECT USING (true);

INSERT INTO public.platform_settings (key, value) VALUES
  ('blocked_words', '["slur1","slur2"]'::jsonb),
  ('announcement', '{"active":false,"text":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Admins can moderate content
CREATE POLICY "admins manage posts" ON public.posts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage reports" ON public.reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage comments" ON public.comments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- 1. follow request states
DO $$ BEGIN
  CREATE TYPE public.follow_status AS ENUM ('pending','accepted','declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS status public.follow_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.follows SET status = 'accepted' WHERE status = 'pending';

DROP POLICY IF EXISTS follows_delete_self ON public.follows;
CREATE POLICY follows_delete_either ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

DROP POLICY IF EXISTS follows_update_target ON public.follows;
CREATE POLICY follows_update_target ON public.follows FOR UPDATE TO authenticated
  USING (auth.uid() = following_id) WITH CHECK (auth.uid() = following_id);

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
CREATE POLICY posts_select_visible ON public.posts FOR SELECT TO authenticated
  USING (
    auth.uid() = author_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.can_view_author(auth.uid(), author_id)
  );

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
CREATE POLICY user_settings_own ON public.user_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_settings_touch ON public.user_settings;
CREATE TRIGGER user_settings_touch BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. exactly one admin account
CREATE UNIQUE INDEX IF NOT EXISTS one_admin_only
  ON public.user_roles ((role)) WHERE role = 'admin';
REVOKE ALL ON FUNCTION public.is_mutual(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_author(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_mutual(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_author(uuid, uuid) TO authenticated, service_role;
-- Create Enum for Call Types
CREATE TYPE call_type AS ENUM ('voice', 'video');

-- Create Enum for Call Status
CREATE TYPE call_status AS ENUM (
    'calling',
    'ringing',
    'accepted',
    'connecting',
    'connected',
    'declined',
    'missed',
    'ended',
    'failed'
);

-- Create Calls Table
CREATE TABLE IF NOT EXISTS public.calls (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    caller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type call_type NOT NULL,
    status call_status NOT NULL DEFAULT 'calling',
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    duration interval,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT calls_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Policies for calls
CREATE POLICY "Users can view their own calls"
    ON public.calls
    FOR SELECT
    USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create calls"
    ON public.calls
    FOR INSERT
    WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update their own calls"
    ON public.calls
    FOR UPDATE
    USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.calls
    FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');

-- Enable Realtime for calls and messages
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
