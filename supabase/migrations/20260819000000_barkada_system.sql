-- ============================================================
-- BARKADA / FRIEND GROUP SYSTEM MIGRATION
-- ============================================================

-- ---- ENUMS ----
DO $$ BEGIN
  CREATE TYPE public.friend_request_status AS ENUM ('pending','accepted','declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.group_member_role AS ENUM ('owner','admin','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_type AS ENUM (
    'text','image','video','audio','file','location','live_location',
    'shared_post','shared_reel','music','poll','system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.group_activity_type AS ENUM (
    'member_joined','member_left','member_removed','member_promoted','member_demoted',
    'group_created','group_updated','message_pinned','location_shared',
    'location_stopped','photo_shared','video_shared','poll_created','reel_shared'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- FRIEND REQUESTS ----
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.friend_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id),
  CHECK (sender_id <> receiver_id)
);
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fr_receiver ON public.friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_fr_sender ON public.friend_requests(sender_id, status);

DROP POLICY IF EXISTS fr_select ON public.friend_requests;
CREATE POLICY fr_select ON public.friend_requests FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
DROP POLICY IF EXISTS fr_insert ON public.friend_requests;
CREATE POLICY fr_insert ON public.friend_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS fr_update ON public.friend_requests;
CREATE POLICY fr_update ON public.friend_requests FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);
DROP POLICY IF EXISTS fr_delete ON public.friend_requests;
CREATE POLICY fr_delete ON public.friend_requests FOR DELETE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;

-- ---- FRIENDSHIPS ----
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id_1, user_id_2),
  CHECK (user_id_1 < user_id_2)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fs_user1 ON public.friendships(user_id_1);
CREATE INDEX IF NOT EXISTS idx_fs_user2 ON public.friendships(user_id_2);

DROP POLICY IF EXISTS fs_select ON public.friendships;
CREATE POLICY fs_select ON public.friendships FOR SELECT USING (true);
DROP POLICY IF EXISTS fs_insert ON public.friendships;
CREATE POLICY fs_insert ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);
DROP POLICY IF EXISTS fs_delete ON public.friendships;
CREATE POLICY fs_delete ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

GRANT SELECT, INSERT, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

-- Helper function: check if two users are friends
CREATE OR REPLACE FUNCTION public.are_friends(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (user_id_1 = LEAST(_a,_b) AND user_id_2 = GREATEST(_a,_b))
  )
$$;
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO authenticated, service_role;

-- ---- EXTEND CONVERSATIONS FOR BARKADA ----
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_barkada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ---- EXTEND CONVERSATION PARTICIPANTS ----
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS role public.group_member_role NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- Update RLS for conv insert to allow barkada creation
DROP POLICY IF EXISTS conv_update_participant ON public.conversations;
CREATE POLICY conv_update_participant ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()));

DROP POLICY IF EXISTS cp_delete_self ON public.conversation_participants;
CREATE POLICY cp_delete_self ON public.conversation_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS cp_update_self ON public.conversation_participants;
CREATE POLICY cp_update_self ON public.conversation_participants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

GRANT UPDATE ON public.conversations TO authenticated;
GRANT UPDATE, DELETE ON public.conversation_participants TO authenticated;

-- ---- EXTEND MESSAGES ----
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type public.message_type NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS client_id TEXT,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_id ON public.messages(client_id) WHERE client_id IS NOT NULL;
GRANT INSERT, UPDATE ON public.messages TO authenticated;

-- ---- MESSAGE ATTACHMENTS ----
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  mime_type TEXT,
  file_name TEXT,
  size_bytes BIGINT,
  width INT,
  height INT,
  duration_seconds INT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ma_select ON public.message_attachments;
CREATE POLICY ma_select ON public.message_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND public.is_conversation_participant(m.conversation_id, auth.uid())
    )
  );
DROP POLICY IF EXISTS ma_insert ON public.message_attachments;
CREATE POLICY ma_insert ON public.message_attachments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND m.sender_id = auth.uid()
    )
  );
