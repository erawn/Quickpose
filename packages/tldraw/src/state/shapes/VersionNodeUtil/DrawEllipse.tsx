import * as React from 'react'
import { getShapeStyle , fills, strokes} from '~state/shapes/shared'
import { ColorStyle, DashStyle, ShapeStyles, SizeStyle, Theme } from '~types'
import { getEllipseIndicatorPath, getEllipsePath } from './ellipseHelpers'
interface VersionNodeSvgProps {
  id: string
  radius: number[]
  style: ShapeStyles
  isSelected: boolean
  isDarkMode: boolean
  imgLink:string
  isCurrent:boolean
}


export const DrawEllipse = React.memo(function DrawEllipse({
  id,
  radius,
  style,
  isSelected,
  isDarkMode,
  imgLink,
  isCurrent
}: VersionNodeSvgProps) {
  const selectStyle: ShapeStyles = {
    color: ColorStyle.Violet,
    isFilled: true,
    dash: DashStyle.Dashed,
    size: style.size,
    }
  const theme: Theme = isDarkMode ? 'dark' : 'light'
  const selectFill = strokes[theme][selectStyle.color] 
  style.isFilled = true 
  const { stroke, strokeWidth, fill} = getShapeStyle(style, isDarkMode)
  const innerPath = getEllipsePath(id, radius, style)
  const imgId = "img"+id.toString()


    //console.log(stroke, selectStyle.color)
  return (
    <>
    {isCurrent && (
        //<g transform="translate(${radius[0]}, ${radius[1]}) scale(4) translate(-${radius[0]}, -${radius[1]})">
        <g transform={'translate('+(radius[0])+','+(radius[1])+')scale(1.3) translate('+(-radius[0])+','+(-radius[1])+')'}>
          <path
            d={getEllipseIndicatorPath(id, radius, selectStyle)}
            stroke="none"
            fill={selectFill}
            pointerEvents="all"
          
          />
        </g>
        
      )}
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
        pointerEvents="all"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <path
        d={innerPath}
        fill={stroke}
        stroke={stroke}
        strokeWidth={strokeWidth}
        pointerEvents="all"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
    </>
  )
})
