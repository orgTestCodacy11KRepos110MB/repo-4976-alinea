import {schema, Schema, type} from '@alinea/core'
import {richText} from '@alinea/input.richtext'
import {CodeBlockSchema} from './CodeBlock.schema'
import {CodeVariantsBlockSchema} from './CodeVariantsBlock.schema'
import {ImageBlockSchema} from './ImageBlock.schema'
import {UnsplashBlockSchema} from './UnsplashBlock.schema'

export const TextBlockSchema = type('Body text', {
  text: richText('Text', {
    blocks: schema({
      CodeBlock: CodeBlockSchema,
      CodeVariantsBlock: CodeVariantsBlockSchema,
      ImageBlock: ImageBlockSchema,
      UnsplashBlock: UnsplashBlockSchema
    }),
    inline: true
  })
})

export type TextBlockSchema = Schema.TypeOf<typeof TextBlockSchema> & {
  id: string
  type: 'TextBlock'
}
