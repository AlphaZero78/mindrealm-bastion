"""Reuse the same professionally recorded word to make its final occurrence consistent."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np
import soundfile as sf


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--audio',type=Path,required=True)
    parser.add_argument('--response',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--ffmpeg',required=True)
    args=parser.parse_args()
    response=json.loads(args.response.read_text(encoding='utf-8'))
    tokens=[token for token in response['word_timestamps'] if token['word']=='簇']
    assert len(tokens)==2
    # The provider URL ends in .wav, while this response contains gapless MP3.
    # Use the same decoder as the alignment stage so encoder delay is removed.
    rate=44100
    decoded=subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','error','-i',str(args.audio),'-ar',str(rate),'-ac','1','-f','f32le','pipe:1'],capture_output=True,check=True)
    audio=np.frombuffer(decoded.stdout,dtype='<f4').copy().reshape(-1,1)
    assert abs(len(audio)/rate-response['duration'])<0.03
    source_start,source_end=[round(tokens[0][key]*rate) for key in ('start','end')]
    target_start,target_end=[round(tokens[1][key]*rate) for key in ('start','end')]
    donor=audio[source_start:source_end].copy()
    original=audio[target_start:target_end].copy()
    assert abs(len(donor)-len(original))<=2
    if len(donor)!=len(original):
        donor=np.column_stack([np.interp(np.linspace(0,len(donor)-1,len(original)),np.arange(len(donor)),donor[:,channel]) for channel in range(donor.shape[1])]).astype(np.float32)
    gain=float(np.clip(np.sqrt(np.mean(original**2)/np.mean(donor**2)),0.75,1.333))
    gain=min(gain,0.98/float(np.max(np.abs(donor))))
    donor*=gain
    fade=round(0.012*rate)
    blend=np.ones(len(original),dtype=np.float32)
    blend[:fade]=np.linspace(0,1,fade)
    blend[-fade:]=np.linspace(1,0,fade)
    replacement=original*(1-blend[:,None])+donor*blend[:,None]
    result=audio.copy()
    result[target_start:target_end]=replacement
    assert np.max(np.abs(result))<=max(1.0,float(np.max(np.abs(audio))))+1e-6
    # Preserve harmless MP3 decoder overshoot in float PCM; the alignment stage
    # applies the final shared peak gain before writing delivery PCM.
    sf.write(args.output,result,rate,subtype='FLOAT')
    receipt={'method':'Reuse the earlier occurrence of the same word from the same professional recording; match its level and crossfade the edges.','word':'簇','sourceSeconds':[tokens[0]['start'],tokens[0]['end']],'targetSeconds':[tokens[1]['start'],tokens[1]['end']],'sourceSamples':[source_start,source_end],'targetSamples':[target_start,target_end],'crossfadeSeconds':0.012,'gain':gain,'decodedSampleRate':rate,'durationChanged':False,'providerRecordingUnmodified':str(args.audio),'output':str(args.output),'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest()}
    args.output.with_suffix('.edit.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(receipt,ensure_ascii=False),flush=True)


if __name__=='__main__':
    main()
