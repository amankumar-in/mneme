import { useMemo } from 'react'
import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import type { BoardStroke } from '../../types'
import { resolveStrokeColor } from './DrawingToolbar'

interface StrokeLayerProps {
  strokes: BoardStroke[]
  currentPath: string | null
  currentColor: string
  currentWidth: number
  width: number
  height: number
  translateX: number
  translateY: number
  scale: number
  isDark: boolean
  selectedStrokeIds?: Set<string>
}

export function StrokeLayer({
  strokes,
  currentPath,
  currentColor,
  currentWidth,
  width,
  height,
  translateX,
  translateY,
  scale,
  isDark,
  selectedStrokeIds,
}: StrokeLayerProps) {
  const strokeElements = useMemo(() => {
    return strokes.flatMap((stroke) => {
      const path = Skia.Path.MakeFromSVGString(stroke.pathData)
      if (!path) return []

      // Apply offset transform for moved strokes
      const matrix = Skia.Matrix()
      matrix.translate(
        stroke.xOffset * scale + translateX,
        stroke.yOffset * scale + translateY
      )
      matrix.scale(scale, scale)
      path.transform(matrix)

      const isSelected = selectedStrokeIds?.has(stroke.id) ?? false
      const elements = []

      // Selection highlight — render a thicker semi-transparent path behind the stroke
      if (isSelected) {
        elements.push(
          <Path
            key={`${stroke.id}-sel`}
            path={path}
            color="#3b82f6"
            style="stroke"
            strokeWidth={(stroke.width + 8) * scale}
            strokeCap="round"
            strokeJoin="round"
            opacity={0.35}
          />
        )
      }

      elements.push(
        <Path
          key={stroke.id}
          path={path}
          color={resolveStrokeColor(stroke.color, isDark)}
          style="stroke"
          strokeWidth={stroke.width * scale}
          strokeCap="round"
          strokeJoin="round"
          opacity={stroke.opacity}
        />
      )

      return elements
    })
  }, [strokes, translateX, translateY, scale, isDark, selectedStrokeIds])

  const activePath = useMemo(() => {
    if (!currentPath) return null
    const path = Skia.Path.MakeFromSVGString(currentPath)
    if (!path) return null

    const matrix = Skia.Matrix()
    matrix.translate(translateX, translateY)
    matrix.scale(scale, scale)
    path.transform(matrix)

    return path
  }, [currentPath, translateX, translateY, scale])

  return (
    <Canvas
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    >
      {strokeElements}
      {activePath && (
        <Path
          path={activePath}
          color={currentColor}
          style="stroke"
          strokeWidth={currentWidth * scale}
          strokeCap="round"
          strokeJoin="round"
        />
      )}
    </Canvas>
  )
}
