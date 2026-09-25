#!/data/data/com.termux/files/usr/bin/bash
# scripts/checkbuild.sh
#
# Checks the latest GitHub Actions run for this repo:
#   - success -> prints a straightforward APK download link
#   - failure -> prints exactly which step failed + the relevant error log
#
# One-time setup:
#   pkg install gh
#   gh auth login
#
# Usage (from anywhere in Termux, once symlinked — see setup notes below):
#   checkbuild
#   checkbuild owner/repo      # optional: override which repo to check

set -u  # (deliberately NOT `set -e` — we want to handle every failure explicitly and print why)

# Which workflow to check specifically — NOT just "the most recent run of any
# kind" (that could pick up an unrelated workflow, like a cleanup/cron job,
# if it happens to have run more recently than your actual build). Edit this
# to match your build workflow's exact display name if it differs.
WORKFLOW_NAME="Build Signed Release APK"

# Keep the Termux session alive after this script finishes. Without this,
# running via a Termux shortcut/widget closes the WHOLE session the instant
# the script's process tree ends — pressing Enter at the pause below would
# otherwise kill the session entirely instead of just returning to a prompt.
pause_before_exit() {
  echo ""
  read -r -p "Press Enter to close this output and return to your shell..." _
  # Hand off to a fresh interactive shell instead of letting the process end,
  # so the Termux session stays open at a normal prompt.
  exec bash -l
}
trap pause_before_exit EXIT

# Termux has no standard /tmp — use a writable dir under $HOME instead.
TMP_DIR="$HOME/.checkbuild_tmp"
mkdir -p "$TMP_DIR"

# ── 1. Figure out which repo to check ──────────────────────────────────────
# Priority: explicit argument > git remote of current directory > hardcoded fallback.
# Edit DEFAULT_REPO once below so `checkbuild` works even when you're NOT
# standing inside the repo folder (e.g. running it from $HOME).
DEFAULT_REPO=""   # <-- fill this in once, e.g. "yourusername/your-repo-name"

REPO="${1:-}"
if [ -z "$REPO" ]; then
  ORIGIN_URL=$(git remote get-url origin 2>/dev/null)
  if [ -n "$ORIGIN_URL" ]; then
    REPO=$(echo "$ORIGIN_URL" | sed -E 's#(git@|https://)github.com[:/]##; s#\.git$##')
  fi
fi
if [ -z "$REPO" ]; then
  REPO="$DEFAULT_REPO"
fi
if [ -z "$REPO" ]; then
  echo "❌ Couldn't figure out which repo to check."
  echo "   Either run this from inside the repo folder, pass it explicitly:"
  echo "     checkbuild owner/repo"
  echo "   or edit DEFAULT_REPO at the top of this script."
  exit 1
fi

GH="gh -R $REPO"

# ── 2. Auth check ───────────────────────────────────────────────────────────
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ Not logged in to gh. Run:  gh auth login"
  exit 1
fi

echo "🔍 Checking $REPO ..."

# ── 3. Latest run of the specific build workflow (NOT any workflow) ────────
RUN_ID=$($GH run list --workflow "$WORKFLOW_NAME" --limit 1 --json databaseId -q '.[0].databaseId' 2>"$TMP_DIR/gh_err.log")
if [ -z "$RUN_ID" ]; then
  echo "⚠️  No runs found for workflow named '$WORKFLOW_NAME'."
  echo "   Falling back to the most recent run of ANY workflow instead — if"
  echo "   this isn't the right one, check WORKFLOW_NAME at the top of this script."
  RUN_ID=$($GH run list --limit 1 --json databaseId -q '.[0].databaseId' 2>"$TMP_DIR/gh_err.log")
fi
if [ -z "$RUN_ID" ]; then
  echo "❌ Couldn't get a run. gh said:"
  cat "$TMP_DIR/gh_err.log"
  exit 1
fi

NAME=$($GH run view "$RUN_ID" --json name -q '.name')
STATUS=$($GH run view "$RUN_ID" --json status -q '.status')

echo "Workflow : $NAME"
echo "Run ID   : $RUN_ID"
echo "Status   : $STATUS"

if [ "$STATUS" = "in_progress" ] || [ "$STATUS" = "queued" ]; then
  echo "⏳ Still running... watching live (Ctrl+C stops watching, doesn't cancel the run):"
  $GH run watch "$RUN_ID"
fi

CONCLUSION=$($GH run view "$RUN_ID" --json conclusion -q '.conclusion')
echo ""

# ── 4a. SUCCESS: give a straightforward download link ──────────────────────
if [ "$CONCLUSION" = "success" ]; then
  echo "✅ Build SUCCEEDED"
  echo ""

  LATEST_TAG=$($GH release list --limit 1 --json tagName -q '.[0].tagName' 2>/dev/null)
  if [ -n "$LATEST_TAG" ]; then
    APK_URL=$($GH release view "$LATEST_TAG" --json assets -q '.assets[] | select(.name | test("\\.apk$")) | .url' 2>/dev/null | head -n 1)
    if [ -n "$APK_URL" ]; then
      echo "📱 APK download link:"
      echo "$APK_URL"
      exit 0
    fi
  fi

  echo "ℹ️  No Release found — downloading the build artifact directly instead..."
  OUT_DIR="$HOME/downloads/build_${RUN_ID}"
  mkdir -p "$OUT_DIR"
  if $GH run download "$RUN_ID" -D "$OUT_DIR" >"$TMP_DIR/gh_dl_err.log" 2>&1; then
    APK_PATH=$(find "$OUT_DIR" -iname "*.apk" | head -n 1)
    if [ -n "$APK_PATH" ]; then
      echo "📱 APK downloaded to:"
      echo "$APK_PATH"
    else
      echo "⚠️  Artifact downloaded but no .apk found inside. Contents:"
      find "$OUT_DIR" -type f
    fi
  else
    echo "❌ Couldn't download artifact. gh said:"
    cat "$TMP_DIR/gh_dl_err.log"
  fi
  exit 0
fi

# ── 4b. FAILURE: show exactly what broke ────────────────────────────────────
if [ "$CONCLUSION" = "failure" ]; then
  echo "❌ Build FAILED"
  echo ""
  echo "Which step failed:"
  $GH run view "$RUN_ID" --json jobs -q '.jobs[].steps[] | select(.conclusion=="failure") | "  → " + .name'
  echo ""
  echo "──────────────────────────────────────────"
  echo "Error log (failed step only):"
  echo "──────────────────────────────────────────"
  $GH run view "$RUN_ID" --log-failed | tail -n 150
  echo "──────────────────────────────────────────"
  $GH run view "$RUN_ID" --log-failed > "$TMP_DIR/last_failed_build.log"
  echo "(full log saved to $TMP_DIR/last_failed_build.log)"
  exit 1
fi

echo "⚠️  Conclusion: '$CONCLUSION' (status was '$STATUS')"
