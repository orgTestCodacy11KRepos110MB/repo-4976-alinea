import {createContext, useContext} from 'react'
import {EntryDraft} from '../draft/EntryDraft'

const context = createContext<EntryDraft | undefined>(undefined)

export function useCurrentDraft(): EntryDraft {
  return useContext(context)!
}

export const CurrentDraftProvider = context.Provider
