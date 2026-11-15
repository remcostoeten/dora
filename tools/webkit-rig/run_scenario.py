"""Loads a page in WebKitGTK, runs one scenario file in it and prints its result."""

import os
import sys

import webview  # sets the GTK and WebKit versions, so it comes before gi.repository
from gi.repository import GLib, Gtk  # noqa: E402

uri, width, height, scenario_path = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]

with open(scenario_path) as handle:
    body = (
        'window.__rigOnly = ' + repr(os.environ.get('RIG_ONLY', '')) + '\n'
        + handle.read()
        + '\nreturn await window.__rigScenario()'
    )

window, view = webview.open_window(uri, width, height)


def on_result(value):
    print('RESULT', value, flush=True)
    GLib.timeout_add(300, lambda: Gtk.main_quit() and False)


webview.when_loaded(view, lambda: webview.call(view, body, on_result))
GLib.timeout_add(int(os.environ.get('RIG_TIMEOUT_MS', '240000')), Gtk.main_quit)
Gtk.main()
