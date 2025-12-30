# Native Menu System

Cross-platform native menu system built with JavaScript for i18n support, integrating with keyboard shortcuts and the command system.

## Overview

This app builds menus from **JavaScript** using Tauri's JS Menu API (`@tauri-apps/api/menu`). This enables:

- Direct integration with React state (Zustand)

## Current Menu Structure

```
App Name
├── About App Name
├── ────────────────────
├── Check for Updates...
├── ────────────────────
├── Preferences...           (Cmd+,)
├── ────────────────────
├── Hide App Name            (Cmd+H)
├── Hide Others              (Cmd+Alt+H)
├── Show All
├── ────────────────────
└── Quit App Name            (Cmd+Q)

View
├── Toggle Left Sidebar      (Cmd+1)
└── Toggle Right Sidebar     (Cmd+2)
```

## Architecture

### Menu Builder (`src/lib/menu.ts`)

Menus are built using direct action handlers:

```typescript
import {
  Menu,
  MenuItem,
  Submenu,
  PredefinedMenuItem,
} from '@tauri-apps/api/menu'
import { useUIStore } from '@/store/ui-store'

export async function buildAppMenu(): Promise<Menu> {
  const appSubmenu = await Submenu.new({
    text: APP_NAME,
    items: [
      await MenuItem.new({
        id: 'preferences',
        text: 'Preferences',
        accelerator: 'CmdOrCtrl+,',
        action: handleOpenPreferences,
      }),
      // ... more items
    ],
  })

  const menu = await Menu.new({
    items: [appSubmenu, viewSubmenu],
  })

  await menu.setAsAppMenu()
  return menu
}

function handleOpenPreferences(): void {
  useUIStore.getState().setPreferencesOpen(true)
}
```



## Menu Item Types

### Custom Menu Items

```typescript
await MenuItem.new({
  id: 'my-action',
  text: t('menu.myAction'),
  accelerator: 'CmdOrCtrl+M',
  action: handleMyAction,
})
```

### Predefined Items

Tauri provides common system menu items:

```typescript
await PredefinedMenuItem.new({ item: 'Separator' })
await PredefinedMenuItem.new({ item: 'Hide', text: t('menu.hide') })
await PredefinedMenuItem.new({ item: 'Quit', text: t('menu.quit') })
await PredefinedMenuItem.new({ item: 'Copy' })
await PredefinedMenuItem.new({ item: 'Paste' })
```

### Submenus

```typescript
const viewSubmenu = await Submenu.new({
  text: t('menu.view'),
  items: [
    await MenuItem.new({ id: 'toggle-sidebar', text: t('menu.toggleSidebar'), ... }),
  ],
})
```

## Adding New Menu Items

### Step 1: Add to Menu Builder

```typescript
// src/lib/menu.ts
await MenuItem.new({
  id: 'my-new-action',
  text: 'My New Action',
  accelerator: 'CmdOrCtrl+N',
  action: handleMyNewAction,
})

function handleMyNewAction(): void {
  // Use getState() for current store values
  const { someValue } = useUIStore.getState()
  // Perform action
}
```

## Action Handlers

Menu actions use Zustand's `getState()` pattern for accessing current state:

```typescript
function handleToggleLeftSidebar(): void {
  const store = useUIStore.getState()
  store.setLeftSidebarVisible(!store.leftSidebarVisible)
}
```

This ensures handlers always have access to current state values.

## Platform Differences

| Platform      | Menu Location    | Modifier Key |
| ------------- | ---------------- | ------------ |
| macOS         | System menu bar  | Cmd          |
| Windows/Linux | Window title bar | Ctrl         |

The `CmdOrCtrl` accelerator automatically uses the correct modifier per platform.

## Troubleshooting

| Issue                     | Solution                                                    |
| ------------------------- | ----------------------------------------------------------- |
| Menu not appearing        | Ensure `buildAppMenu()` is called during app initialization |
| Translations not updating | Verify `setupMenuLanguageListener()` is called              |
| Action not working        | Check handler uses `getState()` for current values          |
| Accelerator conflicts     | Verify shortcut isn't used elsewhere in the app             |
