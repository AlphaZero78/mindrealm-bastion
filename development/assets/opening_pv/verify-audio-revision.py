"""Consolidated final-film check with evidence for the voice and signal-effect changes."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

import numpy as np


def main():
    parser=argparse.ArgumentParser()
    for name in ['video','subtitles','output-dir','baseline-video','baseline-narration','narration','effect','inspection']:
        parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--ffmpeg',required=True)
    args=parser.parse_args()
    validator=Path(__file__).with_name('validate-film.py')
    subprocess.run([sys.executable,'-X','utf8',str(validator),'--video',str(args.video),'--subtitles',str(args.subtitles),'--output-dir',str(args.output_dir),'--ffmpeg',args.ffmpeg],check=True)
    def decode(path,start,duration,filters):
        command=[args.ffmpeg,'-hide_banner','-loglevel','error','-ss',str(start),'-i',str(path),'-t',str(duration),'-vn','-af',filters,'-ar','8000','-ac','1','-f','f32le','pipe:1']
        return np.frombuffer(subprocess.run(command,capture_output=True,check=True).stdout,dtype='<f4').astype(np.float64)
    def correlate(a,b):
        count=min(len(a),len(b))
        a,b=a[:count].copy(),b[:count].copy()
        a-=a.mean();b-=b.mean()
        scale=np.sqrt(np.dot(a,a)*np.dot(b,b))
        length=1 << (2*count-1).bit_length()
        values=np.fft.irfft(np.fft.rfft(a,length)*np.conj(np.fft.rfft(b,length)),length)/scale
        limit=round(0.03*8000)
        candidates=np.r_[values[-limit:],values[:limit+1]]
        best=int(np.argmax(candidates))
        return {'correlation':float(candidates[best]),'lagMilliseconds':(best-limit)/8}
    speech_filter='highpass=f=150,lowpass=f=3000'
    actual=decode(args.video,2.1,2.6,speech_filter)
    new_voice=decode(args.narration,2.1,2.6,speech_filter)
    old_voice=decode(args.baseline_narration,2.1,2.6,speech_filter)
    voice_match=correlate(actual,new_voice)
    previous_match=correlate(actual,old_voice)
    signal_filter='highpass=f=700,lowpass=f=3000'
    effect=decode(args.effect,0,5,'lowpass=f=2200,'+signal_filter)
    previous_signal=correlate(decode(args.baseline_video,20,5,signal_filter),effect)
    revised_signal=correlate(decode(args.video,20,5,signal_filter),effect)
    inspection=json.loads(args.inspection.read_text(encoding='utf-8'))
    result={'newVoiceCorrelation':voice_match,'oldVoiceCorrelation':previous_match,'removedSignalCorrelationBefore':previous_signal,'removedSignalCorrelationAfter':revised_signal,'voiceSourceMeasurements':inspection['voices'],'methods':{'voice':'Compare actual encoded-film speech with the aligned professional source and previous source, allowing up to 30 ms filter/codec timing difference.','signal':'Match the known five-second signal cue against the actual old and revised encoded films in the affected frequency band.','listening':'No human listening review is represented by these measurements.'}}
    result['newVoicePresent']=voice_match['correlation']>0.35 and voice_match['correlation']>previous_match['correlation']+0.20
    result['signalRemoved']=previous_signal['correlation']>0.15 and revised_signal['correlation']<max(0.08,previous_signal['correlation']*0.3)
    (args.output_dir/'audio-revision-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False),flush=True)
    assert result['newVoicePresent'],'The final encoded audio does not sufficiently match the professional narration'
    assert result['signalRemoved'],'The known signal cue remains detectable or the comparison is inconclusive'


if __name__=='__main__':
    main()
