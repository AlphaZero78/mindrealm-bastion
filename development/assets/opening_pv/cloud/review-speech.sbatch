#!/bin/bash
#SBATCH -J mindrealm-pv-speech
#SBATCH -A stu
#SBATCH -p Students
#SBATCH --qos=qos_stu_default
#SBATCH --cpus-per-task=4
#SBATCH --mem=8G
#SBATCH -t 00:15:00
#SBATCH -o logs/%x-%j.out
#SBATCH -e logs/%x-%j.err
set -euo pipefail
umask 077
cd "$HOME/projects/minimax_h3"
test "$#" -eq 2
test -s "$1"
export OMP_NUM_THREADS=4 MKL_NUM_THREADS=4 PYTHONUNBUFFERED=1
export HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1
.venv/bin/python scripts/opening_review_speech.py --audio "$1" --output "$2"
