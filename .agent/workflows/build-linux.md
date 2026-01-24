---
description: Build Linux packages (Debian, Snap, AppImage)
---

To build the application for Linux distributions, run the following command:

```bash
# Builds .deb, .snap, and .AppImage packages
npm run tauri build --prefix apps/desktop
# OR
cd apps/desktop && npm run tauri build
```

This will output the artifacts to:
`apps/desktop/src-tauri/target/release/bundle/`

- **Debian/Ubuntu**: `bundle/deb/*.deb`
- **Snap**: `bundle/snap/*.snap`
- **AppImage**: `bundle/appimage/*.AppImage`
