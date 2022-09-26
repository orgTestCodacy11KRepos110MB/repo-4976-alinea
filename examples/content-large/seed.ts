import {JsonLoader} from '@alinea/backend'
import {FileData} from '@alinea/backend/data/FileData'
import {Storage} from '@alinea/backend/Storage'
import {config} from '@alinea/content/config.js'
import {createStore} from '@alinea/content/store.js'
import {createId, Entry, slugify} from '@alinea/core'
import {Chance} from 'chance'
import {promises as fs} from 'node:fs'

const chance = Chance()

const data = new FileData({
  config,
  fs,
  loader: JsonLoader,
  rootDir: process.cwd()
})

function toEntry(
  workspace: string,
  data: Partial<Entry & Record<string, any>>
): Entry {
  const id = data.id || createId()
  const title = chance.sentence({words: Math.round(Math.random() * 6)})
  const path = slugify(title) + '-' + id
  return {
    id,
    type: 'Page',
    path,
    url: undefined!,
    title,
    ...data,
    alinea: {
      parent: data.parents ? data.parents[data.parents.length - 1] : undefined,
      parents: data.parents || [],
      workspace,
      root: 'data',
      index: 'a0',
      i18n: undefined
    }
  }
}

function createEntry(...parents: Array<string>) {
  return () => {
    const id = createId()
    return toEntry('main', {
      id,
      content: [
        {
          type: 'paragraph',
          textAlign: 'left',
          content: [
            {
              type: 'text',
              text: chance.paragraph()
            }
          ]
        }
      ],
      parents
    })
  }
}

async function main() {
  const store = await createStore()
  const changes = await Storage.publishChanges(
    config,
    store,
    JsonLoader,
    Array.from({length: 100})
      .map(createEntry('xHdbCGvsMXq_4_EJvtyJ4', 'EUiA_Brf4qygOGe1S3Ou1'))
      .concat(
        Array.from({length: 250}).map(
          createEntry('xHdbCGvsMXq_4_EJvtyJ4', 'E6J4wZuFM9C2hKUlpvdgz')
        )
      )
      .concat(
        Array.from({length: 1000}).map(
          createEntry('xHdbCGvsMXq_4_EJvtyJ4', '4OEcWKHP-wCftR0rmwtwj')
        )
      )
      .concat(
        Array.from({length: 3000}).map(
          createEntry('xHdbCGvsMXq_4_EJvtyJ4', '6I3Dz8TCo2nxPor3kKx2V')
        )
      ),
    false
  )
  return data.publish({
    changes
  })
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
