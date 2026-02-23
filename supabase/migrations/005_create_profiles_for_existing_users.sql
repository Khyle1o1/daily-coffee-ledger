-- Create profiles for existing auth users who don't have profiles yet
-- This is a helper migration for backward compatibility

-- Insert profiles for any auth.users that don't have a profile yet
INSERT INTO user_profiles (user_id, email, role, created_by)
SELECT 
  au.id,
  au.email,
  'user' as role,  -- Default to 'user' role
  NULL as created_by
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id
WHERE up.user_id IS NULL;

-- Log the result
DO $$
DECLARE
  profile_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM user_profiles;
  RAISE NOTICE 'Total user profiles: %', profile_count;
END $$;
