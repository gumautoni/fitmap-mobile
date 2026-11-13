"""Scan a proposed Git revision without exposing credential values."""

import argparse
import io
import json
import os
import re
import subprocess
import tarfile
import tempfile
import tomllib
from pathlib import Path

ROOT = Path.cwd().resolve()

IMAGE = (
    "ghcr.io/gitleaks/gitleaks:v8.30.0"
    "@sha256:691af3c7c5a48b16f187ce3446d5f194838f91238f27270ed36eef6359a574d9"
)


def failure_category(result):
    """Classify operational failures without returning raw diagnostics."""
    diagnostics = (result.stdout + result.stderr).decode(errors="replace").lower()

    categories = (
        ("permission denied", "filesystem permission failure"),
        ("operation not permitted", "container permission failure"),
        ("dubious ownership", "Git ownership validation failure"),
        ("read-only file system", "read-only filesystem failure"),
        ("no such file or directory", "required path unavailable"),
    )

    for marker, category in categories:
        if marker in diagnostics:
            return category

    return "unclassified operational failure"


def run(args, label, cwd=ROOT, allowed=(0,)):
    result = subprocess.run(
        args,
        cwd=cwd,
        capture_output=True,
    )

    if result.returncode not in allowed:
        category = failure_category(result)
        raise RuntimeError(
            f"{label}: exit code {result.returncode}. Category: {category}. Raw output suppressed."
        )

    return result


def git(*args, cwd=ROOT):
    return run(
        ["git", *args],
        "Git operation",
        cwd=cwd,
    ).stdout


def container_identity_args():
    """Use the workspace owner's identity on POSIX hosts."""
    if os.name != "posix":
        return []

    return [
        "--user",
        f"{os.getuid()}:{os.getgid()}",
        "--env",
        "HOME=/tmp",
    ]


