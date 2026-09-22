"""The detector lab: everything needed to build OUR fish detector.

camera.py    the rail camera's geometry (refraction through glass, coverage)
sprites.py   real fish cut out of licensed footage, plus procedural fish
plates.py    fish-free tank backgrounds from real footage, plus procedural ones
render.py    synthetic tanks rendered from the rail camera, with exact labels
yolo.py      reading and writing YOLO-format datasets, mixing, splitting
silver.py    real footage auto-labelled by the bootstrap detector (for evaluation)
trainer.py   training our own detector (torchvision; no Ultralytics)
evaluate.py  scoring any detector against any labelled set
"""
