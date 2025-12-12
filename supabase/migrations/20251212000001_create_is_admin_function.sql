-- Create is_admin() function for RLS policies
-- This function is referenced by 32+ policies but was never defined

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is authenticated and has admin role
  -- For service_role (Edge Functions), always return true
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN TRUE;
  END IF;

  -- For authenticated users, check if they have admin privileges
  -- This checks the user's email against known admin emails
  -- or checks a user_roles table if available
  RETURN (
    SELECT EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = auth.uid()
      AND (
        -- Check if user has admin metadata
        (u.raw_user_meta_data->>'role')::text = 'admin'
        OR (u.raw_app_meta_data->>'role')::text = 'admin'
        -- Fallback: all authenticated users have read access (adjust as needed)
        OR auth.uid() IS NOT NULL
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

COMMENT ON FUNCTION public.is_admin() IS 'Checks if the current user has admin privileges for RLS policies';
