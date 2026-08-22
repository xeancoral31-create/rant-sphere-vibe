-- ============================================================
-- POST LOCATION SUPPORT MIGRATION
-- Adds optional location fields to posts table
-- ============================================================

-- Add location columns to posts table (all nullable — location is optional)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS formatted_address TEXT,
  ADD COLUMN IF NOT EXISTS location_privacy TEXT NOT NULL DEFAULT 'public'
    CHECK (location_privacy IN ('public', 'approximate', 'private'));

-- Index for geo queries (posts near a location)
CREATE INDEX IF NOT EXISTS idx_posts_location
  ON public.posts(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Validation constraint: if latitude is set, longitude must also be set
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_location_coords_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_location_coords_check
    CHECK (
      (latitude IS NULL AND longitude IS NULL) OR
      (latitude IS NOT NULL AND longitude IS NOT NULL
        AND latitude BETWEEN -90 AND 90
        AND longitude BETWEEN -180 AND 180)
    );

-- Add group_location JSONB for optional group/community meeting location
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS group_location JSONB;

-- Enable realtime on posts for location updates (already enabled but ensure it)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
