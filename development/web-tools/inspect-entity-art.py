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
    args=parser.parse_args()
    source=Path(args.source).resolve()
    output=Path(args.output).resolve()
    if output==ROOT or ROOT in output.parents:
        parser.error('QA images and reports belong outside the repository.')
    output.mkdir(parents=True,exist_ok=True)
    report=json.loads((source/'bake-report.json').read_text(encoding='utf-8'))
    failures=[]
    records=[]
    rows=[]
    silhouettes={}
    for record in report['entities']:
        id=record['id'];variants=record['variants']
        static=Image.open(record['paths']['static']).convert('RGBA')
        anim=Image.open(record['paths']['animation']).convert('RGBA')
        if static.size!=(640,len(variants)*80) or anim.size!=(640,len(variants)*800):
            failures.append(dict(id=id,reason='dimensions',static=static.size,animation=anim.size))
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
        if len(set(poses[8:10]))<2:
            failures.append(dict(id=id,reason='cast poses unchanged'))
        pose_tiles=[anim.crop((80,p*80,160,(p+1)*80)) for p in range(10)]
        motion=[changed_pixels(pose_tiles[p],pose_tiles[1+(p%4)]) for p in range(1,5)]
        attack=changed_pixels(pose_tiles[5],pose_tiles[6])
        if record.get('locomotion')!='anchored' and min(motion)<12:
            failures.append(dict(id=id,reason='movement too small',changedPixels=motion))
        if record.get('role')!='support' and attack<12:
            failures.append(dict(id=id,reason='attack too small',changedPixels=attack))
        records.append(dict(id=id,variants=len(variants),cells=len(variants)*80,uniquePoses=len(set(poses)),moveChangedPixels=motion,attackChangedPixels=attack,minimumGutter=min(min(b[0],b[1],80-b[2],80-b[3]) for b in bounds)))
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
