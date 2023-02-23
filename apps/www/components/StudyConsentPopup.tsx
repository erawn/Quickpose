import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import Link from 'next/link'
import React, { useLayoutEffect } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Panel } from '~../../packages/tldraw/src/components/Primitives/Panel'
import { styled } from '~styles'
import { DialogState, useDialog } from '../../../packages/tldraw/src/hooks/useDialog'

const STORAGE_KEY = 'quickpose_study_consent'
interface ContentProps {
  children: React.ReactNode
  onClose?: () => void
  container: any
}
function Content({ children, onClose, container }: ContentProps) {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        onClose?.()
        break
    }
  }
  return (
    <AlertDialogPrimitive.Portal container={container}>
      <StyledOverlay />
      <StyledContent onKeyDown={handleKeyDown}>
        Opt-in to send anonymous usage data for research?
        {children}
      </StyledContent>
    </AlertDialogPrimitive.Portal>
  )
}

const StyledDescription = styled(AlertDialogPrimitive.Description, {
  marginBottom: 20,
  color: '$text',
  fontSize: '$2',
  lineHeight: 1.5,
  textAlign: 'center',
  maxWidth: '62%',
  minWidth: 0,
  alignSelf: 'center',
})

export const AlertDialogRoot = AlertDialogPrimitive.Root
export const AlertDialogContent = Content
export const AlertDialogDescription = StyledDescription
export const AlertDialogAction = AlertDialogPrimitive.Action
export const AlertDialogCancel = AlertDialogPrimitive.Cancel

export function StudyConsentPopup({ container }: { container: any }) {
  const [isDismissed, setIsDismissed] = React.useState(true)
  const [dialogContainer, setDialogContainer] = React.useState<any>(null)
  const [dialogState, setDialogState] = React.useState<any>('ready')
  useLayoutEffect(() => {
    try {
      const storageIsDismissed = null //localStorage.getItem(STORAGE_KEY)

      if (storageIsDismissed !== null) {
        return
      } else {
        setIsDismissed(false)
      }
    } catch (err) {
      setIsDismissed(false)
    }
  }, [])

  const handleDismiss = React.useCallback(() => {
    setIsDismissed(true)
    localStorage.setItem(STORAGE_KEY, 'true')
  }, [])

  if (isDismissed) return null

  return (
    // <LoadingScreen>Error: {"test message"}</LoadingScreen>

    //     <div
    //       style={{
    //         position: 'absolute',
    //         top: 0,
    //   left: 0,
    //   width: '100%',
    //   height: '100%',
    //   display: 'flex',
    //   alignItems: 'center',
    // justifyContent: 'center',
    //         zIndex: 999,
    //         fontSize: 'var(--fontSizes-2)',
    //         fontFamily: 'var(--fonts-ui)',
    //         color: '#fff',
    //         mixBlendMode: 'difference',
    //       }}
    //     >
    //       <Panel>
    //       Consent Pop up
    //       </Panel>
    //       <a
    //         href="https://beta.tldraw.com"
    //         style={{
    //           height: '48px',
    //           display: 'flex',
    //           alignItems: 'center',
    //           justifyContent: 'center',
    //           padding: 8,
    //           fontSize: 'inherit',
    //           color: 'inherit',
    //         }}
    //         title="Try the new tldraw at beta.tldraw.com"
    //       >
    //         Consent Pop up
    //       </a>
    //       <button
    //         style={{
    //           height: '48px',
    //           display: 'flex',
    //           alignItems: 'center',
    //           justifyContent: 'center',
    //           padding: 4,
    //           color: 'inherit',
    //           background: 'none',
    //           border: 'none',
    //           cursor: 'pointer',
    //           opacity: 0.8,
    //         }}
    //         title="Dismiss"
    //         onClick={handleDismiss}
    //       >
    //         ×
    //       </button>
    //     </div>

    <AlertDialogRoot open={dialogState !== null}>
      <AlertDialogContent onClose={() => setDialogState(null)} container={container}>
        {dialogState && (
          <AlertDialogDescription>
            {
              <>
                Quickpose is an ongoing research project by{' '}
                <StyledLink href="https://beta.tldraw.com">Eric Rawn</StyledLink>, a PhD student in
                the
                <a href="https://beta.tldraw.com" title="Hybrid Ecologies Lab">
                  Hybrid Ecologies Lab
                </a>{' '}
                at the University of California, Berkeley.
              </>
            }
          </AlertDialogDescription>
        )}
        <div
          style={{
            width: '100%',
            gap: '$6',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          {
            <AlertDialogCancel asChild>
              <Button
                css={{ color: '$text' }}
                onClick={() => {
                  setDialogState(null)
                }}
              >
                Cancel
              </Button>
            </AlertDialogCancel>
          }
          <div style={{ flexShrink: 0 }}>
            {
              <AlertDialogAction asChild>
                <Button
                  onClick={() => {
                    setDialogState(null)
                  }}
                >
                  No
                </Button>
              </AlertDialogAction>
            }
            {
              <AlertDialogAction asChild>
                <Button
                  css={{ backgroundColor: '#2F80ED', color: 'White' }}
                  onClick={() => {
                    setDialogState(null)
                  }}
                >
                  Yes
                </Button>
              </AlertDialogAction>
            }
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialogRoot>
  )
}
const LoadingScreen = styled('div', {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

const StyledOverlay = styled(AlertDialogPrimitive.Overlay, {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, .15)',
  pointerEvents: 'all',
})

export const StyledDialogOverlay = styled(AlertDialogPrimitive.Overlay, {
  backgroundColor: 'rgba(0, 0, 0, .15)',
  position: 'absolute',
  pointerEvents: 'all',
  inset: 0,
})

const StyledContent = styled(AlertDialogPrimitive.Content, {
  position: 'fixed',
  font: '$ui',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'max-content',
  padding: '$3',
  pointerEvents: 'all',
  backgroundColor: '$panel',
  borderRadius: '$3',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  fontFamily: '$ui',
  border: '1px solid $panelContrast',
  boxShadow: '$panel',
})

export const Button = styled('button', {
  all: 'unset',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '$2',
  padding: '0 15px',
  fontSize: '$1',
  lineHeight: 1,
  fontWeight: 'normal',
  height: 36,
  color: '$text',
  cursor: 'pointer',
  minWidth: 48,
})

const StyledLink = styled(Link, {
  color: 'Blue',
  '&:hover': {
    color: 'BlueViolet',
  },
})
