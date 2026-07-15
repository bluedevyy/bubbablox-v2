#!/usr/bin/env bash
#
# Installs a git pre-commit hook that runs the hygiene guard before each commit.
# Run once after cloning:  bash scripts/install-hooks.sh
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
hook="$repo_root/.git/hooks/pre-commit"

cat > "$hook" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
exec "$(git rev-parse --show-toplevel)/scripts/check-hygiene.sh"
HOOK

chmod +x "$hook"
echo "installed pre-commit hook -> $hook"
