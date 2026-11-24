# WebKitGTK startup and interaction benchmark, 2026-11-24

Measured with `tools/webkit-rig` in WebKitGTK 2.54, software rendering under
Xvfb at 2560x1440. Browser-mode Studio, mock adapter, perf fixtures.

Before is `cf5892c3`. After is the `perf/webkit-startup-and-switching` branch.
Each fix was measured on its own branch first, then the combined branch was
checked again. The machine ran other heavy work during most runs, so absolute
timings are noisy. Component counts, forced layouts and bundle sizes do not
move with load.

## Startup

| Metric                              | Before  | After   |
| ----------------------------------- | ------: | ------: |
| JavaScript in the entry closure     | 6.51 MB | 1.24 MB |
| First contentful paint              |  185 ms |   90 ms |
| Boot screen dismissed               | 1097 ms |  780 ms |
| Grid visible                        | 1492 ms | 1276 ms |

Monaco was in the startup bundle because the editor host imported the worker
setup statically, and `manualChunks` pulled lazy features such as Docker and the
schema visualizer into startup chunks. Monaco now loads in an idle slot after
the first paint.

The trade-off is one long frame after boot while Monaco evaluates, 280 to 390
ms under load. Before, the same work sat in front of the first paint.

## Interactions

| Interaction                       | Before          | After          |
| --------------------------------- | --------------- | -------------- |
| View switch, components rendered  | 513             | 48             |
| Monaco DOM writes per view switch | 43 to 49        | 0              |
| SQL Console switch, painted p50   | 67 ms           | 53 ms          |
| Data Viewer switch, painted p50   | 128 ms          | 113 ms         |
| Connection switch, components     | 1728            | 1128           |
| Connection switch, worst gap      | 68 ms           | 25 ms          |
| Add connection close, worst gap   | 62 ms           | 17 ms          |
| Grid scroll, WebKit CPU per frame | 20.0 to 21.6 ms | 16.8 to 18.3 ms |

The worst gaps after connection switches and dialogs came from the splash
snapshot, which restyled the whole page about 500 ms after each interaction to
read theme colors. It now caches them until the theme, hue or zoom changes.

Grid cells only keep `position: relative` and `overflow: hidden` while focused,
edited or dirty. Each of those creates a render layer in WebKit, and software
rendering repaints every layer on each scroll frame. Frame rate stayed within
noise; the saving is CPU per frame.

## Forced layouts

From `rig.sh layout` against the profiling build.

| Interaction     | Before, inside the React commit         | After                  |
| --------------- | --------------------------------------- | ---------------------- |
| Connection menu | 25 to 49 ms in `revealRowInList`        | none in the commit     |
| View switch     | 16 to 49 ms in the rail indicator       | 1 to 2 ms              |
| Add connection  | 8 to 17 ms in `scrollIntoView`          | none in the commit     |

The reads now run in the next animation frame, where the layout they force is
the one the frame needs anyway.

The first SQL Console open still forces about 150 ms of layout while Monaco
creates its editor and measures the font. That happens once per session.

## Not covered

- The packaged Tauri app on the GPU paths.
- The connection switch still renders all 200 sidebar rows. Virtualizing the
  list would cut that further, but the perf tests and the rig click rows that
  sit below the fold.
