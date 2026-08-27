#!/usr/bin/env python3
"""Synthesize one line of Barkly and write mp3 bytes to stdout.

Called by the proxy's /v1/voice route. Three engines, tried in order, all of
which sound like a person rather than a 1990s screen reader:

  1. KOKORO   local neural ONNX, no network, no key. Best when the models are
              already on disk (BARKLY_KOKORO_DIR).
  2. EDGE     Microsoft Edge's neural voices over the network. NO API KEY AT
              ALL, which is why it is the default: a working Barkly voice with
              nothing to sign up for.
  3. GEMINI   style-controllable, needs GEMINI_API_KEY.

This is the same ladder Shorts-pipeline already runs in production
(make_explainer_stacked.py), reused rather than reinvented.

Barkly is a small dog, so the voice is pitched UP and slightly fast. That is
what turns a normal adult narrator voice into something small and impatient.

stdout is BINARY audio; every diagnostic goes to stderr so it cannot corrupt
the stream.
"""
from __future__ import annotations

import os
import ssl
import sys
import tempfile
from pathlib import Path

VOICE = os.environ.get("BARKLY_TTS_VOICE", "en-GB-RyanNeural")
RATE = os.environ.get("BARKLY_TTS_RATE", "+8%")
PITCH = os.environ.get("BARKLY_TTS_PITCH", "+20Hz")
ENGINE = os.environ.get("BARKLY_TTS_ENGINE", "auto").lower()

# The proxy runs behind an agent proxy in some environments; trust the system
# bundle explicitly rather than letting a default CA path fail silently.
CA_BUNDLE = os.environ.get("BARKLY_CA_BUNDLE") or "/etc/ssl/certs/ca-certificates.crt"


def log(msg: str) -> None:
    print(f"[say] {msg}", file=sys.stderr, flush=True)


def kokoro(text: str) -> bytes | None:
    """Local neural TTS. Silent no-op when the models are not downloaded."""
    d = os.environ.get("BARKLY_KOKORO_DIR")
    if not d:
        return None
    model = Path(d) / "kokoro-v1.0.onnx"
    voices = Path(d) / "voices-v1.0.bin"
    if not (model.exists() and voices.exists()):
        return None
    try:
        import soundfile as sf  # type: ignore
        from kokoro_onnx import Kokoro  # type: ignore
    except Exception as e:  # noqa: BLE001
        log(f"kokoro unavailable ({type(e).__name__})")
        return None
    try:
        k = Kokoro(str(model), str(voices))
        samples, rate = k.create(
            text,
            voice=os.environ.get("BARKLY_KOKORO_VOICE", "am_adam"),
            speed=float(os.environ.get("BARKLY_KOKORO_SPEED", "1.08")),
        )
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            sf.write(tmp.name, samples, rate)
            return Path(tmp.name).read_bytes()
    except Exception as e:  # noqa: BLE001
        log(f"kokoro failed ({type(e).__name__}: {e})")
        return None


def edge(text: str) -> bytes | None:
    """Microsoft Edge neural voices. No key, no model download."""
    try:
        import edge_tts.communicate as _ec  # type: ignore

        if Path(CA_BUNDLE).exists():
            _ec._SSL_CTX = ssl.create_default_context(cafile=CA_BUNDLE)
        import asyncio

        import edge_tts  # type: ignore
    except Exception as e:  # noqa: BLE001
        log(f"edge-tts unavailable ({type(e).__name__}) - pip install edge-tts")
        return None

    async def run() -> bytes:
        chunks: list[bytes] = []
        comm = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
        async for part in comm.stream():
            if part["type"] == "audio":
                chunks.append(part["data"])
        return b"".join(chunks)

    try:
        return asyncio.run(run()) or None
    except Exception as e:  # noqa: BLE001
        log(f"edge-tts failed ({type(e).__name__}: {e})")
        return None


def gemini(text: str) -> bytes | None:
    """Gemini TTS. Needs a key, so it is last rather than first."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    import base64
    import json
    import struct
    import urllib.request

    style = os.environ.get(
        "BARKLY_GEMINI_STYLE",
        "Say this as a small, deadpan, slightly vain dog - blunt, funny, "
        "impatient, never sappy",
    )
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-2.5-flash-preview-tts:generateContent?key=" + key
    )
    body = {
        "contents": [{"parts": [{"text": f"{style}: {text}"}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {
                        "voiceName": os.environ.get("BARKLY_GEMINI_VOICE", "Puck")
                    }
                }
            },
        },
    }
    try:
        req = urllib.request.Request(
            url, data=json.dumps(body).encode(), headers={"content-type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
        b64 = data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
        pcm = base64.b64decode(b64)
        # 24kHz mono 16-bit PCM -> WAV, which players accept directly.
        header = (
            b"RIFF"
            + struct.pack("<I", 36 + len(pcm))
            + b"WAVEfmt "
            + struct.pack("<IHHIIHH", 16, 1, 1, 24000, 24000 * 2, 2, 16)
            + b"data"
            + struct.pack("<I", len(pcm))
        )
        return header + pcm
    except Exception as e:  # noqa: BLE001
        log(f"gemini failed ({type(e).__name__}: {e})")
        return None


ENGINES = {"kokoro": kokoro, "edge": edge, "gemini": gemini}
# Edge first: it is the only one that works with nothing configured at all.
ORDER = ["edge", "kokoro", "gemini"]


def main() -> int:
    text = sys.stdin.read().strip()
    if not text:
        log("no text on stdin")
        return 2

    order = [ENGINE] if ENGINE in ENGINES else ORDER
    for name in order:
        audio = ENGINES[name](text)
        if audio:
            log(f"{name}: {len(audio)} bytes")
            sys.stdout.buffer.write(audio)
            sys.stdout.buffer.flush()
            return 0
    log("every engine failed")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
