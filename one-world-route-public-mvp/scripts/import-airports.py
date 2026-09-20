"""Import only corridor airport codes from an OurAirports CSV downloaded by the maintainer.
Usage: python scripts/import-airports.py /path/to/airports.csv
This updates geometry evidence, not flight availability or bookings.
"""
import csv
import datetime
import hashlib
import json
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parent.parent / 'data'
route = json.loads((root / 'public-route.json').read_text())
codes = set(re.findall(r'\b[A-Z]{3}\b', ' '.join(s['corridor'] for s in route['segments'])))
source = Path(sys.argv[1])
airports = {}
with source.open(encoding='utf-8-sig', newline='') as handle:
    for row in csv.DictReader(handle):
        code = row['iata_code']
        if code in codes and row['type'] not in ('closed', 'heliport', 'seaplane_base'):
            if code in airports:
                raise ValueError(f'Duplicate airport code: {code}. Resolve before importing.')
            airports[code] = {'name': row['name'], 'coordinates': [float(row['longitude_deg']), float(row['latitude_deg'])], 'countryCode': row['iso_country'], 'ident': row['ident']}
output = {'source': 'https://ourairports.com/data/', 'downloadUrl': 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv', 'license': 'Public Domain', 'retrievedAt': datetime.datetime.now(datetime.timezone.utc).date().isoformat(), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'airports': dict(sorted(airports.items()))}
(root / 'airports.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Imported {len(airports)} referenced airports')
