/**
 * Application menu builder using Tauri's JavaScript API.
 */
import {
  Menu,
  MenuItem,
  Submenu,
  PredefinedMenuItem,
} from '@tauri-apps/api/menu'
import { useUIStore } from '@/store/ui-store'
import { logger } from '@/lib/logger'
import { check } from '@tauri-apps/plugin-updater'
import { notifications } from '@/lib/notifications'

const APP_NAME = 'Tauri Template'

/**
 * Build and set the application menu with hardcoded English labels.
 */
export async function buildAppMenu(): Promise<Menu> {
  try {
    // Build the main application submenu (appears as app name on macOS)
    const appSubmenu = await Submenu.new({
      text: APP_NAME,
      items: [
        await MenuItem.new({
          id: 'about',
          text: `About ${APP_NAME}`,
          action: handleAbout,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'check-updates',
          text: 'Check for Updates...',
          action: handleCheckForUpdates,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'preferences',
          text: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          action: handleOpenPreferences,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await PredefinedMenuItem.new({
          item: 'Hide',
          text: `Hide ${APP_NAME}`,
        }),
        await PredefinedMenuItem.new({
          item: 'HideOthers',
          text: 'Hide Others',
        }),
        await PredefinedMenuItem.new({
          item: 'ShowAll',
          text: 'Show All',
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await PredefinedMenuItem.new({
          item: 'Quit',
          text: `Quit ${APP_NAME}`,
        }),
      ],
    })

    // Build the Edit submenu
    const editSubmenu = await Submenu.new({
      text: 'Edit',
      items: [
        await PredefinedMenuItem.new({ item: 'Undo' }),
        await PredefinedMenuItem.new({ item: 'Redo' }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await PredefinedMenuItem.new({ item: 'Cut' }),
        await PredefinedMenuItem.new({ item: 'Copy' }),
        await PredefinedMenuItem.new({ item: 'Paste' }),
        await PredefinedMenuItem.new({ item: 'SelectAll' }),
      ],
    })

    // Build the File submenu
    const fileSubmenu = await Submenu.new({
      text: 'File',
      items: [
        await MenuItem.new({
          id: 'new-window',
          text: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          action: () => {
            logger.info('New window menu item clicked')
            // TODO: Implement new window functionality
          },
        }),
        await MenuItem.new({
          id: 'toggle-right-sidebar',
          text: 'Toggle Right Sidebar',
          accelerator: 'CmdOrCtrl+2',
          action: handleToggleRightSidebar,
        }),
      ],
    })

    // Build the View submenu
    const viewSubmenu = await Submenu.new({
      text: 'View',
      items: [
        await MenuItem.new({
          id: 'toggle-left-sidebar',
          text: 'Toggle Left Sidebar',
          accelerator: 'CmdOrCtrl+1',
          action: handleToggleLeftSidebar,
        }),
      ],
    })

    // Build the complete menu
    const menu = await Menu.new({
      items: [appSubmenu, editSubmenu, fileSubmenu, viewSubmenu],
    })

    // Set as the application menu
    await menu.setAsAppMenu()

    logger.info('Application menu built successfully')
    return menu
  } catch (error) {
    logger.error('Failed to build application menu', { error })
    throw error
  }
}

// Menu action handlers

function handleAbout(): void {
  logger.info('About menu item clicked')
  alert(
    `${APP_NAME}\n\nVersion: ${__APP_VERSION__}\n\nBuilt with Tauri v2 + React + TypeScript`
  )
}

async function handleCheckForUpdates(): Promise<void> {
  try {
    logger.info('Checking for updates...')
    const update = await check()
    if (update?.available) {
      notifications.info(
        'Update Available',
        `Version ${update.version} is available. Updating...`
      )
      await update.downloadAndInstall()
      // Relaunch is handled by the updater
    } else {
      notifications.success('Up to Date', 'You are running the latest version')
    }
  } catch (error) {
    logger.error('Failed to check for updates', { error })
    notifications.error('Update Check Failed', 'Could not check for updates')
  }
}

function handleOpenPreferences(): void {
  logger.info('Preferences menu item clicked')
  useUIStore.getState().setPreferencesOpen(true)
}

function handleToggleLeftSidebar(): void {
  logger.info('Toggle Left Sidebar menu item clicked')
  useUIStore.getState().toggleLeftSidebar()
}

function handleToggleRightSidebar(): void {
  logger.info('Toggle Right Sidebar menu item clicked')
  useUIStore.getState().toggleRightSidebar()
}
