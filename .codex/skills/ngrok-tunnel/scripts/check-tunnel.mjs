#!/usr/bin/env node

const DEFAULT_API = process.env.NGROK_API_URL ?? 'http://127.0.0.1:4040/api/tunnels'
const DEFAULT_WAIT_SECONDS = 0
const REQUEST_TIMEOUT_MS = 10_000

function usage() {
  console.log(`Usage: check-tunnel.mjs [options]

Options:
  --api <url>       ngrok local tunnels API (default: ${DEFAULT_API})
  --wait <seconds>  wait for a tunnel to appear (default: ${DEFAULT_WAIT_SECONDS})
  --verify          request the public URL and require a 2xx or 3xx response
  --help            show this help`)
}

function parseNonNegativeNumber(value, option) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${option} must be a non-negative number`)
  }
  return number
}

function parseArgs(argv) {
  const options = {
    api: DEFAULT_API,
    waitSeconds: DEFAULT_WAIT_SECONDS,
    verify: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--help') {
      usage()
      process.exit(0)
    }
    if (argument === '--verify') {
      options.verify = true
      continue
    }
    if (argument === '--api' || argument === '--wait') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error(`${argument} requires a value`)
      }
      index += 1
      if (argument === '--api') {
        options.api = value
      } else {
        options.waitSeconds = parseNonNegativeNumber(value, argument)
      }
      continue
    }

    throw new Error(`unknown option: ${argument}`)
  }

  return options
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`ngrok API returned HTTP ${response.status}`)
  }
  return response.json()
}

function selectTunnel(payload) {
  const tunnels = Array.isArray(payload?.tunnels) ? payload.tunnels : []
  return (
    tunnels.find((tunnel) => tunnel?.proto === 'https' && tunnel?.public_url) ??
    tunnels.find((tunnel) => tunnel?.public_url)
  )
}

async function waitForTunnel(api, waitSeconds) {
  const deadline = Date.now() + waitSeconds * 1000
  let lastError

  do {
    try {
      const tunnel = selectTunnel(await fetchJson(api))
      if (tunnel) {
        return tunnel
      }
      lastError = new Error('ngrok API has no active tunnels')
    } catch (error) {
      lastError = error
    }

    if (Date.now() >= deadline) {
      break
    }
    await delay(Math.min(500, Math.max(0, deadline - Date.now())))
  } while (Date.now() <= deadline)

  throw lastError ?? new Error('no active ngrok tunnel found')
}

function localTarget(tunnel) {
  return tunnel?.config?.addr ?? tunnel?.forwards_to ?? 'unknown'
}

async function verifyPublicUrl(publicUrl) {
  const response = await fetch(publicUrl, {
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (response.status < 200 || response.status >= 400) {
    throw new Error(`public URL returned HTTP ${response.status}`)
  }
  return response.status
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const tunnel = await waitForTunnel(options.api, options.waitSeconds)

  console.log(`public_url=${tunnel.public_url}`)
  console.log(`local_url=${localTarget(tunnel)}`)

  if (options.verify) {
    const status = await verifyPublicUrl(tunnel.public_url)
    console.log(`status_code=${status}`)
    console.log('verified=true')
  }
}

main().catch((error) => {
  console.error(`error=${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
