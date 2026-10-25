"""Transcribe the final mixed film with the cloud's existing local ASR model."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not args.audio.is_file():
        raise FileNotFoundError(args.audio)
    runtime = Path.home() / "projects" / "erke_audio_post" / "lib"
    model_path = Path.home() / "models" / "faster-whisper-large-v3-turbo"
    if not (model_path / "model.bin").is_file():
        raise FileNotFoundError(model_path)
    sys.path.insert(0, str(runtime))
    from faster_whisper import WhisperModel

    model = WhisperModel(str(model_path), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    segments, info = model.transcribe(str(args.audio), language="zh", beam_size=5, word_timestamps=True, vad_filter=True, condition_on_previous_text=False)
    rows = []
    for segment in segments:
        row = {"start": float(segment.start), "end": float(segment.end), "text": segment.text, "averageLogProbability": float(segment.avg_logprob), "noSpeechProbability": float(segment.no_speech_prob), "words": [{"word": word.word, "start": float(word.start), "end": float(word.end), "probability": float(word.probability)} for word in segment.words or []]}
        rows.append(row)
        print(json.dumps({"start": row["start"], "end": row["end"], "text": row["text"]}, ensure_ascii=False), flush=True)
    result = {"audio": str(args.audio), "model": str(model_path), "timestamp": datetime.now(timezone.utc).isoformat(), "language": info.language, "duration": float(info.duration), "segments": rows, "reviewRequired": "Compare recognized words and timings with the approved narration. Recognition does not establish music aesthetics or a human listening review."}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("OPENING_SPEECH_TRANSCRIPTION_COMPLETE", flush=True)


if __name__ == "__main__":
    main()
