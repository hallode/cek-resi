#!/usr/bin/env bash
# UserPromptSubmit: ingatkan agen memakai skill dev-flow bila prompt terlihat seperti tugas coding.
prompt=$(jq -r '.prompt // ""')
lower=$(printf '%s' "$prompt" | tr '[:upper:]' '[:lower:]')

# Slash command (mis. /dev-flow) sudah eksplisit; tidak perlu pengingat.
case "$lower" in /*) exit 0 ;; esac

# Nama repo ("cek-resi", mis. di URL) bukan kata perintah "cek".
lower=${lower//cek-resi/}

hot='hotfix|fix cepat'
change='\b(tambah|tambahin|tambahkan|buat|buatkan|bikin|implement|implementasi|kerjakan|ubah|ganti|perbaiki|benerin|fix|bug|refactor|refaktor|fitur|feature|endpoint|hapus fitur|migrasi)\b'

# Kata perubahan menang atas kata review: "fix bug, cek test, buat PR" tetap tugas coding.
if printf '%s' "$lower" | grep -Eq "$hot"; then
  hint='Prompt ini menyebut hotfix: bila memang meminta perubahan kode, invoke skill dev-flow dengan mode=hotfix (tanpa planner, branch hotfix/<nama>).'
elif printf '%s' "$lower" | grep -Eq "$change"; then
  hint='Bila prompt ini meminta perubahan kode/spec (bukan sekadar pertanyaan atau tugas sepele), invoke skill dev-flow sebelum mengedit: planner -> persetujuan user -> executor -> tanya review -> tanya PR, di branch baru sesuai jenisnya.'
elif printf '%s' "$lower" | grep -Eq '\b(review|cek|check|periksa|merge)\b' &&
  printf '%s' "$lower" | grep -Eq '\bpr\b|\bmr\b|pull request|merge request|/pull/[0-9]+'; then
  hint='Prompt ini meminta review/merge PR: invoke skill review-pr (bukan dev-flow).'
else
  exit 0
fi

jq -n --arg c "$hint" '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $c}}'
