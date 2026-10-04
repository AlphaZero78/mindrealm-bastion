"""Measure alpha bounds for stable model display, without changing any PNG.

python development/web-tools/measure-entity-bounds.py --output <external.json>
Add --write-metadata to refresh only the generated bounds block in entity-art.js.
Use --source <baked sprite directory> to inspect a new external bake first.
Requires Pillow. Alpha > 0 includes every antialiased edge pixel. Coordinates
are local to one 80x80 cell, never atlas-row coordinates. Model bounds combine
all directions/poses/variants; icon bounds combine direction 0 of every static
variant and add a clipped two-pixel margin. minVisibleSpan is the smallest
maximum alpha-bounding-box side across all animation frames. Using one scale
per type based on this value guarantees a minimum visible size without
camera-turn, pose and upgrade animation scale jitter.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
CELL=80
START='// BEGIN GENERATED ENTITY BOUNDS'
END='// END GENERATED ENTITY BOUNDS'


def union(rects,padding=0):
    if not rects:
        raise ValueError('Atlas contains no visible alpha pixels')
    x=max(0,min(r[0] for r in rects)-padding)
    y=max(0,min(r[1] for r in rects)-padding)
    right=min(CELL,max(r[2] for r in rects)+padding)
    bottom=min(CELL,max(r[3] for r in rects)+padding)
    return dict(x=x,y=y,width=right-x,height=bottom-y)


def cells(image,directions):
    for y in range(0,image.height,CELL):
        for direction in directions:
            x=direction*CELL
            yield image.crop((x,y,x+CELL,y+CELL)).getchannel('A')


def measure(source):
    records={}
    for kind in ['towers','enemies']:
        for static_path in sorted((source/kind).glob('*.png')):
            animation_path=source/'animations'/kind/static_path.name
            static=Image.open(static_path).convert('RGBA')
            animation=Image.open(animation_path).convert('RGBA')
            if static.width!=CELL*8 or static.height%CELL or animation.size!=(CELL*8,static.height*10):
                raise ValueError(f'Unexpected atlas dimensions: {static_path}')
            frame_alpha=list(cells(animation,range(8)))
            icon_alpha=list(cells(static,[0]))
            bounds=[cell.getbbox() for cell in frame_alpha]
            icon_bounds=[cell.getbbox() for cell in icon_alpha]
            if any(b is None for b in bounds+icon_bounds):
                raise ValueError(f'Empty model frame: {static_path.name}')
            records[static_path.stem]=dict(
                bounds=union(bounds),iconBounds=union(icon_bounds,2),
                minVisibleSpan=min(max(b[2]-b[0],b[3]-b[1]) for b in bounds),
                variants=static.height//CELL,frames=len(frame_alpha),
                staticSha256=hashlib.sha256(static_path.read_bytes()).hexdigest(),
                animationSha256=hashlib.sha256(animation_path.read_bytes()).hexdigest())
    if not records:
        raise ValueError('No entity atlases were found')
    return records


def refresh_metadata(records):
    path=ROOT/'web/view/entity-art.js'
    text=path.read_text(encoding='utf-8')
    bounds={id:dict(bounds=r['bounds'],iconBounds=r['iconBounds'],minVisibleSpan=r['minVisibleSpan']) for id,r in records.items()}
    block=START+'\nconst ART_BOUNDS='+json.dumps(bounds,ensure_ascii=False,indent=2)+';\n'+END
    if START in text:
        a=text.index(START);b=text.index(END,a)+len(END)
        text=text[:a]+block+text[b:]
    else:
        anchor='export const ENTITY_ART='
        if anchor not in text:
            raise ValueError('Cannot find the shared entity-art export')
        text=text.replace(anchor,block+'\n'+anchor,1)
    if 'bounds:Object.freeze(ART_BOUNDS[id].bounds)' not in text:
        text=text.replace('role,locomotion,kind,staticPath:',
            'role,locomotion,kind,bounds:Object.freeze(ART_BOUNDS[id].bounds),iconBounds:Object.freeze(ART_BOUNDS[id].iconBounds),staticPath:',1)
    if 'minVisibleSpan:ART_BOUNDS[id].minVisibleSpan' not in text:
        text=text.replace('bounds:Object.freeze(ART_BOUNDS[id].bounds)',
            'minVisibleSpan:ART_BOUNDS[id].minVisibleSpan,bounds:Object.freeze(ART_BOUNDS[id].bounds)',1)
    path.write_text(text,encoding='utf-8',newline='\n')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',default=str(ROOT/'assets/game/sprites'))
    parser.add_argument('--output',required=True)
    parser.add_argument('--write-metadata',action='store_true')
    args=parser.parse_args()
    output=Path(args.output).resolve()
    if output==ROOT or ROOT in output.parents:
        parser.error('Reports belong outside the repository; --write-metadata updates the intended source file separately.')
    records=measure(Path(args.source).resolve())
    if args.write_metadata:
        refresh_metadata(records)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(dict(alphaThreshold=1,cell=CELL,iconPadding=2,entities=records),indent=2),encoding='utf-8')
    print(json.dumps(dict(ok=True,entities=len(records),frames=sum(r['frames'] for r in records.values()),metadataWritten=args.write_metadata)))


if __name__=='__main__':main()
