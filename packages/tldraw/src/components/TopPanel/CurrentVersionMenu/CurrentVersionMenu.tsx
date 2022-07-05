import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { PlusIcon, CheckIcon } from '@radix-ui/react-icons'
import { PageOptionsDialog } from '../PageOptionsDialog'
import { styled } from '~styles'
import { useTldrawApp } from '~hooks'
import type { TDSnapshot } from '~types'
import { DMContent, DMDivider } from '~components/Primitives/DropdownMenu'
import { SmallIcon } from '~components/Primitives/SmallIcon'
import { RowButton } from '~components/Primitives/RowButton'
import { ToolButton } from '~components/Primitives/ToolButton'
import { FormattedMessage, useIntl } from 'react-intl'

const sortedSelector = (s: TDSnapshot) =>
  Object.values(s.document.pages).sort((a, b) => (a.childIndex || 0) - (b.childIndex || 0))

const currentProjectSelector = (s: TDSnapshot) => s.appState.currentProject


export function CurrentVersionMenu() {
  const app = useTldrawApp()

  const rIsOpen = React.useRef(false)

  const [isOpen, setIsOpen] = React.useState(false)
  const currentProjectName = app.useStore(currentProjectSelector)

  React.useEffect(() => {
    if (rIsOpen.current !== isOpen) {
      rIsOpen.current = isOpen
    }
  }, [isOpen,currentProjectName])

  const handleClose = React.useCallback(() => {
    setIsOpen(false)
  }, [setIsOpen])

  const handleOpenChange = React.useCallback(
    (isOpen: boolean) => {
      if (rIsOpen.current !== isOpen) {
        setIsOpen(isOpen)
      }
    },
    [setIsOpen]
  )
  

  return (
    <DropdownMenu.Root dir="ltr" open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenu.Trigger dir="ltr" asChild id="TD-Page">
          {currentProjectName === '' ? 
          <StyledToolButtonNoProject variant="text">{"Looking for QuickPose Session..."}</StyledToolButtonNoProject> :
          <StyledToolButtonFoundProject variant="text">{"Connected to Quickpose Session: " + currentProjectName}</StyledToolButtonFoundProject> 
          }
      </DropdownMenu.Trigger>
      <DMContent variant="menu" align="start">
        {isOpen && <PageMenuContent onClose={handleClose} />}
      </DMContent>
    </DropdownMenu.Root>
  )
}

function PageMenuContent({ onClose }: { onClose: () => void }) {
  const app = useTldrawApp()
  const intl = useIntl()


  const handleCreatePage = React.useCallback(() => {
    //app.createPage(undefined, intl.formatMessage({ id: 'new.page' }))
  }, [app])

  const handleChangePage = React.useCallback(
    (id: string) => {
      onClose()
      //app.changePage(id)
    },
    [app]
  )
  return(<></>)
  return (
    <>
      <DropdownMenu.RadioGroup dir="ltr" value={'test'} onValueChange={handleChangePage}>
        {/* {sortedPages.map((page) => (
          <ButtonWithOptions key={page.id}>
            <DropdownMenu.RadioItem
              title={page.name || 'Page'}
              value={page.id}
              key={page.id}
              asChild
            >
              <PageButton>
                <span>{page.name || 'Page'}</span>
                <DropdownMenu.ItemIndicator>
                  <SmallIcon>
                    <CheckIcon />
                  </SmallIcon>
                </DropdownMenu.ItemIndicator>
              </PageButton>
            </DropdownMenu.RadioItem>
            <PageOptionsDialog page={page} onClose={onClose} />
          </ButtonWithOptions>
        ))} */}
      </DropdownMenu.RadioGroup>
      <DMDivider />
      <DropdownMenu.Item onSelect={handleCreatePage} asChild>
        <RowButton>
          <span>
            <FormattedMessage id="create.page" />
          </span>
          <SmallIcon>
            <PlusIcon />
          </SmallIcon>
        </RowButton>
      </DropdownMenu.Item>
    </>
  )
}

const ButtonWithOptions = styled('div', {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gridAutoFlow: 'column',

  '& > *[data-shy="true"]': {
    opacity: 0,
  },

  '&:hover > *[data-shy="true"]': {
    opacity: 1,
  },
})

const NoProject = styled('div', {
  color: 'red'

})
const FoundProject = styled('div', {
  
})
const StyledToolButtonFoundProject = styled(ToolButton,{
  color: 'Green'
})

const StyledToolButtonNoProject = styled(ToolButton,{
  color: 'Red'
})
export const PageButton = styled(RowButton, {
  minWidth: 128,
})
