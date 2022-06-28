import * as React from 'react'
import { getShapeStyle } from '~state/shapes/shared'
import type { ShapeStyles } from '~types'
import { getEllipseIndicatorPath, getEllipsePath } from './ellipseHelpers'

interface VersionNodeSvgProps {
  id: string
  radius: number[]
  style: ShapeStyles
  isSelected: boolean
  isDarkMode: boolean
  imgLink:string
}


export const DrawEllipse = React.memo(function DrawEllipse({
  id,
  radius,
  style,
  isSelected,
  isDarkMode,
  imgLink
}: VersionNodeSvgProps) {
  const { stroke, strokeWidth, fill } = getShapeStyle(style, isDarkMode)
  const innerPath = getEllipsePath(id, radius, style)
  const imgId = "img"+id.toString()
  style.isFilled = true 

  return (
    <>
      <ellipse
        className={style.isFilled || isSelected ? 'tl-fill-hitarea' : 'tl-stroke-hitarea'}
        cx={radius[0]}
        cy={radius[1]}
        rx={radius[0]}
        ry={radius[1]}
      />
      <defs>
        <pattern id={imgId} patternUnits="objectBoundingBox" width="1" height="1">
          <image href={imgLink} x="0" y="0" width={radius[0]*2} height={radius[1]*2}
                  preserveAspectRatio="xMidYMid slice" />
        </pattern>
      </defs>
      {style.isFilled && (
        
      
        <path
          d={getEllipseIndicatorPath(id, radius, style)}
          stroke="none"
          fill={"url(#"+imgId+")"}
          pointerEvents="none"
        />
      )}
      <path
        d={innerPath}
        fill={stroke}
        stroke={stroke}
        strokeWidth={strokeWidth}
        pointerEvents="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  )
})
