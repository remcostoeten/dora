# WebKitGTK interaction benchmark, 2026-11-14

Measured with `tools/webkit-rig` in WebKitGTK 2.54.1, the engine the Linux
desktop app uses. Browser-mode Studio, mock adapter, perf fixtures.

Machine: Arch Linux, KDE Plasma on Wayland, NVIDIA RTX 3060 Ti, 16 cores,
3840x2160 at 144 Hz and 150% scale. Window 3840x2112, viewport 2560x1408 at a
device pixel ratio of 1.5.

Before is `2a6f5163`. After is the `perf/snappy-linux-rendering` branch.

## Interactions, software rendering

Both runs use the software path so the React and CSS work is compared on equal
terms. The after run shared the machine with other builds at a load average of
18, so its timings are pessimistic. Commit counts do not move with load.

Painted is click to the second animation frame after the DOM showed the
result, p50 in milliseconds. Commits is React commits in the window, p50.

| Interaction                | Painted before | Painted after | Commits before | Commits after |
| -------------------------- | -------------: | ------------: | -------------: | ------------: |
| Table switch, cached       |             87 |            65 |             10 |             2 |
| Table switch, uncached     |            231 |           236 |             17 |             7 |
| Data Viewer to SQL Console |            110 |           160 |              5 |             2 |
| SQL Console to Data Viewer |            153 |           208 |              5 |             3 |
| Connection menu open       |            181 |           123 |             14 |             9 |
| Connection menu close      |            324 |           105 |              6 |             4 |
| Add connection, first open |            648 |           346 |             12 |            11 |
| Add connection open        |            342 |           130 |             13 |             8 |
| Add connection close       |            311 |            85 |              7 |             4 |
| Connection switch          |            127 |           120 |             14 |            10 |

The uncached table switch waits on the mock adapter, which delays every call
by 50 to 150 ms. The two view switches paint the Monaco editor or the full
grid and were the rows most affected by the load during the after run.

Handler blocking time for opening the add connection dialog went from 241 ms
to 28 ms.

| Frame pacing             | Before   | After    |
| ------------------------ | -------- | -------- |
| Idle                     | 60.5 fps | 61.2 fps |
| Grid scroll, scripted    | 19.7 fps | 29.6 fps |
| Sidebar scroll, scripted | 58.9 fps | 52.5 fps |

## React work per interaction

From `rig.sh attrib` against the profiling build at 2560x1440.

| Interaction                     | Before                                     | After                             |
| ------------------------------- | ------------------------------------------ | --------------------------------- |
| Table switch, cached            | 4 rendering commits, about 2850 components | 1 commit, 269 components          |
| Background refresh, same data   | 3 commits                                  | 0 commits                         |
| View switch                     | 1505 and 453 components                    | 719 components in one commit      |
| Connection menu open            | 669 components                             | 370 components                    |
| Connection menu close           | 1479 components, mounted for 270 ms        | 141 components, unmounted in 9 ms |
| Connection switch, first commit | 3286 components                            | 2701 components                   |
| `focus()` and `blur()`          | 11 to 26 ms each                           | 0 to 1 ms each                    |

## Rendering path, real binary

Debug build of the desktop app, maximized at 3840x2160, scripted through the
WebKit inspector. Frames per second.

| Path                                         | Idle | Transform animation | Opacity animation | Grid scroll |
| -------------------------------------------- | ---: | ------------------: | ----------------: | ----------: |
| Software (previous default)                  | 60.0 |                19.2 |              19.8 |        27.3 |
| GPU through shared memory, X11               | 24.0 |                24.0 |              24.0 |        24.0 |
| Native Wayland, GPU (new default on Wayland) | 50.7 |                45.5 |              43.2 |        46.2 |

WebKitGTK paces frames with a 60 Hz timer on NVIDIA drivers, so 60 fps is the
ceiling on this machine. The shared memory path copies every frame through the
CPU, which is why it loses to software at this resolution and is only chosen
for displays up to 2560x1600.

## Not covered

- GPU paths on Mesa drivers (Intel, AMD). Only NVIDIA was available.
- Grid scroll paint cost. It improved as a side effect and is still the
  slowest remaining interaction under software rendering.
- Editing, undo, filters and pagination were not timed.
