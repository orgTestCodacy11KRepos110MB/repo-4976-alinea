import {
  Config,
  createError,
  createId,
  Entry,
  entryFromDoc,
  Future,
  Hub,
  Media,
  outcome,
  Workspace,
  Workspaces
} from '@alineacms/core'
import {generateKeyBetween} from '@alineacms/core/util/FractionalIndexing'
import {Cursor, Store} from '@alineacms/store'
import {encode} from 'base64-arraybuffer'
import md5 from 'md5'
import {posix as path} from 'path'
import * as Y from 'yjs'
import {Cache} from './Cache'
import {Data} from './Data'
import {Drafts} from './Drafts'
import {Pages} from './Pages'
import {Previews} from './Previews'
import {PreviewStore, previewStore} from './PreviewStore'
import {parentUrl, walkUrl} from './util/Urls'

export type BackendOptions<T extends Workspaces> = {
  config: Config<T>
  createStore: () => Promise<Store>
  drafts: Drafts
  target: Data.Target
  media: Data.Media
  previews: Previews
}

export class Backend<T extends Workspaces = Workspaces> implements Hub<T> {
  config: Config<T>
  preview: PreviewStore
  createStore: () => Promise<Store>

  constructor(public options: BackendOptions<T>) {
    this.config = options.config
    this.createStore = options.createStore
    this.preview = previewStore(
      () => this.createStore(),
      options.config,
      options.drafts
    )
  }

  async entry(
    id: string,
    stateVector?: Uint8Array
  ): Future<Entry.Detail | null> {
    const {config, drafts, previews} = this.options
    let draft = await drafts.get(id, stateVector)
    if (draft) {
      const doc = new Y.Doc()
      Y.applyUpdate(doc, draft)
      const isValidDraft = outcome.succeeds(() => entryFromDoc(config, doc))
      if (!isValidDraft) {
        console.log(`Removed invalid draft ${id}`)
        await drafts.delete([id])
        draft = undefined
      }
    }
    return outcome(async () => {
      const store = await this.preview.getStore()
      const entry = store.first(Entry.where(Entry.id.is(id)))
      return (
        entry && {
          entry,
          draft: draft && encode(draft),
          previewToken: previews.sign({id})
        }
      )
    })
  }

  async query<T>(cursor: Cursor<T>): Future<Array<T>> {
    return outcome(async () => {
      const store = await this.preview.getStore()
      return store.all(cursor)
    })
  }

  updateDraft(id: string, update: Uint8Array): Future<void> {
    const {drafts} = this.options
    return outcome(async () => {
      const instruction = await drafts.update(id, update)
      await this.preview.applyUpdate(instruction)
    })
  }

  deleteDraft(id: string): Future<void> {
    const {drafts} = this.options
    return outcome(async () => {
      await this.preview.deleteUpdate(id)
      return drafts.delete([id])
    })
  }

  publishEntries(entries: Array<Entry>): Future<void> {
    const {config, drafts, target} = this.options
    function applyPublish(store: Store) {
      Cache.applyPublish(store, config, entries)
      return store
    }
    return outcome(async () => {
      await target.publish(entries)
      const ids = entries.map(entry => entry.id)
      await drafts.delete(ids)
      const create = this.createStore
      this.createStore = () => create().then(applyPublish)
      await this.preview.deleteUpdates(ids)
    })
  }

  uploadFile(
    workspace: string,
    root: string,
    file: Hub.Upload
  ): Future<Media.File> {
    return outcome(async () => {
      const store = await this.preview.getStore()
      const id = createId()
      const {media} = this.options
      const parents = walkUrl(parentUrl(file.path)).map(url => {
        const parent = store.first(
          Entry.where(Entry.workspace.is(workspace))
            .where(Entry.root.is(root))
            .where(Entry.url.is(url))
            .select({id: Entry.id})
        )
        if (!parent) throw createError(400, `Parent not found: ${url}`)
        return parent.id
      })
      const parent = parents[parents.length - 1]
      if (!parent) throw createError(400, `Parent not found: "${file.path}"`)
      const location = await media.upload(workspace as string, file)
      const extension = path.extname(location)
      const prev = store.first(
        Entry.where(Entry.workspace.is(workspace))
          .where(Entry.root.is(root))
          .where(Entry.parent.is(parent))
      )
      const entry: Media.File = {
        id,
        type: 'File',
        index: generateKeyBetween(null, prev?.index || null),
        workspace: workspace as string,
        root: root as string,
        parent: parent,
        parents,
        title: path.basename(file.path, extension),
        url: file.path,
        location,
        extension: extension,
        size: file.buffer.byteLength,
        hash: md5(new Uint8Array(file.buffer)),
        preview: file.preview,
        averageColor: file.averageColor,
        blurHash: file.blurHash
      }
      await this.publishEntries([entry])
      return entry
    })
  }

  get drafts() {
    return this.options.drafts
  }

  loadPages<K extends keyof T>(workspaceKey: K, previewToken?: string) {
    const workspace = this.config.workspaces[workspaceKey]
    return new Pages<T[K] extends Workspace<infer X> ? X : any>(
      this.config,
      workspace,
      previewToken
        ? async () => {
            await this.parsePreviewToken(previewToken)
            return this.preview.getStore()
          }
        : this.createStore
    )
  }

  async parsePreviewToken(token: string): Promise<{id: string; url: string}> {
    const {previews} = this.options
    const [tokenData, err] = outcome(() => previews.verify(token))
    if (!tokenData) throw createError(400, 'Incorrect token')
    const {id} = tokenData
    const store = await this.preview.getStore()
    await this.preview.fetchUpdate(id)
    const entry = store.first(
      Entry.where(Entry.id.is(id)).select({id: Entry.id, url: Entry.url})
    )
    if (!entry) throw createError(404, 'Entry not found')
    return entry
  }
}