GRANT SELECT, INSERT, DELETE ON public.message_attachments TO authenticated;
GRANT ALL ON public.message_attachments TO service_role;

-- ---- MESSAGE REACTIONS ----
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mr_select ON public.message_reactions;
CREATE POLICY mr_select ON public.message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND public.is_conversation_participant(m.conversation_id, auth.uid())
    )
  );
DROP POLICY IF EXISTS mr_insert ON public.message_reactions;
CREATE POLICY mr_insert ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS mr_delete ON public.message_reactions;
CREATE POLICY mr_delete ON public.message_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

-- ---- PINNED MESSAGES ----
CREATE TABLE IF NOT EXISTS public.pinned_messages (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, message_id)
);
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pm_select ON public.pinned_messages;
CREATE POLICY pm_select ON public.pinned_messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
DROP POLICY IF EXISTS pm_insert ON public.pinned_messages;
CREATE POLICY pm_insert ON public.pinned_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));
DROP POLICY IF EXISTS pm_delete ON public.pinned_messages;
CREATE POLICY pm_delete ON public.pinned_messages FOR DELETE TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
GRANT SELECT, INSERT, DELETE ON public.pinned_messages TO authenticated;
GRANT ALL ON public.pinned_messages TO service_role;

-- ---- LOCATION SHARING SESSIONS ----
CREATE TABLE IF NOT EXISTS public.location_sharing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy REAL,
  heading REAL,
  speed REAL,
  is_live BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, conversation_id, is_active)
);
ALTER TABLE public.location_sharing_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lss_conv ON public.location_sharing_sessions(conversation_id, is_active);
CREATE INDEX IF NOT EXISTS idx_lss_user ON public.location_sharing_sessions(user_id, is_active);

DROP POLICY IF EXISTS lss_select ON public.location_sharing_sessions;
CREATE POLICY lss_select ON public.location_sharing_sessions FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
DROP POLICY IF EXISTS lss_insert ON public.location_sharing_sessions;
CREATE POLICY lss_insert ON public.location_sharing_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_conversation_participant(conversation_id, auth.uid()));
DROP POLICY IF EXISTS lss_update ON public.location_sharing_sessions;
CREATE POLICY lss_update ON public.location_sharing_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS lss_delete ON public.location_sharing_sessions;
CREATE POLICY lss_delete ON public.location_sharing_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_sharing_sessions TO authenticated;
GRANT ALL ON public.location_sharing_sessions TO service_role;

-- Auto-expire stale location sessions via cron (if pg_cron available)
DO $$ BEGIN
  PERFORM cron.schedule(
    'cleanup-expired-locations',
    '*/5 * * * *',
    $cron$ UPDATE public.location_sharing_sessions SET is_active = false WHERE is_active = true AND expires_at IS NOT NULL AND expires_at < now(); $cron$
  );
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ---- TRUSTED CONTACTS ----
CREATE TABLE IF NOT EXISTS public.trusted_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trusted_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_on_emergency BOOLEAN NOT NULL DEFAULT true,
  phone_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, trusted_user_id),
  CHECK (user_id <> trusted_user_id)
);
ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tc_own ON public.trusted_contacts;
CREATE POLICY tc_own ON public.trusted_contacts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_contacts TO authenticated;
GRANT ALL ON public.trusted_contacts TO service_role;

-- ---- GROUP ACTIVITY FEED ----
CREATE TABLE IF NOT EXISTS public.group_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_type public.group_activity_type NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.group_activity ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ga_conv ON public.group_activity(conversation_id, created_at DESC);
DROP POLICY IF EXISTS ga_select ON public.group_activity;
CREATE POLICY ga_select ON public.group_activity FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
DROP POLICY IF EXISTS ga_insert ON public.group_activity;
CREATE POLICY ga_insert ON public.group_activity FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));
GRANT SELECT, INSERT ON public.group_activity TO authenticated;
GRANT ALL ON public.group_activity TO service_role;

