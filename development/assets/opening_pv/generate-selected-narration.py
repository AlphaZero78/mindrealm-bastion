"""Extend an approved synthetic audition into a consistent full-film narration."""
import argparse
import hashlib
import json
from pathlib import Path
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--request', type=Path, required=True)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    request = json.loads(args.request.read_text(encoding='utf-8'))
    reference = Path(request['referenceAudio'])
    assert hashlib.sha256(reference.read_bytes()).hexdigest() == request['referenceSha256']
    args.output.mkdir(parents=True, exist_ok=True)
    import numpy as np
    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel
    torch.set_num_threads(4)
    model = Qwen3TTSModel.from_pretrained(str(args.model), device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa', local_files_only=True)
    prompt = model.create_voice_clone_prompt(ref_audio=str(reference), ref_text=request['referenceText'], x_vector_only_mode=False)
    reference_embedding = prompt[0].ref_spk_embedding.float().flatten()
    rows = []
    for shot in request['shots']:
        name = shot['id']
        path = args.output / f'voice-{name}-native.wav'
        receipt = path.with_suffix('.json')
        if path.exists() and receipt.exists():
            previous = json.loads(receipt.read_text(encoding='utf-8'))
            assert previous['text'] == shot['voice'] and previous['referenceSha256'] == request['referenceSha256']
            assert hashlib.sha256(path.read_bytes()).hexdigest() == previous['sha256']
            rows.append(previous)
            print('REUSED', name, flush=True)
            continue
        assert not path.exists(), 'Existing recording must be preserved: ' + str(path)
        seed = 20261025300 + int(name)
        torch.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
        begin = time.monotonic()
        wavs, rate = model.generate_voice_clone(text=shot['voice'], language='Chinese', voice_clone_prompt=prompt, non_streaming_mode=True, max_new_tokens=640)
        wave = np.asarray(wavs[0], dtype=np.float32)
        assert np.isfinite(wave).all() and 1 < len(wave) / rate < 30
        sf.write(path, wave, rate, subtype='PCM_24')
        embedding = model.model.extract_speaker_embedding(audio=wave, sr=rate).float().flatten()
        similarity = float(torch.nn.functional.cosine_similarity(reference_embedding, embedding, dim=0))
        row = {'shot': name, 'text': shot['voice'], 'file': str(path), 'duration': len(wave) / rate, 'sampleRate': rate, 'seed': seed, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'referenceSha256': request['referenceSha256'], 'referenceSpeakerCosineSimilarity': similarity, 'generationSeconds': time.monotonic() - begin}
        receipt.write_text(json.dumps(row, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        rows.append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)
    result = {'provider': 'Qwen3-TTS-12Hz-1.7B-Base', 'voice': 'F 沧桑微沙', 'referenceAudio': str(reference), 'referenceSha256': request['referenceSha256'], 'referenceText': request['referenceText'], 'referenceOrigin': 'User-selected original synthetic audition', 'externalPersonReferenceUsed': False, 'segments': rows}
    (args.output / 'native-narration-manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('SELECTED_F_NARRATION_GENERATED', flush=True)


if __name__ == '__main__':
    main()
