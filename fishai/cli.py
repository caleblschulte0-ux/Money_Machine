"""Command line: ``python -m fishai <command>`` or ``fishai <command>``.

    fishai demo                         synthetic tank through the whole pipeline
    fishai process VIDEO [...]          detect, track, measure, store, summarise, annotate
    fishai baseline                     recompute per-fish baselines from every stored session
    fishai deviations VIDEO_ID          compare one session with its baselines
    fishai assess [VIDEO_ID]            build state, run the reasoner (Qwen or rules), store the verdict
    fishai sensors                      read the configured sensors once
    fishai control ACTION [k=v ...]     request an action through permissions and safety
    fishai approve ACTION [k=v ...]     the owner's yes for an approval-tier action
    fishai status                       what the database holds, and the live watcher if running
    fishai doctor                       what is installed, what is downloaded, what will work

    fishai watch --source 0|URL|FILE    the live loop: sessions, clips, status file (Ctrl+C or `fishai stop`)
    fishai feed [--video ID --at S]     mark a feeding (live, or at S seconds into a processed video)
    fishai clip [--note ...]            ask the running watcher to save the buffer as a clip
    fishai stop                         ask the running watcher to stop
    fishai ingest FOLDER [--watch]      process every new video file in a folder
    fishai daily [--act]                baselines + deviations for new sessions + one assessment
    fishai confirm ID --outcome ...     record what really happened for a flagged anomaly
    fishai export dataset|summaries     training frames + YOLO labels, or a CSV of every track
    fishai maintain                     retention: prune old raw rows and clips
    fishai bench                        detector/tracker report over licensed public clips
    fishai config                       validate the effective configuration
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
        executor = ControlExecutor(db, cfg.section("control"), notify_cfg=cfg.section("notify"))
        state = build_state(db, vid, devs, SensorHub.state_for_reasoner(readings), executor.actuator.state(), db.events(limit=10))
        from fishai.perception.behavior.feeding import feeding_summary

        state["feeding"] = feeding_summary(db)
        rcfg = dict(cfg.section("reasoning"))
        result = assess(state, rcfg, db=db, reasoner=None if not args.rules else __import__("fishai.reasoning.rules", fromlist=["RulesReasoner"]).RulesReasoner(), video_id=vid)
        actions = executor.run_assessment_actions(result.safe_actions, assessment=result.to_dict()) if args.act else []
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
        from fishai.feedback import unconfirmed_anomalies

        unconfirmed = unconfirmed_anomalies(db)
        feedings = db.events("feeding", limit=3)
        clips = db.clips(limit=5)
    from fishai.pipeline.live import read_status

    live = read_status(cfg)
    obj = {"database": str(cfg.resolve_path("paths.database")), "videos": len(videos), "fish": len(fish), "anomalies": len(anomalies),
           "unconfirmed_anomalies": len(unconfirmed), "pending_actions": pending, "latest_assessments": assessments, "live": live,
           "recent_feedings": feedings, "recent_clips": clips}
    lines = [f"database: {obj['database']}", f"videos processed: {len(videos)}", f"fish known: {len(fish)}", f"anomalies recorded: {len(anomalies)} ({len(unconfirmed)} awaiting your confirmation)"]
    if live:
        state = "running" if live.get("running") else "stopped"
        lines.append(f"live watcher: {state} on {live.get('source')}; session {live.get('session_id')}; {live.get('fish_now')} fish now; {live.get('fps_measured', 0):.1f} fps; {live.get('sessions_completed')} sessions done; updated {live.get('updated_at')}")
        if live.get("last_error"):
            lines.append(f"  last error: {live['last_error']}")
        for d in live.get("last_deviations", [])[:5]:
            lines.append(f"  deviation: {d}")
    if feedings:
        lines.append("recent feedings: " + ", ".join(f"{e['recorded_at']} ({e['payload'].get('source')})" for e in feedings))
    if clips:
        lines.append("recent clips: " + ", ".join(Path(c["path"]).name for c in clips))
    for v in videos[-5:]:
        lines.append(f"  {v['video_id']}  {Path(v['path']).name}  {v['duration_s']:.1f}s  {v['detector']}/{v['tracker']}  {v['processed_at']}")
    if pending:
        lines.append("pending approvals: " + ", ".join(f"{a['action']} {a['params']}" for a in pending))
    for a in assessments:
        lines.append(f"assessment {a['recorded_at']}: {a['severity']} via {a['backend']} ({a['model']})")
    _emit(args, obj, "\n".join(lines))
    return 0


def cmd_config(args: argparse.Namespace) -> int:
    from fishai.config_check import check_config

    cfg = _cfg(args)
    result = check_config(cfg)
    lines = [f"error: {e}" for e in result["errors"]] + [f"warning: {w}" for w in result["warnings"]]
    _emit(args, result, "\n".join(lines) or "config OK: every key known, every value in range")
    return 1 if result["errors"] else 0


def cmd_doctor(args: argparse.Namespace) -> int:
    from fishai.doctor import run_doctor

    cfg = _cfg(args)
    report = run_doctor(cfg, check_ollama=not args.offline, source=args.source)
    lines = [f"FishAI {__version__}"]
    for item in report["checks"]:
        mark = {"ok": "OK ", "warn": "!! ", "fail": "XX "}[item["status"]]
        lines.append(f"{mark} {item['name']}: {item['detail']}")
    lines.append(f"ready: {report['ready']}")
    _emit(args, report, "\n".join(lines))
    return 0 if report["ready"] else 1


def cmd_watch(args: argparse.Namespace) -> int:
    from fishai.pipeline.live import LiveWatcher

    cfg = _cfg(args)
    if args.session_s:
        cfg.set_path("live.session_s", args.session_s)
    if args.detector:
        cfg.set_path("detection.backend", args.detector)
    if args.tracker:
        cfg.set_path("tracking.backend", args.tracker)
    if args.assess:
        cfg.set_path("live.assess_each_session", True)
    w = LiveWatcher(cfg, args.source, duration_s=args.duration, max_sessions=args.max_sessions, realtime=None if args.realtime is None else args.realtime)
    print(f"watching {args.source!r}; sessions every {cfg.get_path('live.session_s')}s; status in {w.status_path}")
    results = w.run()
    _emit(args, [r.summary["counts"] for r in results], f"stopped after {len(results)} session(s); {w.status.frames_total} frames")
    return 0


def cmd_feed(args: argparse.Namespace) -> int:
    from fishai.perception.behavior.feeding import (
        compute_feeding_responses,
        feeding_deviations,
        mark_feeding,
    )
    from fishai.pipeline.live import read_status, send_request
    from fishai.storage import Database

    cfg = _cfg(args)
    if args.video is None:
        st = read_status(cfg)
        if st and st.get("running"):
            p = send_request(cfg, "feed", source=args.source, portions=args.portions, note=args.note or "")
            _emit(args, {"request": str(p)}, f"feeding request sent to the watcher (session {st.get('session_id')})")
            return 0
        edge = cfg.get_path("live.edge_url") or cfg.get_path("control.edge_url")
        if edge:
            from fishai.control.actuators import EdgeActuator

            r = EdgeActuator(str(edge)).apply("feed_now", {"portions": args.portions})
            with Database(cfg.resolve_path("paths.database")) as db:
                eid = mark_feeding(db, None, 0.0, "feeder", args.portions, args.note or "", confirmed=r["confirmed"])
            _emit(args, {"event_id": eid, "edge": r["edge"]}, f"rail fed {args.portions} portion(s): {'confirmed by the drum sensor' if r['confirmed'] else 'NOT confirmed'} (event {eid}; no watcher running, so no response was measured)")
            return 0
        raise SystemExit("no watcher is running and no rail is configured; to mark a feeding in a processed video use --video ID --at SECONDS")
    if args.at is None:
        raise SystemExit("--at SECONDS is required with --video")
    with Database(cfg.resolve_path("paths.database")) as db:
        vid = _resolve_video_id(db, args.video)
        eid = mark_feeding(db, vid, args.at, args.source, args.portions, args.note or "")
        rows = compute_feeding_responses(db, eid, cfg.section("feeding"))
        devs = feeding_deviations(db, eid)
    lines = [f"feeding event {eid} at {args.at}s in {vid}: {len(rows)} fish measured"]
    for r in rows:
        who = f"fish {r['fish_id']}" if r["fish_id"] is not None else f"track {r['track_id']}"
        came = f"approached in {r['latency_s']:.1f}s" if r["approached"] else "did not approach"
        lines.append(f"  {who}: {came}; zone {r['zone_fraction_before']:.2f} -> {r['zone_fraction_after']:.2f}; activity {r['activity_before']:.2f} -> {r['activity_after']:.2f}")
    lines += [f"  [{d.severity}] {d.sentence()}" for d in devs]
    _emit(args, {"event_id": eid, "responses": rows, "deviations": [d.to_dict() for d in devs]}, "\n".join(lines))
    return 0


def cmd_request(args: argparse.Namespace) -> int:
    from fishai.pipeline.live import read_status, send_request

    cfg = _cfg(args)
    st = read_status(cfg)
    if not st or not st.get("running"):
        raise SystemExit("no watcher is running")
    p = send_request(cfg, args.cmd, note=getattr(args, "note", "") or "")
    _emit(args, {"request": str(p)}, f"{args.cmd} request sent to the watcher")
    return 0


def cmd_ingest(args: argparse.Namespace) -> int:
    from fishai.jobs.ingest import ingest_folder

    cfg = _cfg(args)
    if args.detector:
        cfg.set_path("detection.backend", args.detector)
    if args.tracker:
        cfg.set_path("tracking.backend", args.tracker)

    def done(r: Any) -> None:
        c = r.summary["counts"]
        print(f"{Path(r.summary['video']['path']).name}: {r.observations} observations, {c['tracks']} tracks, ~{c['distinct_fish_estimate']} fish")

    results = ingest_folder(cfg, args.folder, watch=args.watch, poll_s=args.poll, annotate=not args.no_annotate, on_done=done, max_files=args.max_files)
    if args.then_baseline and results:
        cmd_baseline(args)
    if not results:
        print("nothing new to process")
    return 0


def cmd_daily(args: argparse.Namespace) -> int:
    from fishai.jobs.daily import run_daily

    cfg = _cfg(args)
    rep = run_daily(cfg, act=args.act, rules_only=args.rules, all_sessions=args.all)
    a = rep["assessment"]
    lines = [f"daily {rep['date']}: {len(rep['sessions_reviewed'])} session(s) reviewed, {len(rep['deviations'])} deviation(s), severity {a['severity']} ({a['source']})"]
    lines += [f"  - {o}" for o in a["observations"][:10]]
    lines += [f"  * {c}" for c in a["recommended_checks"][:8]]
    lines.append(f"report: {rep['path']}")
    _emit(args, rep, "\n".join(lines))
    return 0


def cmd_confirm(args: argparse.Namespace) -> int:
    from fishai.feedback import OUTCOMES, confirm, unconfirmed_anomalies
    from fishai.storage import Database

    cfg = _cfg(args)
    with Database(cfg.resolve_path("paths.database")) as db:
        if args.anomaly_id is None:
            rows = unconfirmed_anomalies(db)
            lines = [f"{a['id']:5d}  fish {a['fish_id']}  {a['metric']}  {a['value']:.2f} vs {a['baseline']:.2f}  [{a['severity']}]  {a['detected_at']}" for a in rows]
            _emit(args, rows, "\n".join(lines) or "nothing awaiting confirmation")
            if not args.json:
                print(f"confirm one with: fishai confirm ID --outcome {'|'.join(OUTCOMES)}")
            return 0
        if not args.outcome:
            raise SystemExit("--outcome is required when confirming an anomaly")
        eid = confirm(db, args.outcome, anomaly_id=args.anomaly_id, note=args.note or "")
    _emit(args, {"event_id": eid}, f"recorded: anomaly {args.anomaly_id} -> {args.outcome}")
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    from fishai.jobs.export import export_dataset, export_summaries_csv
    from fishai.storage import Database

    cfg = _cfg(args)
    with Database(cfg.resolve_path("paths.database")) as db:
        if args.what == "summaries":
            out = args.out or str(cfg.resolve_path("paths.output_dir") / "summaries.csv")
            n = export_summaries_csv(db, out)
            _emit(args, {"rows": n, "path": out}, f"wrote {n} track summaries to {out}")
            return 0
        out = args.out or str(cfg.resolve_path("paths.output_dir").parent / "datasets" / args.name)
        m = export_dataset(db, cfg, out, args.name, min_confidence=args.min_confidence, max_frames_per_video=args.per_video)
    _emit(args, m, f"{m['frames']} frames, {m['boxes']} boxes from {len(m['sources'])} video(s) -> {m['out_dir']}\nmanifest: {m['manifest_path']}\n({m['labels_are']})")
    return 0


def cmd_bench(args: argparse.Namespace) -> int:
    from fishai.jobs.bench import run_bench

    cfg = _cfg(args)
    if args.detector:
        cfg.set_path("detection.backend", args.detector)
    if args.tracker:
        cfg.set_path("tracking.backend", args.tracker)
    s = run_bench(
        cfg, manifest=Path(args.manifest) if args.manifest else None, clips_dir=Path(args.clips_dir) if args.clips_dir else None,
        out_dir=Path(args.out) if args.out else None, names=args.names or None, max_frames=args.max_frames, stride=args.stride,
        max_side=args.max_side, extra_paths=[Path(p) for p in (args.extra or [])],
    )
    _emit(args, s, Path(s["report_path"]).read_text(encoding="utf-8") + f"\nreport: {s['report_path']}")
    return 0


def cmd_maintain(args: argparse.Namespace) -> int:
    from fishai.retention import run_retention
    from fishai.storage import Database

    cfg = _cfg(args)
    with Database(cfg.resolve_path("paths.database")) as db:
        rep = run_retention(db, cfg.section("retention"))
        if args.vacuum:
            db.vacuum()
    _emit(args, rep, f"pruned {rep['observations_deleted']} raw observations; deleted {len(rep['clips_deleted'])} clips; clips now {rep.get('clip_bytes_after', 0) / 1e9:.2f} GB")
    return 0


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

    s = sub.add_parser("watch", help="live loop on a camera, stream or file")
    s.add_argument("--source", required=True, help="camera index (0), URL, or a video file")
    s.add_argument("--session-s", type=float, help="seconds per session (default from config)")
    s.add_argument("--duration", type=float, help="stop after this many seconds")
    s.add_argument("--max-sessions", type=int)
    s.add_argument("--detector", choices=["motion", "yolo"])
    s.add_argument("--tracker", choices=["simple", "bytetrack"])
    s.add_argument("--assess", action="store_true", help="run the reasoner at the end of each session")
    s.add_argument("--realtime", dest="realtime", action="store_true", default=None, help="pace a file like a camera")
    s.add_argument("--no-realtime", dest="realtime", action="store_false", help="read a camera/file as fast as possible")
    _add_common(s)
    s.set_defaults(fn=cmd_watch)

    s = sub.add_parser("feed", help="mark a feeding (live watcher, or a processed video)")
    s.add_argument("--video", help="video id (or 'latest') for a processed video")
    s.add_argument("--at", type=float, help="seconds into that video when food went in")
    s.add_argument("--source", default="manual", help="manual | feeder | ...")
    s.add_argument("--portions", type=float, default=1.0)
    s.add_argument("--note")
    _add_common(s)
    s.set_defaults(fn=cmd_feed)

    for name, help_ in (("clip", "save the live buffer as a clip"), ("stop", "stop the live watcher")):
        s = sub.add_parser(name, help=help_)
        s.add_argument("--note", default="")
        _add_common(s)
        s.set_defaults(fn=cmd_request)

    s = sub.add_parser("ingest", help="process every new video in a folder")
    s.add_argument("folder")
    s.add_argument("--watch", action="store_true", help="keep polling the folder")
    s.add_argument("--poll", type=float, default=30.0, help="seconds between polls with --watch")
    s.add_argument("--max-files", type=int)
    s.add_argument("--detector", choices=["motion", "yolo", "synthetic"])
    s.add_argument("--tracker", choices=["simple", "bytetrack"])
    s.add_argument("--no-annotate", action="store_true")
    s.add_argument("--then-baseline", action="store_true")
    _add_common(s)
    s.set_defaults(fn=cmd_ingest)

    s = sub.add_parser("daily", help="baselines, deviations for new sessions, one assessment")
    s.add_argument("--act", action="store_true", help="send proposed safe actions through the control layer")
    s.add_argument("--rules", action="store_true", help="deterministic reasoner only")
    s.add_argument("--all", action="store_true", help="review every session, not just new ones")
    _add_common(s)
    s.set_defaults(fn=cmd_daily)

    s = sub.add_parser("confirm", help="record what really happened for a flagged anomaly")
    s.add_argument("anomaly_id", nargs="?", type=int, help="omit to list anomalies awaiting confirmation")
    from fishai.feedback import OUTCOMES

    s.add_argument("--outcome", choices=OUTCOMES)
    s.add_argument("--note")
    _add_common(s)
    s.set_defaults(fn=cmd_confirm)

    s = sub.add_parser("export", help="training dataset or CSV of summaries")
    s.add_argument("what", choices=["dataset", "summaries"])
    s.add_argument("--name", default="auto_v1", help="dataset name (manifest goes to datasets/manifests/NAME.json)")
    s.add_argument("--out", help="output directory (dataset) or file (summaries)")
    s.add_argument("--min-confidence", type=float)
    s.add_argument("--per-video", type=int, help="max frames per video")
    _add_common(s)
    s.set_defaults(fn=cmd_export)

    s = sub.add_parser("bench", help="run the detector/tracker over licensed public clips and report")
    s.add_argument("--manifest", help="clip manifest (default datasets/manifests/public_clips.json)")
    s.add_argument("--clips-dir", help="where clips are downloaded (default datasets/public_clips)")
    s.add_argument("--out", help="report directory (default runs/bench/<timestamp>)")
    s.add_argument("--names", nargs="*", help="only these clip names")
    s.add_argument("--extra", nargs="*", help="extra local video files to include")
    s.add_argument("--detector", choices=["motion", "yolo"])
    s.add_argument("--tracker", choices=["simple", "bytetrack"])
    s.add_argument("--max-frames", type=int, default=300)
    s.add_argument("--stride", type=int, default=2)
    s.add_argument("--max-side", type=int, default=640)
    _add_common(s)
    s.set_defaults(fn=cmd_bench)

    s = sub.add_parser("maintain", help="retention: prune raw rows and old clips")
    s.add_argument("--vacuum", action="store_true")
    _add_common(s)
    s.set_defaults(fn=cmd_maintain)

    s = sub.add_parser("status", help="what the database holds")
    _add_common(s)
    s.set_defaults(fn=cmd_status)

    s = sub.add_parser("config", help="validate the effective configuration")
    _add_common(s)
    s.set_defaults(fn=cmd_config)

    s = sub.add_parser("doctor", help="check the installation")
    s.add_argument("--offline", action="store_true", help="skip network checks (Ollama, rail, video source)")
    s.add_argument("--source", help="also try to read one frame from this camera/URL/file")
    _add_common(s)
    s.set_defaults(fn=cmd_doctor)
    return p


LONG_RUNNING = {"watch", "ingest", "daily", "bench"}


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    log_file = None
    if args.cmd in LONG_RUNNING:
        try:
            log_file = _cfg(args).resolve_path("paths.output_dir") / "logs" / f"fishai-{args.cmd}.log"
        except Exception:  # a broken config is reported by the command itself
            log_file = None
    setup_logging(getattr(args, "log_level", "INFO"), log_file=log_file)
    if args.cmd in LONG_RUNNING and args.cmd != "bench":
        from fishai.config_check import check_config

        problems = check_config(_cfg(args))["errors"]
        if problems:
            for p in problems:
                log.error("config: %s", p)
            return 3
    try:
        return int(args.fn(args))
    except FileNotFoundError as exc:
        log.error("%s", exc)
        return 2
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