-- ---- GROUP POLLS ----
CREATE TABLE IF NOT EXISTS public.group_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  allow_multiple BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.group_polls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gp_select ON public.group_polls;
CREATE POLICY gp_select ON public.group_polls FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
DROP POLICY IF EXISTS gp_insert ON public.group_polls;
CREATE POLICY gp_insert ON public.group_polls FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id AND public.is_conversation_participant(conversation_id, auth.uid()));
GRANT SELECT, INSERT ON public.group_polls TO authenticated;
GRANT ALL ON public.group_polls TO service_role;

CREATE TABLE IF NOT EXISTS public.group_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.group_polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.group_poll_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gpo_select ON public.group_poll_options;
CREATE POLICY gpo_select ON public.group_poll_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_polls gp WHERE gp.id = poll_id AND public.is_conversation_participant(gp.conversation_id, auth.uid())));
DROP POLICY IF EXISTS gpo_insert ON public.group_poll_options;
CREATE POLICY gpo_insert ON public.group_poll_options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.group_polls gp WHERE gp.id = poll_id AND gp.creator_id = auth.uid()));
GRANT SELECT, INSERT ON public.group_poll_options TO authenticated;
GRANT ALL ON public.group_poll_options TO service_role;

CREATE TABLE IF NOT EXISTS public.group_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.group_polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.group_poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, option_id, user_id)
);
ALTER TABLE public.group_poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gpv_select ON public.group_poll_votes;
CREATE POLICY gpv_select ON public.group_poll_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_polls gp WHERE gp.id = poll_id AND public.is_conversation_participant(gp.conversation_id, auth.uid())));
DROP POLICY IF EXISTS gpv_insert ON public.group_poll_votes;
CREATE POLICY gpv_insert ON public.group_poll_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS gpv_delete ON public.group_poll_votes;
CREATE POLICY gpv_delete ON public.group_poll_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
GRANT SELECT, INSERT, DELETE ON public.group_poll_votes TO authenticated;
GRANT ALL ON public.group_poll_votes TO service_role;

-- ---- GROUP INVITATIONS ----
CREATE TABLE IF NOT EXISTS public.group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, invitee_id)
);
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gi_select ON public.group_invitations;
CREATE POLICY gi_select ON public.group_invitations FOR SELECT TO authenticated
  USING (auth.uid() = invitee_id OR auth.uid() = inviter_id OR public.is_conversation_participant(conversation_id, auth.uid()));
DROP POLICY IF EXISTS gi_insert ON public.group_invitations;
CREATE POLICY gi_insert ON public.group_invitations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = inviter_id AND public.is_conversation_participant(conversation_id, auth.uid()));
DROP POLICY IF EXISTS gi_update ON public.group_invitations;
CREATE POLICY gi_update ON public.group_invitations FOR UPDATE TO authenticated
  USING (auth.uid() = invitee_id);
GRANT SELECT, INSERT, UPDATE ON public.group_invitations TO authenticated;
GRANT ALL ON public.group_invitations TO service_role;

-- ---- STORAGE BUCKET FOR GROUP MEDIA ----
INSERT INTO storage.buckets (id, name, public) VALUES ('group-media','group-media', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS gm_select ON storage.objects;
CREATE POLICY "gm_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'group-media');
DROP POLICY IF EXISTS gm_insert ON storage.objects;
CREATE POLICY "gm_authed_upload" ON storage.objects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND bucket_id = 'group-media');
DROP POLICY IF EXISTS gm_delete ON storage.objects;
CREATE POLICY "gm_owner_delete" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'group-media');

-- ---- EXTEND NOTIFICATION TYPES ----
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'friend_request';
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'friend_accepted';
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'group_invite';
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'group_message';
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'location_shared';
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'emergency';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ---- REALTIME ENABLE ----
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.location_sharing_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_poll_votes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_activity; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
