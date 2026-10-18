"""Decode local runtime-rendered enemy artwork into an external staging folder.

Input is the JSON exported by enemyReview.bake through export-enemy-review.ps1.
The renderer supplies original RGBA pixels; no screenshots or remote transfers.
"""
import argparse
import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if output == ROOT or ROOT in output.parents:
        parser.error('Stage original art outside the repository before inspection.')
    source = json.loads(Path(args.input).read_text(encoding='utf-8'))
    records = []
    for record in source:
        paths = {}
        kind=record.get('kind','enemies')
        if kind not in ['enemies','towers']:
            raise ValueError('Unknown entity kind: '+kind)
        fields=[('rollingResponse','rolling/enemies')] if 'rollingResponse' in record else [('flightResponse','responses/enemies')] if 'flightResponse' in record else [('animation', 'animations/'+kind), ('static', kind), *([('death','death/'+kind)] if 'death' in record else []), ('portrait', 'portraits')]
        for field, folder in fields:
            prefix, data = record[field].split(',', 1)
            if prefix != 'data:image/png;base64':
                raise ValueError('Expected original PNG render: ' + record['id'])
            path = output / folder / (record['id'] + '.png')
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(base64.b64decode(data, validate=True))
            paths[field] = str(path)
        records.append({**{key: value for key, value in record.items() if key not in ['animation', 'static', 'death', 'portrait', 'flightResponse', 'rollingResponse']}, 'paths': paths})
    report_path = output / 'bake-report.json'
    prior = json.loads(report_path.read_text(encoding='utf-8'))['entities'] if report_path.exists() else []
    updated = {record['id']: record for record in prior}
    for record in records:
        previous=updated.get(record['id'],{})
        updated[record['id']]={**previous,**record,'paths':{**previous.get('paths',{}),**record['paths']}}
    report_path.write_text(json.dumps({'source': 'actual game EntityRenderer', 'entities': list(updated.values())}, ensure_ascii=False, indent=2), encoding='utf-8')
    print('ENTITY_ART_STAGED ' + str(len(records)))

if __name__ == '__main__':
    main()
