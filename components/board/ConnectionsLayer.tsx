import { useMemo } from 'react'
import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import type { BoardConnection, BoardItem } from '../../types'

interface ConnectionsLayerProps {
  connections: BoardConnection[]
  items: BoardItem[]
  width: number
  height: number
  translateX: number
  translateY: number
  scale: number
  selectedConnectionIds: Set<string>
  localOverrides?: Map<string, { x: number; y: number; width: number; height: number }>
}

function getEdgeMidpoint(
  item: BoardItem,
  side: string,
  translateX: number,
  translateY: number,
  scale: number,
  override?: { x: number; y: number; width: number; height: number } | null
): { x: number; y: number } {
  const ix = override ? override.x : item.x
  const iy = override ? override.y : item.y
  const iw = override ? override.width : item.width
  const ih = override ? override.height : item.height
  const x = ix * scale + translateX
  const y = iy * scale + translateY
  const w = iw * scale
  const h = ih * scale

  switch (side) {
    case 'top': return { x: x + w / 2, y }
    case 'bottom': return { x: x + w / 2, y: y + h }
    case 'left': return { x, y: y + h / 2 }
    case 'right': return { x: x + w, y: y + h / 2 }
    default: return { x: x + w / 2, y: y + h / 2 }
  }
}

export function ConnectionsLayer({
  connections,
  items,
  width,
  height,
  translateX,
  translateY,
  scale,
  selectedConnectionIds,
  localOverrides,
}: ConnectionsLayerProps) {
  const itemMap = useMemo(() => {
    const map = new Map<string, BoardItem>()
    items.forEach((item) => map.set(item.id, item))
    return map
  }, [items])

  const connectionPaths = useMemo(() => {
    return connections.map((conn) => {
      const fromItem = itemMap.get(conn.fromItemId)
      const toItem = itemMap.get(conn.toItemId)
      if (!fromItem || !toItem) return null

      const fromOv = localOverrides?.get(fromItem.id) ?? null
      const toOv = localOverrides?.get(toItem.id) ?? null

      const from = getEdgeMidpoint(fromItem, conn.fromSide, translateX, translateY, scale, fromOv)
      const to = getEdgeMidpoint(toItem, conn.toSide, translateX, translateY, scale, toOv)

      const isSelected = selectedConnectionIds.has(conn.id)

      // Determine if we need a curve: if endpoints are too close or same axis
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      const path = Skia.Path.Make()
      path.moveTo(from.x, from.y)

      if (dist < 30 * scale) {
        // Very short — just straight line
        path.lineTo(to.x, to.y)
      } else {
        // Use a smooth curve via control point
        const midX = (from.x + to.x) / 2
        const midY = (from.y + to.y) / 2
        // Offset the control point perpendicular to the line
        const perpX = -(to.y - from.y) / dist * 30 * scale
        const perpY = (to.x - from.x) / dist * 30 * scale

        // Only curve if the straight path would look weird (same side connections)
        const needsCurve = conn.fromSide === conn.toSide
        if (needsCurve) {
          path.quadTo(midX + perpX, midY + perpY, to.x, to.y)
        } else {
          path.lineTo(to.x, to.y)
        }
      }

      // Arrowhead
      const arrowSize = 10 * scale
      const angle = Math.atan2(to.y - from.y, to.x - from.x)
      const arrowPath = Skia.Path.Make()
      arrowPath.moveTo(to.x, to.y)
      arrowPath.lineTo(
        to.x - arrowSize * Math.cos(angle - Math.PI / 6),
        to.y - arrowSize * Math.sin(angle - Math.PI / 6)
      )
      arrowPath.moveTo(to.x, to.y)
      arrowPath.lineTo(
        to.x - arrowSize * Math.cos(angle + Math.PI / 6),
        to.y - arrowSize * Math.sin(angle + Math.PI / 6)
      )

      return { conn, path, arrowPath, isSelected }
    }).filter(Boolean) as { conn: BoardConnection; path: any; arrowPath: any; isSelected: boolean }[]
  }, [connections, itemMap, translateX, translateY, scale, selectedConnectionIds, localOverrides])

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
      {connectionPaths.map(({ conn, path, arrowPath, isSelected }) => (
        <Path
          key={conn.id}
          path={path}
          color={isSelected ? '#3b82f6' : conn.color}
          style="stroke"
          strokeWidth={(isSelected ? conn.strokeWidth + 1 : conn.strokeWidth) * scale}
          strokeCap="round"
        />
      ))}
      {connectionPaths.map(({ conn, arrowPath, isSelected }) => (
        <Path
          key={`arrow-${conn.id}`}
          path={arrowPath}
          color={isSelected ? '#3b82f6' : conn.color}
          style="stroke"
          strokeWidth={(isSelected ? conn.strokeWidth + 1 : conn.strokeWidth) * scale}
          strokeCap="round"
        />
      ))}
    </Canvas>
  )
}
