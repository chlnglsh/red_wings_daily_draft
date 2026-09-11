#!/usr/bin/env python3
"""Parse a Wikipedia "<season> Detroit Red Wings season" page (raw wikitext, as
saved from the MediaWiki API) into plain JSON, for cross-checking hockey-reference.

Usage: parse_wiki.py <page.json> > <season>.wiki.json

Output: {"skaters": [{name, pos?, gp, g, a, pts}], "goalies": [{name, gp, gaa?, savePct?}]}
Regular season only: when a table carries both regular-season and playoff column
groups, the first GP/G/A/Pts group is taken. Formats differ by era (plain
wikilinks vs {{sortname}}, with or without a Pos column, separate forward /
defense / goalie tables vs one skater table), which is why this parser walks each
table's header row instead of assuming a layout. Names are the wikilink DISPLAY
text, which carries the diacritics Wikipedia uses for the player.
"""
import json
import re
import sys


def clean_name(cell):
    cell = cell.strip()
    m = re.search(r'\{\{\s*sortname\s*\|([^|}]+)\|([^|}]+)(?:\|([^|}]*))?', cell, re.I)
    if m:
        first, last = m.group(1).strip(), m.group(2).strip()
        name = f'{first} {last}'
        # A third positional argument is the link target, e.g. "Gustav Lindström":
        # prefer it when it is the accented form of the same name.
        target = (m.group(3) or '').strip()
        if target and not target.startswith('dab=') and fold(target) == fold(name):
            name = target
    else:
        m = re.search(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', cell)
        if m:
            name = (m.group(2) or m.group(1)).strip()
        else:
            name = re.sub(r'\{\{[^}]*\}\}|<[^>]+>|\'\'+', '', cell).strip()
    name = re.sub(r'\s*\((ice hockey|hockey)[^)]*\)', '', name)
    return re.sub(r'[†‡*]+', '', name).strip()


def fold(s):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c)).lower()


def header_labels(row):
    """Column labels from a header chunk: only lines that start with '!' count,
    '!!' separates cells on one line, and colgroup headers (colspan=...) are
    dropped so the label index lines up with the data cell index."""
    labels = []
    for line in row.split('\n'):
        line = line.strip()
        if not line.startswith('!'):
            continue
        for cell in re.split(r'!!', line[1:]):
            cell = cell.strip()
            if not cell or re.search(r'colspan\s*=', cell):
                continue
            m = re.search(r'\{\{abbr\|([^|}]+)', cell, re.I)
            if m:
                label = m.group(1)
            else:
                # attributes come before a single '|'; the label is what follows
                label = cell.split('|')[-1] if '|' in cell else cell
                label = re.sub(r'\{\{[^}]*\}\}|<[^>]+>', '', label)
            label = label.strip()
            # Table titles that sit in the header row without being a column.
            if re.match(r'^(regular season|playoffs?|postseason)$', label, re.I):
                continue
            labels.append(label)
    return labels


def split_cells(line):
    line = line.strip()
    if line.startswith('|'):
        line = line[1:]
    cells = re.split(r'\|\|', line)
    out = []
    for c in cells:
        # drop cell attributes like  style="..."|  or  scope="row"|  before the value
        if '|' in c and not c.strip().startswith(('[[', '{{')):
            c = c.split('|', 1)[1] if re.match(r'^\s*[a-z\-]+\s*=', c) else c
        out.append(c.strip())
    return out


def to_int(v):
    v = re.sub(r'\{\{[^}]*\}\}|<[^>]+>|[^\d\-−]', '', v)
    return int(v) if v.lstrip('-−').isdigit() else None


def to_float(v):
    v = re.sub(r'\{\{[^}]*\}\}|<[^>]+>', '', v).strip()
    m = re.search(r'\d*\.\d+|\d+', v)
    return float(m.group(0)) if m else None


def parse(wikitext):
    skaters, goalies = [], []
    for tbl in re.findall(r'\{\|.*?\n\|\}', wikitext, re.S):
        rows = re.split(r'\n\|-[^\n]*', tbl)
        heads = [r for r in rows if re.search(r'\n!|^\s*!', r)]
        if not heads:
            continue
        labels = []
        for h in heads:
            labels += header_labels(h)
        norm = [l.lower().replace('.', '') for l in labels]
        if 'gp' not in norm or 'player' not in norm:
            continue
        gp_i = norm.index('gp')
        is_goalie = 'gaa' in norm and 'g' not in norm[gp_i:gp_i + 4]
        # Columns that precede the first GP: player, maybe No./Pos.
        pre = norm[:gp_i]
        name_i = pre.index('player')
        pos_i = pre.index('pos') if 'pos' in pre else None
        for r in rows:
            if re.search(r'\n!|^\s*!', r) or '||' not in r and '[[' not in r and '{{' not in r:
                continue
            body = r.strip()
            if body.startswith('|+') or body.startswith('!'):
                continue
            cells = split_cells(body)
            if len(cells) <= gp_i:
                continue
            name = clean_name(cells[name_i])
            if not name or name.lower() in ('player', 'total', 'totals', 'team'):
                continue
            if is_goalie:
                rec = {'name': name, 'gp': to_int(cells[gp_i])}
                if 'gaa' in norm and len(cells) > norm.index('gaa'):
                    rec['gaa'] = to_float(cells[norm.index('gaa')])
                for key in ('sv%', 'sv', 'svs%', 'save%'):
                    if key in norm and len(cells) > norm.index(key):
                        rec['savePct'] = to_float(cells[norm.index(key)])
                        break
                # First table wins: regular season precedes playoffs on every layout.
                if rec['gp'] is not None and not any(g['name'] == name for g in goalies):
                    goalies.append(rec)
            else:
                vals = [to_int(c) for c in cells[gp_i:gp_i + 4]]
                if len(vals) < 4 or vals[0] is None:
                    continue
                rec = {'name': name, 'gp': vals[0], 'g': vals[1], 'a': vals[2], 'pts': vals[3]}
                if pos_i is not None:
                    rec['pos'] = re.sub(r'\{\{[^}]*\}\}|<[^>]+>', '', cells[pos_i]).strip()
                if not any(k['name'] == name for k in skaters):
                    skaters.append(rec)
    return {'skaters': skaters, 'goalies': goalies}


if __name__ == '__main__':
    d = json.load(open(sys.argv[1]))
    text = d['query']['pages'][0]['revisions'][0]['slots']['main']['content']
    json.dump(parse(text), sys.stdout, ensure_ascii=False, indent=1)
