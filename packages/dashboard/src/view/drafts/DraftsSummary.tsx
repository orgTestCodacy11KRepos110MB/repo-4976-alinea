import {Outcome} from '@alinea/core'
import {fromModule, HStack, VStack} from '@alinea/ui'
import {MdChevronRight, MdMergeType} from 'react-icons/md'
import {useQuery} from 'react-query'
import {useSession} from '../../hook/UseSession'
import css from './DraftsSummary.module.scss'

const styles = fromModule(css)

export function DraftsSummary() {
  const {hub} = useSession()
  const {data: drafts} = useQuery(['drafts'], () => {
    return hub.listDrafts().then(Outcome.unpack)
  })
  if (!drafts?.length) return null
  return (
    <HStack center gap={10} className={styles.root()}>
      <div className={styles.root.icon()}>
        <MdChevronRight size={20} />
      </div>

      <div className={styles.root.button()}>
        <MdMergeType />
      </div>

      <VStack style={{flexGrow: 1}}>
        <div>{drafts.length} drafts</div>
        <div>view - publish - discard - preview</div>
      </VStack>
    </HStack>
  )
}
