# Dataset manifests

One JSON per exported dataset (`fishai export dataset --name NAME`): which videos, how many frames and boxes, the detector that produced the boxes, the confidence floor, the config hash. The frames and labels themselves are git-ignored; the manifest is the committed record of what was exported.
