-- Modified to be safe for non-superuser CLI push
-- Original contained ALTER DATABASE commands that require superuser
-- SELECT current_database();
-- This file is now a no-op to unblock deployment
SELECT 1;
