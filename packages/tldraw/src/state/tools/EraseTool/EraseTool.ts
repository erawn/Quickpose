import type { TLPointerEventHandler } from '@tldraw/core'
import Vec from '@tldraw/vec'
import { DEAD_ZONE } from '~constants'
import { BaseTool } from '~state/tools/BaseTool'
import { SessionType } from '~types'

enum Status {
  Idle = 'idle',
  Pointing = 'pointing',
  Erasing = 'erasing',
}

export class EraseTool extends BaseTool {
  type = 'erase' as const

  status: Status = Status.Idle

  /* ----------------- Event Handlers ----------------- */

  onPointerDown: TLPointerEventHandler = () => {
    if (this.app.readOnly) return
    if (this.status !== Status.Idle) return

    this.setStatus(Status.Pointing)
  }

  onPointerMove: TLPointerEventHandler = (info) => {
    if (this.app.readOnly) return
    switch (this.status) {
      case Status.Pointing: {
        if (Vec.dist(info.origin, info.point) > DEAD_ZONE) {
          this.app.startSession(SessionType.Erase)
          this.app.updateSession()
          this.setStatus(Status.Erasing)
        }
        break
      }
      case Status.Erasing: {
        this.app.updateSession()
      }
    }
  }

  onPointerUp: TLPointerEventHandler = () => {
    if (this.app.readOnly) return
    switch (this.status) {
      case Status.Pointing: {
        const shapeIdsAtPoint = this.app.shapes
          .filter((shape) => !shape.isLocked && !shape.isFixed)
          .filter((shape) =>
            this.app.getShapeUtil(shape).hitTestPoint(shape, this.app.currentPoint)
          )
          .flatMap((shape) => (shape.children ? [shape.id, ...shape.children] : shape.id))

        this.app.delete(shapeIdsAtPoint)

        break
      }
      case Status.Erasing: {
        this.app.completeSession()

        // Should the app go back to the previous state, the select
        // state, or stay in the eraser state?

        // if (this.previous) {
        //   this.app.selectTool(this.previous)
        // } else {
        //   this.app.selectTool('select')
        // }
      }
    }

    this.setStatus(Status.Idle)
  }

  onCancel = () => {
    if (this.status === Status.Idle) {
      if (this.previous) {
        this.app.selectTool(this.previous)
      } else {
        this.app.selectTool('select')
      }
    } else {
      this.setStatus(Status.Idle)
    }

    this.app.cancelSession()
  }
}
