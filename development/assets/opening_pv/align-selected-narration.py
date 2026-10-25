"""Place the selected narration on the film timeline with slower speech and fresh captions."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

import numpy as np
import soundfile as sf

RATE = 24000
PREFERRED_START = {'01': 2.0, '02': 10.0, '03': 21.0, '04': 33.2, '05': 47.0, '06': 58.5, '07': 70.0, '08': 80.0, '09': 94.2, '10': 105.9, '11': 115.3, '12': 127.55}


def timestamp(seconds, ass=False):
    units = 100 if ass else 1000
    total = round(seconds * units)
    hours, total = divmod(total, 3600 * units)
    minutes, total = divmod(total, 60 * units)
    whole, fraction = divmod(total, units)
    return f'{hours}:{minutes:02}:{whole:02}.{fraction:02}' if ass else f'{hours:02}:{minutes:02}:{whole:02},{fraction:03}'


def wrap_caption(text):
    if len(text) <= 24:
        return text
    positions = [i+1 for i, char in enumerate(text) if char in '，。；！？' and 10 <= i+1 <= len(text)-10]
    split = min(positions, key=lambda i: abs(i-len(text)/2)) if positions else round(len(text)/2)
    return text[:split] + '\n' + text[split:]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--native-manifest', type=Path, required=True)
    parser.add_argument('--timing', type=Path, required=True)
    parser.add_argument('--baseline-manifest', type=Path, required=True)
    parser.add_argument('--ffmpeg', required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    shots = json.loads((source/'shotlist.json').read_text(encoding='utf-8'))
    native = json.loads(args.native_manifest.read_text(encoding='utf-8'))
    timing = {r['shot']: r for r in json.loads(args.timing.read_text(encoding='utf-8'))['segments']}
    previous = {r['shot']: r for r in json.loads(args.baseline_manifest.read_text(encoding='utf-8'))['segments']}
    workspace = args.native_manifest.parent
    args.output_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for shot, recording in zip(shots, native['segments']):
        assert shot['id'] == recording['shot'] and shot['voice'] == recording['text']
        path = workspace/Path(recording['file']).name
        assert hashlib.sha256(path.read_bytes()).hexdigest() == recording['sha256']
        audio, rate = sf.read(path, dtype='float32')
        assert rate == RATE and audio.ndim == 1
        audible = np.flatnonzero(np.abs(audio) > .0006)
        first = max(0, int(audible[0])-round(.08*RATE))
        last = min(len(audio), int(audible[-1])+round(.12*RATE))
        segment = audio[first:last]
        old_length = previous[shot['id']]['end'] - previous[shot['id']]['start']
        duration = max(len(segment)/RATE/.90, old_length*1.15)
        tempo = len(segment)/RATE/duration
        assert .68 < tempo <= .900001, (shot['id'], tempo)
        trimmed = args.output_dir/f"source-{shot['id']}-trimmed.wav"
        sf.write(trimmed, segment, RATE, subtype='FLOAT')
        stretch = f'rubberband=tempo={tempo:.10f}:pitch=1:transients=mixed:detector=soft:phase=laminar:window=long:formant=preserved:pitchq=quality'
        rendered = subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','error','-i',str(trimmed),'-af',stretch,'-ar',str(RATE),'-ac','1','-f','f32le','pipe:1'],capture_output=True,check=True)
        processed = np.frombuffer(rendered.stdout, dtype='<f4').copy()
        assert abs(len(processed)/RATE-duration) < .04
        duration = len(processed)/RATE
        voiced = processed[np.abs(processed)>.005]
        gain = min(.12 / float(np.sqrt(np.mean(voiced**2))), .85/float(np.max(np.abs(processed))))
        processed *= gain
        filename = f"voice-{shot['id']}.wav"
        sf.write(args.output_dir/filename, processed, RATE, subtype='PCM_24')
        # Short source clips can induce zero-duration closing-credit text in
        # Whisper. Keep its raw report and reject only implausibly fast tails.
        asr_segments = timing[shot['id']]['segments']
        ignored_asr = [s for s in asr_segments if len(re.findall(r'[\u4e00-\u9fff]',s['text'])) >= 6 and s['end']-s['start'] < .31]
        words = [w for s in asr_segments if s not in ignored_asr for w in s['words'] if re.search(r'[\u4e00-\u9fff]', w['word'])]
        relative_words = [{**w,'start':max(0,(w['start']-first/RATE)/tempo),'end':min(duration,(w['end']-first/RATE)/tempo)} for w in words]
        row = {'shot':shot['id'],'text':shot['voice'],'file':filename,'sourceFile':str(path),'sourceSha256':recording['sha256'],'sourceIn':first/RATE,'sourceOut':last/RATE,'duration':duration,'tempo':tempo,'pitchRatio':1.0,'baselineSpeechDuration':old_length,'durationRatioToPrevious':duration/old_length,'relativeWords':relative_words,'sourceSpeakerSimilarity':recording['referenceSpeakerCosineSimilarity'],'ignoredDegenerateAsrSegments':ignored_asr,'sha256':hashlib.sha256((args.output_dir/filename).read_bytes()).hexdigest()}
        records.append(row)
    # Place the closing two sentences around the fixed title-card cut at 131 s.
    ending = records[-1]
    chars = []
    for word in ending['relativeWords']:
        letters = re.findall(r'[\u4e00-\u9fff]', word['word'])
        for i, char in enumerate(letters):
            chars.append({'char':char,'start':word['start']+(word['end']-word['start'])*i/len(letters),'end':word['start']+(word['end']-word['start'])*(i+1)/len(letters)})
    expected = re.sub(r'[^\u4e00-\u9fff]','',ending['text'])
    recognized = ''.join(c['char'] for c in chars)
    assert len(recognized) == len(expected), (recognized, expected)
    split = len(re.findall(r'[\u4e00-\u9fff]', ending['text'].split('。')[0]))
    first_end, tagline_start = chars[split-1]['end'], chars[split]['start']
    lower = 131.10-tagline_start
    upper = min(130.85-first_end, 134.40-ending['duration'])
    assert lower <= upper+.03, (lower, upper)
    ending['start'] = min(max(PREFERRED_START['12'], lower), upper)
    ending['end'] = ending['start'] + ending['duration']
    for index, (shot, row) in enumerate(zip(shots[:-1], records[:-1])):
        latest_end = ending['start']-.35 if shot['id']=='11' else shot['end']-.5
        row['start'] = min(PREFERRED_START[shot['id']], latest_end-row['duration'])
        row['end'] = row['start']+row['duration']
        assert row['start'] >= shot['start']-2.0
        if index:assert row['start'] >= records[index-1]['end']+.25
    assert ending['start'] >= records[-2]['end']+.25
    aligned = np.zeros(135*RATE, dtype=np.float32)
    for row in records:
        wave, rate = sf.read(args.output_dir/row['file'], dtype='float32')
        begin = round(row['start']*RATE)
        assert 0 <= begin and begin+len(wave) <= len(aligned)
        aligned[begin:begin+len(wave)] = wave
        row['words'] = [{**w,'start':row['start']+w['start'],'end':row['start']+w['end']} for w in row.pop('relativeWords')]
        # Sentence captions cover the complete audible recording. This avoids
        # premature disappearance when VAD compresses internal word timestamps.
        row['captions'] = [{'text':row['text'],'start':row['start'],'end':min(135,row['end']+.08),'burn':True}]
        if row['shot']=='12':
            opening_text, closing_text = row['text'].split('。',1)
            row['captions'] = [
                {'text':opening_text+'。','start':row['start'],'end':min(131,row['start']+first_end+.15),'burn':True},
                {'text':closing_text,'start':row['start']+tagline_start-.10,'end':min(135,row['end']+.08),'burn':False,'titleCardContainsText':True},
            ]
        print(json.dumps({k:row[k] for k in ['shot','start','end','tempo','durationRatioToPrevious']},ensure_ascii=False),flush=True)
    sf.write(args.output_dir/'narration-aligned.wav', aligned, RATE, subtype='PCM_24')
    ass = ['[Script Info]','ScriptType: v4.00+','PlayResX: 1920','PlayResY: 1080','WrapStyle: 2','ScaledBorderAndShadow: yes','','[V4+ Styles]','Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding','Style: Default,SimSun,42,&H00F5F3EF,&H00FFFFFF,&H001A1713,&H66000000,0,0,0,0,100,100,1,0,1,2,1,2,180,180,88,1','','[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
    srt = []
    for row in records:
        for caption in row['captions']:
            text = wrap_caption(caption['text'])
            srt.append(f"{len(srt)+1}\n{timestamp(caption['start'])} --> {timestamp(caption['end'])}\n{text}\n")
            if caption['burn']:
                escaped = text.replace('\n', r'\N')
                ass.append(f"Dialogue: 0,{timestamp(caption['start'], True)},{timestamp(caption['end'], True)},Default,,0,0,0,,{{\\fad(100,150)}}{escaped}")
    (args.output_dir/'narration.zh-CN.srt').write_text('\n'.join(srt),encoding='utf-8')
    (args.output_dir/'narration.zh-CN.ass').write_text('\n'.join(ass)+'\n',encoding='utf-8')
    result = {'provider':native['provider'],'voice':native['voice'],'referenceSha256':native['referenceSha256'],'duration':135,'sampleRate':RATE,'speechDuration':sum(r['duration'] for r in records),'baselineSpeechDuration':sum(r['baselineSpeechDuration'] for r in records),'sourceSceneAudioIncluded':False,'alignmentMethod':'Complete source recordings, pitch-preserving tempo adjustment, actual source word timestamps, fixed 135-second picture timeline','segments':records}
    (args.output_dir/'narration-manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__ == '__main__':
    main()
