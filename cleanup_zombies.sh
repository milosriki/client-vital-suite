#!/bin/bash

# Read zombie list (format: ID | NAME | SLUG ...)
# Extract the SLUG (column 3)
# We use tail -n +4 to skip headers if using the raw output, but zombie_list.txt is grep output so it might be clean or have pipes.
# The previous `cat zombie_list.txt` showed lines like:
# 91e08e4e... | facebook-conversion | facebook-conversion | ...
# So we need the 3rd column, stripping pipes if necessary. 
# Actually, awk '{print $3}' should get the name/slug.

# Wait, the output format in zombie_list.txt was:
#    91e08e4e-0b3e-4bd7-b512-4462dfe6aa1b | facebook-conversion             | facebook-conversion             | ACTIVE | ...
# So column 1 is ID, column 2 is "|", column 3 is NAME.
# Actually, let's look at the file content again.
# 1:    91e08e4e-0b3e-4bd7-b512-4462dfe6aa1b | facebook-conversion             | facebook-conversion             | ACTIVE | 207     | 2025-09-15 12:28:30
# The columns are separated by "|".
# Column 1: ID
# Column 2: NAME
# Column 3: SLUG
# Let's verify with a dry run first.

echo "Starting cleanup of 2025 Zombies..."

while read -r line; do
    # Extract the function slug. It's the 3rd field if we split by '|'.
    # Actually, awk is safer.
    FUNC_SLUG=$(echo "$line" | awk -F'|' '{print $2}' | xargs)
    
    if [ ! -z "$FUNC_SLUG" ]; then
        echo "Deleting zombie: $FUNC_SLUG"
        /opt/homebrew/bin/supabase functions delete "$FUNC_SLUG" --project-ref ztjndilxurtsfqdsvfds --yes
    fi
done < zombie_list.txt

echo "Cleanup complete."
