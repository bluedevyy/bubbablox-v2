#!/usr/bin/env bash
#
# Repo hygiene guard. Fails (non-zero) if it finds:
#   - unresolved git merge-conflict markers
#   - junk files that should never be committed (Thumbs.db, npm-debug.log, .pyc)
#
# Used by CI and by the pre-commit hook (scripts/install-hooks.sh).
# Only inspects git-tracked files, so local build output / node_modules are ignored.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

fail=0

# 1) Merge-conflict markers in tracked text files.
# The regex is split so this script never trips over itself.
marker="$(printf '%s' '<<<<<<<' '|' '=======' '|' '>>>>>>>')"
conflicts="$(git grep -lE "^(${marker})( |\$)" -- ':!*.png' ':!*.jpg' ':!*.gif' ':!*.exe' 2>/dev/null || true)"
if [ -n "$conflicts" ]; then
  echo "::error::merge-conflict markers found in:"
  echo "$conflicts"
  fail=1
fi

# 2) Junk files that must never be tracked.
junk="$(git ls-files | grep -iE '(^|/)(Thumbs\.db|npm-debug\.log)$|\.pyc$' || true)"
if [ -n "$junk" ]; then
  echo "::error::junk files are tracked (remove with 'git rm --cached'):"
  echo "$junk"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "hygiene: OK"
fi
exit "$fail"
