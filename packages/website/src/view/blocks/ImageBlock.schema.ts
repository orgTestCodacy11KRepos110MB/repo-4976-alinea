import {Schema, type} from '@alineacms/core'
import {link} from '@alineacms/input.link'

export const ImageBlockSchema = type('Image', {
  image: link('Link', {type: 'image', max: 1, inline: true})
})

export type ImageBlockSchema = Schema.TypeOf<typeof ImageBlockSchema>

/*export function queryImageBlock(Entry: Collection<ImageBlockSchema>) {
  return {
    images: Entry.where(Entry.id.isIn(
      Entry.image.i
    ))
  }
}
*/
