import { useGitHubAPI } from './useGitHubAPI.js'

const { getAdminSession } = useGitHubAPI()

let cachedAuthenticated = null
let pendingSessionRequest = null

export async function checkAdminSession({ force = false } = {}) {
  if (!force && typeof cachedAuthenticated === 'boolean') {
    return cachedAuthenticated
  }

  if (pendingSessionRequest) {
    return pendingSessionRequest
  }

  pendingSessionRequest = getAdminSession()
    .then((session) => {
      cachedAuthenticated = Boolean(session?.authenticated)
      return cachedAuthenticated
    })
    .finally(() => {
      pendingSessionRequest = null
    })

  return pendingSessionRequest
}

export function setAdminSessionAuthenticated(value) {
  cachedAuthenticated = Boolean(value)
}

export function resetAdminSessionCache() {
  cachedAuthenticated = null
}
