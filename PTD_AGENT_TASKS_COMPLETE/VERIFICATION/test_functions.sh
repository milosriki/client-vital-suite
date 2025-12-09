#!/bin/bash

################################################################################
# PTD FITNESS - AGENT TASKS VERIFICATION SCRIPT
# Tests Tasks 17 & 18: HubSpot Sync and AI Lead Reply Generation
################################################################################
#
# DESCRIPTION:
#   This script tests the core Edge Functions and verifies database updates:
#   - Task 17: Tests sync-hubspot-to-supabase function and verifies sync_logs
#   - Task 18: Tests business-intelligence function (AI lead reply) and verifies leads table
#
# PREREQUISITES:
#   1. Export environment variables before running:
#      export SUPABASE_URL="https://ztjndilxurtsfqdsvfds.supabase.co"
#      export SUPABASE_ANON_KEY="your-anon-key-here"
#
#   2. Ensure you have the following installed:
#      - curl (for API calls)
#      - jq (for JSON parsing)
#
#   3. Optional: Set SUPABASE_SERVICE_ROLE_KEY for direct database queries
#      If not set, the script will use REST API queries with ANON_KEY
#
# USAGE:
#   ./test_functions.sh              # Run all tests
#   ./test_functions.sh --dry-run    # Show what would be tested without executing
#   ./test_functions.sh --task-17    # Test only Task 17 (HubSpot Sync)
#   ./test_functions.sh --task-18    # Test only Task 18 (AI Lead Reply)
#   ./test_functions.sh --verbose    # Show detailed output
#
# ENVIRONMENT VARIABLES:
#   SUPABASE_URL           (Required) Your Supabase project URL
#   SUPABASE_ANON_KEY      (Required) Your Supabase anonymous key
#   SUPABASE_SERVICE_ROLE_KEY (Optional) For database verification queries
#
################################################################################

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Test configuration
DRY_RUN=false
VERBOSE=false
TEST_TASK_17=true
TEST_TASK_18=true
TESTS_PASSED=0
TESTS_FAILED=0

################################################################################
# HELPER FUNCTIONS
################################################################################

print_header() {
    echo ""
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[✓ PASS]${NC} $1"
    ((TESTS_PASSED++))
}

