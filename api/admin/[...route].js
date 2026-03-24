import process from 'node:process'
import { handleAdminApiRequest } from '../../server/adminApi.js'
import { createNodeRequest, sendNodeResponse } from '../../server/nodeAdapter.js'

export default async function handler(req, res) {
  const request = await createNodeRequest(req)
  const response = await handleAdminApiRequest(request, process.env)
  await sendNodeResponse(res, response)
}
