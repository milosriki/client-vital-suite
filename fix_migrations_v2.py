import os
import re

migration_dir = '/Users/milosvukovic/client-vital-suite/supabase/migrations'
files = sorted(os.listdir(migration_dir))

# Group files by their timestamp prefix
groups = {}
for f in files:
    if not f.endswith('.sql'):
        continue
    
    # Match 14 digits or 8 digits
    match = re.match(r'^(\d{8,14})_.*\.sql$', f)
    if match:
        prefix = match.group(1)
        if prefix not in groups:
            groups[prefix] = []
        groups[prefix].append(f)

# Rename files in each group if there are duplicates
for prefix, filenames in groups.items():
    if len(filenames) > 1:
        print(f"Processing group {prefix} with {len(filenames)} files")
        for i, filename in enumerate(filenames):
            # If prefix is 14 digits, we need to increment the seconds
            # If prefix is 8 digits, we append HHMMSS
            
            if len(prefix) == 14:
                # Parse timestamp and increment
                # Simple string manipulation: increment last digit(s)
                # But we might overflow seconds.
                # Let's just replace the last 6 digits with something unique?
                # Or just append a suffix? No, Supabase expects strict format.
                # Let's increment the timestamp integer value.
                ts_int = int(prefix)
                new_ts = str(ts_int + i)
                new_prefix = new_ts
            else:
                # 8 digits
                suffix = f"{230000 + i:06d}"
                new_prefix = prefix + suffix
            
            new_filename = new_prefix + filename[len(prefix):]
            
            # Rename
            old_path = os.path.join(migration_dir, filename)
            new_path = os.path.join(migration_dir, new_filename)
            print(f"Renaming {filename} to {new_filename}")
            os.rename(old_path, new_path)
