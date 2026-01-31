#!/usr/bin/env bash
set -euo pipefail

# Update badges and commit changes
#
# Usage:
#   ./scripts/update-badges.sh <test-status> <coverage>
#
# Arguments:
#   test-status: "passing" or "failing"
#   coverage: Coverage percentage (0-100)

# Check arguments
if [ $# -ne 2 ]; then
  echo "Usage: $0 <test-status> <coverage>"
  echo "  test-status: passing or failing"
  echo "  coverage: 0-100"
  exit 1
fi

TEST_STATUS="$1"
COVERAGE="$2"

# Validate test status
if [ "$TEST_STATUS" != "passing" ] && [ "$TEST_STATUS" != "failing" ]; then
  echo "Error: test-status must be 'passing' or 'failing'"
  exit 1
fi

# Validate coverage is a number
if ! [[ "$COVERAGE" =~ ^[0-9]+$ ]]; then
  echo "Error: coverage must be a number (0-100)"
  exit 1
fi

echo "Updating badges..."
echo "  Tests: $TEST_STATUS"
echo "  Coverage: $COVERAGE%"

# Ensure static directory exists
mkdir -p static

# Download badge images to static folder
echo "Downloading badge images..."

pushd gate

./badge.ts tests --status="$TEST_STATUS" --download > ../static/badge-tests.svg 2>/dev/null
echo "  ✓ Tests badge downloaded"

./badge.ts coverage --percent="$COVERAGE" --download > ../static/badge-coverage.svg 2>/dev/null
echo "  ✓ Coverage badge downloaded"

./badge.ts license --type="MIT" --download > ../static/badge-license.svg 2>/dev/null
echo "  ✓ License badge downloaded"

# Update README.md with badges
echo "Updating README.md..."

# Replace with tests badge (clears the section)
./badge.ts markdown --replace \
  --img-src="static/badge-tests.svg" \
  --alt="Tests: ${TEST_STATUS}" \
  --link="https://github.com/thesmart/events-ts/actions/workflows/gate.yml" \
  ../README.md

# Append coverage badge
./badge.ts markdown --append \
  --img-src="static/badge-coverage.svg" \
  --alt="Coverage: ${COVERAGE}" \
  ../README.md

# Append license badge
./badge.ts markdown --append \
  --img-src="static/badge-license.svg" \
  --alt="License: MIT" \
  --link="LICENSE" \
  ../README.md

popd

deno task format README.md

echo "✓ Badges updated successfully"
