import {channel, createSchema, DataOf} from '@alinea/core'
import {text} from '@alinea/input.text'

export const schema = createSchema({
  Home: channel('Home', {
    title: text('Title', {multiline: true}),
    headline: text('Headline', {multiline: true})
  })
})

export const {Home} = schema.channels

export type Home = DataOf<typeof Home>
