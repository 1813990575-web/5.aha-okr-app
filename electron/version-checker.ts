import { dialog, shell } from 'electron'
import https from 'https'

// 当前应用版本号（与 package.json 保持一致）
const CURRENT_VERSION = '1.1.1'

// GitHub Raw URL 上的 version.json 地址
const VERSION_URL = 'https://raw.githubusercontent.com/1813990575-web/5.Aha-OKR/main/version.json'

interface VersionInfo {
  version: string
  downloadUrl: string
  releaseNotes: string
}

/**
 * 比较两个版本号
 * @param local 本地版本号
 * @param remote 远程版本号
 * @returns true 表示远程版本较新
 */
function compareVersions(local: string, remote: string): boolean {
  const localParts = local.split('.').map(Number)
  const remoteParts = remote.split('.').map(Number)

  const maxLength = Math.max(localParts.length, remoteParts.length)

  for (let i = 0; i < maxLength; i++) {
    const localPart = localParts[i] || 0
    const remotePart = remoteParts[i] || 0

    if (remotePart > localPart) {
      return true
    } else if (remotePart < localPart) {
      return false
    }
  }

  return false
}

/**
 * 异步获取远程版本信息
 */
function fetchRemoteVersion(): Promise<VersionInfo | null> {
  return new Promise((resolve) => {
    const request = https.get(VERSION_URL, { timeout: 5000 }, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          https.get(redirectUrl, { timeout: 5000 }, (redirectResponse) => {
            handleResponse(redirectResponse, resolve)
          }).on('error', () => {
            resolve(null)
          })
          return
        }
      }

      handleResponse(response, resolve)
    })

    request.on('error', () => {
      resolve(null)
    })

    request.on('timeout', () => {
      request.destroy()
      resolve(null)
    })
  })
}

/**
 * 处理 HTTP 响应
 */
function handleResponse(
  response: import('http').IncomingMessage,
  resolve: (value: VersionInfo | null) => void
): void {
  if (response.statusCode !== 200) {
    resolve(null)
    return
  }

  let data = ''
  response.on('data', (chunk) => {
    data += chunk
  })

  response.on('end', () => {
    try {
      const versionInfo: VersionInfo = JSON.parse(data)
      resolve(versionInfo)
    } catch {
      resolve(null)
    }
  })

  response.on('error', () => {
    resolve(null)
  })
}

/**
 * 显示更新提示对话框
 */
function showUpdateDialog(versionInfo: VersionInfo): void {
  const result = dialog.showMessageBoxSync({
    type: 'info',
    title: '发现新版本',
    message: `发现新版本 ${versionInfo.version}`,
    detail: versionInfo.releaseNotes || '新版本已发布，请下载最新安装包以获取更好的体验。',
    buttons: ['去下载', '稍后'],
    defaultId: 0,
    cancelId: 1,
  })

  if (result === 0) {
    // 用户点击"去下载"
    shell.openExternal(versionInfo.downloadUrl)
  }
  // 用户点击"稍后"，不做任何操作
}

/**
 * 检查版本更新
 * 应用启动时调用，静默检查，失败不影响应用启动
 */
export async function checkForUpdates(): Promise<void> {
  try {
    console.log('[VersionChecker] 正在检查版本更新...')

    const remoteVersionInfo = await fetchRemoteVersion()

    if (!remoteVersionInfo) {
      console.log('[VersionChecker] 无法获取远程版本信息')
      return
    }

    console.log(`[VersionChecker] 本地版本: ${CURRENT_VERSION}, 远程版本: ${remoteVersionInfo.version}`)

    if (compareVersions(CURRENT_VERSION, remoteVersionInfo.version)) {
      console.log('[VersionChecker] 发现新版本')
      showUpdateDialog(remoteVersionInfo)
    } else {
      console.log('[VersionChecker] 当前已是最新版本')
    }
  } catch (error) {
    // 静默处理错误，不影响应用启动
    console.log('[VersionChecker] 版本检查失败:', error)
  }
}

/**
 * 获取当前版本号
 */
export function getCurrentVersion(): string {
  return CURRENT_VERSION
}
