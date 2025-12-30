import type { AppCommand } from './types'
import { notifications } from '@/lib/notifications'

export const notificationCommands: AppCommand[] = [
  {
    id: 'notification.test-toast',
    label: 'Test Toast',
    description: 'Show a test notification',
    group: 'debug',
    keywords: ['test', 'toast', 'notification', 'debug'],
    async execute() {
      await notifications.success('Test Toast', 'This is a test notification')
    },
  },
]
