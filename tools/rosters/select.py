#!/usr/bin/env python3
"""Pick a season's draft pool from a full hockey-reference skater/goalie table.

Usage: select.py <season.json> [--overrides overrides.json --season 2008-09]

The roster rule (the same one the Penguins were built with, user decisions of
2026-09-10, applied to Detroit 2026-09-11):
  1. Top N per position by games played: 4 LW, 4 C, 4 RW, 6 D, 2 G.
  2. Star rescue: any skater with >= 20 GP AND >= 20 points who ranks in his
     position's top N by POINTS replaces the lowest-GP pick at that position who is
     not himself a top-N scorer. Stars who missed games (an injured Datsyuk,
     Yzerman's 2002-03) stay draftable; they still score low through the GP weight.
  3. Positions are what hockey-reference lists for that season's stat row. Dual
     positions ("C/LW", "F", "W") and per-season corrections come from the
     overrides file: {"<season>": {"<name>": "LW"}}.
Prints the chosen roster as JSON, plus a "changes" list explaining every rescue.
"""
import argparse
import json

CAP = {'LW': 4, 'C': 4, 'RW': 4, 'D': 6}
GOALIES = 2
RESCUE_MIN_GP = 20
RESCUE_MIN_PTS = 20


def normalize_pos(pos, name, overrides):
    if name in overrides:
        return overrides[name]
    pos = pos.upper().strip()
    if pos in CAP:
        return pos
    if '/' in pos:
        first = pos.split('/')[0]
        if first in CAP:
            return first
    if pos in ('F', 'W', ''):
        return None  # needs an override
    return None


def select(data, overrides, keep=()):
    unresolved = []
    by_pos = {p: [] for p in CAP}
    for s in data['skaters']:
        if s.get('pos', '').upper() == 'G':
            continue  # goalies come from the goalie table
        pos = normalize_pos(s.get('pos', ''), s['name'], overrides)
        if pos is None:
            unresolved.append({'name': s['name'], 'pos': s.get('pos', ''), 'gp': s['gp'], 'pts': s['pts']})
            continue
        by_pos[pos].append(dict(s, pos=pos))

    roster, changes = [], []
    for pos, cap in CAP.items():
        pool = by_pos[pos]
        by_gp = sorted(pool, key=lambda r: (-r['gp'], -r['pts'], r['name']))
        by_pts = sorted(pool, key=lambda r: (-r['pts'], -r['gp'], r['name']))
        picks = by_gp[:cap]
        top_scorers = {r['name'] for r in by_pts[:cap]}
        for star in by_pts[:cap]:
            if star in picks or star['gp'] < RESCUE_MIN_GP or star['pts'] < RESCUE_MIN_PTS:
                continue
            droppable = [r for r in picks if r['name'] not in top_scorers]
            if not droppable:
                continue
            out = min(droppable, key=lambda r: (r['gp'], r['pts']))
            picks[picks.index(out)] = star
            changes.append(f"{pos}: {star['name']} ({star['gp']} GP, {star['pts']} pts) replaces {out['name']} ({out['gp']} GP, {out['pts']} pts)")
        # Protected names (overrides "keep"): franchise figures the user wants in
        # the pool regardless of the cut, e.g. Fedorov's 21-game 1997-98 holdout
        # season. They displace the lowest-GP pick who is neither protected nor a
        # top-N scorer; if nobody is displaceable the group simply runs over the cap.
        for name in keep:
            star = next((r for r in pool if r['name'] == name), None)
            if star is None or star in picks:
                continue
            droppable = [r for r in picks if r['name'] not in top_scorers and r['name'] not in keep]
            if droppable:
                out = min(droppable, key=lambda r: (r['gp'], r['pts']))
                picks[picks.index(out)] = star
                changes.append(f"{pos}: {star['name']} ({star['gp']} GP, {star['pts']} pts) KEPT, replaces {out['name']} ({out['gp']} GP, {out['pts']} pts)")
            else:
                picks.append(star)
                changes.append(f"{pos}: {star['name']} ({star['gp']} GP, {star['pts']} pts) KEPT over the cap")
        roster += sorted(picks, key=lambda r: (-r['gp'], -r['pts']))
    goalies = sorted(data['goalies'], key=lambda r: (-r['gp'], r['name']))[:GOALIES]
    return {'roster': roster, 'goalies': goalies, 'changes': changes, 'unresolved': unresolved}


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('season_json')
    ap.add_argument('--overrides')
    ap.add_argument('--season')
    a = ap.parse_args()
    ov, keep = {}, []
    if a.overrides:
        allov = json.load(open(a.overrides))
        ov = allov.get('positions', {}).get(a.season, {})
        keep = allov.get('keep', {}).get(a.season, [])
    out = select(json.load(open(a.season_json)), ov, keep)
    json.dump(out, open(a.season_json.replace('.json', '.pick.json'), 'w') if False else __import__('sys').stdout, ensure_ascii=False, indent=1)
