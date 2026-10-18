"""Validate baked atlas cells and write a labeled contact sheet outside the repo.

Requires Pillow. Use --source <bake output> --output <external QA directory>.
Checks dimensions, transparent gutters, directional/pose cells, tier/phase
changes and cross-entity silhouette reuse. The sheet displays original pixels
at 2x nearest-neighbor scale and does not alter the delivered runtime atlases.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops

ROOT=Path(__file__).resolve().parents[2]
CELL=80


def digest(im):
    return hashlib.sha256(im.tobytes()).hexdigest()


def pixels(image):
    return image.get_flattened_data() if hasattr(image, 'get_flattened_data') else image.getdata()


def changed_pixels(a,b):
    difference=ImageChops.difference(a,b)
    return sum(max(p)>=24 and max(x[3],y[3])>=80 for p,x,y in zip(pixels(difference),pixels(a),pixels(b)))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--ids',help='Recheck only the named entities after a focused fix')
    args=parser.parse_args()
    source=Path(args.source).resolve()
    output=Path(args.output).resolve()
    if output==ROOT or ROOT in output.parents:
        parser.error('QA images and reports belong outside the repository.')
    output.mkdir(parents=True,exist_ok=True)
    report=json.loads((source/'bake-report.json').read_text(encoding='utf-8'))
    if args.ids:
        selected=set(args.ids.split(','));report['entities']=[r for r in report['entities'] if r['id'] in selected]
        if {r['id'] for r in report['entities']}!=selected:raise ValueError('Unknown selected entity')
    failures=[]
    records=[]
    rows=[]
    silhouettes={}
    for record in report['entities']:
        id=record['id'];variants=record['variants']
        static=Image.open(record['paths']['static']).convert('RGBA')
        anim=Image.open(record['paths']['animation']).convert('RGBA')
        death=Image.open(record['paths']['death']).convert('RGBA') if record['paths'].get('death') else None
        if static.size!=(640,len(variants)*80) or anim.size!=(640,len(variants)*800):
            failures.append(dict(id=id,reason='dimensions',static=static.size,animation=anim.size))
        if death and death.size!=(640,len(variants)*record['deathRows']*80):
            failures.append(dict(id=id,reason='death dimensions',death=death.size))
        bounds=[]
        for row in range(len(variants)*10):
            for direction in range(8):
                cell=anim.crop((direction*80,row*80,(direction+1)*80,(row+1)*80))
                alpha=cell.getchannel('A').point(lambda x:255 if x>=16 else 0)
                bbox=alpha.getbbox()
                if not bbox:
                    failures.append(dict(id=id,row=row,direction=direction,reason='empty'))
                elif min(bbox[0],bbox[1],80-bbox[2],80-bbox[3])<2:
                    failures.append(dict(id=id,row=row,direction=direction,reason='edge',bbox=bbox))
                if bbox:bounds.append(bbox)
        if death:
            for vi,variant in enumerate(variants):
                death_poses=[]
                for pose in range(record['deathRows']):
                    row=vi*record['deathRows']+pose
                    for direction in range(8):
                        tile=death.crop((direction*80,row*80,(direction+1)*80,(row+1)*80))
                        bbox=tile.getchannel('A').point(lambda x:255 if x>=16 else 0).getbbox()
                        if not bbox or min(bbox[0],bbox[1],80-bbox[2],80-bbox[3])<2:
                            failures.append(dict(id=id,reason='death empty or clipped',row=row,direction=direction,bbox=bbox))
                    death_poses.append(digest(death.crop((80,row*80,160,(row+1)*80))))
                if len(set(death_poses))<2:
                    failures.append(dict(id=id,variant=variant,reason='death mechanism unchanged'))
        neutral=static.crop((80,0,160,80))
        shape=digest(neutral.getchannel('A'))
        if shape in silhouettes:
            failures.append(dict(id=id,reason='duplicate silhouette',other=silhouettes[shape]))
        silhouettes[shape]=id
        variants_seen=[]
        poses=[]
        for vi,variant in enumerate(variants):
            variants_seen.append(digest(static.crop((0,vi*80,640,(vi+1)*80))))
            for pose in range(10):
                tile=anim.crop((80,(vi*10+pose)*80,160,(vi*10+pose+1)*80))
                poses.append(digest(tile))
            if digest(static.crop((0,vi*80,640,(vi+1)*80)))!=digest(anim.crop((0,vi*800,640,vi*800+80))):
                failures.append(dict(id=id,variant=variant,reason='static animation RGBA alignment'))
        if len(set(variants_seen))!=len(variants):
            failures.append(dict(id=id,reason='duplicate variant'))
        if record.get('role')!='support' and len(set(poses[5:8]))<2:
            failures.append(dict(id=id,reason='attack poses unchanged'))
        if (record.get('kind')!='towers' or record.get('role')=='support') and len(set(poses[8:10]))<2:
            failures.append(dict(id=id,reason='cast poses unchanged'))
        pose_tiles=[anim.crop((80,p*80,160,(p+1)*80)) for p in range(10)]
        motion=[changed_pixels(pose_tiles[p],pose_tiles[1+(p%4)]) for p in range(1,5)]
        attack=changed_pixels(pose_tiles[5],pose_tiles[6])
        flight_changed=[];rolling_changed=[]
        if record.get('locomotion')=='hover':
            # A steady jet/duct command holds a stable airframe. Its time cells
            # may match; require a real rendered slow/fast control response
            # instead of prescribing a cyclic bob to satisfy a pixel count.
            response_path=record['paths'].get('flightResponse')
            if not response_path or not record.get('flightSource') or record.get('flightSpeeds') not in [[.15,1.5],[0,1.5]]:
                failures.append(dict(id=id,reason='missing actual flight-control response'))
            else:
                response=Image.open(response_path).convert('RGBA')
                cell=record.get('flightCell',80)
                if cell not in [80,512] or response.size!=(cell*2,len(variants)*cell):
                    failures.append(dict(id=id,reason='flight response dimensions',dimensions=response.size))
                else:
                    if cell>80 and not any(abs(value)>.02 for values in record.get('flightControlDeltas',{}).values() for value in values):
                        failures.append(dict(id=id,reason='missing measured flight actuator change'))
                    for vi,variant in enumerate(variants):
                        slow=response.crop((0,vi*cell,cell,(vi+1)*cell));fast=response.crop((cell,vi*cell,cell*2,(vi+1)*cell))
                        change=changed_pixels(slow,fast);flight_changed.append(change)
                        if change<round(12*cell/80):failures.append(dict(id=id,variant=variant,reason='flight controls unchanged',changedPixels=change))
                        for label,tile in [('slow',slow),('fast',fast)]:
                            bbox=tile.getchannel('A').point(lambda x:255 if x>=16 else 0).getbbox()
                            if not bbox or min(bbox[0],bbox[1],cell-bbox[2],cell-bbox[3])<2:failures.append(dict(id=id,variant=variant,reason='flight response empty or clipped',command=label,bbox=bbox))
        elif record.get('rollingWheels',0)>0:
            # A smooth circular tyre has an almost invariant 80 px silhouette.
            # Inspect its real rim/hub response at modelling scale; the rig
            # suite independently checks actual GLB contact and travel.
            path=record['paths'].get('rollingResponse');cell=record.get('rollingCell',0)
            travel=record.get('rollingTravel',[])
            if not path or not record.get('rollingSource') or cell<256 or len(travel)!=2 or travel[0]!=0 or travel[1]<=0:
                failures.append(dict(id=id,reason='missing actual wheel response'))
            else:
                response=Image.open(path).convert('RGBA')
                if response.size!=(cell*2,len(variants)*cell):
                    failures.append(dict(id=id,reason='wheel response dimensions'))
                else:
                    for vi,variant in enumerate(variants):
                        a=response.crop((0,vi*cell,cell,(vi+1)*cell));b=response.crop((cell,vi*cell,cell*2,(vi+1)*cell))
                        change=changed_pixels(a,b);rolling_changed.append(change)
                        if change<12:failures.append(dict(id=id,variant=variant,reason='wheel response unchanged',changedPixels=change))
        elif record.get('locomotion')!='anchored' and min(motion)<12:
            failures.append(dict(id=id,reason='movement too small',changedPixels=motion))
        if record.get('role')!='support' and attack<12:
            failures.append(dict(id=id,reason='attack too small',changedPixels=attack))
        records.append(dict(id=id,variants=len(variants),cells=len(variants)*80,uniquePoses=len(set(poses)),moveChangedPixels=motion,flightControlChangedPixels=flight_changed,wheelControlChangedPixels=rolling_changed,attackChangedPixels=attack,minimumGutter=min(min(b[0],b[1],80-b[2],80-b[3]) for b in bounds)))
        selected=[('T1 / phase1',static.crop((80,0,160,80))),('second',static.crop((80,min(1,len(variants)-1)*80,160,(min(1,len(variants)-1)+1)*80))),
                  ('last',static.crop((80,(len(variants)-1)*80,160,len(variants)*80))),('move 2',anim.crop((80,160,160,240))),
                  ('windup',anim.crop((80,400,160,480))),('contact',anim.crop((80,480,160,560))),('cast',anim.crop((80,720,160,800)))]
        rows.append((id,selected))
    for index in range(0,len(rows),10):
        subset=rows[index:index+10]
        sheet=Image.new('RGB',(7*170+200,len(subset)*190+30),'#122c31')
        draw=ImageDraw.Draw(sheet)
        for row,(id,cells) in enumerate(subset):
            draw.text((10,row*190+80),id,fill='#eae5d5')
            for col,(label,tile) in enumerate(cells):
                x=200+col*170;y=row*190+25
                draw.text((x,y-17),label,fill='#a5cabe')
                tile=tile.resize((160,160),Image.Resampling.NEAREST)
                sheet.paste(tile,(x,y),tile)
        sheet.save(output/f'entity-art-contact-{index//10+1}.png')
    featured=['armored_worm','remote_hunter','bandwidth_jammer','memory_mechanic','drone_loom','noise_hive']
    featured=[r for id in featured for r in report['entities'] if r['id']==id]
    if featured:
        frames=[]
        for pose in [1,2,3,4,5,6,7,9]:
            frame=Image.new('RGB',(840,((len(featured)+2)//3)*280),'#122c31')
            draw=ImageDraw.Draw(frame)
            for i,record in enumerate(featured):
                atlas=Image.open(record['paths']['animation']).convert('RGBA')
                tile=atlas.crop((80,pose*80,160,(pose+1)*80)).resize((240,240),Image.Resampling.NEAREST)
                x=(i%3)*280+20;y=(i//3)*280+30
                draw.text((x,y-19),record['id'],fill='#eae5d5')
                frame.paste(tile,(x,y),tile)
            frames.append(frame)
        frames[0].save(output/'entity-art-motion.gif',save_all=True,append_images=frames[1:],duration=[170,170,170,170,140,110,170,230],loop=0,disposal=2)
    summary=dict(ok=not failures,entities=len(records),cells=sum(r['cells'] for r in records),records=records,failures=failures)
    (output/'inspection.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary,indent=2))
    raise SystemExit(0 if not failures else 1)


if __name__=='__main__':main()
