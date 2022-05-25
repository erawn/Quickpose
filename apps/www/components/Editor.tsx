import { Tldraw, TldrawApp, TldrawProps, useFileSystem, TDShapeType, ColorStyle } from '@tldraw/tldraw'
import { useAccountHandlers } from 'hooks/useAccountHandlers'
import { useUploadAssets } from 'hooks/useUploadAssets'
import React, { FC } from 'react'
import * as gtag from 'utils/gtag'
import { useAsync } from "react-async"

declare const window: Window & { app: TldrawApp }

interface EditorProps {
  id?: string
  isUser?: boolean
  isSponsor?: boolean
}

const requestCurrentId = async () => {
  const response = await fetch('http://127.0.0.1:8080/currentVersion');
	const id = await response.json();
}


const Editor: FC<EditorProps & Partial<TldrawProps>> = ({
  id = 'home',
  isUser = false,
  isSponsor = false,
  ...rest
}) => {
  const handleMount = React.useCallback((app: TldrawApp) => {
    window.app = app


    app.createShapes( 
      {
        id: 'rect1',
        type: TDShapeType.Rectangle,
        name: 'Rectangle',
        childIndex: 1,
        point: [0, 0],
        size: [100, 100],
      },
      {
        id: 'rect2',
        name: 'Rectangle',
        type: TDShapeType.Rectangle,
        point: [200, 200],
        size: [100, 100],
      }
    )
  }, [])
  
  const requestData = React.useCallback(async() => {
      const response = await fetch('http://127.0.0.1:8080/versions.json')
      let data =  await response.json()
      data = JSON.stringify(data)
      data = JSON.parse(data)
      return data
    }, [])

  React.useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      const app = window.app
      const rect1 = app.getShape('rect1')
      requestData().then(data => 
        {
          console.log(data)
          const node0 = app.getShape('rect1')
          if(!node0){
            app.createShapes({
              id: 'node0',
              type: TDShapeType.Image, 
              name: 'Image',
              childIndex: 1,
              point: [0, 0],
              size: [100, 100],
            })
          }
        })



      if (!rect1) {
        
        return
      }

      const color = i % 2 ? ColorStyle.Black : ColorStyle.Green

      app.updateShapes({
        id: 'rect1', 
        style: {
          ...rect1.style, 
          color,
        },
      })

      i++
    }, 1000)
    return () => clearInterval(interval)
  }, [requestData])

  // Send events to gtag as actions.
  const handlePersist = React.useCallback((_app: TldrawApp, reason?: string) => {
    gtag.event({
      action: reason ?? '',
      category: 'editor',
      label: reason ?? 'persist',
      value: 0,
    })
  }, [])

  const fileSystemEvents = useFileSystem()
  

  const { onSignIn, onSignOut } = useAccountHandlers()

  const { onAssetUpload } = useUploadAssets()

  return (
    <div className="tldraw">
      <Tldraw
        id={id}
        autofocus
        onMount={handleMount}
        onPersist={handlePersist}
        showSponsorLink={!isSponsor}
        onSignIn={isSponsor ? undefined : onSignIn}
        onSignOut={isUser ? onSignOut : undefined}
        onAssetUpload={onAssetUpload}
        {...fileSystemEvents}
        {...rest}
      />
    </div>
  )
}

export default Editor
