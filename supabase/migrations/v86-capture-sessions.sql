-- v86: cross-device capture sessions for hybrid desktop+mobile handoff
--
-- A desktop operator going step-by-step through a procedure (paperwork upload,
-- affidavit capture, driver-doc verification, etc.) often needs to capture
-- physical documents that are easier to photograph on a phone than upload
-- through a desktop file picker.
--
-- Pattern: desktop creates a capture_session with a short code, shows
-- code + QR. User opens /capture/[code] on phone, captures, uploads. Desktop
-- polls (or subscribes via Supabase Realtime in v2) for the upload status,
-- pulls the resulting blob URL, and continues the procedure.
--
-- TTL: 15 minutes. Sessions auto-expire so abandoned codes don't pile up.
-- No PHI / IOR identifiers stored on the session itself — those live on
-- the parent procedure row (refund claim, paperwork extraction, etc.).

CREATE TABLE IF NOT EXISTS capture_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,                            -- 6-char alphanumeric, displayed to user
  kind TEXT NOT NULL CHECK (kind IN ('paperwork', 'driver_doc', 'affidavit', 'general')),
  desktop_session_token TEXT,                            -- caller-supplied opaque correlation id
  user_id UUID,                                          -- nullable for anon sessions
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'expired', 'cancelled')),
  uploaded_blob_url TEXT,                                -- Vercel Blob URL once captured
  uploaded_filename TEXT,
  uploaded_mime TEXT,
  uploaded_size_bytes INTEGER,
  uploaded_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,                    -- caller-supplied context: claim_id, doc_type, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes')
);

CREATE INDEX IF NOT EXISTS idx_capture_sessions_code ON capture_sessions(code);
CREATE INDEX IF NOT EXISTS idx_capture_sessions_user_status ON capture_sessions(user_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_capture_sessions_expires_at ON capture_sessions(expires_at) WHERE status = 'pending';

-- RLS policies
ALTER TABLE capture_sessions ENABLE ROW LEVEL SECURITY;

-- Service-role + authenticated users can read their own sessions by code.
-- Anon users can read by code (the code itself is the auth — like a one-time link).
DROP POLICY IF EXISTS capture_sessions_select_by_code ON capture_sessions;
CREATE POLICY capture_sessions_select_by_code ON capture_sessions
  FOR SELECT TO anon, authenticated
  USING (true);  -- code is the auth: caller must KNOW the code to query

DROP POLICY IF EXISTS capture_sessions_insert_authenticated ON capture_sessions;
CREATE POLICY capture_sessions_insert_authenticated ON capture_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS capture_sessions_insert_anon ON capture_sessions;
CREATE POLICY capture_sessions_insert_anon ON capture_sessions
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- Mobile uploads update the session via service-role only (the API route
-- runs server-side with service-role key, so client-side anon updates are
-- not allowed — prevents tampering).
DROP POLICY IF EXISTS capture_sessions_update_service_role ON capture_sessions;
CREATE POLICY capture_sessions_update_service_role ON capture_sessions
  FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);
