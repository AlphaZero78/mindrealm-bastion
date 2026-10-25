"""Assemble verified source clips, narration, scene sound, music and subtitles."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


def run(command, cwd=None):
    subprocess.run([str(value) for value in command], cwd=cwd, check=True)


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode("utf-8")).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--media-dir", type=Path, required=True)
    parser.add_argument("--media-manifest", type=Path, required=True)
    parser.add_argument("--narration-dir", type=Path, required=True)
    parser.add_argument("--score", type=Path, required=True)
    parser.add_argument("--title-card", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path, required=True)
    parser.add_argument("--cached-edits-dir", type=Path, help="Reuse rendered shot edits while rebuilding the title card and delivery")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--picture-master", type=Path, help="Reuse an existing clean picture master for an audio revision")
    parser.add_argument("--ambience", type=Path, help="Reuse the existing scene ambience stem")
    parser.add_argument("--no-scene-audio", action="store_true", help="Exclude every generated source-clip audio track from the soundtrack")
    parser.add_argument("--captioned-video", type=Path, help="Reuse captioned picture packets when only audio changes and subtitle timing is identical")
    parser.add_argument("--through-shot", help="Render a labeled work-in-progress prefix ending at this shot")
    args = parser.parse_args()
    if args.no_scene_audio and args.ambience:
        raise ValueError("Scene audio exclusion cannot be combined with an ambience stem")
    source = Path(__file__).resolve().parent
    plan = json.loads((source / "cloud-shots.json").read_text(encoding="utf-8"))
    manifest = json.loads(args.media_manifest.read_text(encoding="utf-8"))
    media = manifest["clips"]
    edit_overrides = manifest.get("editOverrides", {})
    clips = plan["clips"]
    if args.through_shot:
        ids = [clip["id"] for clip in clips]
        if args.through_shot not in ids:
            raise ValueError("Unknown preview ending shot: " + args.through_shot)
        clips = clips[:ids.index(args.through_shot)+1]
    film_duration = clips[-1]["timelineEnd"] if args.through_shot else plan["endCard"]["timelineEnd"]
    required = [clip["id"] for clip in clips]
    source_ids = {clip["id"]: edit_overrides.get(clip["id"], {}).get("sourceClip", clip["id"]) for clip in clips}
    missing = [name for name in required if source_ids[name] not in media or not (args.media_dir / media[source_ids[name]]["file"]).is_file()]
    if missing:
        raise ValueError("Source clips are still missing: " + ", ".join(missing))
    for path in [args.score, args.title_card, args.narration_dir / "narration-aligned.wav", args.narration_dir / "narration.zh-CN.ass"] + [path for path in (args.picture_master, args.ambience, args.captioned_video) if path is not None]:
        if not path.is_file():
            raise FileNotFoundError(path)
    args.work_dir.mkdir(parents=True, exist_ok=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    edits = args.cached_edits_dir if args.cached_edits_dir else args.work_dir / "edits"
    edits.mkdir(exist_ok=True)
    ff = [args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
    encode = ["-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-threads", "2", "-r", "24", "-video_track_timescale", "24000"]
    pictures = []
    audio_inputs = []
    for position, clip in enumerate(clips, 1):
        edit_override = edit_overrides.get(clip["id"], {})
        item = media[source_ids[clip["id"]]]
        path = (args.media_dir / item["file"]).resolve()
        duration = clip["timelineEnd"] - clip["timelineStart"]
        source_in = edit_override.get("sourceIn", item.get("editSourceIn", clip["sourceIn"]))
        if source_in + duration > item["duration"] + 1/24:
            raise ValueError(f"Source {clip['id']} is shorter than the requested edit")
        audio_inputs.append((clip, item, path, source_in))
        if args.picture_master:
            continue
        params = {"sourceSha256": item["sha256"], "sourceIn": source_in, "duration": duration, "outputSize": [1920, 1080], "fadeIn": 0.8 if clip["id"] == "01" else 0, "fadeOut": 0.28 if clip["id"] == "12" else 0, "renderVersion": 2}
        key = fingerprint(params)
        target = edits / f"shot-{clip['id']}-{key[:12]}.mp4"
        if not target.is_file():
            first_frame = round(source_in*24)
            last_frame = first_frame + round(duration*24)
            vf = f"trim=start_frame={first_frame}:end_frame={last_frame},setpts=N/(24*TB),crop=1344:756:0:6,scale=1920:1080:flags=lanczos,setsar=1"
            if params["fadeIn"]:
                vf += f",fade=t=in:st=0:d={params['fadeIn']}"
            if params["fadeOut"]:
                vf += f",fade=t=out:st={duration-params['fadeOut']}:d={params['fadeOut']}"
            print(json.dumps({"stage": "picture_edit", "shot": clip["id"], "index": position, "total": len(required)}), flush=True)
            run(ff + ["-i", path, "-an", "-vf", vf, "-frames:v", round(duration*24)] + encode + [target])
        pictures.append(target.resolve())
    if not args.through_shot and not args.picture_master:
        card_hash = hashlib.sha256(args.title_card.read_bytes()).hexdigest()[:12]
        card_video = edits / f"title-card-{card_hash}.mp4"
        if not card_video.is_file():
            run(ff + ["-loop", "1", "-framerate", "24", "-i", args.title_card.resolve(), "-an", "-vf", "fade=t=in:st=0:d=0.35,fade=t=out:st=3.4:d=0.6", "-frames:v", "96"] + encode + [card_video])
        pictures.append(card_video.resolve())
    picture_master = args.picture_master if args.picture_master else args.work_dir / "picture-master.mp4"
    if not args.picture_master:
        concat = args.work_dir / "picture-timeline.ffconcat"
        lines = ["ffconcat version 1.0"]
        for path in pictures:
            escaped = path.as_posix().replace("'", "'\\''")
            lines.append(f"file '{escaped}'")
        concat.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(json.dumps({"stage": "picture_assembly", "duration": film_duration}), flush=True)
        run(ff + ["-f", "concat", "-safe", "0", "-i", concat, "-an", "-c:v", "copy", "-movflags", "+faststart", picture_master])
    ambience = None
    if not args.no_scene_audio:
        # Scene ambience overlaps briefly across cuts while picture timing stays exact.
        ambience = args.ambience if args.ambience else args.work_dir / "scene-ambience.wav"
        if not args.ambience:
            command = ff.copy()
            filters, labels = [], []
            for index, (clip, item, path, source_in) in enumerate(audio_inputs):
                command += ["-i", path]
                before = min(0.15, clip["timelineStart"], source_in)
                after = max(0, min(0.15, item["duration"] - source_in - (clip["timelineEnd"]-clip["timelineStart"])))
                length = clip["timelineEnd"] - clip["timelineStart"] + before + after
                delay = round((clip["timelineStart"]-before)*1000)
                label = f"scene{index}"
                filters.append(f"[{index}:a]atrim=start={source_in-before}:duration={length},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-29:TP=-8:LRA=18,afade=t=in:st=0:d=0.15,afade=t=out:st={max(0,length-0.2)}:d=0.2,adelay={delay}|{delay}[{label}]")
                labels.append(f"[{label}]")
            filters.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0:dropout_transition=0,apad,atrim=duration={film_duration},aresample=48000[ambience]")
            print(json.dumps({"stage": "scene_sound"}), flush=True)
            run(command + ["-filter_complex", ";".join(filters), "-map", "[ambience]", "-ar", "48000", "-c:a", "pcm_s24le", ambience])
    mixed_audio = args.work_dir / "final-soundtrack.m4a"
    mix_sources = ["[voice]", "[bed]"] + (["[2:a]"] if ambience else [])
    mix_graph = "[0:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=55,lowpass=f=7600,loudnorm=I=-18:TP=-3:LRA=12,asplit=2[voice][duck];[1:a]aresample=48000,aformat=channel_layouts=stereo[music];[music][duck]sidechaincompress=threshold=0.025:ratio=3:attack=50:release=350[bed];" + "".join(mix_sources) + f"amix=inputs={len(mix_sources)}:normalize=0:dropout_transition=0,loudnorm=I=-18:TP=-1.5:LRA=16,afade=t=out:st={film_duration-0.6}:d=0.6,apad,atrim=duration={film_duration},aresample=48000[final]"
    print(json.dumps({"stage": "final_mix"}), flush=True)
    soundtrack_sources = [(args.narration_dir/"narration-aligned.wav").resolve(), args.score.resolve()] + ([ambience.resolve()] if ambience else [])
    mix_command = ff.copy()
    for path in soundtrack_sources:
        mix_command += ["-i", path]
    run(mix_command + ["-filter_complex", mix_graph, "-map", "[final]", "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "192k", mixed_audio])
    mix_receipt = {"sourceClipAudioIncluded": not args.no_scene_audio, "sources": [{"path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in soundtrack_sources], "filterGraph": mix_graph, "output": str(mixed_audio.resolve()), "sha256": hashlib.sha256(mixed_audio.read_bytes()).hexdigest()}
    (args.work_dir/"soundtrack-provenance.json").write_text(json.dumps(mix_receipt, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    shutil.copyfile(args.narration_dir/"narration.zh-CN.ass", args.work_dir/"subtitles.ass")
    temporary = args.output.with_name(args.output.stem + ".rendering.mp4")
    print(json.dumps({"stage": "subtitles_and_delivery"}), flush=True)
    picture_input = args.captioned_video if args.captioned_video else picture_master
    picture_encode = ["-c:v", "copy"] if args.captioned_video else ["-vf", "ass=subtitles.ass", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-threads", "2", "-pix_fmt", "yuv420p", "-r", "24", "-video_track_timescale", "24000"]
    run(ff + ["-i", picture_input.resolve(), "-i", mixed_audio.resolve(), "-map", "0:v:0", "-map", "1:a:0"] + picture_encode + ["-c:a", "copy", "-t", film_duration, "-movflags", "+faststart", "-metadata", "title=心域防线：最后的清醒信号", "-metadata", "comment=AI-generated cinematic imagery; original game-world introduction; source licenses retained with the editable project", temporary.resolve()], cwd=args.work_dir)
    temporary.replace(args.output)
    receipt = {"output": str(args.output.resolve()), "durationTarget": film_duration, "resolution": [1920,1080], "nativeSourceResolution": [1344,768], "fps": 24, "sourceClips": len(required), "sourceClipAudioIncluded": not args.no_scene_audio, "soundtrackProvenance": str((args.work_dir/"soundtrack-provenance.json").resolve()), "titleCardSha256": hashlib.sha256(args.title_card.read_bytes()).hexdigest(), "editingOverrides": edit_overrides, "sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(), "status": "preview_rendered_pending_review" if args.through_shot else "rendered_pending_final_review"}
    args.output.with_suffix(".production.json").write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(receipt,ensure_ascii=False),flush=True)


if __name__ == "__main__":
    main()
