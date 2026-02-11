import { useMemo } from 'react'
import { Canvas, Line, Circle, vec } from '@shopify/react-native-skia'
import { useThemeColor } from '../../hooks/useThemeColor'
import type { BoardPatternType } from '../../types'

interface CanvasBackgroundProps {
  patternType: BoardPatternType
  width: number
  height: number
  translateX: number
  translateY: number
  scale: number
}

const GRID_SPACING = 40
const DOT_SPACING = 40
const RULE_SPACING = 32

export function CanvasBackground({
  patternType,
  width,
  height,
  translateX,
  translateY,
  scale,
}: CanvasBackgroundProps) {
  const { borderColor, colorSubtle } = useThemeColor()

  // Use a subtle color for patterns - slightly increased visibility
  const patternColor = borderColor + '80' // ~50% opacity

  const elements = useMemo(() => {
    if (patternType === 'plain') return null

    const spacing =
      patternType === 'rules' ? RULE_SPACING :
      patternType === 'dots' ? DOT_SPACING :
      GRID_SPACING

    const scaledSpacing = spacing * scale

    // Calculate visible range with some padding
    const startX = -translateX - scaledSpacing
    const startY = -translateY - scaledSpacing
    const endX = -translateX + width + scaledSpacing
    const endY = -translateY + height + scaledSpacing

    // Snap to grid
    const gridStartX = Math.floor(startX / scaledSpacing) * scaledSpacing
    const gridStartY = Math.floor(startY / scaledSpacing) * scaledSpacing

    const lines: React.ReactElement[] = []
    let key = 0

    if (patternType === 'grid') {
      // Vertical lines
      for (let x = gridStartX; x <= endX; x += scaledSpacing) {
        const screenX = x + translateX
        lines.push(
          <Line
            key={key++}
            p1={vec(screenX, 0)}
            p2={vec(screenX, height)}
            color={patternColor}
            strokeWidth={1}
          />
        )
      }
      // Horizontal lines
      for (let y = gridStartY; y <= endY; y += scaledSpacing) {
        const screenY = y + translateY
        lines.push(
          <Line
            key={key++}
            p1={vec(0, screenY)}
            p2={vec(width, screenY)}
            color={patternColor}
            strokeWidth={1}
          />
        )
      }
    } else if (patternType === 'rules') {
      // Horizontal lines only
      for (let y = gridStartY; y <= endY; y += scaledSpacing) {
        const screenY = y + translateY
        lines.push(
          <Line
            key={key++}
            p1={vec(0, screenY)}
            p2={vec(width, screenY)}
            color={patternColor}
            strokeWidth={1}
          />
        )
      }
    } else if (patternType === 'dots') {
      for (let x = gridStartX; x <= endX; x += scaledSpacing) {
        for (let y = gridStartY; y <= endY; y += scaledSpacing) {
          const screenX = x + translateX
          const screenY = y + translateY
          if (screenX >= -5 && screenX <= width + 5 && screenY >= -5 && screenY <= height + 5) {
            lines.push(
              <Circle
                key={key++}
                cx={screenX}
                cy={screenY}
                r={1.5 * scale}
                color={patternColor}
              />
            )
          }
        }
      }
    }

    return lines
  }, [patternType, width, height, translateX, translateY, scale, patternColor])

  if (patternType === 'plain' || !elements) return null

  return (
    <Canvas style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none' }}>
      {elements}
    </Canvas>
  )
}
