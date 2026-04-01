import { useState, useEffect } from 'react'

export function VersionDisplay() {
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        if (window.electronAPI?.app?.getVersion) {
          const appVersion = await window.electronAPI.app.getVersion()
          setVersion(appVersion)
        }
      } catch (error) {
        console.error('[VersionDisplay] 获取版本号失败:', error)
      }
    }

    fetchVersion()
  }, [])

  if (!version) {
    return null
  }

  return (
    <div className="version-display">
      <span className="version-text">v{version}</span>
    </div>
  )
}
