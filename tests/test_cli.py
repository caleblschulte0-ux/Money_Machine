import json
import subprocess
import sys

from fishai.cli import main


def test_demo_then_status_and_baseline(workdir, capsys):
    db = str(workdir / "cli.db")
    assert main(["demo", "--frames", "80", "--output", str(workdir / "out"), "--db", db, "--log-level", "ERROR"]) == 0
    out = capsys.readouterr().out
    assert "summary:" in out and (workdir / "out" / "demo_tank.summary.json").exists()
    assert main(["status", "--db", db, "--json"]) == 0
    status = json.loads(capsys.readouterr().out)
    assert status["videos"] == 1
    assert main(["baseline", "--db", db]) == 0
    assert main(["deviations", "latest", "--db", db]) == 0
    assert "not enough history" in capsys.readouterr().out


def test_assess_with_rules_and_act(workdir, capsys):
    db = str(workdir / "cli.db")
    assert main(["assess", "none", "--rules", "--act", "--db", db, "--json", "--log-level", "ERROR"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["assessment"]["source"] == "rules"
    assert payload["assessment"]["severity"] == "ok"
    assert "water_temperature" in payload["state"]["sensors"]


def test_control_and_approve(workdir, capsys):
    db = str(workdir / "cli.db")
    assert main(["control", "adjust_lighting", "percent=25", "--db", db]) == 0
    assert main(["control", "dose_chemical", "ml=1", "--db", db]) == 0
    assert "NOT executed" in capsys.readouterr().out
    assert main(["approve", "dose_chemical", "ml=1", "--db", db]) == 0
    assert main(["approve", "disable_heater", "--db", db]) == 1


def test_sensors_and_doctor(workdir, capsys):
    db = str(workdir / "cli.db")
    assert main(["sensors", "--store", "--db", db]) == 0
    assert "water_temperature" in capsys.readouterr().out
    main(["doctor", "--offline", "--db", db, "--json"])
    report = json.loads(capsys.readouterr().out)
    assert {"opencv", "database", "detector weights"} <= {c["name"] for c in report["checks"]}


def test_module_entrypoint():
    r = subprocess.run([sys.executable, "-m", "fishai", "--version"], capture_output=True, text=True)
    assert r.returncode == 0 and "fishai" in r.stdout


def test_missing_video_is_a_clean_error(workdir):
    assert main(["process", str(workdir / "nope.mp4"), "--db", str(workdir / "x.db"), "--log-level", "ERROR"]) == 2
