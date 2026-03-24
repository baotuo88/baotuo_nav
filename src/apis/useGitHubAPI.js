const API_BASE = '/api/admin'
const REQUEST_GUARD_HEADER = 'x-btnav-request'
const REQUEST_GUARD_VALUE = '1'

function createApiError(message, status, code) {
  const error = new Error(message || '请求失败')
  error.status = status
  error.code = code
  return error
}

async function parseJson(response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    throw createApiError('服务端返回了无效 JSON', response.status, 'INVALID_JSON_RESPONSE')
  }
}

async function request(path, init = {}) {
  const method = init.method || 'GET'
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
  const headers = new Headers(init.headers || {})

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (isMutation) {
    headers.set(REQUEST_GUARD_HEADER, REQUEST_GUARD_VALUE)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    method,
    headers
  })

  const data = await parseJson(response)

  if (!response.ok) {
    throw createApiError(data?.error || `请求失败 (${response.status})`, response.status, data?.code)
  }

  return data
}

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function arrayBufferToBase64(arrayBuffer) {
  return bytesToBase64(new Uint8Array(arrayBuffer))
}

export function useGitHubAPI() {
  const getAdminSession = async () => {
    return request('/session')
  }

  const loginAdmin = async (password) => {
    return request('/session', {
      method: 'POST',
      body: JSON.stringify({ password })
    })
  }

  const logoutAdmin = async () => {
    return request('/session', {
      method: 'DELETE'
    })
  }

  const getServerConfig = async () => {
    return request('/config')
  }

  const verifyGitHubConnection = async () => {
    return request('/github')
  }

  const loadCategoriesFromGitHub = async () => {
    return request('/navigation')
  }

  const saveCategoriesToGitHub = async (data) => {
    return request('/navigation', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  const uploadBinaryFile = async (path, binaryData, message) => {
    return request('/files', {
      method: 'PUT',
      body: JSON.stringify({
        path,
        contentBase64: arrayBufferToBase64(binaryData),
        message
      })
    })
  }

  return {
    getAdminSession,
    loginAdmin,
    logoutAdmin,
    getServerConfig,
    verifyGitHubConnection,
    loadCategoriesFromGitHub,
    saveCategoriesToGitHub,
    uploadBinaryFile
  }
}
