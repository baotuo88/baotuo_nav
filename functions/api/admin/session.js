import { handleAdminApiRequest } from '../../../server/adminApi.js'

export async function onRequest(context) {
  return handleAdminApiRequest(context.request, context.env)
}
