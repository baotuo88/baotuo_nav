const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
}

const GITHUB_API_BASE = 'https://api.github.com'
const ADMIN_COOKIE_NAME = 'btnav_admin_session'
const SESSION_TTL_SECONDS = 60 * 60 * 8
const REQUEST_GUARD_HEADER = 'x-btnav-request'
const REQUEST_GUARD_VALUE = '1'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

class ApiError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', status = 500) {
    super(message)
    this.code = code
    this.status = status
  }
}

export async function handleAdminApiRequest(request, runtimeEnv = {}) {
  try {
    const url = new URL(request.url)
    const route = url.pathname.replace(/^\/api\/admin\/?/, '')
    const config = getRuntimeConfig(runtimeEnv)

    switch (route) {
      case 'session':
        return handleSessionRoute(request, config)
      case 'config':
        return handleConfigRoute(config)
      case 'github':
        return handleGitHubRoute(request, config)
      case 'navigation':
        return handleNavigationRoute(request, config)
      case 'files':
        return handleFilesRoute(request, config)
      default:
        throw new ApiError('未找到对应的管理接口', 'NOT_FOUND', 404)
    }
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR'
    const message = error instanceof Error ? error.message : '服务端处理失败'
    return jsonResponse({ error: message, code }, { status })
  }
}

async function handleSessionRoute(request, config) {
  if (request.method === 'GET') {
    const authenticated = await isAuthenticated(request, config.sessionSecret)
    return jsonResponse({ authenticated })
  }

  if (request.method === 'POST') {
    assertMutationRequest(request)

    if (!config.adminPassword) {
      throw new ApiError('管理员密码未配置，请在服务端环境变量中设置 ADMIN_PASSWORD', 'ADMIN_PASSWORD_MISSING', 503)
    }

    const { password = '' } = await readJsonBody(request)
    if (password !== config.adminPassword) {
      throw new ApiError('密钥错误，请重新输入', 'INVALID_PASSWORD', 401)
    }

    const token = await createSessionToken(config.sessionSecret)
    const secure = new URL(request.url).protocol === 'https:'

    return jsonResponse(
      { authenticated: true },
      {
        headers: {
          'set-cookie': serializeCookie(ADMIN_COOKIE_NAME, token, {
            maxAge: SESSION_TTL_SECONDS,
            secure
          })
        }
      }
    )
  }

  if (request.method === 'DELETE') {
    assertMutationRequest(request)

    const secure = new URL(request.url).protocol === 'https:'
    return jsonResponse(
      { authenticated: false },
      {
        headers: {
          'set-cookie': serializeCookie(ADMIN_COOKIE_NAME, '', {
            maxAge: 0,
            secure
          })
        }
      }
    )
  }

  throw new ApiError('不支持的请求方法', 'METHOD_NOT_ALLOWED', 405)
}

function handleConfigRoute(config) {
  return jsonResponse({
    adminPasswordConfigured: Boolean(config.adminPassword),
    githubTokenConfigured: Boolean(config.githubToken),
    githubOwner: config.githubOwner,
    githubRepo: config.githubRepo,
    githubBranch: config.githubBranch,
    githubConfigured: isGitHubConfigured(config)
  })
}

async function handleGitHubRoute(request, config) {
  await requireAuthentication(request, config)

  return jsonResponse(await verifyGitHubConnection(config))
}

async function handleNavigationRoute(request, config) {
  await requireAuthentication(request, config)

  if (request.method === 'GET') {
    return jsonResponse(await loadNavigationData(config))
  }

  if (request.method === 'PUT') {
    assertMutationRequest(request)
    const payload = sanitizeNavigationPayload(await readJsonBody(request))
    const result = await saveNavigationData(config, payload)
    return jsonResponse(result)
  }

  throw new ApiError('不支持的请求方法', 'METHOD_NOT_ALLOWED', 405)
}

async function handleFilesRoute(request, config) {
  await requireAuthentication(request, config)
  assertMutationRequest(request)

  if (request.method !== 'PUT') {
    throw new ApiError('不支持的请求方法', 'METHOD_NOT_ALLOWED', 405)
  }

  const { path = '', contentBase64 = '', message = '' } = await readJsonBody(request)
  assertAllowedAssetPath(path)

  if (!contentBase64) {
    throw new ApiError('缺少文件内容', 'MISSING_FILE_CONTENT', 400)
  }

  const binary = base64ToBytes(contentBase64)
  const response = await uploadBinaryFile(path, binary.buffer, message || `chore: 更新文件 ${path}`, config)

  return jsonResponse({
    ok: true,
    path,
    response
  })
}

function sanitizeNavigationPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ApiError('导航数据格式无效', 'INVALID_NAVIGATION_PAYLOAD', 400)
  }

  if (!Array.isArray(data.categories)) {
    throw new ApiError('导航分类数据缺失', 'INVALID_NAVIGATION_CATEGORIES', 400)
  }

  const searchEngines = ['google', 'baidu', 'bing', 'duckduckgo']
  const search = searchEngines.includes(data.search) ? data.search : 'bing'

  return {
    categories: data.categories,
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : '宝拓导航',
    search
  }
}

