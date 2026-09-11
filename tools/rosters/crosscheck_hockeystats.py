#!/usr/bin/env python3
"""Cross-check the modern seasons (2007-08 onward) in a seasons.ts against
hockeystats.com, whose play-by-play data starts in 2007-08 (user asked for it as
a second source, 2026-09-11). Skaters only: GP / G / A / PTS per season.

Usage: crosscheck_hockeystats.py src/teams/redwings/seasons.ts
Prints one line per mismatch and a final count. Polite: one request per player,
half a second apart, results cached in ./hs_cache/.
"""
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

UA = 'warmup-test-roster-check/1.0 (chloeenglish@gmail.com)'
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hs_cache')


def fold(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))


def fetch(name):
    os.makedirs(CACHE, exist_ok=True)
    key = re.sub(r'[^A-Z]', '_', fold(name).upper())
    path = os.path.join(CACHE, key + '.json')
    if os.path.exists(path):
        return json.load(open(path))
    q = urllib.parse.urlencode({'player': fold(name).upper(), 'gameType': 'regular-season'})
    req = urllib.request.Request(f'https://hockeystats.com/api-n/individual-stats?{q}', headers={'User-Agent': UA, 'Accept': 'application/json'})
    try:
        data = json.load(urllib.request.urlopen(req, timeout=30))
    except Exception as e:  # noqa: BLE001
        data = {'error': str(e)}
    json.dump(data, open(path, 'w'))
    time.sleep(0.5)
    return data


def main(path):
    text = open(path, encoding='utf-8').read()
    checked = mismatches = missing = 0
    for m in re.finditer(r"\n  \{\n    id: '([^']+)',(.*?)\n    roster: \[\n(.*?)\n    \],", text, re.S):
        sid, body = m.group(1), m.group(3)
        start = int(sid[:4])
        if start < 2007:
            continue
        code = f'{str(start)[2:]}-{str(start + 1)[2:]}'
        for pm in re.finditer(r"name: (?:'([^']*)'|\"([^\"]*)\"), position: '(\w+)', gp: (\d+), g: (\d+), a: (\d+), pts: (\d+)", body):
            name, pos = pm.group(1) or pm.group(2), pm.group(3)
            if pos == 'G':
                continue
            gp, g, a, pts = (int(pm.group(i)) for i in (4, 5, 6, 7))
            data = fetch(name)
            rows = [r for r in data.get('stats', []) if r.get('Season') == code and r.get('game_strength') == 'AS' and r.get('Team') == 'DET']
            if not rows:
                missing += 1
                print(f'  ? {sid} {name}: no hockeystats row')
                continue
            r = rows[0]
            checked += 1
            if (r['GP'], r['G'], r['A'], r['P']) != (gp, g, a, pts):
                mismatches += 1
                print(f"  X {sid} {name}: file {gp}/{g}/{a}/{pts} vs hockeystats {r['GP']}/{r['G']}/{r['A']}/{r['P']}")
    print(f'checked {checked}, mismatches {mismatches}, no row {missing}')


if __name__ == '__main__':
    main(sys.argv[1])
