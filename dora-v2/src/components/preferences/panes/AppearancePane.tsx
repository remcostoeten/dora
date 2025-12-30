import { useTheme } from '@/hooks/use-theme'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'
import { usePreferences, useSavePreferences } from '@/services/preferences'

export function AppearancePane() {
  const { theme, setTheme } = useTheme()
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences()

  const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
    // Update the theme provider immediately for instant UI feedback
    setTheme(value)

    // Persist the theme preference to disk, preserving other preferences
    if (preferences) {
      savePreferences.mutate({ ...preferences, theme: value })
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Appearance">
        <SettingsField
          label="Color Theme"
          description="Choose how the application looks"
        >
          <select
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value as 'light' | 'dark' | 'system')}
            disabled={savePreferences.isPending}
            className="w-full p-2 border rounded-md"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
