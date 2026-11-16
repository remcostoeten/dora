"""Shared WebKitGTK window setup for the rig's runners."""

import os

import gi

gi.require_version('Gtk', '3.0')
gi.require_version('Gdk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import GLib, Gtk, WebKit2  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def read(*parts):
    with open(os.path.join(HERE, *parts)) as handle:
        return handle.read()


def injected_source():
    """The kit, plus the probes selected through RIG_ATTRIB and RIG_LAYOUT."""
    source = read('inject', 'kit.js')
    if os.environ.get('RIG_ATTRIB') == '1':
        source += '\n' + read('inject', 'commits.js')
    if os.environ.get('RIG_LAYOUT') == '1':
        source += '\n' + read('inject', 'layout.js')
    return source


def open_window(uri, width, height):
    """Opens an undecorated window showing `uri` and returns (window, view)."""
    manager = WebKit2.UserContentManager()
    manager.add_script(
        WebKit2.UserScript(
            injected_source(),
            WebKit2.UserContentInjectedFrames.TOP_FRAME,
            WebKit2.UserScriptInjectionTime.START,
            None,
            None,
        )
    )
    view = WebKit2.WebView(
        user_content_manager=manager, web_context=WebKit2.WebContext.new_ephemeral()
    )
    settings = view.get_settings()
    settings.set_enable_developer_extras(True)
    settings.set_enable_smooth_scrolling(os.environ.get('RIG_SMOOTH', '1') == '1')
    settings.set_enable_write_console_messages_to_stdout(os.environ.get('RIG_CONSOLE') == '1')

    window = Gtk.Window()
    window.set_title(os.environ.get('RIG_TITLE', 'dora-webkit-rig'))
    window.set_default_size(width, height)
    window.set_decorated(False)
    window.add(view)
    view.load_uri(uri)
    window.show_all()
    return window, view


def call(view, body, on_value):
    """Runs an async function body in the page and passes its result on as a string."""

    def finished(source, result, _data):
        try:
            on_value(source.call_async_javascript_function_finish(result).to_string())
        except GLib.Error as error:
            print('ERR', error.message, flush=True)
            Gtk.main_quit()

    view.call_async_javascript_function(body, -1, None, None, None, None, finished, None)


def when_loaded(view, start, settle_ms=500):
    state = {'started': False}

    def on_load(_view, event):
        if event != WebKit2.LoadEvent.FINISHED or state['started']:
            return
        state['started'] = True
        GLib.timeout_add(settle_ms, lambda: start() and False)

    view.connect('load-changed', on_load)
