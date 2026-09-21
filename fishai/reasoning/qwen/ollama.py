"""Ollama client for a local Qwen (or any local chat model).

Uses only the standard library so the reasoner has no extra dependency.
The model is asked for JSON with Ollama's ``format`` schema so most
replies are already valid; ``schema.validate`` is still the gate.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from fishai.log import get_logger
from fishai.reasoning.base import register_reasoner
from fishai.reasoning.qwen.prompt import SYSTEM_PROMPT, build_user_prompt
from fishai.reasoning.schema import RESPONSE_FORMAT, Assessment, extract_json, validate

log = get_logger(__name__)


class OllamaReasoner:
    name = "ollama"

    def __init__(
        self,
        host: str = "http://127.0.0.1:11434",
        model: str = "qwen2.5:7b",
        timeout_s: float = 120.0,
        temperature: float = 0.1,
        keep_alive: str = "5m",
        transport: Any | None = None,
    ) -> None:
        self.host = host.rstrip("/")
        self.model = model
        self.timeout_s = timeout_s
        self.temperature = temperature
        self.keep_alive = keep_alive
        # ``transport(path, payload_or_None) -> dict`` lets tests substitute the HTTP call.
        self._transport = transport or self._http

    # ------------------------------------------------------------ transport
    def _http(self, path: str, payload: dict[str, Any] | None) -> dict[str, Any]:
        url = f"{self.host}{path}"
        data = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST" if data else "GET")
        with urllib.request.urlopen(req, timeout=self.timeout_s) as resp:  # noqa: S310 - local host from config
            return json.loads(resp.read().decode())

    def available(self) -> bool:
        try:
            tags = self._transport("/api/tags", None)
        except (urllib.error.URLError, OSError, ValueError) as exc:
            log.info("ollama not reachable at %s: %s", self.host, exc)
            return False
        names = {m.get("name", "") for m in tags.get("models", [])}
        base = self.model.split(":")[0]
        ok = self.model in names or any(n.split(":")[0] == base for n in names)
        if not ok:
            log.warning("ollama is up but model %s is not pulled (have: %s)", self.model, ", ".join(sorted(names)) or "none")
        return ok

    # --------------------------------------------------------------- assess
    def assess(self, state: dict[str, Any]) -> Assessment:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_user_prompt(state)},
            ],
            "stream": False,
            "format": RESPONSE_FORMAT,
            "keep_alive": self.keep_alive,
            "options": {"temperature": self.temperature},
        }
        try:
            reply = self._transport("/api/chat", payload)
        except (urllib.error.URLError, OSError, ValueError) as exc:
            raise ReasonerUnavailable(f"ollama call failed: {exc}") from exc
        content = (reply.get("message") or {}).get("content", "")
        raw = extract_json(content) if isinstance(content, str) else content
        a = validate(raw, source=f"ollama:{self.model}")
        if raw is None:
            log.warning("model returned no JSON; first 200 chars: %r", content[:200])
        return a


class ReasonerUnavailable(RuntimeError):
    """The configured model could not be reached; callers fall back to rules."""


@register_reasoner("ollama")
def _build(cfg: dict[str, Any]) -> OllamaReasoner:
    sub = dict(cfg.get("ollama", {}))
    return OllamaReasoner(**sub)
