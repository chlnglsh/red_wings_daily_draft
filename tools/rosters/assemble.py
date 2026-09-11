#!/usr/bin/env python3
"""Rebuild the roster blocks in src/teams/redwings/seasons.ts from hockey-reference
data, cross-checked against Wikipedia, and print a per-season diff of the change.

Usage (from the repo root):
  assemble.py --hr <dir of <endYear>.json from parse_hr.py>
              --wiki <dir of <startYear>.json from parse_wiki.py>
              --overrides tools/rosters/position_overrides.json
              --seasons src/teams/redwings/seasons.ts
              [--write]        # rewrite the file in place (default: diff only)

Everything about a season EXCEPT its roster (label, points, era, blurb, league
scoring rate) is kept exactly as it is in the file. Player ids are kept for players
who stay; new players get an id in the same style (<startYear>-<surname>, with a
first-name suffix when that surname already exists in the season).
"""
import argparse
import json
import re
import sys
import unicodedata

sys.path.insert(0, __import__('os').path.dirname(__file__))
from select import select  # noqa: E402


def fold(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c)).lower()


def slug(s):
    return re.sub(r'[^a-z]', '', fold(s))


NAME_FIXES = {}  # filled from overrides["names"]: hockey-reference spelling -> preferred display


def load_seasons_ts(path):
    text = open(path, encoding='utf-8').read()
    blocks = []
    for m in re.finditer(r"\n  \{\n    id: '([^']+)',(.*?)\n    roster: \[\n(.*?)\n    \],\n  \},", text, re.S):
        sid, head, body = m.group(1), m.group(2), m.group(3)
        players = []
        for pm in re.finditer(r"\{ id: '([^']+)', name: (?:'([^']*)'|\"([^\"]*)\"), position: '(\w+)', gp: (\d+), g: (\d+), a: (\d+), pts: (\d+)(.*?) \}", body):
            extra = pm.group(9)
            players.append({
                'id': pm.group(1), 'name': pm.group(2) or pm.group(3), 'pos': pm.group(4),
                'gp': int(pm.group(5)), 'g': int(pm.group(6)), 'a': int(pm.group(7)), 'pts': int(pm.group(8)),
                'gaa': float(re.search(r'gaa: ([\d.]+)', extra).group(1)) if 'gaa:' in extra else None,
                'savePct': float(re.search(r'savePct: ([\d.]+)', extra).group(1)) if 'savePct:' in extra else None,
            })
        blocks.append({'id': sid, 'span': m.span(3), 'players': players})
    return text, blocks


def fmt_name(name):
    return f'"{name}"' if "'" in name else f"'{name}'"


def fmt_player(p):
    line = f"      {{ id: '{p['id']}', name: {fmt_name(p['name'])}, position: '{p['pos']}', gp: {p['gp']}, g: {p['g']}, a: {p['a']}, pts: {p['pts']}"
    if p['pos'] == 'G':
        if p.get('gaa') is not None:
            line += f", gaa: {p['gaa']:.2f}"
        if p.get('savePct') is not None:
            line += f", savePct: {p['savePct']:.3f}"
    return line + ' },'


def build(sid, hr, wiki, overrides, old_players):
    start = sid[:4]
    ov = overrides.get('positions', {}).get(sid, {})
    picked = select(hr, ov, overrides.get('keep', {}).get(sid, []))
    wiki_by = {fold(w['name']): w for w in wiki.get('skaters', [])}
    wiki_g = {fold(w['name']): w for w in wiki.get('goalies', [])}
    old_by = {fold(p['name']): p for p in old_players}

    def match_old(name, gp, pts):
        # Same person if the folded name matches, or (a nickname / initial form
        # on one source) the surname AND the season stat line match exactly.
        o = old_by.get(fold(name))
        if o:
            return o, True
        sur = fold(name).split()[-1]
        for o in old_players:
            if fold(o['name']).split()[-1] == sur and o['gp'] == gp and o['pts'] == pts:
                return o, False
        return None, False
    used_ids = set()
    out, notes = [], list(picked['changes'])

    def make_id(name):
        parts = fold(name).split()
        base = f"{start}-{slug(parts[-1])}"
        cand = base
        if cand in used_ids:
            cand = f"{base}-{slug(parts[0])}"
        used_ids.add(cand)
        return cand

    for s in picked['roster']:
        name = NAME_FIXES.get(s['name'], s['name'])
        old, exact = match_old(name, s['gp'], s['pts'])
        if old and not exact:
            name = old['name']  # keep the file's form (e.g. "Gordon" over "Gord"); accents only change exact matches
        pid = old['id'] if old and old['id'] not in used_ids else None
        if pid:
            used_ids.add(pid)
        else:
            pid = make_id(name)
        w = wiki_by.get(fold(name))
        if w:
            hr_line = (s['gp'], s['g'], s['a'], s['pts'])
            wk_line = (w['gp'], w['g'], w['a'], w['pts'])
            if wk_line != hr_line:
                old_line = (old['gp'], old['g'], old['a'], old['pts']) if old else None
                if old_line == wk_line:
                    # Two sources (Wikipedia + the existing file) against one: keep the majority.
                    s = dict(s, gp=w['gp'], g=w['g'], a=w['a'], pts=w['pts'])
                    notes.append(f"CROSSCHECK {name}: hockey-reference {'/'.join(map(str, hr_line))} vs Wikipedia {'/'.join(map(str, wk_line))} -> kept Wikipedia (matches the existing file)")
                else:
                    notes.append(f"CROSSCHECK {name}: hockey-reference {'/'.join(map(str, hr_line))} vs Wikipedia {'/'.join(map(str, wk_line))} -> kept hockey-reference")
        else:
            notes.append(f"nocheck {name}: not found on the Wikipedia page")
        out.append({'id': pid, 'name': name, 'pos': s['pos'], 'gp': s['gp'], 'g': s['g'], 'a': s['a'], 'pts': s['pts']})
    for g in picked['goalies']:
        name = NAME_FIXES.get(g['name'], g['name'])
        old, exact = match_old(name, g['gp'], 0)
        if old and not exact:
            name = old['name']
        # Rounding differences between sources are noise: keep the file's goalie
        # numbers when they are within one unit of the last printed digit.
        if old and old.get('gaa') is not None and g.get('gaa') is not None and abs(old['gaa'] - g['gaa']) <= 0.011:
            g['gaa'] = old['gaa']
        if old and old.get('savePct') is not None and g.get('savePct') is not None and abs(old['savePct'] - g['savePct']) <= 0.0011:
            g['savePct'] = old['savePct']
        pid = old['id'] if old and old['id'] not in used_ids else None
        if pid:
            used_ids.add(pid)
        else:
            pid = make_id(name)
        w = wiki_g.get(fold(name))
        if w and w.get('gp') != g['gp']:
            notes.append(f"CROSSCHECK {name} (G): hockey-reference {g['gp']} GP vs Wikipedia {w['gp']}")
        if w and w.get('gaa') is not None and g.get('gaa') is not None and abs(w['gaa'] - g['gaa']) > 0.011:
            notes.append(f"CROSSCHECK {name} (G): GAA hockey-reference {g['gaa']} vs Wikipedia {w['gaa']}")
        out.append({'id': pid, 'name': name, 'pos': 'G', 'gp': g['gp'], 'g': 0, 'a': 0, 'pts': 0, 'gaa': g.get('gaa'), 'savePct': g.get('savePct')})
    for u in picked['unresolved']:
        if u['pos'] != 'G':
            notes.append(f"UNRESOLVED position '{u['pos']}' for {u['name']} ({u['gp']} GP, {u['pts']} pts): add to position_overrides.json")
    return out, notes


