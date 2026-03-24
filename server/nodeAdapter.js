import { Buffer } from 'node:buffer'

export async function createNodeRequest(req) {
  const body = await readRequestBody(req)
  const protocol = req.socket?.encrypted ? 'https' : 'http'
  const host = req.headers.host || 'localhost'
  const url = `${protocol}://${host}${req.url}`

  return new Request(url, {
    method: req.method,
    headers: req.headers,
    body: body.length > 0 ? body : undefined
  })
}

export async function sendNodeResponse(res, response) {
  res.statusCode = response.status

  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })

  const buffer = Buffer.from(await response.arrayBuffer())
  res.end(buffer)
}

async function readRequestBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return Buffer.alloc(0)
  }

  return new Promise((resolve, reject) => {
    const chunks = []

    req.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk))
    })

    req.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    req.on('error', reject)
  })
}
