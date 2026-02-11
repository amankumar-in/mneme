import { useMemo } from 'react'
import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import type { BoardStroke } from '../../types'

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
}: StrokeLayerProps) {
  const strokeElements = useMemo(() => {
    return strokes.map((stroke) => {
      const path = Skia.Path.MakeFromSVGString(stroke.pathData)
      if (!path) return null

      // Apply offset transform for moved strokes
      const matrix = Skia.Matrix()
      matrix.translate(
        stroke.xOffset * scale + translateX,
        stroke.yOffset * scale + translateY
      )
      matrix.scale(scale, scale)
      path.transform(matrix)

      return (
        <Path
          key={stroke.id}
          path={path}
          color={stroke.color}
          style="stroke"
          strokeWidth={stroke.width * scale}
          strokeCap="round"
          strokeJoin="round"
          opacity={stroke.opacity}
        />
      )
    })
  }, [strokes, translateX, translateY, scale])

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
