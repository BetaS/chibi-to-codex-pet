import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const RUNTIME_PUBLIC_ROOT = '/vendor/estertion-spine-3.6'
const RUNTIME_OUTPUT_ROOT = 'vendor/estertion-spine-3.6'

interface StaticResource {
  contentType: string
  fileName: string
  outputName: string
  publicPath: string
}

function sendFile(
  response: ServerResponse,
  filePath: string,
  contentType: string,
): void {
  try {
    const body = readFileSync(filePath)
    response.statusCode = 200
    response.setHeader('Content-Type', contentType)
    response.setHeader('Cache-Control', 'no-store')
    response.end(body)
  } catch {
    response.statusCode = 404
    response.end('Not found')
  }
}

function requestPath(request: IncomingMessage): string | null {
  if (!request.url) return null

  try {
    return new URL(request.url, 'http://localhost').pathname
  } catch {
    return null
  }
}

export function localResourcePlugin(repositoryRoot: string): Plugin {
  const runtimeRoot = resolve(
    repositoryRoot,
    'third_party/estertion-spine-3.6',
  )
  const noticesPath = resolve(repositoryRoot, 'THIRD_PARTY_NOTICES.md')
  const resources: StaticResource[] = [
    {
      publicPath: `${RUNTIME_PUBLIC_ROOT}/spine-webgl.js`,
      fileName: resolve(runtimeRoot, 'spine-webgl.js'),
      outputName: `${RUNTIME_OUTPUT_ROOT}/spine-webgl.js`,
      contentType: 'text/javascript; charset=utf-8',
    },
    {
      publicPath: `${RUNTIME_PUBLIC_ROOT}/LICENSE`,
      fileName: resolve(runtimeRoot, 'LICENSE'),
      outputName: `${RUNTIME_OUTPUT_ROOT}/LICENSE`,
      contentType: 'text/plain; charset=utf-8',
    },
    {
      publicPath: `${RUNTIME_PUBLIC_ROOT}/THIRD_PARTY_NOTICES.md`,
      fileName: noticesPath,
      outputName: `${RUNTIME_OUTPUT_ROOT}/THIRD_PARTY_NOTICES.md`,
      contentType: 'text/markdown; charset=utf-8',
    },
  ]

  return {
    name: 'livesd-local-resources',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = requestPath(request)
        if (!pathname) {
          next()
          return
        }

        const resource = resources.find(
          (candidate) => candidate.publicPath === pathname,
        )
        if (resource) {
          sendFile(response, resource.fileName, resource.contentType)
          return
        }

        next()
      })
    },
    generateBundle() {
      for (const resource of resources) {
        this.emitFile({
          type: 'asset',
          fileName: resource.outputName,
          source: readFileSync(resource.fileName),
        })
      }
    },
  }
}
