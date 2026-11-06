"""Exact App198 -> App8ed controller. Importing this module performs no native action."""
from __future__ import annotations
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

BASE = "8edca9d64b78f1eea0a6f402a6dd0c522bdcd4ea"
OLD = "198e8a35dc120b554468074dd689793addb54385"
MIDDLE = "445fcdcccf72f2038ed7abe7c96336864058cfe2"
OLD_TREE = "54e792e02ad7b92137b9699b67d5dc346024f23e"
NEW_TREE = "ad31eebe4463921df63bda6617aa2fb30f623bde"
LAUNCHER = "cb887091c9045fba6b9eeb5ad2502ca6206006aa220b123d4594de8526828a5d"
CORE = "ee883b62cf4a318af3450c506931a969623b8987"
ANCHOR = "b696ff211daabd4be3989522c569f24ccccd0dce"
START = 2147483648
RESERVE = 536870912
EARLY_STOP = RESERVE + 134217728
URGENT_KILL = RESERVE + 67108864
POLL = .05
DEADLINE = 600
APP_ROOT = "/workspace/work/platform17-consumer-8edca9d6"
OLD_ROOT = "/workspace/work/platform17-consumer-198e8a35"
ANCHOR_ROOT = "/workspace/work/platform17-integrated-app-b696ff21"
PRIVATE = "/workspace/private/platform-service-consumer-rehearsal-17/exact-consumer-8edca9d6-01"
ADMISSION = PRIVATE + "/consumer-admission.json"
RUNTIME = "/workspace/private/cladora-functional-dev-v1"
OLD_RECORD = "/workspace/private/platform-service-consumer-rehearsal-17/exact-consumer-198e8a35-01/monitored-build-02/consumer-process.private.json"
RELAY_RECORD = RUNTIME + "/relay-cors-v2/process.json"
PROTECTED_FILES = (RUNTIME + "/descriptor.json", RUNTIME + "/core15/service-runtime-binding.json", RELAY_RECORD)
BUILD_FILES = (".next/BUILD_ID", ".next/build-manifest.json", ".next/routes-manifest.json", ".next/server/app-paths-manifest.json")
BUILD_ARGV = ("node", "scripts/run-core-service-app-assembly-17.mjs", "build")
START_ARGV = ("node", "scripts/run-core-service-app-assembly-17.mjs", "start")

class Rejected(ValueError):
    pass
class Unknown(RuntimeError):
    pass

def need(condition, code):
    if not condition:
        raise Rejected(code)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def fields(value, expected, code):
    need(type(value) is dict and set(value) == set(expected), code)

def digest(value, n=64):
    need(type(value) is str and re.fullmatch("[a-f0-9]{%d}" % n, value) is not None, "HASH_FORMAT")

def parse(raw):
    need(type(raw) is bytes and 0 < len(raw) <= 32768, "REQUEST_BYTES")
    def pairs(items):
        result = {}
        for k, v in items:
            need(k not in result, "DUPLICATE_JSON_FIELD")
            result[k] = v
        return result
    return json.loads(raw.decode("utf-8"), object_pairs_hook=pairs)

