import {Field} from '@alineacms/core'
import {createRichText} from './RichTextField'
import {RichTextInput} from './RichTextInput'
export * from './RichTextField'
export * from './RichTextInput'
export const richText = Field.withView(createRichText, RichTextInput)
