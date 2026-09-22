"""Notifications: how an alert reaches a person.

Backends, all configured under ``notify.backends`` and chosen per install:

log       always available; writes to the log (and the ``events`` table)
ntfy      POST to an ntfy topic (https://ntfy.sh or self-hosted): phone push
          with zero accounts; topic name is the secret, keep it unguessable
webhook   POST JSON to any URL (Home Assistant, Discord, Slack, your own)
email     SMTP; the password comes from the FISHAI_SMTP_PASSWORD
          environment variable, never from a config file

A failed backend never raises into the caller: the failure is logged and
recorded, and the next backend still runs. ``min_severity`` filters what
is worth a person's attention; ``ok`` and ``info`` stay in the database.
"""

from __future__ import annotations

import json
import os
import smtplib
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from email.message import EmailMessage
from typing import Any

from fishai.log import get_logger

log = get_logger(__name__)

SEVERITY_RANK = {"ok": 0, "info": 1, "warning": 2, "critical": 3}


@dataclass
class Notification:
    title: str
    message: str
    severity: str = "info"
    data: dict[str, Any] = field(default_factory=dict)
    tags: list[str] = field(default_factory=list)


class LogBackend:
    kind = "log"

    def __init__(self, cfg: dict[str, Any]) -> None:
        pass

    def send(self, n: Notification) -> None:
        log.warning("NOTIFY [%s] %s: %s", n.severity, n.title, n.message)


class NtfyBackend:
    kind = "ntfy"

    def __init__(self, cfg: dict[str, Any]) -> None:
        self.url = f"{str(cfg.get('server', 'https://ntfy.sh')).rstrip('/')}/{cfg['topic']}"
        self.timeout_s = float(cfg.get("timeout_s", 10))

    def send(self, n: Notification) -> None:
        priority = {"ok": "2", "info": "3", "warning": "4", "critical": "5"}.get(n.severity, "3")
        req = urllib.request.Request(
            self.url, data=n.message.encode("utf-8"), method="POST",
            headers={"Title": n.title, "Priority": priority, "Tags": ",".join(n.tags or ["fish"]), "Content-Type": "text/plain; charset=utf-8"},
        )
        with urllib.request.urlopen(req, timeout=self.timeout_s):  # noqa: S310 - configured URL
            pass


class WebhookBackend:
    kind = "webhook"

    def __init__(self, cfg: dict[str, Any]) -> None:
        self.url = str(cfg["url"])
        self.timeout_s = float(cfg.get("timeout_s", 10))
        self.headers = dict(cfg.get("headers", {}))

    def send(self, n: Notification) -> None:
        body = json.dumps({"title": n.title, "message": n.message, "severity": n.severity, "data": n.data, "tags": n.tags}, default=str).encode()
        req = urllib.request.Request(self.url, data=body, method="POST", headers={"Content-Type": "application/json", **self.headers})
        with urllib.request.urlopen(req, timeout=self.timeout_s):  # noqa: S310 - configured URL
            pass


class EmailBackend:
    kind = "email"

    def __init__(self, cfg: dict[str, Any]) -> None:
        self.host = str(cfg["host"])
        self.port = int(cfg.get("port", 587))
        self.user = str(cfg.get("user", ""))
        self.password = os.environ.get(str(cfg.get("password_env", "FISHAI_SMTP_PASSWORD")), "")
        self.sender = str(cfg.get("from", self.user))
        self.to = [str(x) for x in (cfg.get("to") if isinstance(cfg.get("to"), list) else [cfg.get("to")]) if x]
        self.starttls = bool(cfg.get("starttls", True))
        self.timeout_s = float(cfg.get("timeout_s", 20))

    def send(self, n: Notification) -> None:
        msg = EmailMessage()
        msg["Subject"] = f"[FishAI {n.severity}] {n.title}"
        msg["From"] = self.sender
        msg["To"] = ", ".join(self.to)
        body = n.message
        if n.data:
            body += "\n\n" + json.dumps(n.data, indent=2, default=str)
        msg.set_content(body)
        with smtplib.SMTP(self.host, self.port, timeout=self.timeout_s) as s:
            if self.starttls:
                s.starttls()
            if self.user:
                s.login(self.user, self.password)
            s.send_message(msg)


_BACKENDS = {"log": LogBackend, "ntfy": NtfyBackend, "webhook": WebhookBackend, "email": EmailBackend}


class Notifier:
    def __init__(self, cfg: dict[str, Any] | None, db: Any = None) -> None:
        cfg = cfg or {}
        self.min_severity = str(cfg.get("min_severity", "warning"))
        self.db = db
        self.backends: list[Any] = []
        for entry in cfg.get("backends") or [{"kind": "log"}]:
            kind = entry.get("kind")
            if kind not in _BACKENDS:
                log.error("unknown notify backend %r", kind)
                continue
            try:
                self.backends.append(_BACKENDS[kind](entry))
            except (KeyError, ValueError, TypeError) as exc:
                log.error("notify backend %s misconfigured: %s", kind, exc)

    def should_send(self, severity: str) -> bool:
        return SEVERITY_RANK.get(severity, 1) >= SEVERITY_RANK.get(self.min_severity, 2)

    def send(self, n: Notification, force: bool = False) -> dict[str, Any]:
        """Send to every backend; returns {backend_kind: 'sent' | error text}. Never raises."""
        outcome: dict[str, Any] = {}
        if not force and not self.should_send(n.severity):
            outcome["skipped"] = f"severity {n.severity} below {self.min_severity}"
            return outcome
        for b in self.backends:
            try:
                b.send(n)
                outcome[b.kind] = "sent"
            except (urllib.error.URLError, OSError, smtplib.SMTPException, ValueError) as exc:
                log.error("notify via %s failed: %s", b.kind, exc)
                outcome[b.kind] = f"failed: {exc}"
        if self.db is not None:
            try:
                self.db.add_event("notification", {"title": n.title, "severity": n.severity, "outcome": outcome, "message": n.message[:500]})
            except Exception as exc:  # the journal must not break the alert
                log.error("could not journal notification: %s", exc)
        return outcome


def assessment_notification(assessment: dict[str, Any], deviations: list[dict[str, Any]] | None = None, context: str = "") -> Notification:
    sev = str(assessment.get("severity", "info"))
    obs = list(assessment.get("observations", []))[:5]
    checks = list(assessment.get("recommended_checks", []))[:4]
    lines = obs + ([""] + ["Check: " + c for c in checks] if checks else [])
    title = {"critical": "Tank needs attention now", "warning": "Something is off in the tank", "info": "Tank note", "ok": "Tank is fine"}.get(sev, "Tank")
    if context:
        title += f" ({context})"
    return Notification(title, "\n".join(lines) or "No details", sev, {"source": assessment.get("source"), "deviations": deviations or []}, ["fish"])
