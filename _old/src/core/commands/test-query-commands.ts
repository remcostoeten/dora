// Test query command definitions for keyboard shortcuts
// These will be integrated with the commands system later

export const TEST_QUERY_SHORTCUTS = {
  'Ctrl+Shift+1': 'CREATE Tables',
  'Ctrl+Shift+2': 'INSERT Data',
  'Ctrl+Shift+3': 'READ Queries',
  'Ctrl+Shift+4': 'UPDATE Operations',
  'Ctrl+Shift+5': 'DELETE Operations',
  'Ctrl+Shift+6': 'Advanced Queries',
  'Ctrl+Shift+7': 'Performance Queries',
} as const

export type TestQueryShortcut = keyof typeof TEST_QUERY_SHORTCUTS