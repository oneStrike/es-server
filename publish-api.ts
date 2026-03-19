import fs from 'node:fs'
import process from 'node:process'
import { parseEnv } from 'node:util'
import kill from 'tree-kill'

const env = parseEnv(fs.readFileSync('.env', 'utf8'))

interface AppConfig {
  name: string
  port: string
  envPath: string
  startCommand: string
  swaggerPath: string
  projectId: string
}

const APPS: Record<string, AppConfig> = {
  admin: {
    name: 'admin',
    port: '8080',
    envPath: 'apps/admin-api/.env.development',
    startCommand: 'start:admin',
    swaggerPath: 'api-doc-json',
    projectId: env.APIFOX_ADMIN_PROJECT_ID || '',
  },
  app: {
    name: 'app',
    port: '8081',
    envPath: 'apps/app-api/.env.development',
    startCommand: 'start:app',
    swaggerPath: 'api-doc-json',
    projectId: env.APIFOX_APP_PROJECT_ID || '',
  },
}

const APIFOX_OPENAPI_URL =
  'https://api.apifox.com/v1/projects/PROJECT_ID/import-openapi?locale=zh-CN'

function parseArgs(): { app: string } {
  const args = process.argv.slice(2)
  let app = 'admin'

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

    if (arg === '--app' && nextArg && APPS[nextArg]) {
      app = nextArg
    } else if (arg === '--app' && nextArg && !APPS[nextArg]) {
      console.warn(`⚠️ 未知的应用类型: ${nextArg}，使用默认的 admin`)
    }
  }

  return { app }
}

function getAppConfig(appType: string): AppConfig {
  const config = APPS[appType]
  if (!config) {
    throw new Error(`未知的应用类型: ${appType}`)
  }
  return config
}

function loadEnvFile(appConfig: AppConfig): void {
  APPS[appConfig.name].projectId =
    env[`APIFOX_${appConfig.name.toUpperCase()}_PROJECT_ID`] || ''
}

async function checkPortInUse(port: string): Promise<boolean> {
  try {
    const net = await import('node:net')
    return await new Promise((resolve) => {
      const socket = new net.Socket()
      socket.setTimeout(1000)
      socket.on('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.on('timeout', () => {
        socket.destroy()
        resolve(false)
      })
      socket.on('error', () => {
        socket.destroy()
        resolve(false)
      })
      socket.connect(Number(port), '127.0.0.1')
    })
  } catch {
    return false
  }
}

let startedProcessId: number | null = null

async function startApp(startCommand: string): Promise<void> {
  console.log('📦 应用未运行，正在启动...')
  const { spawn } = await import('node:child_process')

  const child = spawn('pnpm', [startCommand], {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: true,
    shell: true,
  })

  child.on('spawn', () => {
    startedProcessId = child.pid || null
    console.log('✅ 应用启动命令已执行 (PID:', startedProcessId, ')')
  })

  child.on('error', (error) => {
    console.error('❌ 启动应用失败:', error)
  })
}

async function getOpenAPIDocument(
  port: string,
  swaggerPath: string,
): Promise<any> {
  const baseUrl = `http://127.0.0.1:${port}`
  const swaggerUrl = `${baseUrl}/${swaggerPath}`

  console.log(`📡 正在从 ${swaggerUrl} 获取 OpenAPI 文档...`)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(swaggerUrl, {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    console.log('✅ 成功获取 OpenAPI 文档')
    return data
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ 获取文档失败: ${error.message}`)
    }
    throw error
  }
}

async function publishToApifox(
  openAPIDoc: any,
  appConfig: AppConfig,
): Promise<void> {
  try {
    console.log(`📤 正在发送 ${appConfig.name} OpenAPI 文档到 Apifox...`)
    console.log(`🔗 API 地址: ${APIFOX_OPENAPI_URL}`)

    const postData = {
      input: JSON.stringify(openAPIDoc),
      options: {
        deleteUnmatchedResources: true,
      },
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    const response = await fetch(
      APIFOX_OPENAPI_URL.replace('PROJECT_ID', appConfig.projectId),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Apifox-Api-Version': '2024-03-28',
          "Authorization": `Bearer ${env.APIFOX_API_KEY}`,
        },
        body: JSON.stringify(postData),
        signal: controller.signal,
      },
    )

    clearTimeout(timeoutId)

    const responseData = await response.json()

    if (!response.ok) {
      console.error('❌ 发布失败!')
      console.error(`状态码: ${response.status}`)
      console.error(`响应数据:`, responseData)
      throw new Error(`HTTP ${response.status}`)
    }

    console.log('✅ 成功发布到 Apifox!')
    console.log('📊 响应数据:', JSON.stringify(responseData, null, 2))
    console.log('🚀 ~ publishToApifox ~ response:', responseData)
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ 发布失败!')
      console.error(`错误信息: ${error.message}`)
    } else {
      console.error('❌ 未知错误:', error)
    }
    throw error
  }
}

async function waitForAppReady(
  port: string,
  maxAttempts = 30,
): Promise<boolean> {
  console.log('⏳ 等待应用启动...')
  for (let i = 0; i < maxAttempts; i++) {
    const isReady = await checkPortInUse(port)
    if (isReady) {
      console.log('✅ 应用已就绪!')
      await new Promise((resolve) => setTimeout(resolve, 2000))
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log(`⏳ 等待中... (${i + 1}/${maxAttempts})`)
  }
  console.error('❌ 应用启动超时')
  return false
}

async function stopStartedApp(): Promise<void> {
  if (startedProcessId) {
    console.log(`🔚 正在停止脚本启动的应用进程 (PID: ${startedProcessId})...`)
    try {
      await new Promise<void>((resolve, reject) => {
        kill(startedProcessId!, 'SIGTERM', (err) => {
          if (err) {
            console.error(`❌ 停止进程失败 (PID: ${startedProcessId}):`, err)
            reject(err)
          } else {
            console.log(`✅ 已成功停止进程 (PID: ${startedProcessId})`)
            resolve()
          }
        })
      })
      startedProcessId = null
    } catch (error) {
      console.error(`❌ 停止进程失败 (PID: ${startedProcessId}):`, error)
    }
  }
}

async function main() {
  const { app } = parseArgs()
  const appConfig = getAppConfig(app)

  console.log(`🚀 开始发布 ${appConfig.name}-api 文档到 Apifox...`)

  loadEnvFile(appConfig)

  let isAppStartedByScript = false

  try {
    const port = env.APP_PORT || appConfig.port
    const isPortInUse = await checkPortInUse(port)

    if (isPortInUse) {
      console.log(`✅ 检测到应用已在端口 ${port} 运行`)
    } else {
      console.log(`⚠️ 端口 ${port} 未检测到运行中的应用`)
      await startApp(appConfig.startCommand)
      const isReady = await waitForAppReady(port)
      if (!isReady) {
        throw new Error('应用启动失败')
      }
      isAppStartedByScript = true
    }

    const openAPIDoc = await getOpenAPIDocument(port, appConfig.swaggerPath)
    console.log(`📋 API 数量: ${Object.keys(openAPIDoc.paths || {}).length}`)

    await publishToApifox(openAPIDoc, appConfig)
    console.log('🎉 所有操作完成!')
  } catch (error) {
    console.error('❌ 执行失败:', error)
    process.exit(1)
  } finally {
    if (isAppStartedByScript) {
      await stopStartedApp()
    } else {
      console.log('🔚 应用是手动启动的，不停止')
    }
  }
}

void main()
