"""Formats the JSON a rig runner prints into readable text."""

import json
import sys


def measure(data):
    print(f"  viewport {data.get('w')}x{data.get('h')} dpr {data.get('dpr')} errors={data.get('errors')}")
    for name, value in data.items():
        if not isinstance(value, dict):
            continue
        if 'fps' in value:
            print(
                f"  {name:24s} fps {value['fps']:6.1f}  p50 {value['p50']:6.1f}"
                f"  p95 {value['p95']:6.1f}  max {value['max']:6.1f}"
            )
        elif isinstance(value.get('sync'), dict):
            parts = [
                f"{metric} p50 {value[metric]['p50']:6.1f} p95 {value[metric]['p95']:6.1f}"
                for metric in ('sync', 'ready', 'painted', 'worstGap', 'commits')
            ]
            print(f"  {name:24s} " + ' | '.join(parts))
        else:
            fields = ' '.join(
                f"{key}={round(item, 1) if isinstance(item, (int, float)) else item}"
                for key, item in value.items()
            )
            print(f"  {name:24s} {fields}")


def attrib(captures):
    for capture in captures:
        commits = capture['commits']
        total = sum(commit.get('ms') or 0 for commit in commits)
        rendering = sum(1 for commit in commits if commit.get('n'))
        print(
            f"\n### {capture['label']}  sync={capture['sync']}ms  commits={len(commits)}"
            f" ({rendering} rendering)  render-total={total:.0f}ms"
        )
        for commit in commits:
            if commit.get('error'):
                print('   ERR', commit['error'])
                continue
            if not commit['n']:
                continue
            print(
                f"   t+{commit['t']:4d}ms  {commit['ms']:6.1f}ms  rendered={commit['n']:4d}"
                f"  roots={','.join(commit['roots'])[:150]}"
            )
            print(f"        top: {'  '.join(commit['top'][:9])[:330]}")


def layout(captures):
    for capture in captures:
        print(f"\n### {capture['label']}  sync={capture['sync']}ms  totals={capture['totals']}")
        for call in capture['slow']:
            print(f"   t+{call['at']:4d} {call['name']:22s} {call['ms']:4d}ms  {call['stack'][:520]}")


def plain(data):
    print('  ' + ' '.join(f"{key}={value}" for key, value in data.items()))


FORMATS = {'measure': measure, 'attrib': attrib, 'layout': layout, 'plain': plain}

for line in sys.stdin:
    line = line.rstrip('\n')
    if line.startswith('RESULT '):
        FORMATS[sys.argv[1]](json.loads(line[7:]))
    elif line.strip():
        print(line[:300])
