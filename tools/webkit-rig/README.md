# WebKitGTK rig

Runs browser-mode Studio (mock adapter, perf fixtures) inside a WebKitGTK 4.1
webview, the engine the Linux desktop app uses, and measures it there.

The Playwright harness in `packages/studio/src/test/performance` measures
headless Chromium. That is the right tool for render invariants in CI. It says
little about how the app feels on Linux: WebKitGTK lays out, paints and
schedules frames differently, and by default the desktop app renders on the
CPU. This rig measures the real engine and needs no Rust build.

Requirements: Linux with a display, Python 3 with PyGObject, the GTK 3 and
WebKit2 4.1 typelibs, and Bun.

## Commands

    tools/webkit-rig/rig.sh build                       production build into apps/desktop/dist,
                                                        profiling build into apps/desktop/dist-profile
    tools/webkit-rig/rig.sh serve <dir> <port>          static server for one of those folders
    tools/webkit-rig/rig.sh measure  <base-url> [only]  click-to-paint timings and frame pacing
    tools/webkit-rig/rig.sh attrib   <base-url> [only]  React commits per interaction, by component
    tools/webkit-rig/rig.sh layout   <base-url>         DOM calls that force a slow synchronous layout
    tools/webkit-rig/rig.sh timeline <base-url> <name>  WebKit's own timeline and sampled JS self time
    tools/webkit-rig/rig.sh wheel    <base-url>         real wheel notches on the grid

`<base-url>` is `http://127.0.0.1:<port>`. `measure` and `wheel` want the
production build. `attrib`, `layout` and `timeline` want the profiling build,
which is unminified and aliases `react-dom` to its profiling entry.

A typical session:

    tools/webkit-rig/rig.sh build
    tools/webkit-rig/rig.sh serve apps/desktop/dist 4180 &
    tools/webkit-rig/rig.sh serve apps/desktop/dist-profile 4182 &
    tools/webkit-rig/rig.sh measure http://127.0.0.1:4180 tableSwitchCached,gridScroll
    tools/webkit-rig/rig.sh attrib http://127.0.0.1:4182 table
    tools/webkit-rig/rig.sh timeline http://127.0.0.1:4182 scroll

Environment:

| Variable | Meaning |
| --- | --- |
| `RIG_W`, `RIG_H` | Window size in device pixels. Default 2560x1440. |
| `RIG_MODE` | `software` (default: X11, CPU rendering), `gpu` (X11, GPU compositing through shared memory) or `wayland` (native Wayland, GPU). Mirrors `DORA_RENDERER` in the desktop app. |
| `RIG_SMOOTH` | `0` turns off WebKit's animated wheel scrolling, as the app does under software rendering. |
| `RIG_SCENARIO` | Path to a replacement scenario file for `measure`, `attrib` or `layout`. |
| `INSPECTOR_PORT` | Port for `timeline`. Default 9333. |
| `RIG_MIN_MS` | Shortest style, layout, paint or composite record `timeline` lists. Default 4. |

`only` selects groups, comma separated:

- `measure`: `idle`, `tableSwitchCached`, `tableSwitchWalk`, `gridScroll`,
  `viewSwitch`, `connectionMenu`, `addConnectionDialog`, `connectionSwitch`
- `attrib`: `table`, `view`, `menu`, `dialog`, `connection`
- `timeline` names: `table`, `view`, `menu`, `dialog`, `scroll`, `idle`, `custom`

`timeline custom` profiles any expression:

    RIG_SETUP="<js run once first>" RIG_ACTION="<js to profile>" \
    RIG_RESET="<js run after each repeat>" RIG_WAIT=800 RIG_REPEAT=2 \
    tools/webkit-rig/rig.sh timeline http://127.0.0.1:4182 custom

A scenario file is a plain script that declares `async function run()`,
assigns it to `window.__rigScenario` and returns a JSON string. Inside the page
`window.__rig` offers `select` (the selectors the scenarios click), `click`,
`press` (pointer events, which Radix menus need), `key`, `text`, `waitFor`,
`sleep`, `settle`, `frames`, `interaction` and `scrollerOf`.

## Reading the output

`measure` reports, per interaction, p50 and p95 in milliseconds:

- `sync`: how long the click handler blocked.
- `ready`: until the DOM showed the result.
- `painted`: two animation frames after that. This is what a user waits for.
- `worstGap`: the longest gap between animation frames while it settled.
- `commits`: React commits in the window, empty ones included.

`attrib` lists each commit that rendered components: time after the click,
render time, how many components rendered, the components the render started
from and those with the most self time. `(mN)` means N of them mounted.
WebKit's clock has 1 ms resolution, so trust counts over small durations.

`layout` lists calls such as `offsetWidth`, `scrollWidth`, `focus` or
`getBoundingClientRect` that took 3 ms or more because they forced style and
layout, with the calling stack.

`timeline` prints self time per record type, the individual style, layout,
paint and composite records with the painted area, and the JS functions with
the most sampled self time. A record marked FORCED ran synchronously inside
script.

`wheel` reports how long a wheel notch takes to move the grid and the frame
pacing while it scrolls.

## Caveats

- Windows open on the real desktop for the length of a run.
- Timings move with machine load. Commit counts, component counts, record
  counts and painted areas do not, so compare those first.
- The mock adapter delays every call by 50 to 150 ms on purpose. Anything that
  reaches the adapter has that floor. Cached paths do not.
- WebKitGTK falls back to a 60 Hz timer for vblank when the DRM vblank ioctl is
  unavailable, which is the case on NVIDIA drivers. 60 fps is then the ceiling
  whatever the monitor does.
