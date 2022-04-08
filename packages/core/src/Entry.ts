import {Collection} from '@alineacms/store'
import {Label} from './Label'

export type Id<T> = string & {__t: T}

export enum EntryStatus {
  Draft = 'draft',
  Published = 'published',
  Publishing = 'publishing',
  Archived = 'archived'
}

export interface Entry {
  id: string
  type: string
  title: Label
  index: string
  // Computed properties
  workspace: string
  root: string
  url: string
  $status?: EntryStatus
  parent?: string
  parents: Array<string>
  $isContainer?: boolean
}

export namespace Entry {
  export type Detail = {
    entry: Entry
    draft: string | undefined
    previewToken: string
  }
  export type Minimal = Pick<
    Entry,
    'id' | 'type' | 'workspace' | 'root' | 'url'
  >
  export type Summary = Pick<
    Entry,
    | 'id'
    | 'type'
    | 'title'
    | 'index'
    | 'workspace'
    | 'root'
    | 'url'
    | 'parent'
    | 'parents'
    | '$isContainer'
  > & {
    childrenCount: number
  }
  export type Raw = Omit<
    Entry,
    | 'workspace'
    | 'root'
    | 'url'
    | '$status'
    | 'parent'
    | 'parents'
    | '$isContainer'
  >
}

export const Entry = new Collection<Entry>('Entry')
