import * as React from 'react'
import { getShapeStyle , fills, strokes} from '~state/shapes/shared'
import { ColorStyle, DashStyle, ShapeStyles, SizeStyle, Theme } from '~types'
import { getEllipseIndicatorPath, getEllipsePath } from './ellipseHelpers'
import { Utils } from '@tldraw/core'

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
  radius,
  style,
  isSelected,
  isDarkMode,
  isCurrent,
  imgLink,
  id,
}: VersionNodeSvgProps) {
  const { stroke, strokeWidth, fill } = getShapeStyle(style, isDarkMode)
  const sw = 1 + strokeWidth * 1.618 + (radius[0] * .2)
  const rx = Math.max(0, radius[0] - sw / 2)
  const ry = Math.max(0, radius[1] - sw / 2)
  const perimeter = Utils.perimeterOfEllipse(rx, ry)
  const { strokeDasharray, strokeDashoffset } = Utils.getPerfectDashProps(
    perimeter < 64 ? perimeter * 2 : perimeter,
    strokeWidth * 1.618,
    DashStyle.Dotted,
    4
  )
  const strokeDefault = Utils.getPerfectDashProps(
    perimeter < 64 ? perimeter * 2 : perimeter,
    strokeWidth * 1.618,
    DashStyle.Dotted,
    4
  )

  const selectStyle: ShapeStyles = {
    color: ColorStyle.Violet,
    isFilled: true,
    dash: DashStyle.Solid,
    size: style.size,
    }
  const theme: Theme = isDarkMode ? 'dark' : 'light'
  const selectFill = strokes[theme][selectStyle.color] 
  style.isFilled = true 

  const imgId = "img"+id.toString()

  return (
    <>
    <defs>
      <linearGradient id="Gradient2" x1="0" x2="0" y1="0" y2="1" gradientTransform="rotate(-45)" preserveAspectRatio="xMidYMid slice">
          <stop offset="0%" stopColor="rgb(161,244,252)"stopOpacity="1"/>
          <stop offset="100%" stopColor="rgb(114,166,248)" stopOpacity="1"/>
          
        </linearGradient>
      </defs> 
      {/* <ellipse
        className={style.isFilled || isSelected ? 'tl-fill-hitarea' : 'tl-stroke-hitarea'}
        cx={radius[0]}
        cy={radius[1]}
        rx={radius[0]}
        ry={radius[1]}
      /> */}
      {/* <defs>
        <pattern id={imgId} patternUnits="objectBoundingBox" width="1" height="1">
          <image href={imgLink} x="0" y="0" width={(radius[0]*2)-sw} height={(radius[1]*2)-sw}
                  preserveAspectRatio="xMidYMid slice" />
        </pattern>
      </defs> */}
      {/* {style.isFilled && (
        
      
        <path
          d={getEllipseIndicatorPath(id, radius, style)}
          stroke="none"
          fill={"url(#"+imgId+")"}
          pointerEvents="none"
        />
      )} */}
      {isCurrent &&
       <g transform={'translate('+(radius[0])+','+(radius[1])+') scale(1.38) translate('+(-radius[0])+','+(-radius[1])+')'}>
          <ellipse
            stroke="none"
            pointerEvents="none"
            fill={"url(#Gradient2)"}
            cx={radius[0]}
            cy={radius[1]}
            rx={radius[0]}
            ry={radius[1]}
          />
        </g>
      } 
      {!isCurrent &&
       <g transform={'translate('+(radius[0])+','+(radius[1])+') scale(1.38) translate('+(-radius[0])+','+(-radius[1])+')'}>
        <ellipse
          cx={radius[0]}
          cy={radius[1]}
          rx={radius[1]}
          ry={radius[1]}
          fill={"none"}
          stroke={stroke}
          strokeWidth={(1 + strokeWidth * 1.618) +2}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          pointerEvents="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          />
        </g>
      } 
   

      <ellipse
        className={style.isFilled || isSelected ? 'tl-fill-hitarea' : 'tl-stroke-hitarea'}
        cx={radius[0]}
        cy={radius[1]}
        rx={radius[0]}
        ry={radius[1]}
      />
      {/* <ellipse
        cx={radius[0]}
        cy={radius[1]}
        rx={rx}
        ry={ry}
        fill={"url(#"+imgId+")"}
      /> */}
      <ellipse
        cx={radius[0]}
        cy={radius[1]}
        rx={rx}
        ry={ry}
        fill={"none"}
        stroke={stroke}
        strokeWidth={sw+2}
        strokeDasharray={strokeDefault.strokeDasharray}
        strokeDashoffset={strokeDefault.strokeDashoffset}
        pointerEvents="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  )
})
