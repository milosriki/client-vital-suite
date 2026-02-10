#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
from pathlib import Path

# Add current directory to path so imports work
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))

print(f"Current directory: {current_dir}")
print(f"Python executable: {sys.executable}")

try:
    from design_system import DesignSystemGenerator, format_markdown
    print("Successfully imported DesignSystemGenerator")
except ImportError as e:
    print(f"Failed to import DesignSystemGenerator: {e}")
    sys.exit(1)

def run():
    print("Starting reproduction...")
    try:
        generator = DesignSystemGenerator()
        print("DesignSystemGenerator instantiated.")
        
        query = "fitness coaching luxury elite brutalist"
        project_name = "Dream Body Project"
        
        print(f"Calling generate with query='{query}', project_name='{project_name}'")
        result = generator.generate(query, project_name)
        
        print("Generation successful!")
        print("Result keys:", result.keys())
        
        formatted = format_markdown(result)
        print("Formatting successful!")
        print("Output length:", len(formatted))
        print("Output Preview:\n" + formatted[:500])
        
    except Exception as e:
        print(f"Detailed Exception Caught: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run()
