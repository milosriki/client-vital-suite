import os
import re

def get_remote_functions(filepath):
    functions = []
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    # Skip header lines (usually first 4 lines in supabase list output)
    # Format: | ID | NAME | SLUG | ...
    for line in lines:
        if "|" in line and "ID" not in line and "----" not in line:
            parts = line.split('|')
            if len(parts) > 3:
                name = parts[2].strip()
                functions.append(name)
    return set(functions)

def get_local_functions(base_dir):
    functions = []
    if os.path.exists(base_dir):
        for entry in os.listdir(base_dir):
            if os.path.isdir(os.path.join(base_dir, entry)):
                if not entry.startswith("_") and not entry.startswith("."):
                    functions.append(entry)
    return set(functions)

def main():
    remote_functions = get_remote_functions('remaining_functions.txt')
    local_functions = get_local_functions('supabase/functions')
    
    ghosts = remote_functions - local_functions
    missing_remote = local_functions - remote_functions
    
    print(f"Remote Count: {len(remote_functions)}")
    print(f"Local Count: {len(local_functions)}")
    
    print("\n--- 👻 GHOST FUNCTIONS (Remote but not Local) ---")
    for f in sorted(ghosts):
        print(f)
        
    print("\n--- 💤 UNDEPLOYED LOCAL FUNCTIONS (Local but not Remote) ---")
    for f in sorted(missing_remote):
        print(f)

    # Check for suspicious duplicates (e.g. name similarity)
    print("\n--- 👯 POTENTIAL DUPLICATES (Name Similarity) ---")
    all_funcs = sorted(list(local_functions))
    for i in range(len(all_funcs)):
        for j in range(i + 1, len(all_funcs)):
            f1 = all_funcs[i]
            f2 = all_funcs[j]
            # specific logic: if one is a substring of another or very close
            if f1 in f2 or f2 in f1:
                 print(f"Match: {f1} <-> {f2}")
            # check for "webhook" vs "receiver"
            if f1.replace("-receiver","") == f2 or f2.replace("-receiver","") == f1:
                 print(f"Receiver Match: {f1} <-> {f2}")

if __name__ == "__main__":
    main()
