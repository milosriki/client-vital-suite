#!/bin/bash
# Add environment variables to Vercel (without embedding secrets in this repo)
# Run: bash scripts/add-all-vercel-env.sh

set -euo pipefail

if [[ -f .env.local ]]; then
	set -a
	# shellcheck disable=SC1091
	source .env.local
	set +a
fi

require_var() {
	local name="$1"
	if [[ -z "${!name:-}" ]]; then
		echo "❌ Missing env var: ${name}"
		echo "   Set it in your shell or in .env.local (gitignored)."
		exit 1
	fi
}

add_vercel_env() {
	local name="$1"
	local env="$2"
	require_var "$name"
	vercel env add "$name" "$env" <<< "${!name}" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
}

echo "🚀 Adding environment variables to Vercel..."

echo "📦 Adding Required Variables..."
for env in production preview development; do
	echo "  → VITE_SUPABASE_URL ($env)"
	add_vercel_env VITE_SUPABASE_URL "$env"

	echo "  → VITE_SUPABASE_PUBLISHABLE_KEY ($env)"
	add_vercel_env VITE_SUPABASE_PUBLISHABLE_KEY "$env"

	echo "  → VITE_SUPABASE_ANON_KEY ($env)"
	add_vercel_env VITE_SUPABASE_ANON_KEY "$env"

	echo "  → SUPABASE_URL ($env)"
	add_vercel_env SUPABASE_URL "$env"

	echo "  → SUPABASE_SERVICE_ROLE_KEY ($env)"
	add_vercel_env SUPABASE_SERVICE_ROLE_KEY "$env"
done

echo ""
echo "📦 Adding Gemini & Facebook Variables..."
for env in production preview development; do
	echo "  → VITE_GEMINI_API_KEY ($env)"
	add_vercel_env VITE_GEMINI_API_KEY "$env"

	echo "  → FB_PIXEL_ID ($env)"
	add_vercel_env FB_PIXEL_ID "$env"

	echo "  → FB_ACCESS_TOKEN ($env)"
	add_vercel_env FB_ACCESS_TOKEN "$env"

	echo "  → EVENT_SOURCE_URL ($env)"
	add_vercel_env EVENT_SOURCE_URL "$env"
done

echo "  → FB_TEST_EVENT_CODE (preview)"
add_vercel_env FB_TEST_EVENT_CODE preview
echo "  → FB_TEST_EVENT_CODE (development)"
add_vercel_env FB_TEST_EVENT_CODE development

echo ""
echo "📦 Adding URL & Config Variables..."
for env in production preview development; do
	echo "  → VITE_META_CAPI_URL ($env)"
	add_vercel_env VITE_META_CAPI_URL "$env"

	echo "  → VITE_API_BASE ($env)"
	add_vercel_env VITE_API_BASE "$env"

	echo "  → LOG_LEVEL ($env)"
	add_vercel_env LOG_LEVEL "$env"
done

echo ""
echo "✅ All environment variables added!"
echo "⚠️  Mark these as Sensitive in Vercel Dashboard: SUPABASE_SERVICE_ROLE_KEY, FB_ACCESS_TOKEN"

