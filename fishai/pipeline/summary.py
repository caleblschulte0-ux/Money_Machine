"""JSON summary of one processed video: the structured state a reasoner reads."""

from __future__ import annotations

from typing import Any

from fishai import __version__
from fishai.types import TrackSummary, VideoRecord


def _round(x: float, nd: int = 3) -> float:
    return round(float(x), nd)


def track_to_summary_dict(s: TrackSummary, identity: dict[str, Any] | None = None) -> dict[str, Any]:
    d = {
        "track_id": s.track_id,
        "fish_id": identity.get("fish_id") if identity else None,
        "identity_confidence": _round(identity.get("confidence", 0.0)) if identity else None,
        "first_seen_s": _round(s.first_ts),
        "last_seen_s": _round(s.last_ts),
        "duration_s": _round(s.duration_s),
        "observations": s.n_observations,
        "activity_score": _round(s.activity_score, 1),
        "mean_speed_px_s": _round(s.mean_speed_px_s, 1),
        "max_speed_px_s": _round(s.max_speed_px_s, 1),
        "mean_speed_tank_heights_s": _round(s.mean_speed_norm_s),
        "total_distance_px": _round(s.total_distance_px, 1),
        "zone_fractions": {
            "surface": _round(s.surface_fraction),
            "middle": _round(s.middle_fraction),
            "bottom": _round(s.bottom_fraction),
        },
        "zone_time_s": {
            "surface": _round(s.surface_time_s, 2),
            "middle": _round(s.middle_time_s, 2),
            "bottom": _round(s.bottom_time_s, 2),
        },
        "mean_position": {"x": _round(s.mean_nx), "y": _round(s.mean_ny)},
        "missing_time_s": _round(s.missing_time_s, 2),
        "longest_gap_s": _round(s.longest_gap_s, 2),
        "hiding_candidate": bool(s.extra.get("hiding_candidate", False)),
        "mean_detection_confidence": _round(s.mean_confidence),
        "min_track_identity_confidence": _round(s.min_identity_confidence),
    }
    return d


def build_summary(
    video: VideoRecord,
    summaries: list[TrackSummary],
    identities: dict[int, dict[str, Any]],
    processed_frames: int,
    frames_with_detections: int,
    total_detections: int,
    annotated_path: str | None,
    notes: list[str] | None = None,
) -> dict[str, Any]:
    fish = [track_to_summary_dict(s, identities.get(s.track_id)) for s in summaries]
    long_tracks = [s for s in summaries if s.n_observations >= 5]
    return {
        "fishai_version": __version__,
        "video": {
            "id": video.video_id,
            "path": video.path,
            "width": video.width,
            "height": video.height,
            "fps": _round(video.fps, 2),
            "frame_count": video.frame_count,
            "duration_s": _round(video.duration_s, 2),
            "processed_at": video.processed_at,
            "camera_id": video.camera_id,
            "lighting_mode": video.lighting_mode,
        },
        "pipeline": {
            "detector": video.detector,
            "tracker": video.tracker,
            "config_hash": video.config_hash,
            "processed_frames": processed_frames,
            "frames_with_detections": frames_with_detections,
            "total_detections": total_detections,
        },
        "counts": {
            "tracks": len(summaries),
            "tracks_5plus_observations": len(long_tracks),
            "distinct_fish_estimate": len({i["fish_id"] for i in identities.values()}) if identities else len(long_tracks),
        },
        "tank": {
            "mean_activity_score": _round(sum(s.activity_score for s in long_tracks) / len(long_tracks), 1) if long_tracks else 0.0,
            "mean_surface_fraction": _round(sum(s.surface_fraction for s in long_tracks) / len(long_tracks)) if long_tracks else 0.0,
            "mean_bottom_fraction": _round(sum(s.bottom_fraction for s in long_tracks) / len(long_tracks)) if long_tracks else 0.0,
        },
        "fish": fish,
        "annotated_video": annotated_path,
        "notes": notes or [],
    }