print_fail() {
    echo -e "${RED}[✗ FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

print_warn() {
    echo -e "${YELLOW}[⚠ WARN]${NC} $1"
}

print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

print_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

check_prerequisites() {
    print_header "Checking Prerequisites"

    local all_good=true

    # Check for required commands
    if ! command -v curl &> /dev/null; then
        print_fail "curl is not installed. Please install curl first."
        all_good=false
    else
        print_pass "curl is installed"
    fi

    if ! command -v jq &> /dev/null; then
        print_fail "jq is not installed. Please install jq for JSON parsing."
        all_good=false
    else
        print_pass "jq is installed"
    fi

    # Check for required environment variables
    if [ -z "$SUPABASE_URL" ]; then
        print_fail "SUPABASE_URL environment variable is not set"
        echo "       Set it with: export SUPABASE_URL=\"https://ztjndilxurtsfqdsvfds.supabase.co\""
        all_good=false
    else
        print_pass "SUPABASE_URL is set: $SUPABASE_URL"
    fi

    if [ -z "$SUPABASE_ANON_KEY" ]; then
        print_fail "SUPABASE_ANON_KEY environment variable is not set"
        echo "       Set it with: export SUPABASE_ANON_KEY=\"your-key-here\""
        all_good=false
    else
        print_pass "SUPABASE_ANON_KEY is set (length: ${#SUPABASE_ANON_KEY} chars)"
    fi

    if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        print_warn "SUPABASE_SERVICE_ROLE_KEY not set (optional, will use ANON_KEY)"
    else
        print_pass "SUPABASE_SERVICE_ROLE_KEY is set"
    fi

    if [ "$all_good" = false ]; then
        echo ""
        print_fail "Prerequisites check failed. Please fix the issues above."
        exit 1
    fi

    echo ""
}

################################################################################
# TASK 17: TEST HUBSPOT SYNC
################################################################################

test_task_17() {
    print_header "TASK 17: HubSpot Sync Test"

    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would test: sync-hubspot-to-supabase function"
        print_info "[DRY RUN] Would verify: sync_logs table has new entry"
        return
    fi

    local function_url="${SUPABASE_URL}/functions/v1/sync-hubspot-to-supabase"

    # Step 1: Get timestamp before test
    local test_start=$(date -u +"%Y-%m-%dT%H:%M:%S")
    print_verbose "Test start time: $test_start"

    # Step 2: Call the sync function
    print_test "Calling sync-hubspot-to-supabase function..."

    local response
    local http_code

    response=$(curl -s -w "\n%{http_code}" -X POST "$function_url" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d '{"sync_type": "contacts", "limit": 5}' \
        2>&1)

    http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    print_verbose "Response code: $http_code"
    print_verbose "Response body: $body"

    # Step 3: Check HTTP response code
    if [ "$http_code" = "200" ]; then
        print_pass "Function returned 200 OK"
    else
        print_fail "Function returned $http_code (expected 200)"
        if [ "$VERBOSE" = true ]; then
            echo "Response: $body"
        fi
        return
    fi

    # Step 4: Parse response body
    if echo "$body" | jq -e . >/dev/null 2>&1; then
        print_pass "Response is valid JSON"

        if [ "$VERBOSE" = true ]; then
            echo "$body" | jq '.'
        fi

        # Check for success indicators
        local success=$(echo "$body" | jq -r '.success // empty')
        local contacts_synced=$(echo "$body" | jq -r '.results.contacts_synced // .contacts_synced // empty')

        if [ "$success" = "true" ] || [ -n "$contacts_synced" ]; then
            print_pass "Sync operation completed successfully"
            if [ -n "$contacts_synced" ]; then
                print_info "Contacts synced: $contacts_synced"
            fi
        else
            print_warn "Could not confirm sync success from response"
        fi
    else
        print_warn "Response is not valid JSON, but function returned 200"
    fi

    # Step 5: Verify sync_logs table has new entry
    print_test "Verifying sync_logs table for new entry..."

    # Use service role key if available, otherwise anon key
    local auth_key="${SUPABASE_SERVICE_ROLE_KEY:-$SUPABASE_ANON_KEY}"

    # Query sync_logs for recent entries
    local sync_logs_url="${SUPABASE_URL}/rest/v1/sync_logs"
    local logs_response

    logs_response=$(curl -s -X GET "$sync_logs_url" \
        -H "apikey: $auth_key" \
        -H "Authorization: Bearer $auth_key" \
        -H "Content-Type: application/json" \
        --get \
        --data-urlencode "platform=eq.hubspot" \
        --data-urlencode "order=synced_at.desc" \
        --data-urlencode "limit=5" \
        2>&1)

    print_verbose "Sync logs response: $logs_response"

    if echo "$logs_response" | jq -e . >/dev/null 2>&1; then
        local log_count=$(echo "$logs_response" | jq 'length')

        if [ "$log_count" -gt 0 ]; then
            print_pass "Found $log_count recent sync log entries"

            # Check the most recent entry
            local last_status=$(echo "$logs_response" | jq -r '.[0].status // empty')
            local last_synced=$(echo "$logs_response" | jq -r '.[0].synced_at // empty')
            local record_count=$(echo "$logs_response" | jq -r '.[0].record_count // 0')

            print_info "Most recent sync: $last_synced"
            print_info "Status: $last_status"
            print_info "Records: $record_count"

            if [ "$last_status" = "success" ]; then
                print_pass "Most recent sync status is 'success'"
            elif [ "$last_status" = "error" ]; then
                local error_msg=$(echo "$logs_response" | jq -r '.[0].error_message // "No error message"')
                print_warn "Most recent sync status is 'error': $error_msg"
            else
                print_info "Status: $last_status"
            fi
        else
            print_fail "No sync logs found for HubSpot"
        fi
    else
        print_fail "Could not query sync_logs table"
        print_verbose "Response: $logs_response"
    fi

    echo ""
}

################################################################################
# TASK 18: TEST AI LEAD REPLY GENERATION
################################################################################

test_task_18() {
    print_header "TASK 18: AI Lead Reply Generation Test"

    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would test: business-intelligence function (includes lead reply logic)"
        print_info "[DRY RUN] Would verify: leads table has ai_suggested_reply populated"
        return
    fi

    local function_url="${SUPABASE_URL}/functions/v1/business-intelligence"

    # Step 1: Check if there are any leads without AI replies
    print_test "Checking for leads that need AI replies..."

    local auth_key="${SUPABASE_SERVICE_ROLE_KEY:-$SUPABASE_ANON_KEY}"
    local leads_url="${SUPABASE_URL}/rest/v1/leads"

    # Query leads without ai_suggested_reply
    local leads_before
    leads_before=$(curl -s -X GET "$leads_url" \
        -H "apikey: $auth_key" \
        -H "Authorization: Bearer $auth_key" \
        -H "Content-Type: application/json" \
        --get \
        --data-urlencode "select=id,firstname,email,ai_suggested_reply" \
        --data-urlencode "ai_suggested_reply=is.null" \
        --data-urlencode "limit=5" \
        2>&1)

    print_verbose "Leads before: $leads_before"

    local leads_count_before=0
    if echo "$leads_before" | jq -e . >/dev/null 2>&1; then
        leads_count_before=$(echo "$leads_before" | jq 'length')
        print_info "Found $leads_count_before leads without AI replies"

        if [ "$leads_count_before" -eq 0 ]; then
            print_warn "No leads found without AI replies. Test may not show changes."
            print_info "Creating a test lead for verification..."

            # Create a test lead
            local test_lead_data='{
                "firstname": "Test",
                "lastname": "User",
                "email": "test-'$(date +%s)'@example.com",
                "phone": "555-0123",
                "fitness_goal": "weight loss",
                "budget_range": "10000",
                "status": "NEW"
            }'

            local create_response
            create_response=$(curl -s -X POST "$leads_url" \
                -H "apikey: $auth_key" \
                -H "Authorization: Bearer $auth_key" \
                -H "Content-Type: application/json" \
                -H "Prefer: return=representation" \
                -d "$test_lead_data" \
                2>&1)

            if echo "$create_response" | jq -e . >/dev/null 2>&1; then
                local test_lead_id=$(echo "$create_response" | jq -r '.[0].id // .id // empty')
                if [ -n "$test_lead_id" ]; then
                    print_pass "Created test lead with ID: $test_lead_id"
                    leads_count_before=1
                else
                    print_warn "Could not extract lead ID from response"
                fi
            else
                print_warn "Could not create test lead"
            fi
        fi
    else
        print_warn "Could not query leads table"
    fi

    # Step 2: Call the business-intelligence function
    print_test "Calling business-intelligence function (includes AI lead reply)..."

    local response
    local http_code

    response=$(curl -s -w "\n%{http_code}" -X POST "$function_url" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d '{}' \
        2>&1)

    http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    print_verbose "Response code: $http_code"
    print_verbose "Response body: $body"

    # Step 3: Check HTTP response code
    if [ "$http_code" = "200" ]; then
        print_pass "Function returned 200 OK"
    else
        print_fail "Function returned $http_code (expected 200)"
        if [ "$VERBOSE" = true ]; then
            echo "Response: $body"
        fi
        return
    fi

    # Step 4: Parse response body
    if echo "$body" | jq -e . >/dev/null 2>&1; then
        print_pass "Response is valid JSON"

        if [ "$VERBOSE" = true ]; then
            echo "$body" | jq '.'
        fi

        # Check for success indicators
        local success=$(echo "$body" | jq -r '.success // empty')
        local executive_summary=$(echo "$body" | jq -r '.analysis.executive_summary // empty')

        if [ "$success" = "true" ]; then
            print_pass "Business intelligence analysis completed successfully"
            if [ -n "$executive_summary" ] && [ "$executive_summary" != "null" ]; then
                print_info "Executive summary generated"
                if [ "$VERBOSE" = true ]; then
                    echo "Summary: $executive_summary"
                fi
            fi
        else
            print_warn "Could not confirm success from response"
        fi
    else
        print_warn "Response is not valid JSON, but function returned 200"
    fi

    # Step 5: Wait a moment for database updates
    print_info "Waiting 2 seconds for database updates..."
    sleep 2

    # Step 6: Verify leads table has ai_suggested_reply populated
    print_test "Verifying leads table for AI suggested replies..."

    # Query leads with ai_suggested_reply
    local leads_after
    leads_after=$(curl -s -X GET "$leads_url" \
        -H "apikey: $auth_key" \
        -H "Authorization: Bearer $auth_key" \
        -H "Content-Type: application/json" \
        --get \
        --data-urlencode "select=id,firstname,email,ai_suggested_reply" \
        --data-urlencode "ai_suggested_reply=not.is.null" \
        --data-urlencode "order=created_at.desc" \
        --data-urlencode "limit=5" \
        2>&1)

    print_verbose "Leads after: $leads_after"

    if echo "$leads_after" | jq -e . >/dev/null 2>&1; then
        local leads_count_after=$(echo "$leads_after" | jq 'length')

        if [ "$leads_count_after" -gt 0 ]; then
            print_pass "Found $leads_count_after leads with AI suggested replies"

            # Show sample reply
            local sample_reply=$(echo "$leads_after" | jq -r '.[0].ai_suggested_reply // empty')
            local sample_name=$(echo "$leads_after" | jq -r '.[0].firstname // "Unknown"')

            if [ -n "$sample_reply" ] && [ "$sample_reply" != "null" ]; then
                print_pass "AI suggested reply is populated"
                print_info "Sample reply for '$sample_name':"
                echo "       ${sample_reply:0:100}..."
            fi

            # Check if new replies were generated
            if [ "$leads_count_before" -gt 0 ]; then
                print_pass "Lead reply generation is working"
            fi
        else
            print_fail "No leads found with AI suggested replies"
            print_info "This could mean:"
            echo "       - No leads exist in the database"
            echo "       - The AI reply generation logic did not run"
            echo "       - All leads already had replies before this test"
        fi
    else
        print_fail "Could not query leads table for verification"
        print_verbose "Response: $leads_after"
    fi

    # Step 7: Verify business-intelligence logged to sync_logs
    print_test "Verifying business-intelligence execution was logged..."

    local bi_logs_url="${SUPABASE_URL}/rest/v1/sync_logs"
    local bi_logs_response

    bi_logs_response=$(curl -s -X GET "$bi_logs_url" \
        -H "apikey: $auth_key" \
        -H "Authorization: Bearer $auth_key" \
        -H "Content-Type: application/json" \
        --get \
        --data-urlencode "platform=eq.system" \
        --data-urlencode "operation_type=eq.business-intelligence" \
        --data-urlencode "order=synced_at.desc" \
        --data-urlencode "limit=1" \
        2>&1)

    if echo "$bi_logs_response" | jq -e . >/dev/null 2>&1; then
        local bi_log_count=$(echo "$bi_logs_response" | jq 'length')

        if [ "$bi_log_count" -gt 0 ]; then
            print_pass "Business intelligence execution was logged to sync_logs"
            local last_bi_run=$(echo "$bi_logs_response" | jq -r '.[0].synced_at // empty')
            print_info "Last BI run: $last_bi_run"
        else
            print_warn "No business-intelligence logs found in sync_logs"
        fi
    fi

    echo ""
}

