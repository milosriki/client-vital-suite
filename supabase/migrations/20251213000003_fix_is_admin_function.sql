-- ============================================================
-- FIX: Update is_admin() function to handle NULL cases properly
-- The previous version could fail when current_setting returns NULL
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    jwt_role TEXT;
BEGIN
    -- Safely get JWT role, defaulting to empty string if NULL
    jwt_role := COALESCE(current_setting('request.jwt.claim.role', true), '');

    -- Check if user is service_role (Edge Functions)
    IF jwt_role = 'service_role' THEN
        RETURN TRUE;
    END IF;

    -- For authenticated users, check if they have admin privileges
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check user metadata for admin role
    RETURN (
        SELECT EXISTS (
            SELECT 1
            FROM auth.users u
            WHERE u.id = auth.uid()
            AND (
                COALESCE((u.raw_user_meta_data->>'role')::text, '') = 'admin'
                OR COALESCE((u.raw_app_meta_data->>'role')::text, '') = 'admin'
                OR COALESCE((u.raw_app_meta_data->>'is_admin')::text, '') = 'true'
            )
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        -- If any error occurs, default to false for safety
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Ensure permissions are correctly set
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

COMMENT ON FUNCTION public.is_admin() IS 'Safely checks if the current user has admin privileges - handles NULL cases';
