#!/usr/bin/env bash
# Detect duplicate method signatures inside a single Java class file.
# Catches the "method X is already defined" build failure earlier than Gradle.
# Strips /* ... */ block comments and // line comments before matching.
set -euo pipefail

ROOT="android/app/src/main/java"
[[ -d "$ROOT" ]] || { echo "skip: $ROOT not present"; exit 0; }

fail=0
while IFS= read -r -d '' file; do
  # Strip block comments (multiline) + line comments, then extract signatures.
  stripped=$(python3 -c "
import re, sys
src = open('$file').read()
src = re.sub(r'/\*.*?\*/', '', src, flags=re.DOTALL)
src = re.sub(r'//[^\n]*', '', src)
sys.stdout.write(src)
")
  sigs=$(printf '%s\n' "$stripped" \
    | { grep -E '^[[:space:]]*(public|private|protected)[^=;]*\([^)]*\)[[:space:]]*\{?[[:space:]]*$' || true; } \
    | sed -E 's/[[:space:]]+/ /g' \
    | sed -E 's/\{[[:space:]]*$//' \
    | sort | uniq -c | awk '$1 > 1 { print }')
  if [[ -n "$sigs" ]]; then
    echo "❌ Duplicate method signature(s) in $file:"
    echo "$sigs"
    fail=1
  fi
done < <(find "$ROOT" -type f -name '*.java' -print0)

if [[ $fail -ne 0 ]]; then
  echo ""
  echo "Duplicate Java methods detected — fix before Gradle build."
  exit 1
fi
echo "✅ No duplicate Java method signatures found."
