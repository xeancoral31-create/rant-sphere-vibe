-- Migration: Create soundtracks table and configure storage for admin uploads
-- Timestamp: 20260820000000

-- 1. Create the soundtracks table
CREATE TABLE IF NOT EXISTS public.soundtracks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  artist      text NOT NULL,
  genre       text NOT NULL DEFAULT '',
  category    text NOT NULL DEFAULT 'Admin Uploads',
  cover_url   text,
  audio_url   text NOT NULL,
  duration    text NOT NULL DEFAULT '0:00',
  uploader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.soundtracks ENABLE ROW LEVEL SECURITY;

-- 3. Any authenticated user can read soundtracks
CREATE POLICY "soundtracks_select_authenticated"
  ON public.soundtracks FOR SELECT
  TO authenticated
  USING (true);

-- 4. Only admins can insert soundtracks
CREATE POLICY "soundtracks_insert_admin"
  ON public.soundtracks FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Only admins can update soundtracks
CREATE POLICY "soundtracks_update_admin"
  ON public.soundtracks FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Only admins can delete soundtracks
CREATE POLICY "soundtracks_delete_admin"
  ON public.soundtracks FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Create a publicly readable storage bucket for soundtrack files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'soundtracks',
  'soundtracks',
  true,
  52428800, -- 50MB limit per file
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 8. Storage policy: anyone can read files (public bucket)
CREATE POLICY "soundtracks_storage_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'soundtracks');

-- 9. Storage policy: only admins can upload files
CREATE POLICY "soundtracks_storage_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'soundtracks'
    AND public.has_role(auth.uid(), 'admin')
  );

-- 10. Storage policy: only admins can delete files
CREATE POLICY "soundtracks_storage_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'soundtracks'
    AND public.has_role(auth.uid(), 'admin')
  );
