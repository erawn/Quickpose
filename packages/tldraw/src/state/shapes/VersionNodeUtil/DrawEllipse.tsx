import * as React from 'react'
import { getShapeStyle } from '~state/shapes/shared'
import type { ShapeStyles } from '~types'
import { getEllipseIndicatorPath, getEllipsePath } from './ellipseHelpers'

interface EllipseSvgProps {
  id: string
  radius: number[]
  style: ShapeStyles
  isSelected: boolean
  isDarkMode: boolean
}
function getIconImageURL(id){
	return 'http://127.0.0.1:8080' + "/image/" + id + "?" + ((new Date()).getTime()); //Add Time to avoid Caching so images update properly
}

export const DrawEllipse = React.memo(function DrawEllipse({
  id,
  radius,
  style,
  isSelected,
  isDarkMode,
}: EllipseSvgProps) {
  const { stroke, strokeWidth, fill } = getShapeStyle(style, isDarkMode)
  const innerPath = getEllipsePath(id, radius, style)

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
        <pattern id="img1" patternUnits="userSpaceOnUse" width="100" height="100">
          <image href="http://127.0.0.1:8080/image/1" x="0" y="0" width="100" height="100" />
        </pattern>
      </defs>
      {style.isFilled && (
        
      
        <path
          d={getEllipseIndicatorPath(id, radius, style)}
          stroke="none"
          fill={"url(#img1"}
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
