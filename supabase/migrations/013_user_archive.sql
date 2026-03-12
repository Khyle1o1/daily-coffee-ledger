-- 013_user_archive.sql
-- Adds soft-archive support to user_profiles.
-- Users with existing audit log activity cannot be hard-deleted; they are
-- archived instead (profile flagged + auth account banned).

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_archived  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_archived ON user_profiles(is_archived);
