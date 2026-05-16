import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function ThemeToggle({ compact = false, className = '' }) {
  const { isDark, toggleTheme } = useTheme()
  const Icon = isDark ? Sun : Moon
  const nextTheme = isDark ? 'light' : 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle ${compact ? 'compact' : ''} ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      {!compact && (
        <span className="theme-toggle-label">
          {isDark ? 'Light theme' : 'Dark theme'}
        </span>
      )}
    </button>
  )
}
