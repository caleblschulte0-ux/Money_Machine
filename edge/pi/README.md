# FishAI edge agent (Raspberry Pi on the rail)

One Python file, standard-library server. It streams the camera with
locked exposure and colour, reads the temperature probe and float switch,
drives the feeder drum, and logs the FEED button, so the PC running FishAI
sees the rail as one URL.

```
PC:  fishai watch --source http://<pi>:8000/stream.mjpg
```

## Install on the Pi

```bash
git clone <repo>; cd <repo>/edge/pi
bash install.sh            # apt packages, 1-wire overlay, systemd service
sudo nano /etc/systemd/system/fishai-edge.service   # pins and camera settings
sudo systemctl restart fishai-edge
curl http://localhost:8000/status
```

## Wiring (BCM pins, all low voltage)

| Part | Pin (default) | Notes |
|---|---|---|
| DS18B20 temperature probe | GPIO4 (1-wire) | 4.7 k pull-up to 3.3 V; `--temp-unit F` |
| Float switch | 17 | to ground; closed = water at level |
| Feeder drum motor (via driver) | 27 | drive a MOSFET or motor board, never the pin directly |
| Drum home sensor (Hall or optical) | 22 | to ground; closes once per revolution |
| FEED button | 23 | to ground |
| IR-cut filter switch | optional `--ircut-pin` | |
| IR illuminator | optional `--irled-pin` | |

## Camera settings

Auto exposure and auto white balance are OFF. Set `--exposure-us`,
`--gain`, `--red-gain`, `--blue-gain` once for the tank's lighting and
leave them; FishAI's fish identity depends on colours not drifting. Check a
snapshot after changing the tank light:

```
curl -o snap.jpg http://<pi>:8000/snapshot.jpg
```

Day/night: `POST /camera/mode {"mode":"night"}` switches the IR-cut filter
and illuminator when wired. FishAI also detects the mode from the frames,
so identity never mixes colour footage with infrared footage.

## Try it anywhere

```
python3 fishai_edge.py --fake --port 8000
curl http://localhost:8000/status
curl -X POST -d '{"portions":1}' http://localhost:8000/feed
```
