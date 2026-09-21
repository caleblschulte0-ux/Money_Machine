"""Command line: ``python -m fishai <command>`` or ``fishai <command>``.

    fishai demo                         synthetic tank through the whole pipeline
    fishai process VIDEO [...]          detect, track, measure, store, summarise, annotate
    fishai baseline                     recompute per-fish baselines from every stored session
    fishai deviations VIDEO_ID          compare one session with its baselines
    fishai assess [VIDEO_ID]            build state, run the reasoner (Qwen or rules), store the verdict
    fishai sensors                      read the configured sensors once
    fishai control ACTION [k=v ...]     request an action through permissions and safety
    fishai approve ACTION [k=v ...]     the owner's yes for an approval-tier action
    fishai status                       what the database holds
    fishai doctor                       what is installed, what is downloaded, what will work
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from fishai import __version__
from fishai.config import Config, load_config
from fishai.log import get_logger, setup_logging

log = get_logger("fishai")


def _add_common(p: argparse.ArgumentParser) -> None:
    p.add_argument("--config", "-c", help="override YAML merged over configs/default.yaml")
    p.add_argument("--set", "-o", action="append", default=[], metavar="KEY=VALUE", help="dotted override, e.g. -o tracking.backend=bytetrack")
    p.add_argument("--db", help="SQLite path (overrides paths.database)")
    p.add_argument("--log-level", default="INFO")
    p.add_argument("--json", action="store_true", help="print machine-readable output")


def _cfg(args: argparse.Namespace) -> Config:
    overrides = list(args.set)
    if getattr(args, "db", None):
        overrides.append(f"paths.database={args.db}")
    return load_config(args.config, overrides)


def _kv(pairs: list[str]) -> dict[str, Any]:
    import yaml

    out: dict[str, Any] = {}
    for p in pairs:
        if "=" not in p:
            raise SystemExit(f"expected key=value, got {p!r}")
        k, v = p.split("=", 1)
        out[k] = yaml.safe_load(v)
    return out


def _emit(args: argparse.Namespace, obj: Any, text: str | None = None) -> None:
    if args.json or text is None:
        print(json.dumps(obj, indent=2, default=str))
    else:
        print(text)


# ------------------------------------------------------------------ commands
def cmd_process(args: argparse.Namespace) -> int:
    from fishai.pipeline import process_video

    cfg = _cfg(args)
    if args.detector:
        cfg.set_path("detection.backend", args.detector)
    if args.tracker:
        cfg.set_path("tracking.backend", args.tracker)
    if args.stride:
        cfg.set_path("video.frame_stride", args.stride)
    if args.max_frames:
        cfg.set_path("video.max_frames", args.max_frames)
    if args.max_side:
        cfg.set_path("video.max_side", args.max_side)
    results = []
    for video in args.videos:
        r = process_video(video, cfg, output_dir=args.output, annotate=not args.no_annotate)
        results.append(r)
        c = r.summary["counts"]
        _emit(
            args,
            r.summary,
            f"{video}: {r.summary['pipeline']['processed_frames']} frames, {r.observations} observations, "
            f"{c['tracks']} tracks, ~{c['distinct_fish_estimate']} fish, {r.elapsed_s:.1f}s\n"
            f"  summary:   {r.summary_path}\n  annotated: {r.annotated_path or '(off)'}",
        )
    if args.then_baseline and results:
        return cmd_baseline(args)
    return 0


def cmd_demo(args: argparse.Namespace) -> int:
    from fishai.video.synthetic import SyntheticAquarium

    cfg = _cfg(args)
    out = Path(args.output or cfg.resolve_path("paths.output_dir"))
    out.mkdir(parents=True, exist_ok=True)
    path = out / "demo_tank.mp4"
    SyntheticAquarium(n_fish=args.fish, seed=args.seed, hide_fish=2 if args.fish >= 2 else None, hide_between=(80, 140)).write(path, args.frames)
    print(f"wrote synthetic tank {path} ({args.fish} fish, {args.frames} frames)")
    args.videos = [str(path)]
    args.detector = args.detector or "motion"
    args.tracker = args.tracker or None
    args.stride = None
    args.max_frames = None
    args.max_side = None
    args.no_annotate = False
    args.then_baseline = False
    return cmd_process(args)


def cmd_baseline(args: argparse.Namespace) -> int:
    from fishai.perception.behavior.baselines import update_baselines
    from fishai.storage import Database

    cfg = _cfg(args)
    with Database(cfg.resolve_path("paths.database")) as db:
        result = update_baselines(db, cfg.section("baselines"))
    lines = []
    for fish_id, metrics in sorted(result.items()):
        parts = ", ".join(f"{m}={s['mean']:.2f}±{s['std']:.2f} (n={s['n']})" for m, s in metrics.items())
        lines.append(f"fish {fish_id}: {parts}")
    _emit(args, result, "\n".join(lines) or "no fish with sessions yet")
    return 0


def cmd_deviations(args: argparse.Namespace) -> int:
    from fishai.perception.behavior.baselines import deviations_for_video
    from fishai.storage import Database

    cfg = _cfg(args)
    with Database(cfg.resolve_path("paths.database")) as db:
        vid = _resolve_video_id(db, args.video_id)
        devs = deviations_for_video(db, vid, cfg.section("baselines"), persist=not args.dry_run)
    _emit(args, [d.to_dict() for d in devs], "\n".join(f"[{d.severity}] {d.sentence()}" for d in devs) or "no deviations (or not enough history yet)")
    return 0


def cmd_assess(args: argparse.Namespace) -> int:
    from fishai.control import ControlExecutor
    from fishai.perception.behavior.baselines import deviations_for_video
    from fishai.reasoning import assess, build_state
    from fishai.sensors import SensorHub, build_sensors
    from fishai.storage import Database

    cfg = _cfg(args)
    with Database(cfg.resolve_path("paths.database")) as db:
        vid = _resolve_video_id(db, args.video_id) if args.video_id != "none" else None
        devs = deviations_for_video(db, vid, cfg.section("baselines"), persist=False) if vid else []
        hub = SensorHub(build_sensors(cfg.get("sensors", [])), limits=cfg.get("sensor_limits", {}))
        readings = hub.read_all(db)
        executor = ControlExecutor(db, cfg.section("control"))
        state = build_state(db, vid, devs, SensorHub.state_for_reasoner(readings), executor.actuator.state(), db.events(limit=10))
        rcfg = dict(cfg.section("reasoning"))
        result = assess(state, rcfg, db=db, reasoner=None if not args.rules else __import__("fishai.reasoning.rules", fromlist=["RulesReasoner"]).RulesReasoner(), video_id=vid)
        actions = executor.run_assessment_actions(result.safe_actions) if args.act else []
    text = [f"severity: {result.severity}  (source: {result.source}, confidence {result.confidence:.2f})"]
    text += [f"  - {o}" for o in result.observations]
    if result.possible_causes:
        text.append("possible causes: " + "; ".join(result.possible_causes))
    if result.recommended_checks:
        text.append("recommended checks:")
        text += [f"  * {c}" for c in result.recommended_checks]
    if result.safe_actions:
        text.append("proposed safe actions: " + ", ".join(result.safe_actions))
    for a in actions:
        text.append(f"  {a['action']}: {'ran' if a['executed'] else 'not run'} ({a['reason']})")
    if result.dropped:
        text.append("validator dropped: " + "; ".join(result.dropped))
    _emit(args, {"assessment": result.to_dict(), "actions": actions, "state": state}, "\n".join(text))
    return 0


def cmd_sensors(args: argparse.Namespace) -> int:
    from fishai.sensors import SensorHub, build_sensors
    from fishai.storage import Database

    cfg = _cfg(args)
    hub = SensorHub(build_sensors(cfg.get("sensors", [])))
    with Database(cfg.resolve_path("paths.database")) as db:
        readings = hub.read_all(db if args.store else None)
    _emit(args, {k: r.to_dict() for k, r in readings.items()}, "\n".join(f"{k}: {r.value:.2f} {r.unit} [{r.status}, {r.source}]" for k, r in readings.items()))
    return 0


def cmd_control(args: argparse.Namespace) -> int:
    from fishai.control import ControlExecutor
    from fishai.storage import Database

    cfg = _cfg(args)
    with Database(cfg.resolve_path("paths.database")) as db:
        ex = ControlExecutor(db, cfg.section("control"))
        fn = ex.approve if args.cmd == "approve" else ex.request
        r = fn(args.action, _kv(args.params), "owner" if args.cmd == "approve" else "cli")
    _emit(args, r, f"{r['action']}: {'executed' if r['executed'] else 'NOT executed'} - {r['reason']}")
    return 0 if r["executed"] or args.cmd == "control" else 1


def cmd_status(args: argparse.Namespace) -> int:
    from fishai.storage import Database

    cfg = _cfg(args)
    with Database(cfg.resolve_path("paths.database")) as db:
        videos = db.list_videos()
        fish = db.list_fish()
        anomalies = db.anomalies()
        assessments = db.assessments(limit=3)
        pending = [a for a in db.actions(limit=100) if a["permission"] == "pending"]
    obj = {"database": str(cfg.resolve_path("paths.database")), "videos": len(videos), "fish": len(fish), "anomalies": len(anomalies), "pending_actions": pending, "latest_assessments": assessments}
    lines = [f"database: {obj['database']}", f"videos processed: {len(videos)}", f"fish known: {len(fish)}", f"anomalies recorded: {len(anomalies)}"]
    for v in videos[-5:]:
        lines.append(f"  {v['video_id']}  {Path(v['path']).name}  {v['duration_s']:.1f}s  {v['detector']}/{v['tracker']}  {v['processed_at']}")
    if pending:
        lines.append("pending approvals: " + ", ".join(f"{a['action']} {a['params']}" for a in pending))
    for a in assessments:
        lines.append(f"assessment {a['recorded_at']}: {a['severity']} via {a['backend']} ({a['model']})")
    _emit(args, obj, "\n".join(lines))
    return 0


def cmd_doctor(args: argparse.Namespace) -> int:
    from fishai.doctor import run_doctor

    cfg = _cfg(args)
    report = run_doctor(cfg, check_ollama=not args.offline)
    lines = [f"FishAI {__version__}"]
    for item in report["checks"]:
        mark = {"ok": "OK ", "warn": "!! ", "fail": "XX "}[item["status"]]
        lines.append(f"{mark} {item['name']}: {item['detail']}")
    lines.append(f"ready: {report['ready']}")
    _emit(args, report, "\n".join(lines))
    return 0 if report["ready"] else 1


def _resolve_video_id(db: Any, ref: str) -> str:
    """Accept a video id, a prefix of one, a path, or 'latest'."""
    videos = db.list_videos()
    if not videos:
        raise SystemExit("no videos processed yet")
    if ref == "latest":
        return videos[-1]["video_id"]
    exact = [v for v in videos if v["video_id"] == ref or v["path"] == ref or Path(v["path"]).name == ref]
    if exact:
        return exact[0]["video_id"]
    pref = [v for v in videos if v["video_id"].startswith(ref)]
    if len(pref) == 1:
        return pref[0]["video_id"]
    raise SystemExit(f"no unique video matches {ref!r}; try `fishai status`")


# -------------------------------------------------------------------- parser
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="fishai", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--version", action="version", version=f"fishai {__version__}")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("process", help="process one or more videos")
    s.add_argument("videos", nargs="+")
    s.add_argument("--detector", choices=["motion", "yolo", "synthetic"])
    s.add_argument("--tracker", choices=["simple", "bytetrack"])
    s.add_argument("--stride", type=int)
    s.add_argument("--max-frames", type=int)
    s.add_argument("--max-side", type=int)
    s.add_argument("--output", help="directory for summaries and annotated video")
    s.add_argument("--no-annotate", action="store_true")
    s.add_argument("--then-baseline", action="store_true", help="recompute baselines afterwards")
    _add_common(s)
    s.set_defaults(fn=cmd_process)

    s = sub.add_parser("demo", help="generate a synthetic tank and run the pipeline on it")
    s.add_argument("--fish", type=int, default=3)
    s.add_argument("--frames", type=int, default=300)
    s.add_argument("--seed", type=int, default=7)
    s.add_argument("--detector", choices=["motion", "yolo"])
    s.add_argument("--tracker", choices=["simple", "bytetrack"])
    s.add_argument("--output")
    _add_common(s)
    s.set_defaults(fn=cmd_demo)

    s = sub.add_parser("baseline", help="recompute per-fish baselines")
    _add_common(s)
    s.set_defaults(fn=cmd_baseline)

    s = sub.add_parser("deviations", help="compare a session to its baselines")
    s.add_argument("video_id", nargs="?", default="latest")
    s.add_argument("--dry-run", action="store_true", help="do not store the anomalies")
    _add_common(s)
    s.set_defaults(fn=cmd_deviations)

    s = sub.add_parser("assess", help="run the reasoner over the current state")
    s.add_argument("video_id", nargs="?", default="latest", help="video id, 'latest', or 'none'")
    s.add_argument("--rules", action="store_true", help="use the deterministic reasoner even if a model is available")
    s.add_argument("--act", action="store_true", help="send proposed safe actions through the control layer")
    _add_common(s)
    s.set_defaults(fn=cmd_assess)

    s = sub.add_parser("sensors", help="read the configured sensors once")
    s.add_argument("--store", action="store_true", help="store the readings")
    _add_common(s)
    s.set_defaults(fn=cmd_sensors)

    for name, help_ in (("control", "request an action"), ("approve", "approve an approval-tier action (owner)")):
        s = sub.add_parser(name, help=help_)
        s.add_argument("action")
        s.add_argument("params", nargs="*", metavar="key=value")
        _add_common(s)
        s.set_defaults(fn=cmd_control)

    s = sub.add_parser("status", help="what the database holds")
    _add_common(s)
    s.set_defaults(fn=cmd_status)

    s = sub.add_parser("doctor", help="check the installation")
    s.add_argument("--offline", action="store_true", help="skip network checks (Ollama)")
    _add_common(s)
    s.set_defaults(fn=cmd_doctor)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    setup_logging(getattr(args, "log_level", "INFO"))
    try:
        return int(args.fn(args))
    except FileNotFoundError as exc:
        log.error("%s", exc)
        return 2
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
