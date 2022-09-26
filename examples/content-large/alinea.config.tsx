import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundPermMedia} from '@alinea/ui/icons/IcRoundPermMedia'
import {alinea, MediaSchema} from 'alinea'

export const config = alinea.createConfig({
  workspaces: {
    main: alinea.workspace('Example', {
      source: './content',
      mediaDir: './public',
      schema: alinea.schema({
        ...MediaSchema,
        Page: alinea.type('Page', {
          title: alinea.text('Title'),
          path: alinea.path('Path'),
          content: alinea.richText('Body')
        }),
        Container: alinea
          .type('Container', {
            title: alinea.text('Title'),
            path: alinea.path('Path')
          })
          .configure({isContainer: true, contains: ['Page', 'Container']})
      }),
      roots: {
        data: alinea.root('Example project', {
          icon: IcRoundInsertDriveFile,
          contains: ['Page', 'Container']
        }),
        media: alinea.root('Media', {
          icon: IcRoundPermMedia,
          contains: ['MediaLibrary']
        })
      }
    })
  }
})
