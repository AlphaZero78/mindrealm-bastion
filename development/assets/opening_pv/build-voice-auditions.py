"""Make matched 15-second listening examples from requested professional recordings."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess
import urllib.request

import av
import numpy as np
import soundfile as sf


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--manifest',type=Path,required=True)
    parser.add_argument('--ffmpeg',required=True)
    parser.add_argument('--output-dir',type=Path,required=True)
    args=parser.parse_args()
    plan=json.loads(args.manifest.read_text(encoding='utf-8'))
    workspace=args.manifest.parent
    args.output_dir.mkdir(parents=True,exist_ok=True)
    def fetch(voice):
        response=voice['response']
        local=workspace/f"{voice['id']}-provider-{response['request_id']}.audio"
        if not local.exists():
            req=urllib.request.Request(response['audio_url'],headers={'User-Agent':'Mindrealm-Voice-Auditions/1.0'})
            with urllib.request.urlopen(req,timeout=90) as remote, local.with_suffix('.partial').open('wb') as target:
                while block:=remote.read(1024*1024):target.write(block)
            local.with_suffix('.partial').replace(local)
        return local
    with ThreadPoolExecutor(max_workers=3) as pool:
        paths=list(pool.map(fetch,plan['voices']))
    records=[]
    for voice,path in zip(plan['voices'],paths):
        response=voice['response']
        tokens=[t for t in response['word_timestamps'] if not t['word'].startswith('<') and t['word'].strip()]
        assert ''.join(t['word'] for t in tokens)==plan['script']
        words=[t for t in tokens if re.search(r'[\u4e00-\u9fffA-Za-z0-9]',t['word'])]
        decoded_source=subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','error','-i',str(path),'-ar','44100','-ac','1','-f','f32le','pipe:1'],capture_output=True,check=True)
        samples=np.frombuffer(decoded_source.stdout,dtype='<f4').copy()
        audible=np.flatnonzero(np.abs(samples)>0.0006)
        first=max(0,int(audible[0])-round(0.08*44100))
        last=min(len(samples),int(audible[-1])+round(0.12*44100))
        source_in,source_out=first/44100,last/44100
        tempo=(last-first)/(14.6*44100)
        assert 0.7<=tempo<=1.3
        name=voice['name'].split(' - ')[0].replace(' ','_')
        output=args.output_dir/f"{voice['id']}_{name}_15秒.wav"
        trimmed=workspace/f"{voice['id']}-trimmed.wav"
        sf.write(trimmed,samples[first:last],44100,subtype='FLOAT')
        filters=f"rubberband=tempo={tempo:.10f}:pitch=1:transients=mixed:detector=soft:phase=laminar:window=long:formant=preserved:pitchq=quality"
        stretched=subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','error','-i',str(trimmed),'-af',filters,'-ar','44100','-ac','1','-f','f32le','pipe:1'],capture_output=True,check=True)
        inner=np.frombuffer(stretched.stdout,dtype='<f4').copy()
        assert abs(len(inner)/44100-14.6)<0.06
        desired=round(14.6*44100)
        if len(inner)>desired:
            assert float(np.max(np.abs(inner[desired:])))<0.005
        inner=np.pad(inner[:desired],(0,max(0,desired-len(inner))))
        aligned=np.zeros(15*44100,dtype=np.float32)
        begin=round(0.15*44100)
        aligned[begin:begin+len(inner)]=inner
        timed=workspace/f"{voice['id']}-timed.wav"
        sf.write(timed,aligned,44100,subtype='FLOAT')
        rendered=subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','info','-i',str(timed),'-af','loudnorm=I=-18:TP=-2:LRA=8:print_format=json','-ar','44100','-ac','1','-f','f32le','pipe:1'],capture_output=True,check=True)
        log=rendered.stderr.decode('utf-8',errors='replace')
        match=re.search(r'\{\s*"input_i".*?\}',log,re.S)
        loudness=json.loads(match.group(0)) if match else None
        normalized=np.frombuffer(rendered.stdout,dtype='<f4').copy()
        assert abs(len(normalized)-15*44100)<=2
        normalized=np.pad(normalized[:15*44100],(0,max(0,15*44100-len(normalized))))
        gain=10**((-18-float(loudness['output_i']))/20) if loudness else 1
        gain=min(gain,0.95/float(np.max(np.abs(normalized))))
        normalized*=gain
        sf.write(output,normalized,44100,subtype='PCM_24')
        decoded,rate=sf.read(output,dtype='float32')
        assert rate==44100 and len(decoded)==15*rate
        assert 0<float(np.max(np.abs(decoded)))<1
        assert float(np.sqrt(np.mean(decoded*decoded)))>0.01
        speech=np.flatnonzero(np.abs(decoded)>0.01)
        assert speech[-1]/rate>14.0, 'Speech is too short for the requested 15-second read'
        with av.open(str(path)) as container:
            native={'container':container.format.name,'sampleRate':container.streams.audio[0].codec_context.sample_rate}
        row={'id':voice['id'],'voiceName':voice['name'],'voiceId':voice['voiceId'],'engine':response['engine'],'requestId':response['request_id'],'source':str(path),'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'native':native,'providerDuration':response['duration'],'sourceIn':source_in,'sourceOut':source_out,'localTempoForMatchedDuration':tempo,'pitchRatio':1,'duration':15.0,'sampleRate':rate,'output':str(output),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'peak':float(np.max(np.abs(decoded))),'speechRange':[float(speech[0]/rate),float(speech[-1]/rate)],'loudness':loudness,'postLoudnessGain':gain,'matchedLufs':float(loudness['output_i'])+20*np.log10(gain),'textVerifiedAgainstProviderTiming':True}
        records.append(row)
        print(json.dumps({'id':row['id'],'voice':row['voiceName'],'duration':15,'output':str(output),'speechRange':row['speechRange'],'outputLufs':row['matchedLufs']},ensure_ascii=False),flush=True)
    result={'script':plan['script'],'durationEach':15,'equalVolumeTargetLufs':-18,'pitchTreatment':'Natural voice pitch preserved','voices':records,'selectedVoice':None,'status':'ready_for_user_selection'}
    (args.output_dir/'试听说明.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (args.output_dir/'共同试听文案.txt').write_text(plan['script']+'\n',encoding='utf-8')
    (workspace/'audition-manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':
    main()
