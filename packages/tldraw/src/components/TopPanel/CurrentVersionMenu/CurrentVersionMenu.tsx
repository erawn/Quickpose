import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { PlusIcon, CheckIcon } from '@radix-ui/react-icons'
import { PageOptionsDialog } from '../PageOptionsDialog'
import { styled } from '~styles'
import { useTldrawApp } from '~hooks'
import type { ColorStyle, TDSnapshot } from '~types'
import { DMContent, DMDivider } from '~components/Primitives/DropdownMenu'
import { SmallIcon } from '~components/Primitives/SmallIcon'
import { RowButton } from '~components/Primitives/RowButton'
import { ToolButton } from '~components/Primitives/ToolButton'
import { FormattedMessage, useIntl } from 'react-intl'
import { strokes, fills, defaultTextStyle } from '~state/shapes/shared/shape-styles'
import { preventEvent } from '~components/preventEvent'
import type { TldrawApp } from '~state'
import {
  CircleIcon,
} from '~components/Primitives/icons'
const sortedSelector = (s: TDSnapshot) =>
  Object.values(s.document.pages).sort((a, b) => (a.childIndex || 0) - (b.childIndex || 0))

const currentProjectSelector = (s: TDSnapshot) => s.appState.currentProject
const currentStyleSelector = (s: TDSnapshot) => s.appState.currentStyle
const themeSelector = (s: TDSnapshot) => (s.settings.isDarkMode ? 'dark' : 'light')

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
  const app: TldrawApp = useTldrawApp()
  const intl = useIntl()
  const theme = app.useStore(themeSelector)
  const currentStyle = app.useStore(currentStyleSelector)

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
  return(<>
  {/* <DropdownMenu.Trigger asChild id="TD-Styles">
  <ToolButton variant="text">
    <FormattedMessage id="styles" />
    <OverlapIcons
      style={{
        color: strokes[theme][currentStyle.color as ColorStyle],
      }}
    >
      {(
        <CircleIcon
          size={16}
          stroke="none"
          fill={fills[theme][currentStyle.color as ColorStyle]}
        />
      )}
    </OverlapIcons>
  </ToolButton>
</DropdownMenu.Trigger> */}
<DMContent>
        <StyledRow variant="tall" id="TD-Styles-Color-Container">
          <span>
          <FormattedMessage id="export.by.color" />
          </span>
          <ColorGrid>
            {Object.keys(strokes.light).map((style: string) => (
              <DropdownMenu.Item
                key={style}
                onSelect={preventEvent}
                asChild
                id={`TD-Styles-Color-Swatch-${style}`}
              >
                <ToolButton
                  variant="icon"
                  onClick={() => {
                    app.exportByColor(app,style as ColorStyle)
                    onClose();

                  } } // { color: style as ColorStyle })}
                >
                  <CircleIcon
                    size={18}
                    strokeWidth={2.5}
                    fill={
                     fills.light[style as ColorStyle]
                    }
                    stroke={strokes.light[style as ColorStyle]}
                  />
                </ToolButton>
              </DropdownMenu.Item>
            ))}
          </ColorGrid>
        </StyledRow>
        </DMContent>
</>)
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
const OverlapIcons = styled('div', {
  display: 'grid',
  '& > *': {
    gridColumn: 1,
    gridRow: 1,
  },
})
const ColorGrid = styled('div', {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, auto)',
  gap: 0,
})

export const StyledRow = styled('div', {
  position: 'relative',
  width: '100%',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  minHeight: '32px',
  outline: 'none',
  color: '$text',
  fontFamily: '$ui',
  fontWeight: 400,
  fontSize: '$1',
  padding: '$2 0 $2 $3',
  borderRadius: 4,
  userSelect: 'none',
  margin: 0,
  display: 'flex',
  gap: '$3',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  variants: {
    variant: {
      tall: {
        alignItems: 'flex-start',
        padding: '0 0 0 $3',
        '& > span': {
          paddingTop: '$4',
        },
      },
    },
  },
})
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