function getRuntimeConfig(runtimeEnv) {
  const adminPassword = readEnv(runtimeEnv, 'ADMIN_PASSWORD', 'VITE_ADMIN_PASSWORD')
  const githubToken = readEnv(runtimeEnv, 'GITHUB_TOKEN', 'VITE_GITHUB_TOKEN')
  const githubOwner = readEnv(runtimeEnv, 'GITHUB_OWNER', 'VITE_GITHUB_OWNER')
  const githubRepo = readEnv(runtimeEnv, 'GITHUB_REPO', 'VITE_GITHUB_REPO')
  const githubBranch = readEnv(runtimeEnv, 'GITHUB_BRANCH', 'VITE_GITHUB_BRANCH')
  const sessionSecret = readEnv(runtimeEnv, 'ADMIN_SESSION_SECRET') || adminPassword

  return {
    adminPassword,
    sessionSecret,
    githubToken,
    githubOwner,
    githubRepo,
    githubBranch
  }
}

function readEnv(runtimeEnv, ...keys) {
  for (const key of keys) {
    const runtimeValue = runtimeEnv?.[key]
    if (typeof runtimeValue === 'string' && runtimeValue.trim()) {
      return runtimeValue.trim()
    }

    const processValue = globalThis.process?.env?.[key]
    if (typeof processValue === 'string' && processValue.trim()) {
      return processValue.trim()
    }
  }

  return ''
}

function isGitHubConfigured(config) {
  return Boolean(config.githubToken && config.githubOwner && config.githubRepo && config.githubBranch)
}

async function requireAuthentication(request, config) {
  if (!config.sessionSecret) {
    throw new ApiError('管理员密码未配置，请先设置服务端环境变量', 'ADMIN_PASSWORD_MISSING', 503)
  }

  const authenticated = await isAuthenticated(request, config.sessionSecret)
  if (!authenticated) {
    throw new ApiError('登录状态已失效，请重新登录', 'UNAUTHORIZED', 401)
  }
}

function assertMutationRequest(request) {
  if (request.headers.get(REQUEST_GUARD_HEADER) !== REQUEST_GUARD_VALUE) {
    throw new ApiError('非法请求来源', 'INVALID_REQUEST_SOURCE', 403)
  }
}

async function isAuthenticated(request, sessionSecret) {
  if (!sessionSecret) {
    return false
  }

  const token = getCookieValue(request.headers.get('cookie'), ADMIN_COOKIE_NAME)
  if (!token) {
    return false
  }

  return verifySessionToken(token, sessionSecret)
}

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return ''

  const cookies = cookieHeader.split(';')
  for (const entry of cookies) {
    const [rawKey, ...rest] = entry.trim().split('=')
    if (rawKey === name) {
      return rest.join('=')
    }
  }

  return ''
}

function serializeCookie(name, value, { maxAge, secure }) {
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict'
  ]

  if (typeof maxAge === 'number') {
    parts.push(`Max-Age=${maxAge}`)
  }

  if (secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

async function createSessionToken(secret) {
  const nonce = new Uint8Array(12)
  crypto.getRandomValues(nonce)

  const payload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    nonce: bytesToBase64Url(nonce)
  }

  const encodedPayload = stringToBase64Url(JSON.stringify(payload))
  const signature = await signValue(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

async function verifySessionToken(token, secret) {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) {
    return false
  }

  const validSignature = await verifyValue(encodedPayload, signature, secret)
  if (!validSignature) {
    return false
  }

  try {
    const payload = JSON.parse(base64UrlToString(encodedPayload))
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

async function signValue(value, secret) {
  const key = await importHmacKey(secret, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return bytesToBase64Url(new Uint8Array(signature))
}

async function verifyValue(value, signature, secret) {
  const key = await importHmacKey(secret, ['verify'])
  return crypto.subtle.verify('HMAC', key, base64UrlToBytes(signature), encoder.encode(value))
}

async function importHmacKey(secret, usages) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  )
}

function stringToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value))
}

function base64UrlToString(value) {
  return decoder.decode(base64UrlToBytes(value))
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
  return base64ToBytes(padded)
}

function bytesToBase64(bytes) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function base64ToBytes(value) {
  const sanitized = value.replace(/\s+/g, '')
  const binary = atob(sanitized)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function jsonResponse(data, init = {}) {
  const headers = new Headers(JSON_HEADERS)

  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value)
    })
  }

  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers
  })
}

async function readJsonBody(request) {
  try {
    return await request.json()
  } catch {
    throw new ApiError('请求体不是有效的 JSON', 'INVALID_JSON_BODY', 400)
  }
}

