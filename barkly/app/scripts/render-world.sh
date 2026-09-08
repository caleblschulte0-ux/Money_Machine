#!/usr/bin/env bash
# Render the world and promote it, in one sequential process.
#
# WHY THIS EXISTS. The render packs take minutes, so it is tempting to
# background them and poll. Every hand-rolled poll in one session was written
# as `until [ "$(pgrep -fc blender)" = "0" ]` -- which matches the shell running
# the loop, because that shell's own command line contains the word "blender".
# The loop waited on itself and never exited. An hour of apparent render time
# was a deadlock; the scene pack takes under a minute.
#
# There is nothing to poll if the steps are sequential in one process. Run this
# and wait for it. If you must background it, background THIS, and match on the
# process name (`pgrep -x blender`) never the command line.
#
#   scripts/render-world.sh            # props, scenes, promote
#   scripts/render-world.sh props      # just the prop pack
#   scripts/render-world.sh scenes     # just the scene pack
set -euo pipefail
cd "$(dirname "$0")/.."

what="${1:-all}"

if [ "$what" = "all" ] || [ "$what" = "props" ]; then
  echo "== prop pack =="
  blender -b --python tools/blender/world_prop_pack.py | grep -E '^rendered|^PROP_ONLY' || true
fi

if [ "$what" = "all" ] || [ "$what" = "scenes" ]; then
  echo "== scene pack =="
  blender -b --python tools/blender/world_scene_pack.py | grep -E '^rendered|^SCENE_ONLY' || true
fi

echo "== promote =="
# Refuses a partial pass and a render older than the builder, so a half-finished
# render cannot reach assets/. See the header of promote-props.py.
python3 scripts/promote-props.py
