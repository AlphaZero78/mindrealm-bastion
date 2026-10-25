"""Generate reproducible, text-described Mandarin voice auditions on the cloud GPU."""
import argparse
import datetime
import hashlib
import json
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--request', type=Path, required=True)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    plan = json.loads(args.request.read_text(encoding='utf-8'))
    args.output.mkdir(parents=True, exist_ok=True)
    import numpy as np
    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel
    torch.set_num_threads(4)
    model = Qwen3TTSModel.from_pretrained(
        str(args.model), device_map='cuda:0', dtype=torch.bfloat16,
        attn_implementation='sdpa', local_files_only=True,
    )
    rows = []
    for candidate in plan['voices']:
        path = args.output / f"{candidate['id']}-native.wav"
        receipt = path.with_suffix('.json')
        if receipt.exists() and path.exists():
            previous = json.loads(receipt.read_text(encoding='utf-8'))
            if previous['request'] == candidate and previous['text'] == plan['script']:
                assert hashlib.sha256(path.read_bytes()).hexdigest() == previous['sha256']
                rows.append(previous)
                print('REUSED', candidate['id'], flush=True)
                continue
        assert not path.exists(), f'Refusing to overwrite existing recording: {path}'
        torch.manual_seed(candidate['seed'])
        torch.cuda.manual_seed_all(candidate['seed'])
        begin = time.monotonic()
        wavs, rate = model.generate_voice_design(
            text=plan['script'], language='Chinese', instruct=candidate['instruct'],
            non_streaming_mode=True, max_new_tokens=768,
        )
        wave = np.asarray(wavs[0], dtype=np.float32)
        assert np.isfinite(wave).all() and len(wave) > 5 * rate
        sf.write(path, wave, rate, subtype='PCM_24')
        row = {
            'id': candidate['id'], 'name': candidate['name'], 'request': candidate,
            'text': plan['script'], 'model': str(args.model), 'method': 'generate_voice_design',
            'referenceAudioUsedForGeneration': False, 'sampleRate': rate,
            'duration': len(wave) / rate, 'file': str(path),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'peak': float(np.max(np.abs(wave))),
            'generationSeconds': time.monotonic() - begin,
            'createdUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        receipt.write_text(json.dumps(row, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        rows.append(row)
        print(json.dumps({k: row[k] for k in ['id', 'duration', 'generationSeconds', 'sha256']}, ensure_ascii=False), flush=True)
    result = {'script': plan['script'], 'voices': rows, 'status': 'native_generation_complete'}
    (args.output / 'native-manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('DESIGNED_VOICES_GENERATED', flush=True)


if __name__ == '__main__':
    main()