function assertGitHubConfigured(config) {
  if (!isGitHubConfigured(config)) {
    throw new ApiError('GitHub 服务未完整配置，请检查服务端环境变量', 'GITHUB_NOT_CONFIGURED', 503)
  }
}

async function verifyGitHubConnection(config) {
  if (!isGitHubConfigured(config)) {
    return {
      connected: false,
      error: 'GitHub 服务未完整配置',
      repo: ''
    }
  }

  try {
    const response = await githubFetch(`/repos/${config.githubOwner}/${config.githubRepo}`, config)
    const repoInfo = await response.json()

    return {
      connected: true,
      repo: repoInfo.full_name,
      permissions: repoInfo.permissions
    }
  } catch (error) {
    return {
      connected: false,
      error: error.message
    }
  }
}

async function loadNavigationData(config) {
  assertGitHubConfigured(config)

  const file = await getFileContent('src/mock/mock_data.js', config)
  const exportMatch = file.content.match(/export const mockData = ({[\s\S]*})/)

  if (!exportMatch) {
    throw new ApiError('无法解析 mock_data.js 文件格式', 'INVALID_MOCK_DATA_FILE', 500)
  }

  const data = JSON.parse(exportMatch[1])
  return {
    ...data,
    _fileSha: file.sha
  }
}

async function saveNavigationData(config, data) {
  assertGitHubConfigured(config)

  const currentFile = await getFileContent('src/mock/mock_data.js', config)
  const content = generateMockDataContent(data)
  const message = `chore: 更新导航数据 - ${new Date().toLocaleString('zh-CN')}`

  return updateFileContent('src/mock/mock_data.js', content, message, currentFile.sha, config)
}

function generateMockDataContent(data) {
  return `export const mockData = ${JSON.stringify(data, null, 2)}\n`
}

async function getFileContent(path, config, isBinaryFile = false) {
  assertGitHubConfigured(config)
  const encodedPath = encodeGitHubPath(path)
  const response = await githubFetch(`/repos/${config.githubOwner}/${config.githubRepo}/contents/${encodedPath}`, config)
  const data = await response.json()

  if (!data.content) {
    throw new ApiError('GitHub 文件内容为空', 'EMPTY_GITHUB_CONTENT', 500)
  }

  return {
    content: isBinaryFile ? data.content : decoder.decode(base64ToBytes(data.content)),
    sha: data.sha,
    path: data.path
  }
}

async function updateFileContent(path, content, message, sha, config) {
  assertGitHubConfigured(config)
  const encodedPath = encodeGitHubPath(path)

  const response = await githubFetch(
    `/repos/${config.githubOwner}/${config.githubRepo}/contents/${encodedPath}`,
    config,
    {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: bytesToBase64(encoder.encode(content)),
        sha,
        branch: config.githubBranch
      })
    }
  )

  return response.json()
}

async function uploadBinaryFile(path, arrayBuffer, message, config) {
  assertGitHubConfigured(config)

  let sha = null
  try {
    const existingFile = await getFileContent(path, config, true)
    sha = existingFile.sha
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error
    }
  }

  const encodedPath = encodeGitHubPath(path)
  const body = {
    message,
    content: bytesToBase64(new Uint8Array(arrayBuffer)),
    branch: config.githubBranch
  }

  if (sha) {
    body.sha = sha
  }

  const response = await githubFetch(
    `/repos/${config.githubOwner}/${config.githubRepo}/contents/${encodedPath}`,
    config,
    {
      method: 'PUT',
      body: JSON.stringify(body)
    }
  )

  return response.json()
}

function encodeGitHubPath(path) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/')
}

async function githubFetch(path, config, init = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${config.githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'baotuo_nav',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {})
      },
      signal: controller.signal
    })

    if (!response.ok) {
      let message = `GitHub 请求失败 (${response.status})`
      const responseText = await response.clone().text()

      try {
        const errorData = responseText ? JSON.parse(responseText) : null
        if (errorData?.message) {
          message = `GitHub API Error: ${errorData.message}`
        }
      } catch (parseError) {
        void parseError
        if (responseText.trim()) {
          message = `GitHub 响应异常 (${response.status}): ${responseText.trim().slice(0, 240)}`
        }
      }

      throw new ApiError(message, 'GITHUB_REQUEST_FAILED', response.status)
    }

    return response
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError('GitHub 请求超时，请检查网络连接', 'GITHUB_TIMEOUT', 504)
    }

    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(error.message || 'GitHub 请求失败', 'GITHUB_REQUEST_FAILED', 502)
  } finally {
    clearTimeout(timeoutId)
  }
}

function assertAllowedAssetPath(path) {
  const allowed = /^public\/(?:logo\.png|sitelogo\/[a-zA-Z0-9._-]+\.(?:ico|png|svg|webp))$/
  if (!allowed.test(path)) {
    throw new ApiError('不允许写入该文件路径', 'INVALID_ASSET_PATH', 400)
  }
}
