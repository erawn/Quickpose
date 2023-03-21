import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import * as Checkbox from '@radix-ui/react-checkbox'
import { CheckIcon } from '@radix-ui/react-icons'
import { scaleBand } from 'd3'
import Link from 'next/link'
import React, { useLayoutEffect } from 'react'
import { styled } from '~styles'
import { studyConsentResponse } from '~utils/quickPoseTypes'

const STORAGE_KEY = 'quickpose_study_consent'
interface ContentProps {
  children: React.ReactNode
  onClose?: () => void
  container: any
}
function Content({ children, onClose, container }: ContentProps) {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    // switch (event.key) {
    //   case 'Escape':
    //     onClose?.()
    //     break
    // }
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
  color: 'Black',
  fontSize: '$2',
  lineHeight: 1.5,
  textAlign: 'left',
  maxWidth: '80%',
  minWidth: '10%',
  alignSelf: 'center',
  textIndent: 50,
})
export const AlertDialogRoot = AlertDialogPrimitive.Root
export const AlertDialogContent = Content
export const AlertDialogDescription = StyledDescription
export const AlertDialogAction = AlertDialogPrimitive.Action
export const AlertDialogCancel = AlertDialogPrimitive.Cancel

export function StudyConsentPopup({ container, setActive }: { container: any; setActive: any }) {
  const [checked, setChecked] = React.useState<Checkbox.CheckedState>(false)
  const handleCheckboxClick = (): void => {
    setChecked(!checked)
  }

  return (
    <AlertDialogRoot open={true}>
      <AlertDialogContent onClose={() => {}} container={container}>
        {
          <>
            <AlertDialogDescription>
              {
                <>
                  Quickpose is an ongoing research project by{' '}
                  <StyledLink href="https://www.ericrawn.media/" style={{ color: 'blue' }}>
                    Eric Rawn
                  </StyledLink>
                  , a PhD student in the{' '}
                  <StyledLink href="https://www.hybrid-ecologies.org/">
                    Hybrid Ecologies Lab
                  </StyledLink>{' '}
                  at the University of California, Berkeley. The software is 100% free to use and
                  open-source. However, if you wish to participate in our research, we would really
                  appreciate it! We&apos;re studying how folks use Quickpose for their everyday
                  work.{' '}
                  <b>
                    If you consent below, Quickpose will automatically send anonymous, encrypted
                    usage data to our collection server for analysis
                  </b>
                  . No code, images, or IP information will ever be collected (although we may
                  collect statistics about the code you write in Quickpose projects). For
                  information about the research, the data we collect, and what we do with it,{' '}
                  <StyledLink href="https://www.ericrawn.media/quickpose-docs#faq">
                    see our wiki page
                  </StyledLink>
                </>
              }
            </AlertDialogDescription>
            <div style={{ textAlign: 'center', fontSize: '20px' }}>
              <StyledLink href="" style={{}}>
                Read the Entire Consent Form Here
              </StyledLink>
            </div>
          </>
        }
        <div
          style={{
            width: '100%',
            gap: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {
            <AlertDialogAction asChild>
              <form>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '$1',
                    marginTop: '10px',
                  }}
                >
                  <StyledCheckbox
                    checked={checked}
                    onCheckedChange={handleCheckboxClick}
                    className="CheckboxRoot"
                    defaultChecked
                    id="c1"
                  >
                    <Checkbox.Indicator className="CheckboxIndicator">
                      <CheckIcon
                        style={{
                          transformOrigin: 'center center',
                          transform: 'scale(1.7) translateX(-2px)',
                        }}
                      />
                    </Checkbox.Indicator>
                  </StyledCheckbox>
                  <label htmlFor="c1">
                    <div style={{ fontSize: '13px', marginLeft: '5px' }}>
                      Save My Preference for All Future Projects (This can be changed at anytime in
                      the settings)
                    </div>
                  </label>
                </div>
              </form>
            </AlertDialogAction>
          }
          <div style={{ flexShrink: 0 }}>
            {
              <AlertDialogAction asChild>
                <Button
                  onClick={() => {
                    const response: studyConsentResponse = {
                      preference: 'Disabled',
                      promptAgain: !checked as boolean,
                    }
                    setActive(response)
                  }}
                  css={{
                    border: '5px solid black',
                    '&:hover': {
                      color: 'white',
                      backgroundColor: '#1b2024',
                    },
                  }}
                >
                  <b>I DO NOT CONSENT, DO NOT SEND ANONYMOUS USAGE DATA.</b>
                </Button>
              </AlertDialogAction>
            }
          </div>
          {
            <AlertDialogAction asChild>
              <Button
                css={{
                  backgroundColor: '#65A5FF',
                  color: 'White',
                  '&:hover': {
                    backgroundColor: '#1b2024',
                  },
                }}
                onClick={() => {
                  const response: studyConsentResponse = {
                    preference: 'Enabled',
                    promptAgain: !checked as boolean,
                  }
                  setActive(response)
                }}
              >
                I CONSENT TO PARTICIPATE IN RESEARCH AND HAVE READ THE CONSENT FORM. I UNDERSTAND I
                CAN OPT-OUT AT ANY TIME
              </Button>
            </AlertDialogAction>
          }
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
  maxwidth: '80%',
  minwidth: '20%',
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
  fontSize: '30px',
})

export const Button = styled('button', {
  all: 'unset',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '$2',
  padding: '4px 15px',
  fontSize: '$1',
  lineHeight: 1.5,
  fontWeight: 'normal',
  height: 36,
  color: '$text',
  cursor: 'pointer',
  minWidth: 48,
  textAlign: 'center',
})

const StyledLink = styled('a', {
  color: 'Blue',
  '&:hover': {
    color: 'DarkBlue',
  },
})

const StyledCheckbox = styled(Checkbox.Root, {
  display: 'flex',
  alignItems: 'center',
  fontSize: '$1',
  width: '25px',
  height: '25px',
  borderRadius: '4px',
  '&:hover': {
    backgroundColor: 'Gray',
  },
  '&:focus': {
    boxShadow: '0 0 0 2px black',
  },
})

// const StyledLink = styled(Link,{
//   color: 'Blue',
//   text-decoration: none,
//   margin: 1rem
//   position: relative;
// });
