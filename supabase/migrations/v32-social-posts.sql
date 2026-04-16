-- Track outbound social posts so /api/social/next-post can dedupe.
-- Make.com (and any future poster) hits the endpoint on a schedule;
-- without dedupe, double-firing scenarios produce duplicate FB Page posts.
CREATE TABLE IF NOT EXISTS social_posts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  platform text NOT NULL DEFAULT 'facebook_page',
  caption text NOT NULL,
  caption_hash text NOT NULL,
  video_url text,
  image_url text,
  landing_url text,
  posted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_platform_posted
  ON social_posts (platform, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_posts_hash
  ON social_posts (caption_hash);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages social_posts"
  ON social_posts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
