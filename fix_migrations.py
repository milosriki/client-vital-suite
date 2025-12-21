import os
import re

migration_dir = '/Users/milosvukovic/client-vital-suite/supabase/migrations'
files = sorted(os.listdir(migration_dir))

# Group files by their prefix (date part)
groups = {}
for f in files:
    if not f.endswith('.sql'):
        continue
    # Check if it matches YYYYMMDD_name.sql (8 digits)
    match = re.match(r'^(\d{8})_.*\.sql$', f)
    if match:
        prefix = match.group(1)
        if prefix not in groups:
            groups[prefix] = []
        groups[prefix].append(f)

# Rename files in each group
for prefix, filenames in groups.items():
    if len(filenames) > 0: # Even if 1, we should probably normalize it to full timestamp to avoid future issues, but the error was due to duplicates.
        # Actually, if there is only 1 file with 8 digits, it works fine as version=20251209.
        # But if we have 20251209_a.sql and 20251209_b.sql, they collide.
        # Also we might have 20251209123456_c.sql which is fine.
        
        # Let's verify if there are collisions.
        # The error was for 20251209.
        print(f"Processing group {prefix} with {len(filenames)} files")
        for i, filename in enumerate(filenames):
            # Create new timestamp: YYYYMMDD + HHMMSS
            # We'll use 200000 + i to avoid conflict with existing timestamps like 005251 or 093052
            # But we should check if the new timestamp exists.
            
            # Let's just append 99 + i to the end? No, needs to be 14 digits.
            # Prefix is 8 digits. We need 6 more.
            # Let's use 230000 + i (11 PM) to be safe?
            suffix = f"{230000 + i:06d}"
            new_prefix = prefix + suffix
            
            # Check if this timestamp already exists
            # (unlikely for 2300xx unless user worked late at night)
            
            new_filename = new_prefix + filename[8:] # remove the 8 digit prefix
            
            # Rename
            old_path = os.path.join(migration_dir, filename)
            new_path = os.path.join(migration_dir, new_filename)
            print(f"Renaming {filename} to {new_filename}")
            os.rename(old_path, new_path)
