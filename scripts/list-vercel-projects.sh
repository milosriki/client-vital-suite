#!/bin/bash
# =============================================================================
# List all Vercel projects and find similar names
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Vercel Projects Discovery${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check authentication
if ! vercel whoami &>/dev/null; then
  echo -e "${RED}❌ Not authenticated. Run: vercel login${NC}"
  exit 1
fi

USER=$(vercel whoami 2>/dev/null)
echo -e "Authenticated as: ${GREEN}$USER${NC}"
echo ""

# Keywords to search for
KEYWORDS=("vital" "client" "suite" "ptd" "fitness" "trainer" "dubai")

echo -e "${YELLOW}Searching for projects matching:${NC} ${KEYWORDS[*]}"
echo ""

# Get all projects
echo -e "${BLUE}All Projects:${NC}"
echo "─────────────────────────────────────────────────────────────"

vercel project ls 2>/dev/null | tail -n +3 | while read -r line; do
  PROJECT=$(echo "$line" | awk '{print $1}')
  URL=$(echo "$line" | awk '{print $2}')
  UPDATED=$(echo "$line" | awk '{print $3, $4}')
  
  if [[ -z "$PROJECT" ]]; then
    continue
  fi
  
  # Check if matches any keyword
  MATCHED=false
  for keyword in "${KEYWORDS[@]}"; do
    if [[ "${PROJECT,,}" == *"${keyword,,}"* ]]; then
      MATCHED=true
      break
    fi
  done
  
  if [[ "$MATCHED" == true ]]; then
    if [[ "$PROJECT" == "client-vital-suite" ]]; then
      echo -e "${GREEN}★ $PROJECT${NC} (PRIMARY)"
      echo -e "  URL: $URL"
      echo -e "  Updated: $UPDATED"
    else
      echo -e "${YELLOW}○ $PROJECT${NC}"
      echo -e "  URL: $URL"
      echo -e "  Updated: $UPDATED"
    fi
    echo ""
  fi
done

echo "─────────────────────────────────────────────────────────────"
echo ""
echo -e "${BLUE}Recommendation:${NC}"
echo "• Keep 'client-vital-suite' as the primary project"
echo "• Consider deleting unused similar projects"
echo "• Consolidate if multiple projects serve same purpose"
echo ""
echo -e "Delete a project: ${YELLOW}vercel project rm <project-name>${NC}"