def diff(old, new):
    o = {fold(p['name']): p for p in old}
    n = {fold(p['name']): p for p in new}
    lines = []
    for k in n:
        if k not in o:
            p = n[k]
            lines.append(f"  + {p['name']} {p['pos']} {p['gp']} GP {p['pts']} pts")
    for k in o:
        if k not in n:
            p = o[k]
            lines.append(f"  - {p['name']} {p['pos']} {p['gp']} GP {p['pts']} pts")
    for k in n:
        if k in o:
            a, b = o[k], n[k]
            ch = []
            if a['pos'] != b['pos']:
                ch.append(f"pos {a['pos']}->{b['pos']}")
            if (a['gp'], a['g'], a['a'], a['pts']) != (b['gp'], b['g'], b['a'], b['pts']):
                ch.append(f"stats {a['gp']}/{a['g']}/{a['a']}/{a['pts']}->{b['gp']}/{b['g']}/{b['a']}/{b['pts']}")
            if a['name'] != b['name']:
                ch.append(f"name {a['name']}->{b['name']}")
            if b['pos'] == 'G' and (a.get('gaa'), a.get('savePct')) != (b.get('gaa'), b.get('savePct')):
                ch.append(f"goalie {a.get('gaa')}/{a.get('savePct')}->{b.get('gaa')}/{b.get('savePct')}")
            if ch:
                lines.append(f"  ~ {b['name']}: " + ', '.join(ch))
    return lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--hr', required=True)
    ap.add_argument('--wiki', required=True)
    ap.add_argument('--overrides', required=True)
    ap.add_argument('--seasons', required=True)
    ap.add_argument('--write', action='store_true')
    a = ap.parse_args()
    overrides = json.load(open(a.overrides))
    NAME_FIXES.update(overrides.get('names', {}))
    text, blocks = load_seasons_ts(a.seasons)
    edits = []
    summary = {'seasons': 0, 'added': 0, 'dropped': 0, 'changed': 0, 'conflicts': 0, 'fillers': 0}
    for b in blocks:
        sid = b['id']
        start = int(sid[:4])
        hr = json.load(open(f"{a.hr}/{start + 1}.json"))
        try:
            wiki = json.load(open(f"{a.wiki}/{start}.json"))
        except FileNotFoundError:
            wiki = {}
        new, notes = build(sid, hr, wiki, overrides, b['players'])
        counts = {}
        for p in new:
            counts[p['pos']] = counts.get(p['pos'], 0) + 1
        print(f"=== {sid}  {len(b['players'])} -> {len(new)} players  " + ' '.join(f"{k}{v}" for k, v in counts.items()))
        for l in diff(b['players'], new):
            print(l)
        for n in notes:
            print('  !', n)
        edits.append((b['span'], '\n'.join(fmt_player(p) for p in new)))
        summary['seasons'] += 1
        for l in diff(b['players'], new):
            summary['added' if l.startswith('  +') else 'dropped' if l.startswith('  -') else 'changed'] += 1
        summary['conflicts'] += sum(1 for n in notes if n.startswith('CROSSCHECK'))
        summary['fillers'] += sum(1 for p in new if p['pos'] != 'G' and p['gp'] < 10)
    print('SUMMARY', json.dumps(summary))
    if a.write:
        for (s, e), body in sorted(edits, reverse=True):
            text = text[:s] + body + text[e:]
        open(a.seasons, 'w', encoding='utf-8').write(text)
        print('WROTE', a.seasons)


if __name__ == '__main__':
    main()
