#!/usr/bin/env bash
# Regenerate the ChatGPT handoff package. Run from barkly/handoff/ after any
# significant change so the package never goes stale:
#     ./build_handoff.sh
#
# Regenerates CODE_SNAPSHOT.md from live source, refreshes the concept sheet
# copy, and rebuilds barkly-handoff.zip. BARKLY_FOR_CHATGPT.md is hand-written
# — update it by hand when the product changes.
set -euo pipefail
cd "$(dirname "$0")"

FILES=(
  app/package.json app/app.json
  app/src/barkly/types.ts app/src/barkly/state.ts app/src/barkly/personality.ts
  app/src/barkly/prompts.ts app/src/barkly/memory.ts app/src/barkly/dialogue.ts
  app/src/barkly/greetings.ts
  app/src/world/locations.ts app/src/world/npcs.ts app/src/world/stash.ts app/src/world/thoughts.ts
  app/src/providers/types.ts app/src/providers/registry.ts
  app/src/providers/dialogue/anthropic.ts app/src/providers/dialogue/scripted.ts
  app/src/providers/stt/expoSpeechRecognitionStt.ts
  app/src/providers/tts/expoSpeechTts.ts app/src/providers/tts/elevenLabsTts.ts
  app/src/storage/types.ts app/src/storage/asyncStorageStore.ts app/src/storage/inMemoryStore.ts
  app/src/animation/renderer.ts app/src/hooks/useBarkly.ts
  app/src/ui/BarklyRoom.tsx app/src/ui/BarklyPhotoView.tsx app/src/ui/scenes/Scenes.tsx
  app/src/ui/StageProps.tsx app/src/ui/SettingsSheet.tsx
  app/App.tsx server/index.mjs
  app/__tests__/state.test.ts app/__tests__/memory.test.ts app/__tests__/prompts.test.ts
  app/__tests__/dialogue.test.ts app/__tests__/world.test.ts app/__tests__/stash.test.ts
  app/__tests__/greetings.test.ts
)

{
  echo "# Barkly — Complete Code Snapshot"
  echo
  echo "Every source file in the project, concatenated. Generated $(date -u +%Y-%m-%d)."
  echo
  echo "Stack: React Native + Expo SDK 57 + TypeScript. \`src/barkly/\` is the"
  echo "platform-agnostic brain, \`src/world/\` is the game world, \`src/providers/\` are"
  echo "swappable vendor adapters, \`src/ui/\` is the screen, \`server/\` is the key-holding"
  echo "proxy. Read \`BARKLY_FOR_CHATGPT.md\` first for context."
  echo
  echo "---"
  echo
  for f in "${FILES[@]}"; do
    ext="${f##*.}"
    case "$ext" in ts|tsx) lang=typescript;; mjs|js) lang=javascript;; json) lang=json;; *) lang=;; esac
    echo "## \`barkly/$f\`"; echo; echo "\`\`\`$lang"; cat "../$f"; echo "\`\`\`"; echo
  done
  echo "---"; echo
  echo "## Character canon: \`barkly/docs/CHARACTER.md\`"; echo; cat ../docs/CHARACTER.md; echo
  echo "---"; echo
  echo "## Architecture: \`barkly/docs/ARCHITECTURE.md\`"; echo; cat ../docs/ARCHITECTURE.md
} > CODE_SNAPSHOT.md

cp ../app/assets/barkly/concept/barkly-concept.png .
rm -f barkly-handoff.zip
zip -qr barkly-handoff.zip BARKLY_FOR_CHATGPT.md CODE_SNAPSHOT.md README.md barkly-concept.png screenshots/
echo "handoff rebuilt: $(du -h barkly-handoff.zip | cut -f1) zip, $(wc -l < CODE_SNAPSHOT.md) lines of code snapshot"