def scan(workspace, name, mode, source, base, head):
    report = workspace / "reports" / f"{name}.json"

    args = [
        "docker",
        "run",
        "--rm",
        *container_identity_args(),
        "--network",
        "none",
        "--read-only",
        "--tmpfs",
        "/tmp",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--env",
        "GIT_CONFIG_COUNT=1",
        "--env",
        "GIT_CONFIG_KEY_0=safe.directory",
        "--env",
        "GIT_CONFIG_VALUE_0=*",
        "--mount",
        f"type=bind,source={workspace},target=/audit,readonly",
        "--mount",
        f"type=bind,source={workspace / 'reports'},target=/reports",
        IMAGE,
        mode,
        "--config=/audit/snapshot/.gitleaks.toml",
        "--gitleaks-ignore-path=/audit/empty.ignore",
        "--ignore-gitleaks-allow",
        "--redact=100",
        "--no-banner",
        "--no-color",
        "--report-format=json",
        f"--report-path=/reports/{name}.json",
        "--exit-code=42",
    ]

    if mode == "git":
        args.append(f"--log-opts=--full-history -m {base}..{head}")

    args.append(source)

    result = run(
        args,
        f"Scanner {name}",
        allowed=(0, 42),
    )

    diagnostics = (result.stdout + result.stderr).decode(errors="replace")

    if (
        re.search(r"\bERR\b", diagnostics)
        or "partial scan" in diagnostics.lower()
        or "permission denied" in diagnostics.lower()
        or "fatal:" in diagnostics.lower()
    ):
        raise RuntimeError(f"Incomplete scan: {name}.")

    if not report.exists():
        raise RuntimeError(f"Missing report: {name}.")

    findings = json.loads(report.read_text(encoding="utf-8")) or []

    if not isinstance(findings, list):
        raise RuntimeError("Unexpected report format.")

    if bool(findings) != (result.returncode == 42):
        raise RuntimeError("Scanner exit/report mismatch.")

    print(f"{name}: {len(findings)} findings", flush=True)

    return len(findings)


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)

    args = parser.parse_args()
    base, head = args.base, args.head

    if not all(re.fullmatch(r"[0-9a-f]{40}", ref) for ref in (base, head)):
        raise RuntimeError("Full commit hashes required.")

    if git("rev-parse", "HEAD").decode().strip() != head:
        raise RuntimeError("Checked-out revision mismatch.")

    if git("rev-parse", "--is-shallow-repository").strip() != b"false":
        raise RuntimeError("Full Git history required.")

    if git("status", "--porcelain", "--untracked-files=all").strip():
        raise RuntimeError("A clean checkout is required.")

    git("cat-file", "-e", f"{base}^{{commit}}")
    git("cat-file", "-e", f"{head}^{{commit}}")
    git("merge-base", base, head)

    inspected = subprocess.run(
        ["docker", "image", "inspect", IMAGE],
        capture_output=True,
    )

    if inspected.returncode != 0:
        run(
            ["docker", "pull", IMAGE],
            "Pinned scanner image pull",
        )

    version = (
        run(
            [
                "docker",
                "run",
                "--rm",
                "--network",
                "none",
                IMAGE,
                "version",
            ],
            "Scanner version",
        )
        .stdout.decode()
        .strip()
    )

    if version.lstrip("v") != "8.30.0":
        raise RuntimeError("Unexpected scanner version.")

    print("Gitleaks version: 8.30.0", flush=True)

    with tempfile.TemporaryDirectory(prefix="fitmap-secret-scan-") as directory:
        workspace = Path(directory).resolve()

        if workspace.is_relative_to(ROOT):
            raise RuntimeError("Unsafe temporary workspace.")

        snapshot = workspace / "snapshot"
        mirror = workspace / "history.git"

        snapshot.mkdir()
        (workspace / "reports").mkdir()
        (workspace / "empty.ignore").touch()

        archive = git("archive", "--format=tar", head)

        with tarfile.open(
            fileobj=io.BytesIO(archive),
            mode="r:",
        ) as source:
            if any(item.issym() or item.islnk() for item in source.getmembers()):
                raise RuntimeError("Unexpected archive links.")

            source.extractall(snapshot, filter="data")

        tracked = {
            item.decode("utf-8")
            for item in git("ls-tree", "-r", "--name-only", "-z", head).split(b"\0")
            if item
        }

        actual = {
            path.relative_to(snapshot).as_posix() for path in snapshot.rglob("*") if path.is_file()
        }

        if tracked != actual:
            raise RuntimeError("Snapshot coverage mismatch.")

        config = tomllib.loads((snapshot / ".gitleaks.toml").read_text(encoding="utf-8"))

        if config.get("extend", {}).get("useDefault") is not True:
            raise RuntimeError("Default rules must remain enabled.")

        if not any(
            rule.get("id") == "fitmap-environment-secret" for rule in config.get("rules", [])
        ):
            raise RuntimeError("Required FitMap rule missing.")

        git(
            "clone",
            "--mirror",
            "--no-hardlinks",
            str(ROOT),
            str(mirror),
        )

        for ref in (base, head):
            git(
                "cat-file",
                "-e",
                f"{ref}^{{commit}}",
                cwd=mirror,
            )

        expected_commits = set(git("rev-list", f"{base}..{head}").splitlines())

        actual_commits = set(git("rev-list", f"{base}..{head}", cwd=mirror).splitlines())

        if actual_commits != expected_commits:
            raise RuntimeError("Commit coverage mismatch.")

        print(f"Snapshot files: {len(actual)}")
        print(f"PR commits: {len(actual_commits)}")

        history_count = scan(
            workspace,
            "history",
            "git",
            "/audit/history.git",
            base,
            head,
        )

        snapshot_count = scan(
            workspace,
            "snapshot",
            "dir",
            "/audit/snapshot",
            base,
            head,
        )

        if {".env", "backend/.env"} & tracked:
            print("Real environment file tracked.")
            return 42

        if history_count or snapshot_count:
            print("Secret scanning failed. Review findings locally.")
            return 42

    print("Secret scanning passed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(str(error))
        raise SystemExit(1) from None
    except Exception as error:
        print(f"Secret scan interrupted: {type(error).__name__}")
        raise SystemExit(1) from None
