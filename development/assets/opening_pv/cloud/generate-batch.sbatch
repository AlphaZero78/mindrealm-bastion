#!/bin/bash
#SBATCH -J mindrealm-pv-batch
#SBATCH -A stu
#SBATCH -p Students
#SBATCH --qos=qos_stu_default
#SBATCH --gres=gpu:A100:1
#SBATCH --cpus-per-task=4
#SBATCH --mem=16G
#SBATCH -t 04:00:00
#SBATCH -o logs/%x-%j.out
#SBATCH -e logs/%x-%j.err
set -euo pipefail
umask 077
cd "$HOME/projects/minimax_h3"
test -s outputs/setup-complete.txt
test -s outputs/download-complete.txt
source .venv/bin/activate
export H3_PROJECT="$PWD"
export H3_API_KEY="$(python -c 'import secrets;print(secrets.token_urlsafe(32))')"
export OMP_NUM_THREADS=4 MKL_NUM_THREADS=4 PYTHONUNBUFFERED=1
export TOKENIZERS_PARALLELISM=false HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1
if test "$#" -eq 0; then printf 'Supply one or more request JSON paths.\n' >&2; exit 2; fi
requests=("$@")
for request in "${requests[@]}"; do
    python - "$request" <<'PY'
import json, re, sys
from pathlib import Path
p=Path(sys.argv[1]).resolve()
assert p.is_relative_to(Path.cwd())
r=json.loads(p.read_text()); name=r['request_id']
assert re.fullmatch(r'mindrealm_pv_[A-Za-z0-9_-]{1,65}',name)
assert (r['width'],r['height'],r['fps'])==(1344,768,24)
assert 5 <= r['duration_seconds'] <= 15
assert r['native_frames'] % 17 == 5 and r['native_frames'] >= round(r['duration_seconds']*24)
assert r['steps']==8 and r['sampler']=='euler' and r['scheduler']=='simple'
assert (r['shift_video'],r['shift_audio'])==(6,3)
adapter=Path.home()/'models'/'MiniMax-H3'/'loras'/r['lora_name']
assert adapter.is_file() and adapter.stat().st_size==1956193000
receipt=json.loads((Path('outputs')/'opening-adapter-download.json').read_text())
assert receipt['status']=='complete' and receipt['sha256']=='08cfe946033af7d27719b964b6e0a0e50c32138daabbd6ce4137e23df6bf9980'
target=Path('outputs')/f'request-{name}.json'
if target.exists(): assert json.loads(target.read_text())==r, 'Existing request has different settings'
else: target.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print('REQUEST_READY '+name,flush=True)
PY
done
server_pid=''
cleanup() {
    if test -n "$server_pid"; then kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 143' TERM INT
port=$((20000+SLURM_JOB_ID%30000))
for phase in encode sample decode; do
    cache_option=--cache-classic
    if test "$phase" = decode; then cache_option=--cache-none; fi
    python ComfyUI/main.py --listen 127.0.0.1 --port "$port" \
      --models-directory "$HOME/models/MiniMax-H3" \
      --output-directory "$PWD/outputs" --user-directory "$PWD/outputs/comfy-user" \
      --gpu-only --use-pytorch-cross-attention --disable-xformers \
      --disable-async-offload --disable-pinned-memory --disable-dynamic-vram \
      --disable-comfy-compiler "$cache_option" --disable-auto-launch --offline \
      >"logs/opening-server-${SLURM_JOB_ID}-${phase}.log" 2>&1 &
    server_pid=$!
    for request in "${requests[@]}"; do
        request_id=$(python -c 'import json,sys;print(json.load(open(sys.argv[1]))["request_id"])' "$request")
        if test "$phase" = encode && test -s "outputs/bundles/${request_id}_conditioning.json" && test -s "outputs/bundles/${request_id}_conditioning.safetensors"; then continue; fi
        if test "$phase" = sample && test -s "outputs/bundles/${request_id}_sampled.json" && test -s "outputs/bundles/${request_id}_sampled.safetensors"; then continue; fi
        if test "$phase" = decode && test -s "outputs/validated-${request_id}.txt"; then continue; fi
        printf 'OPENING_PHASE_START %s %s\n' "$request_id" "$phase"
        python scripts/opening_stage_client_v2.py --phase "$phase" --request "$request" --port "$port" --server-pid "$server_pid"
        if test "$phase" = decode; then
            python scripts/opening_validate_clip.py --request "$request"
            date -Is > "outputs/validated-${request_id}.txt"
        fi
    done
    cleanup
    server_pid=''
done
printf 'OPENING_BATCH_COMPLETE %s\n' "$SLURM_JOB_ID"