def validate(r):
    fields(r, ("contract", "run_id", "tool", "consumer", "old_app", "admission", "transport", "protected_files", "budget", "deadline_seconds"), "REQUEST_FIELDS")
    need(r["contract"] == "platform17.app198-app8ed.request.v2", "CONTRACT")
    need(type(r["run_id"]) is str and re.fullmatch("app8ed-[a-z0-9-]{8,64}", r["run_id"]) is not None, "RUN_ID")
    fields(r["tool"], ("sha", "tree", "seal_sha256"), "TOOL_FIELDS")
    digest(r["tool"]["sha"], 40); digest(r["tool"]["tree"], 40); digest(r["tool"]["seal_sha256"])
    need(r["tool"]["sha"] not in (BASE, OLD, ANCHOR), "TOOL_IS_NOT_APP_OR_ANCHOR")
    fields(r["consumer"], ("root", "sha", "tree", "launcher_sha256"), "CONSUMER_FIELDS")
    need(r["consumer"] == {"root": APP_ROOT, "sha": BASE, "tree": NEW_TREE, "launcher_sha256": LAUNCHER}, "CONSUMER_PIN")
    old = r["old_app"]
    fields(old, ("root", "sha", "tree", "launcher_sha256", "pid", "start_ticks", "argv", "record_sha256", "build"), "OLD_FIELDS")
    need((old["root"], old["sha"], old["tree"], old["launcher_sha256"]) == (OLD_ROOT, OLD, OLD_TREE, LAUNCHER), "OLD_APP198_ONLY")
    need(type(old["pid"]) is int and old["pid"] > 1, "OLD_PID")
    need(type(old["start_ticks"]) is str and re.fullmatch("[1-9][0-9]*", old["start_ticks"]) is not None, "OLD_TICKS")
    need(old["argv"] == ["next-server (v16.4.1)"], "OLD_ARGV")
    digest(old["record_sha256"])
    build = old["build"]
    fields(build, ("id", "files", "served_manifest_sha256"), "BUILD_FIELDS")
    need(type(build["id"]) is str and re.fullmatch("[A-Za-z0-9_-]{1,64}", build["id"]) is not None, "BUILD_ID")
    fields(build["files"], BUILD_FILES, "BUILD_FILE_ALLOWLIST")
    for d in build["files"].values(): digest(d)
    digest(build["served_manifest_sha256"])
    fields(r["admission"], ("file", "sha256"), "ADMISSION_FIELDS")
    need(r["admission"]["file"] == ADMISSION, "ADMISSION_PATH"); digest(r["admission"]["sha256"])
    fields(r["transport"], ("root", "sha", "tree", "launcher_sha256", "abi", "relay_seal_sha256", "binding_sha256"), "TRANSPORT_FIELDS")
    need(r["transport"] == {"root": ANCHOR_ROOT, "sha": ANCHOR, "tree": "534ec94f21699a65686bade5539517dfd818ec1e", "launcher_sha256": "5a25abd1847b7ff928fb310b14f9aadbfcda554eb1c29d1a146e66e6cb944092", "abi": "platform17.relay-cors-preflight.v2", "relay_seal_sha256": "c3cb3af536866aac88513c402a3a4484f48103583592a9e86e9e3926112aaf02", "binding_sha256": r["transport"]["binding_sha256"]}, "TRANSPORT_PIN")
    digest(r["transport"]["binding_sha256"])
    fields(r["protected_files"], PROTECTED_FILES, "PROTECTED_FILE_ALLOWLIST")
    for d in r["protected_files"].values(): digest(d)
    fields(r["budget"], ("start_bytes", "reserve_bytes", "estimated_build_bytes", "margin_bytes", "peak_bound"), "BUDGET_FIELDS")
    need(r["budget"] == {"start_bytes": START, "reserve_bytes": RESERVE, "estimated_build_bytes": 1073741824, "margin_bytes": 536870912, "peak_bound": False}, "EXACT_OWNER_BUDGET")
    for k in ("start_bytes", "reserve_bytes", "estimated_build_bytes", "margin_bytes"):
        need(type(r["budget"][k]) is int, "BUDGET_INTEGER")
    need(type(r["budget"]["peak_bound"]) is bool, "PEAK_BOUND_BOOLEAN")
    need(type(r["deadline_seconds"]) is int and r["deadline_seconds"] == DEADLINE, "DEADLINE")
    return r

def same_old(observed, r):
    old = r["old_app"]
    need(observed["source"] == old["sha"] and observed["tree"] == old["tree"], "OLD_SOURCE_DRIFT")
    need(observed["pid"] == old["pid"] and observed["start_ticks"] == old["start_ticks"], "OLD_PID_RECYCLED_OR_CHANGED")
    need(observed["cwd"] == old["root"] and observed["argv"] == old["argv"] and observed["live"] is True, "OLD_PROCESS_IDENTITY")
    need(observed["build"] == old["build"], "OLD_BUILD_DRIFT")

def check_snapshot(snapshot, r, *, old_stopped=False):
    need(snapshot["consumer"] == r["consumer"], "OBSERVED_CONSUMER_DRIFT")
    need(snapshot["tool"] == r["tool"], "OBSERVED_TOOL_DRIFT")
    # This is the exact observed three-commit chain, not a false direct-parent check.
    need(snapshot["lineage"] == [OLD, MIDDLE, BASE], "LINEAGE_198_445_8ED")
    need(snapshot["admission_sha256"] == r["admission"]["sha256"], "ADMISSION_DRIFT")
    need(snapshot["protected_files"] == r["protected_files"] and snapshot["relay_identity_current"] is True, "PROTECTED_RUNTIME_DRIFT")
    need(snapshot["sources_clean"] is True and snapshot["protected_sources_match"] is True, "SOURCE_CLEAN_OR_PROTECTED_PIN")
    if old_stopped:
        need(snapshot["old_ended"] is True, "OLD_STOP_ACK_REQUIRED")
    else:
        same_old(snapshot["old"], r)

def enough(snapshot):
    need(snapshot["available_bytes"] >= START and snapshot["free_inodes"] > 0, "INSUFFICIENT_CAPACITY_NO_BUILD")

@dataclass
class Outcome:
    state: str
    first_error: dict | None
    cleanup: list
    old_stop: str
    start_dispatch: str
    evidence: dict

