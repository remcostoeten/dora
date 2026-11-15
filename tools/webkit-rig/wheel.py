"""Sends real wheel notches to the grid and reports scroll latency and frame pacing."""

import json
import os
import sys

import webview  # sets the GTK and WebKit versions, so it comes before gi.repository
from gi.repository import Gdk, GLib, Gtk  # noqa: E402

uri, width, height = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
NOTCHES = int(os.environ.get('RIG_NOTCHES', '12'))
INTERVAL_MS = int(os.environ.get('RIG_NOTCH_INTERVAL', '150'))

PREPARE = '''
const rig = window.__rig
await rig.waitFor(() => document.querySelector(rig.select.cell) !== null, 30000)
rig.click(rig.select.tableItem('perf_events'))
await rig.sleep(1500)
const scroller = rig.scrollerOf(document.querySelector(rig.select.grid))
const rect = scroller.getBoundingClientRect()
const log = { frames: [], scrolls: [] }
window.__wheelLog = log
scroller.addEventListener('scroll', () => log.scrolls.push([performance.now(), scroller.scrollTop]), { passive: true })
function tick(now) {
	log.frames.push(now)
	requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
return JSON.stringify({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, zoom: devicePixelRatio, now: performance.now() })
'''
COLLECT = 'return JSON.stringify(window.__wheelLog)'

window, view = webview.open_window(uri, width, height)
state = {'sent': []}


def quantile(values, fraction):
    if not values:
        return None
    return round(values[min(len(values) - 1, int(len(values) * fraction))], 1)


def send_notch():
    target = state['target']
    scale = target['zoom'] / view.get_scale_factor()
    event = Gdk.Event.new(Gdk.EventType.SCROLL)
    event.window = view.get_window()
    event.send_event = True
    event.time = Gtk.get_current_event_time()
    event.x = target['x'] * scale
    event.y = target['y'] * scale
    event.direction = Gdk.ScrollDirection.DOWN
    event.set_device(Gdk.Display.get_default().get_default_seat().get_pointer())
    state['sent'].append(GLib.get_monotonic_time() / 1000.0)
    Gtk.main_do_event(event)
    if len(state['sent']) < NOTCHES:
        GLib.timeout_add(INTERVAL_MS, send_notch)
    else:
        GLib.timeout_add(1200, lambda: webview.call(view, COLLECT, report) and False)
    return False


def report(value):
    log = json.loads(value)
    clock_offset = state['monotonic_at_prepare'] - state['target']['now']
    sent = [stamp - clock_offset for stamp in state['sent']]
    scrolls = log['scrolls']
    last_scroll = scrolls[-1][0] if scrolls else sent[0]
    frames = [stamp for stamp in log['frames'] if sent[0] <= stamp <= last_scroll + 50]
    gaps = sorted(later - earlier for earlier, later in zip(frames, frames[1:]))
    latencies = sorted(
        next(stamp for stamp, _top in scrolls if stamp >= notch) - notch
        for notch in sent
        if any(stamp >= notch for stamp, _top in scrolls)
    )
    print('RESULT', json.dumps({
        'smoothScrolling': os.environ.get('RIG_SMOOTH', '1') == '1',
        'notches': len(sent),
        'scrollEvents': len(scrolls),
        'activeMs': round(last_scroll - sent[0]),
        'fps': round(len(frames) / max(1.0, last_scroll + 50 - sent[0]) * 1000, 1),
        'frameGapP50': quantile(gaps, 0.5),
        'frameGapP95': quantile(gaps, 0.95),
        'notchToScrollP50': quantile(latencies, 0.5),
        'notchToScrollMax': quantile(latencies, 1.0),
    }), flush=True)
    Gtk.main_quit()


def prepared(value):
    state['target'] = json.loads(value)
    state['monotonic_at_prepare'] = GLib.get_monotonic_time() / 1000.0
    GLib.timeout_add(500, send_notch)


webview.when_loaded(view, lambda: webview.call(view, PREPARE, prepared))
GLib.timeout_add(60000, Gtk.main_quit)
Gtk.main()
