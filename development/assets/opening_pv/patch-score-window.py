"""Replace the reported signal effect with its clean music bed, preserving other times."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np
import soundfile as sf


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--original',type=Path,required=True)
    parser.add_argument('--clean',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--ffmpeg',required=True)
    args=parser.parse_args()
    rate=48000
    raw=subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','error','-i',str(args.original),'-ar',str(rate),'-ac','2','-f','f32le','pipe:1'],capture_output=True,check=True).stdout
    original=np.frombuffer(raw,dtype='<f4').reshape(-1,2).copy()
    clean,actual_rate=sf.read(args.clean,dtype='float32',always_2d=True)
    assert actual_rate==rate and clean.shape==original.shape
    gains=[]
    correlations=[]
    for begin,end in [(17.5,18.5),(26,27)]:
        a=original[round(begin*rate):round(end*rate)].astype(np.float64).ravel()
        b=clean[round(begin*rate):round(end*rate)].astype(np.float64).ravel()
        gains.append(float(np.dot(a,b)/np.dot(b,b)))
        correlations.append(float(np.dot(a,b)/np.sqrt(np.dot(a,a)*np.dot(b,b))))
    assert min(correlations)>0.95, 'The clean and original music beds are not aligned'
    assert all(0.25<gain<4 for gain in gains)
    times=np.arange(len(original),dtype=np.float64)/rate
    blend=np.zeros(len(original),dtype=np.float32)
    inside=(times>=19)&(times<=25)
    blend[inside]=1
    for begin,end,reverse in [(18.75,19,False),(25,25.25,True)]:
        mask=(times>=begin)&(times<end)
        t=(times[mask]-begin)/(end-begin)
        smooth=t*t*(3-2*t)
        blend[mask]=1-smooth if reverse else smooth
    matching_gain=np.interp(times,[18.75,25.25],gains).astype(np.float32)
    mixed=original*(1-blend[:,None])+clean*matching_gain[:,None]*blend[:,None]
    outside=(times<18.75)|(times>=25.25)
    assert np.array_equal(mixed[outside],original[outside])
    assert np.max(np.abs(mixed))<1
    args.output.parent.mkdir(parents=True,exist_ok=True)
    sf.write(args.output,mixed,rate,subtype='PCM_24')
    def band_power(samples):
        samples=samples.mean(axis=1)
        frames=np.lib.stride_tricks.sliding_window_view(samples,4096)[::2048]
        power=np.abs(np.fft.rfft(frames*np.hanning(4096),axis=1))**2
        frequencies=np.fft.rfftfreq(4096,1/rate)
        return float(power[:,(frequencies>=700)&(frequencies<=3000)].sum())
    old_power=band_power(original[19*rate:25*rate])
    new_power=band_power(mixed[19*rate:25*rate])
    result={'method':'Rebuild the score without computerNoise_001.ogg, match the surrounding music gain, then replace only the affected window with short smooth crossfades.','removedEffect':'computerNoise_001.ogg','effectOriginalStart':20,'effectOriginalEnd':25,'fullyCleanWindow':[19,25],'transitionWindows':[[18.75,19],[25,25.25]],'boundaryCorrelations':correlations,'boundaryGainMatch':gains,'outsideWindowUnchangedBeforePcmQuantization':True,'band700to3000HzReductionDb':float(10*np.log10(old_power/new_power)),'output':str(args.output),'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest()}
    args.output.with_suffix('.provenance.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False),flush=True)


if __name__=='__main__':
    main()
