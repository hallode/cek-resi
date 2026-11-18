#!/usr/bin/env bash
# Pre-PR checks: lint, test, then start every service and run e2e + the
# backward-compatibility replay of the base ref's spec cases.
#
# Usage: .claude/skills/push-pr/run-checks.sh [base-ref]   (default origin/master)
# Exit: 0 all green, 1 a check failed, 2 could not run (ports busy / services did not start).

set -uo pipefail
base=${1:-origin/master}
root=$(git rev-parse --show-toplevel)
cd "$root" || exit 2
log_dir=$(mktemp -d)
status=0
declare -a summary

run() { # run <name> <command...>
  local name=$1
  shift
  if "$@" >"$log_dir/$name.log" 2>&1; then
    summary+=("OK    $name")
  else
    summary+=("GAGAL $name  (log: $log_dir/$name.log)")
    echo "---- $name (40 baris terakhir) ----"
    tail -40 "$log_dir/$name.log"
    status=1
  fi
}

finish() {
  echo
  echo "==== Ringkasan ===="
  printf '%s\n' "${summary[@]}"
  exit "$status"
}

run lint mise run lint
run test mise run test

# Services must start from this working tree; never reuse (or kill) what is already running.
busy=$(lsof -nP -iTCP:8080-8083 -sTCP:LISTEN 2>/dev/null | tail -n +2)
if [[ -n $busy ]]; then
  echo "Port 8080-8083 sudah dipakai; hentikan dulu proses ini lalu ulangi:"
  echo "$busy"
  summary+=("LEWAT e2e + kompatibilitas (port sibuk)")
  [[ $status -eq 0 ]] && status=2
  finish
fi

set -m # own process group, so every service started by `mise run dev` can be stopped
mise run dev >"$log_dir/dev.log" 2>&1 &
dev_pid=$!
trap 'kill -- -"$dev_pid" 2>/dev/null; wait "$dev_pid" 2>/dev/null' EXIT

ready=0
for _ in $(seq 1 180); do
  if curl -sf -m 2 localhost:8080/health >/dev/null && curl -sf -m 2 localhost:8081/health >/dev/null &&
    curl -sf -m 2 localhost:8082/health >/dev/null && curl -sf -m 2 localhost:8083/health >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if [[ $ready -eq 0 ]]; then
  echo "Service tidak hidup dalam 180 detik. Log: $log_dir/dev.log"
  tail -30 "$log_dir/dev.log"
  summary+=("GAGAL start service (mise run dev)")
  status=1
  finish
fi

run e2e mise run e2e
# compat exits 1 = breaking change, 2 = a service was unreachable, 3 = could not run; its report is always shown.
compat_log="$log_dir/compat.log"
mise exec -- node services/gateway-ts/e2e/compat.ts "$base" >"$compat_log" 2>&1
compat_status=$?
cat "$compat_log"
case $compat_status in
0) summary+=("OK    compat") ;;
1) summary+=("GAGAL compat: breaking change (lihat di atas)") status=1 ;;
2) summary+=("GAGAL compat: service tidak terjangkau") status=1 ;;
*) summary+=("GAGAL compat: gagal jalan (exit $compat_status; base ref?)") status=1 ;;
esac
finish
