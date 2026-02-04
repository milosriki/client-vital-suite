#!/bin/bash

# Elite WhatsApp Sales Agent - Deployment Script
# This script deploys all required components and verifies the setup

set -e  # Exit on error

echo "🚀 Starting WhatsApp Sales Agent Deployment"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

echo "Step 1: Checking Prerequisites"
echo "-------------------------------"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI not found. Install: https://supabase.com/docs/guides/cli"
    exit 1
fi
print_status "Supabase CLI installed"

# Check if logged in to Supabase
if ! supabase status &> /dev/null; then
    print_warning "Not linked to Supabase project. Run: supabase link"
fi

echo ""
echo "Step 2: Applying Database Migration"
echo "------------------------------------"

# Apply migration
if supabase db push; then
    print_status "Database migration applied successfully"
else
    print_error "Failed to apply migration. Check connection and try again."
    exit 1
fi

echo ""
echo "Step 3: Deploying Edge Functions"
echo "---------------------------------"

# Deploy send-hubspot-message
echo "Deploying send-hubspot-message..."
if supabase functions deploy send-hubspot-message --no-verify-jwt; then
    print_status "send-hubspot-message deployed"
else
    print_error "Failed to deploy send-hubspot-message"
    exit 1
fi

# Deploy updated ptd-agent-gemini
echo "Deploying ptd-agent-gemini (updated)..."
if supabase functions deploy ptd-agent-gemini --no-verify-jwt; then
    print_status "ptd-agent-gemini deployed"
else
    print_error "Failed to deploy ptd-agent-gemini"
    exit 1
fi

# Deploy hubspot-webhook-receiver (if updated)
# Uncomment when webhook receiver is updated
# echo "Deploying hubspot-webhook-receiver..."
# if supabase functions deploy hubspot-webhook-receiver --no-verify-jwt; then
#     print_status "hubspot-webhook-receiver deployed"
# else
#     print_error "Failed to deploy hubspot-webhook-receiver"
#     exit 1
# fi

echo ""
echo "Step 4: Verifying Environment Variables"
echo "----------------------------------------"

# List required secrets
REQUIRED_SECRETS=(
    "HUBSPOT_API_KEY"
    "GEMINI_API_KEY"
    "SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
)

echo "Required secrets for functions:"
for secret in "${REQUIRED_SECRETS[@]}"; do
    echo "  - $secret"
done

print_warning "Verify these secrets are set in Supabase Dashboard -> Edge Functions -> Secrets"

echo ""
echo "Step 5: Testing Deployment"
echo "--------------------------"

# Test send-hubspot-message function
echo "Testing send-hubspot-message function..."
print_warning "Manual test required via Supabase Dashboard"

echo ""
echo "Step 6: Next Steps"
echo "------------------"
echo ""
print_warning "IMPORTANT: Before going live, you must:"
echo "  1. Update hubspot-webhook-receiver with message sending logic"
echo "  2. Test with a real WhatsApp message in staging"
echo "  3. Verify no information leaks in responses"
echo "  4. Monitor message_delivery_log and response_safety_log tables"
echo "  5. Confirm HubSpot Conversations API access is enabled"
echo ""

print_status "Deployment Complete!"
echo ""
echo "📊 Monitor your deployment:"
echo "   • Supabase Dashboard: https://app.supabase.com"
echo "   • Function Logs: Edge Functions -> send-hubspot-message/ptd-agent-gemini"
echo "   • Database Logs: Table Editor -> message_delivery_log, response_safety_log"
echo ""
echo "📘 Documentation:"
echo "   • Walkthrough: brain/walkthrough.md"
echo "   • Implementation Plan: brain/implementation_plan.md"
echo ""
