"""Fit complete designed recordings to equal 15-second, equal-loudness samples."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

import numpy as np
import soundfile as sf


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--ffmpeg', required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    native = json.loads(args.manifest.read_text(encoding='utf-8'))
    workspace = args.manifest.parent
    args.output_dir.mkdir(parents=True, exist_ok=True)
    rate = 44100
    rows = []

    def decode(path, filters=None):
        command = [args.ffmpeg, '-hide_banner', '-loglevel', 'info', '-i', str(path)]
        if filters:
            command += ['-af', filters]
        command += ['-ar', str(rate), '-ac', '1', '-f', 'f32le', 'pipe:1']
        result = subprocess.run(command, capture_output=True, check=True)
        return np.frombuffer(result.stdout, dtype='<f4').copy(), result.stderr.decode('utf-8', errors='replace')

    for voice in native['voices']:
        source = workspace / f"{voice['id']}-native.wav"
        assert hashlib.sha256(source.read_bytes()).hexdigest() == voice['sha256']
        samples, _ = decode(source)
        audible = np.flatnonzero(np.abs(samples) > 0.0006)
        first = max(0, int(audible[0]) - round(.08 * rate))
        last = min(len(samples), int(audible[-1]) + round(.12 * rate))
        tempo = (last - first) / (14.6 * rate)
        assert .7 <= tempo <= 1.5, f"Excessive tempo correction for {voice['id']}: {tempo}"
        trimmed = workspace / f"{voice['id']}-trimmed.wav"
        sf.write(trimmed, samples[first:last], rate, subtype='FLOAT')
        filters = f'rubberband=tempo={tempo:.10f}:pitch=1:transients=mixed:detector=soft:phase=laminar:window=long:formant=preserved:pitchq=quality'
        inner, _ = decode(trimmed, filters)
        desired = round(14.6 * rate)
        assert abs(len(inner) - desired) < .06 * rate
        if len(inner) > desired:
            assert float(np.max(np.abs(inner[desired:]))) < .005
        inner = np.pad(inner[:desired], (0, max(0, desired - len(inner))))
        aligned = np.zeros(15 * rate, dtype=np.float32)
        start = round(.15 * rate)
        aligned[start:start + len(inner)] = inner
        timed = workspace / f"{voice['id']}-timed.wav"
        sf.write(timed, aligned, rate, subtype='FLOAT')
        normalized, log = decode(timed, 'loudnorm=I=-18:TP=-2:LRA=8:print_format=json')
        loudness = json.loads(re.search(r'\{\s*"input_i".*?\}', log, re.S).group(0))
        assert abs(len(normalized) - 15 * rate) <= 2
        normalized = np.pad(normalized[:15 * rate], (0, max(0, 15 * rate - len(normalized))))
        gain = min(10 ** ((-18 - float(loudness['output_i'])) / 20), .95 / float(np.max(np.abs(normalized))))
        normalized *= gain
        output = args.output_dir / f"{voice['id']}_{voice['name']}_15秒.wav"
        sf.write(output, normalized, rate, subtype='PCM_24')
        check, sr = sf.read(output, dtype='float32')
        active = np.flatnonzero(np.abs(check) > .01)
        assert sr == rate and len(check) == 15 * rate
        assert 0 < np.max(np.abs(check)) < 1 and active[-1] / rate > 14
        row = {
            'id': voice['id'], 'name': voice['name'], 'output': str(output),
            'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'source': str(source), 'sourceSha256': voice['sha256'],
            'request': voice['request'], 'sourceDuration': voice['duration'],
            'sourceRange': [first / rate, last / rate], 'tempo': tempo, 'pitchRatio': 1,
            'duration': 15.0, 'samples': len(check), 'sampleRate': sr,
            'loudnessLufs': float(loudness['output_i']) + 20 * np.log10(gain),
            'peak': float(np.max(np.abs(check))), 'speechRange': [active[0] / rate, active[-1] / rate],
        }
        rows.append(row)
        print(json.dumps({k: row[k] for k in ['id', 'duration', 'tempo', 'speechRange', 'output']}, ensure_ascii=False), flush=True)
    result = {
        'script': native['script'], 'durationEach': 15.0, 'equalVolumeTargetLufs': -18,
        'voices': rows, 'selectedVoice': None, 'status': 'awaiting_text_verification',
        'humanListeningPerformed': False, 'referenceAudioUsedForGeneration': False,
    }
    (workspace / 'audition-manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (args.output_dir / '试听说明.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (args.output_dir / '共同试听文案.txt').write_text(native['script'] + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
