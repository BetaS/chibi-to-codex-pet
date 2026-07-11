import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

export function sitesStaticHostingPlugin(repositoryRoot: string): Plugin {
  return {
    name: 'sites-static-hosting',
    apply: 'build',
    async closeBundle() {
      const outputRoot = resolve(repositoryRoot, 'dist')
      const clientRoot = resolve(outputRoot, 'client')
      const serverRoot = resolve(outputRoot, 'server')

      await rm(clientRoot, { recursive: true, force: true })
      await mkdir(clientRoot, { recursive: true })

      const entries = await readdir(outputRoot, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === 'client' || entry.name === 'server') continue
        await cp(
          resolve(outputRoot, entry.name),
          resolve(clientRoot, entry.name),
          { recursive: entry.isDirectory() },
        )
      }

      await rm(serverRoot, { recursive: true, force: true })
      await mkdir(serverRoot, { recursive: true })
      await cp(
        resolve(repositoryRoot, 'worker/sites-static.js'),
        resolve(serverRoot, 'index.js'),
      )
    },
  }
}
