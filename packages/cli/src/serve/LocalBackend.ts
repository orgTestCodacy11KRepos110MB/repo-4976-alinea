import {nodeHandler} from '@alinea/backend/router/NodeHandler'
import {createError} from '@alinea/core/ErrorWithCode'
import http, {IncomingMessage, ServerResponse} from 'node:http'
import path from 'node:path'
import {parentPort} from 'node:worker_threads'
import {DevBackend} from './DevBackend'

const parent = parentPort
if (!parent) throw createError('Not in thread')

export type LocalBackendContext = {
  rootDir: string
  port: number
}

let server: http.Server

parent.on('message', (message: any) => {
  if (message === 'close') {
    server.close()
  } else {
    const context: LocalBackendContext = message
    const backend = createBackendHandler(context)
    server = http
      .createServer(
        async (request: IncomingMessage, response: ServerResponse) => {
          const handler = await backend
          return handler(request, response)
        }
      )
      .listen(0, () => {
        const address = server.address()
        if (address && typeof address === 'object') {
          console.log(`> Worker listening on ${address.port}`)
          parent.postMessage(address.port)
        } else {
          server.close()
        }
      })
  }
})

async function createBackendHandler(context: LocalBackendContext) {
  const {rootDir, port} = context
  const outputDir = path.join(rootDir, '.alinea')
  const {config} = await import(`file://${outputDir}/config.js`)
  const {createStore} = await import(`file://${outputDir}/store.js`)
  const {createStore: createDraftStore} = await import(
    `file://${outputDir}/store.js`
  )
  const backend = new DevBackend({
    config,
    createStore,
    port,
    cwd: rootDir,
    createDraftStore
  })
  return nodeHandler(backend.handle)
}
