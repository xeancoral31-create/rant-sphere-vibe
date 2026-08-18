
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
DO $$ BEGIN
  CREATE POLICY pv_select_all ON public.poll_votes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY pv_insert_self ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY pv_delete_self ON public.poll_votes FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
DO $$ BEGIN
  CREATE POLICY bm_select_self ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bm_insert_self ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bm_delete_self ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