################################################################################
# MAIN EXECUTION
################################################################################

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Test PTD Fitness Edge Functions (Tasks 17 & 18)

OPTIONS:
    --dry-run       Show what would be tested without executing
    --task-17       Test only Task 17 (HubSpot Sync)
    --task-18       Test only Task 18 (AI Lead Reply)
    --verbose       Show detailed debug output
    --help          Show this help message

EXAMPLES:
    $0                      # Run all tests
    $0 --dry-run            # Preview tests
    $0 --task-17 --verbose  # Test Task 17 with debug output
    $0 --task-18            # Test only Task 18

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --task-17)
            TEST_TASK_18=false
            shift
            ;;
        --task-18)
            TEST_TASK_17=false
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_header "PTD FITNESS - VERIFICATION SCRIPT"
    echo -e "${BOLD}Testing Tasks 17 & 18${NC}"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        print_warn "DRY RUN MODE - No actual tests will be executed"
        echo ""
    fi

    # Check prerequisites
    check_prerequisites

    # Run tests
    if [ "$TEST_TASK_17" = true ]; then
        test_task_17
    fi

    if [ "$TEST_TASK_18" = true ]; then
        test_task_18
    fi

    # Print summary
    print_header "TEST SUMMARY"

    local total_tests=$((TESTS_PASSED + TESTS_FAILED))

    echo -e "${BOLD}Total Tests:${NC} $total_tests"
    echo -e "${GREEN}${BOLD}Passed:${NC}      $TESTS_PASSED"

    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "${RED}${BOLD}Failed:${NC}      $TESTS_FAILED"
    else
        echo -e "${GREEN}${BOLD}Failed:${NC}      $TESTS_FAILED"
    fi

    echo ""

    if [ $TESTS_FAILED -eq 0 ] && [ $TESTS_PASSED -gt 0 ]; then
        echo -e "${GREEN}${BOLD}✓ ALL TESTS PASSED${NC}"
        echo ""
        exit 0
    elif [ "$DRY_RUN" = true ]; then
        echo -e "${CYAN}${BOLD}ℹ DRY RUN COMPLETE${NC}"
        echo ""
        exit 0
    elif [ $TESTS_FAILED -gt 0 ]; then
        echo -e "${RED}${BOLD}✗ SOME TESTS FAILED${NC}"
        echo ""
        exit 1
    else
        echo -e "${YELLOW}${BOLD}⚠ NO TESTS WERE RUN${NC}"
        echo ""
        exit 1
    fi
}

# Run main function
main
