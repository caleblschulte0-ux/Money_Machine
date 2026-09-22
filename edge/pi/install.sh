#!/usr/bin/env bash
# Install the edge agent on a Raspberry Pi (Raspberry Pi OS Bookworm or later).
#   bash install.sh
set -euo pipefail
cd "$(dirname "$0")"
sudo apt-get update
sudo apt-get install -y python3-picamera2 python3-opencv python3-numpy python3-gpiozero python3-pip
sudo pip3 install --break-system-packages -r requirements.txt
# DS18B20 needs the 1-wire overlay
if ! grep -q "^dtoverlay=w1-gpio" /boot/firmware/config.txt 2>/dev/null; then
    echo "dtoverlay=w1-gpio" | sudo tee -a /boot/firmware/config.txt
    echo "1-wire enabled; reboot once before the temperature probe reads."
fi
sudo mkdir -p /opt/fishai-edge
sudo cp fishai_edge.py /opt/fishai-edge/
sudo cp fishai-edge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fishai-edge
echo "running: curl http://$(hostname -I | awk '{print $1}'):8000/status"