class Controller:
    def __init__(self, host):
        self.h = host

    def run(self, raw):
        # All request rejection precedes construction of a native host action.
        r = validate(parse(raw))
        h = self.h
        h.authorize(r, sha(raw))
        initial = h.observe(r)
        check_snapshot(initial, r)
        enough(initial)
        build = new = None
        first = None
        clean = []
        old_stop = "NOT_RUN"
        start_state = "NOT_RUN"
        facts = {}
        claimed = False
        try:
            h.current(r)
            h.claim(r, sha(raw)); claimed = True
            h.current(r); h.preflight(r)
            h.current(r)
            fresh = h.observe(r); check_snapshot(fresh, r); enough(fresh)
            h.record("build-intent", {"argv": BUILD_ARGV, "App": BASE, "budget": r["budget"]})
            h.current(r)
            enough(h.sample())
            begin = h.monotonic()  # Includes spawn/PID-receipt persistence time.
            build = h.spawn_build(r)
            while True:
                sample = h.sample()
                h.record("sample", sample)
                if sample["available_bytes"] <= EARLY_STOP or sample["free_inodes"] == 0:
                    raise RuntimeError("STOPPED_CAPACITY_GUARD")
                if h.monotonic() - begin >= DEADLINE:
                    raise RuntimeError("STOPPED_BUILD_DEADLINE")
                h.current(r)
                code = h.build_poll(build)
                if code is not None:
                    need(not h.build_members(build), "UNKNOWN_REMAINING_BUILD_DESCENDANTS")
                    need(code == 0, "FAILED_OFFICIAL_BUILD")
                    break
                h.sleep(POLL)
            facts["new_build"] = h.read_build(r)
            h.record("build-pass", facts["new_build"])
            h.current(r); check_snapshot(h.observe(r), r)
            h.preflight(r)
            h.current(r); check_snapshot(h.observe(r), r)
            need(h.read_build(r) == facts["new_build"], "NEW_BUILD_DRIFT_BEFORE_STOP")
            h.record("old-stop-intent", {"App": OLD, "after_build": "PASS"})
            h.current(r)
            old_stop = "ATTEMPTED_NOT_ACK"
            h.stop_old(r); old_stop = "ACK"
            h.current(r); check_snapshot(h.observe(r, old_stopped=True), r, old_stopped=True)
            need(h.read_build(r) == facts["new_build"], "NEW_BUILD_DRIFT_BEFORE_START")
            need(h.port_free(), "PORT3008_NOT_FREE_NO_START")
            h.current(r)
            h.record("start-intent", {"argv": START_ARGV, "App": BASE, "may_create_child": True})
            start_state = "DISPATCHING_MAY_EXIST"
            new = h.spawn_start(r, facts["new_build"])
            start_state = "DISPATCHED_MAY_EXIST"
            facts["served"] = h.start_ack(new, r, facts["new_build"])
            h.current(r)
            check_snapshot(h.observe(r, old_stopped=True), r, old_stopped=True)
            need(h.read_build(r) == facts["new_build"], "NEW_BUILD_DRIFT_AFTER_ACK")
            h.record("app-retained", facts["served"])
            result = Outcome("ACK_EXACT_APP8ED_RETAINED", None, [], old_stop, "ACK", facts)
        except BaseException as error:
            first = {"type": type(error).__name__, "message": str(error)}
            # A spawn method may fail while persisting PID evidence. Its own
            # custody slot survives that failure; absence of a returned handle
            # is never proof that a native child was not created.
            new = new or h.possible_start()
            build = build or h.possible_build()
            if new is not None or start_state != "NOT_RUN":
                try: clean.append(h.cleanup_start(new))
                except BaseException as secondary: clean.append({"resource": "new_app", "state": "UNKNOWN", "error": str(secondary)})
            if build is not None:
                try: clean.append(h.cleanup_build(build))
                except BaseException as secondary: clean.append({"resource": "new_build", "state": "UNKNOWN", "error": str(secondary)})
            unknown = isinstance(error, Unknown) or any(x["state"] == "UNKNOWN" for x in clean)
            result = Outcome("UNKNOWN_STOPPED_NO_RETRY" if unknown else "FAILED_STOPPED_NO_RETRY", first, clean, old_stop, start_state, facts)
        if claimed:
            try:
                h.finish(result)
            except BaseException as error:
                # The primary error cannot be replaced by receipt persistence.
                result.evidence["finish_error"] = {"type": type(error).__name__, "message": str(error)}
                result.first_error = result.first_error or result.evidence["finish_error"]
                result.state = "UNKNOWN_RECEIPT_PERSISTENCE_NO_RETRY"
                result.evidence["custody_followup"] = {"owner": "Platform", "deadline_seconds": 600, "new_app": "RETAINED_ACK" if result.start_dispatch == "ACK" else "SEE_CLEANUP_AND_DISPATCH_STATE", "no_retry": True}
        return result
