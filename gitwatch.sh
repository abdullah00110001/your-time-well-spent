#!/bin/bash

# Simple gitwatch — Error + Fix only

set -o pipefail

# Colors
RED='\e[0;31m'
GREEN='\e[0;32m'
YELLOW='\e[1;33m'
CYAN='\e[0;36m'
GRAY='\e[0;90m'
RESET='\e[0m'

gitwatch() {
  local runid runurl

  # Get latest run
  runid=$(gh run list -L 1 --json databaseId -q '.[0].databaseId' 2>/dev/null)
  [[ -z "$runid" ]] && printf "${RED}❌ No builds found${RESET}\n" && return 1

  runurl=$(gh run view "$runid" --json url -q '.url' 2>/dev/null)

  # Watch
  if gh run watch "$runid" --exit-status 2>/dev/null; then
    printf "\n${GREEN}✅ BUILD SUCCESS${RESET}\n\n"
  else
    printf "\n${RED}❌ BUILD FAILED${RESET}\n${GRAY}$runurl${RESET}\n\n"

    # Get errors
    local errors=$(
      gh run view "$runid" --json jobs -q \
        '.jobs[] | select(.conclusion=="failure") | .databaseId' 2>/dev/null |
      xargs -I {} gh run view --log --job={} 2>/dev/null |
      grep -E "error:" |
      grep -v "warning:" |
      sed -E 's|^.*life-os-[0-9]+/||g' |
      sed -E 's|^.*/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z[[:space:]]*||g' |
      sed -E 's|^[[:space:]]*||g' |
      sort -u
    )

    [[ -z "$errors" ]] && return 1

    # Print errors with fixes
    local idx=1
    while IFS= read -r err; do
      printf "${RED}%2d. %s${RESET}\n" "$idx" "$err"

      # Auto-detect fix
      if echo "$err" | grep -q "tensorflow\|tflite\|GpuDelegate\|Interpreter"; then
        printf "${GREEN}   ✓ Fix:${RESET} Add to ${CYAN}android/app/build.gradle${RESET} → ${CYAN}dependencies{}${RESET}\n"
        printf "      ${CYAN}implementation 'org.tensorflow:tensorflow-lite:2.14.0'${RESET}\n"
        printf "      ${CYAN}implementation 'org.tensorflow:tensorflow-lite-gpu:2.14.0'${RESET}\n"
        printf "      ${CYAN}implementation 'org.tensorflow:tensorflow-lite-support:0.4.4'${RESET}\n"
        printf "      Then add inside ${CYAN}android{}${RESET}: ${CYAN}aaptOptions { noCompress \"tflite\" }${RESET}\n"

      elif echo "$err" | grep -q "PureShield\|pureShield"; then
        printf "${GREEN}   ✓ Fix:${RESET} Add imports to ${CYAN}PureShieldPlugin.java${RESET}:\n"
        printf "      ${CYAN}import com.mylifeos.app.shield.vision.PureShieldConfig;${RESET}\n"
        printf "      ${CYAN}import com.mylifeos.app.shield.vision.PureShieldService;${RESET}\n"

      elif echo "$err" | grep -q "does not exist\|cannot find symbol"; then
        printf "${GREEN}   ✓ Fix:${RESET} Check imports in Java file, or add to ${CYAN}build.gradle${RESET}\n"

      elif echo "$err" | grep -q "should be declared in a file named"; then
        local fname=$(echo "$err" | grep -oE 'named [A-Za-z0-9_]+\.java' | sed 's/named //')
        printf "${GREEN}   ✓ Fix:${RESET} Rename file to ${CYAN}$fname${RESET}\n"

      elif echo "$err" | grep -q "exported\|service\|manifest"; then
        printf "${GREEN}   ✓ Fix:${RESET} Add to ${CYAN}AndroidManifest.xml${RESET} before ${CYAN}</application>{{RESET}}:\n"
        printf "      ${CYAN}<service android:name=\"com.mylifeos.app.shield.vision.PureShieldService\"${RESET}\n"
        printf "      ${CYAN}    android:foregroundServiceType=\"mediaProjection\"${RESET}\n"
        printf "      ${CYAN}    android:exported=\"false\" />${RESET}\n"

      fi

      printf "\n"
      ((idx++))
    done <<< "$errors"

    # Summary
    local count=$(echo "$errors" | wc -l)
    printf "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
    printf "${YELLOW}Total: $count errors${RESET}\n"
    printf "${GRAY}Logs: $runurl${RESET}\n\n"
  fi
}

gitwatch "$@"

