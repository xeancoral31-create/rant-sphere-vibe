-- Create Enum for Call Types
DO $$ BEGIN
  CREATE TYPE call_type AS ENUM ('voice', 'video');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Create Enum for Call Status
DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN null; END $$;

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
DO $$ BEGIN
  CREATE POLICY "Users can view their own calls"
      ON public.calls
      FOR SELECT
      USING (auth.uid() = caller_id OR auth.uid() = receiver_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create calls"
      ON public.calls
      FOR INSERT
      WITH CHECK (auth.uid() = caller_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own calls"
      ON public.calls
      FOR UPDATE
      USING (auth.uid() = caller_id OR auth.uid() = receiver_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Ensure moddatetime exists
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Add updated_at trigger
DROP TRIGGER IF EXISTS handle_updated_at ON public.calls;
DO $$ BEGIN
  CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.calls
    FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable Realtime for calls and messages
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
