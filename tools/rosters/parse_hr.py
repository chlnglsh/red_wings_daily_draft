#!/usr/bin/env python3
"""Parse a saved hockey-reference.com team season page into plain JSON.

Usage: parse_hr.py <page.html> > <season>.json

Output: {"skaters": [{name, pos, gp, g, a, pts}], "goalies": [{name, gp, gaa, savePct}]}
Regular season only (the *_post tables are ignored). Names keep hockey-reference's
diacritics. `pos` is the position hockey-reference lists for THAT season's stats row
(C / LW / RW / D / G, occasionally F or W on very old seasons).
"""
import html
import json
import re
import sys


def cells(row):
    out = {}
    for k, v in re.findall(r'<t[dh][^>]*data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', row, re.S):
        out[k] = html.unescape(re.sub(r'<[^>]+>', '', v)).strip()
    return out


def table(page, tid):
    # hockey-reference wraps most tables in HTML comments; strip the markers first.
    page = page.replace('<!--', '').replace('-->', '')
    m = re.search(r'<table[^>]*id="%s"[^>]*>(.*?)</table>' % tid, page, re.S)
    if not m:
        return []
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', m.group(1), re.S)
    return [c for c in (cells(r) for r in rows) if c.get('name_display') and c.get('ranker', '').isdigit()]


def num(v, cast=int):
    try:
        return cast(v)
    except (TypeError, ValueError):
        return None


def parse(path):
    page = open(path, encoding='utf-8').read()
    skaters = []
    for c in table(page, 'player_stats'):
        skaters.append({
            'name': c['name_display'], 'pos': c.get('pos', ''),
            'gp': num(c.get('games')), 'g': num(c.get('goals')),
            'a': num(c.get('assists')), 'pts': num(c.get('points')),
        })
    goalies = []
    for c in table(page, 'goalie_stats'):
        goalies.append({
            'name': c['name_display'], 'gp': num(c.get('goalie_games')),
            'gaa': num(c.get('goals_against_avg'), float),
            'savePct': num(c.get('save_pct_goalie'), float),
        })
    return {'skaters': skaters, 'goalies': goalies}


if __name__ == '__main__':
    json.dump(parse(sys.argv[1]), sys.stdout, ensure_ascii=False, indent=1)
