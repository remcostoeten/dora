import { useEffect } from 'react'
import { initializeCommandSystem } from './lib/commands'
import { buildAppMenu } from './lib/menu'
import { logger } from './lib/logger'
import { cleanupOldFiles } from './lib/recovery'
import './App.css'
import { MainWindow } from './components/layout/MainWindow'
import { ThemeProvider } from './components/ThemeProvider'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  // Initialize command system and cleanup on app startup
  useEffect(() => {
    logger.info('🚀 Frontend application starting up')
    initializeCommandSystem()
    logger.debug('Command system initialized')

    // Initialize menu
    const initMenu = async () => {
      try {
        await buildAppMenu()
        logger.debug('Application menu built')
      } catch (error) {
        logger.warn('Failed to initialize menu', { error })
      }
    }

    initMenu()

    // Clean up old recovery files on startup
    cleanupOldFiles().catch(error => {
      logger.warn('Failed to cleanup old recovery files', { error })
    })

    // Handle window events
    const handleContextMenu = (event: React.MouseEvent) => {
      event.preventDefault()
      // TODO: Show context menu
    }

    window.addEventListener('contextmenu', handleContextMenu as any)
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu as any)
    }
  }, [])

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <MainWindow />
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
