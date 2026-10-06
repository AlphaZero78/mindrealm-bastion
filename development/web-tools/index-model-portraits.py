"""Inspect rendered alpha bounds and install approved original portrait sheets."""
import argparse
import json
from pathlib import Path
import shutil
from PIL import Image

root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source')
args=parser.parse_args()
source=Path(args.source).resolve()
models=json.loads((root/'game/assets/game/models/models.json').read_text(encoding='utf-8'))['entities']
output=root/'game/assets/game/portraits';output.mkdir(parents=True,exist_ok=True)
portraits={}
for id,model in models.items():
    path=source/(id+'.png')
    with Image.open(path) as image:
        variants=list(model['variants'])
        if image.size != (256,256*len(variants)):
            raise ValueError('Unexpected portrait dimensions: '+id)
        bounds=[image.getchannel('A').crop((0,row*256,256,(row+1)*256)).getbbox() for row in range(len(variants))]
        if not all(bounds):
            raise ValueError('Empty portrait variant: '+id)
        left=max(0,min(b[0] for b in bounds)-6);top=max(0,min(b[1] for b in bounds)-6)
        right=min(256,max(b[2] for b in bounds)+6);bottom=min(256,max(b[3] for b in bounds)+6)
        portraits[id]={'cell':256,'rows':len(variants),'bounds':{'x':left,'y':top,'width':right-left,'height':bottom-top},'path':f'/assets/game/portraits/{id}.png'}
    shutil.copy2(path,output/path.name)
(root/'game/web/view/model-portraits.js').write_text('// Generated from inspected 256 px PBR portraits.\nexport const MODEL_PORTRAITS='+json.dumps(portraits,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print('MODEL_PORTRAITS_OK '+str(len(portraits)))
