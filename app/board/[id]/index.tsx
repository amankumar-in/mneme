import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AppState,
  BackHandler,
  Dimensions,
  Keyboard,
  LayoutChangeEvent,
  Pressable,
  Share,
  TextInput,
  View,
} from 'react-native'
// KeyboardAvoidingView removed — infinite canvas handles keyboard avoidance
// by shifting translateY directly
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { YStack, Text, XStack } from 'tamagui'
import { Ionicons } from '@expo/vector-icons'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Skia } from '@shopify/react-native-skia'

import { BoardHeader } from '../../../components/board/BoardHeader'
import { DrawingToolbar, getDefaultDrawColor, resolveStrokeColor } from '../../../components/board/DrawingToolbar'
import { FlyMenu } from '../../../components/board/FlyMenu'
import { CanvasBackground } from '../../../components/board/CanvasBackground'
import { StrokeLayer } from '../../../components/board/StrokeLayer'
import { ConnectionsLayer } from '../../../components/board/ConnectionsLayer'
import {
  useBoard,
  useBoardItems,
  useBoardStrokes,
  useBoardConnections,
  useCreateBoardItem,
  useUpdateBoardItem,
  useDeleteBoardItem,
  useCreateBoardStroke,
  useUpdateBoardStroke,
  useDeleteBoardStroke,
  useCreateBoardConnection,
  useDeleteBoardConnection,
  useSaveViewport,
} from '../../../hooks/useBoards'
import { useAttachmentHandler } from '../../../hooks/useAttachmentHandler'
import { useVoiceRecorder } from '../../../hooks/useVoiceRecorder'
import { useAudioPlayer } from '../../../hooks/useAudioPlayer'
import { useAppTheme } from '../../../contexts/ThemeContext'
import { useThemeColor } from '../../../hooks/useThemeColor'
import { resolveAttachmentUri } from '../../../services/fileStorage'
import { Image as ExpoImage } from 'expo-image'
import type { BoardItem, BoardStroke } from '../../../types'

const LONG_PRESS_DURATION = 400
const TAP_MOVE_THRESHOLD = 5
const TEXT_MAX_WIDTH = 600

export default function BoardScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const insets = useSafeAreaInsets()
  const { resolvedTheme } = useAppTheme()
  const isDark = resolvedTheme === 'dark'
  const { background, color, iconColorStrong, accentColor, borderColor } = useThemeColor()

  // Canvas size
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // Data
  const { data: board } = useBoard(id || '')
  const { data: items = [] } = useBoardItems(id || '')
  const { data: strokes = [] } = useBoardStrokes(id || '')
  const { data: connections = [] } = useBoardConnections(id || '')

  // Mutations
  const createItem = useCreateBoardItem(id || '')
  const updateItem = useUpdateBoardItem(id || '')
  const deleteItem = useDeleteBoardItem(id || '')
  const createStroke = useCreateBoardStroke(id || '')
  const updateStroke = useUpdateBoardStroke(id || '')
  const deleteStroke = useDeleteBoardStroke(id || '')
  const createConnection = useCreateBoardConnection(id || '')
  const deleteConnection = useDeleteBoardConnection(id || '')
  const { saveViewport } = useSaveViewport(id || '')

  // Attachment & audio
  const { showImageSourcePicker } = useAttachmentHandler()
  const { isRecording, duration: voiceDuration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder()
  const { playingNoteId, isPlaying, toggle: toggleAudio } = useAudioPlayer()

  // Canvas transform
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const scale = useSharedValue(1)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)
  const savedScale = useSharedValue(1)

  // For JS reads of transform (updated via runOnJS)
  const [jsTranslateX, setJsTranslateX] = useState(0)
  const [jsTranslateY, setJsTranslateY] = useState(0)
  const [jsScale, setJsScale] = useState(1)

  // Drawing state
  const [drawColor, setDrawColor] = useState(() => getDefaultDrawColor(isDark))
  const [drawWidth, setDrawWidth] = useState(2)
  const [currentPathString, setCurrentPathString] = useState<string | null>(null)
  const pathRef = useRef<any>(null)
  const [undoStack, setUndoStack] = useState<string[]>([]) // stroke IDs
  const [redoStack, setRedoStack] = useState<string[]>([])

  // Pending strokes — drawn but not yet in query data
  const [pendingStrokes, setPendingStrokes] = useState<BoardStroke[]>([])

  // Fly menu state
  const [flyMenu, setFlyMenu] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  })
  const [flyMenuCanvasPos, setFlyMenuCanvasPos] = useState({ x: 0, y: 0 })

  // Text editing state
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingTextValue, setEditingTextValue] = useState('')
  const textInputRefs = useRef<Map<string, TextInput>>(new Map())

  // Selection state
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)

  // Manipulation state — move, resize, or connection drag
  // Uses ref + state: ref for immediate reads inside gesture callbacks (avoids stale closures),
  // state for triggering re-renders.
  type ManipulationState = {
    type: 'move' | 'resize' | 'connection'
    itemId: string
    handle?: string   // corner key for resize, side for connection
    startScreen: { x: number; y: number }
    startBounds: { x: number; y: number; width: number; height: number }
  } | null
  const manipulationRef = useRef<ManipulationState>(null)
  const [manipulation, _setManipulation] = useState<ManipulationState>(null)
  const setManip = useCallback((val: ManipulationState) => {
    manipulationRef.current = val
    _setManipulation(val)
  }, [])

  // Optimistic local override for the item being moved/resized (avoids DB writes per frame)
  type LocalOverrideState = { id: string; x: number; y: number; width: number; height: number } | null
  const localOverrideRef = useRef<LocalOverrideState>(null)
  const [localOverride, _setLocalOverride] = useState<LocalOverrideState>(null)
  const setLocalOv = useCallback((val: LocalOverrideState) => {
    localOverrideRef.current = val
    _setLocalOverride(val)
  }, [])

  // Connection drag preview (screen coords)
  const [connectionPreview, setConnectionPreview] = useState<{
    fromItemId: string
    fromSide: string
    startX: number; startY: number
    currentX: number; currentY: number
  } | null>(null)

  // Measured sizes for text items (so hit-testing works before DB update round-trips)
  const measuredSizes = useRef<Map<string, { width: number; height: number }>>(new Map())

  // Recording state for audio placement
  const [pendingAudioPos, setPendingAudioPos] = useState<{ x: number; y: number } | null>(null)

  // Restore viewport on mount
  useEffect(() => {
    if (board?.viewport) {
      translateX.value = board.viewport.x
      translateY.value = board.viewport.y
      scale.value = board.viewport.zoom
      savedTranslateX.value = board.viewport.x
      savedTranslateY.value = board.viewport.y
      savedScale.value = board.viewport.zoom
      setJsTranslateX(board.viewport.x)
      setJsTranslateY(board.viewport.y)
      setJsScale(board.viewport.zoom)
    }
  }, [board?.id])

  // Save viewport on unmount
  useEffect(() => {
    return () => {
      saveViewport({ x: translateX.value, y: translateY.value, zoom: scale.value })
    }
  }, [])

  // Shift canvas when keyboard would cover the editing text
  const keyboardShiftRef = useRef(0)
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', (e) => {
      console.log('[KB] show, editingTextId:', editingTextId)
      if (!editingTextId) return
      const editingItem = items.find((i) => i.id === editingTextId)
      console.log('[KB] editingItem found:', !!editingItem, 'y:', editingItem?.y)
      if (!editingItem) return
      const itemScreenY = editingItem.y * jsScale + jsTranslateY + 40
      const keyboardTop = e.endCoordinates.screenY
      const needsShift = itemScreenY > keyboardTop - 60
      console.log('[KB] itemScreenY:', itemScreenY, 'keyboardTop:', keyboardTop, 'needsShift:', needsShift)
      if (needsShift) {
        const shift = itemScreenY - keyboardTop + 100
        const newY = jsTranslateY - shift
        console.log('[KB] shifting by:', shift, 'newY:', newY)
        keyboardShiftRef.current = shift
        translateY.value = newY
        savedTranslateY.value = newY
        setJsTranslateY(newY)
      }
    })
    const sub2 = Keyboard.addListener('keyboardDidHide', () => {
      console.log('[KB] hide, editingTextId:', editingTextId, 'shiftRef:', keyboardShiftRef.current, 'jsTranslateY:', jsTranslateY)
      if (keyboardShiftRef.current !== 0) {
        const newY = jsTranslateY + keyboardShiftRef.current
        console.log('[KB] restoring, newY:', newY)
        translateY.value = newY
        savedTranslateY.value = newY
        setJsTranslateY(newY)
        keyboardShiftRef.current = 0
      }
      // Close fly menu + clean up editing state after keyboard dismiss animation
      // finishes (~250ms). Clearing editingTextId synchronously would unmount the
      // TextInput mid-animation, causing iOS to briefly re-show the keyboard.
      if (flyMenu.visible) {
        dismissFlyMenu()
      }
      if (editingTextId) {
        setTimeout(() => {
          saveEditingText()
        }, 300)
      }
    })
    return () => { sub.remove(); sub2.remove() }
  }, [editingTextId, editingTextValue, items, jsScale, jsTranslateY, flyMenu.visible])

  // Save text when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        if (editingTextId) {
          saveEditingText()
        }
        saveViewport({ x: translateX.value, y: translateY.value, zoom: scale.value })
      }
    })
    return () => sub.remove()
  }, [editingTextId, editingTextValue])

  // Clear pending strokes once query data refreshes with the real strokes
  useEffect(() => {
    if (pendingStrokes.length > 0) {
      setPendingStrokes([])
    }
  }, [strokes])

  // Clear localOverride once items query refetches (avoids visual jump after move/resize)
  useEffect(() => {
    if (localOverride && !manipulationRef.current) {
      setLocalOv(null)
    }
  }, [items])

  // Merge query strokes + pending strokes for flicker-free rendering
  const allStrokes = useMemo(() => {
    if (pendingStrokes.length === 0) return strokes
    return [...strokes, ...pendingStrokes]
  }, [strokes, pendingStrokes])

  const syncTransformToJS = useCallback(() => {
    setJsTranslateX(translateX.value)
    setJsTranslateY(translateY.value)
    setJsScale(scale.value)
  }, [])

  // ── Gesture handlers ──────────────────────────────────

  // Two-finger pan
  const panGesture = Gesture.Pan()
    .minPointers(2)
    .onStart(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX
      translateY.value = savedTranslateY.value + e.translationY
      runOnJS(syncTransformToJS)()
    })
    .onEnd(() => {
      runOnJS(syncTransformToJS)()
      runOnJS(saveViewport)({ x: translateX.value, y: translateY.value, zoom: scale.value })
    })

  // Pinch zoom
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value
    })
    .onUpdate((e) => {
      const newScale = Math.min(Math.max(savedScale.value * e.scale, 0.1), 5)
      scale.value = newScale
      runOnJS(syncTransformToJS)()
    })
    .onEnd(() => {
      runOnJS(syncTransformToJS)()
      runOnJS(saveViewport)({ x: translateX.value, y: translateY.value, zoom: scale.value })
    })

  // ── Draw gesture helpers (called via runOnJS) ──────────

  function handleDrawStart(screenX: number, screenY: number) {
    console.log('[DRAW] handleDrawStart, screenY:', screenY, 'editingTextId:', editingTextId)
    // Save any editing text when drawing starts
    if (editingTextId) {
      saveEditingText()
    }

    const canvasX = (screenX - jsTranslateX) / jsScale
    const canvasY = (screenY - jsTranslateY) / jsScale

    // If an item is selected, check for handle hits using the ORIGINAL touch position
    // (before the Pan's minDistance moved the finger away from the handle)

    if (selectedItemId) {
      const selectedItem = items.find((i) => i.id === selectedItemId)

      if (selectedItem) {
        const handle = getHandleAtPosition(touchStartRef.current.x, touchStartRef.current.y, selectedItem)

        if (handle) {
          const bounds = { x: selectedItem.x, y: selectedItem.y, width: selectedItem.width, height: selectedItem.height }
          if (handle.startsWith('side-')) {
            // Start connection drag
            const side = handle.replace('side-', '')

            const sidePos = getSideMidpoint(selectedItem, side)
            setManip({ type: 'connection', itemId: selectedItem.id, handle: side, startScreen: { x: screenX, y: screenY }, startBounds: bounds })
            setConnectionPreview({
              fromItemId: selectedItem.id,
              fromSide: side,
              startX: sidePos.x * jsScale + jsTranslateX,
              startY: sidePos.y * jsScale + jsTranslateY,
              currentX: screenX,
              currentY: screenY,
            })
          } else {
            // Start resize
            setManip({ type: 'resize', itemId: selectedItem.id, handle, startScreen: { x: screenX, y: screenY }, startBounds: bounds })
            setLocalOv({ id: selectedItem.id, ...bounds })
          }
          return
        }

        // Check if touching inside the selected item → move
        let selW = selectedItem.width
        let selH = selectedItem.height
        if (selectedItem.type === 'text' && selW === 0 && selectedItem.content) {
          const measured = measuredSizes.current.get(selectedItem.id)
          if (measured) { selW = measured.width; selH = measured.height }
        }
        if (canvasX >= selectedItem.x && canvasX <= selectedItem.x + selW &&
            canvasY >= selectedItem.y && canvasY <= selectedItem.y + selH) {
          const bounds = { x: selectedItem.x, y: selectedItem.y, width: selectedItem.width, height: selectedItem.height }
          setManip({ type: 'move', itemId: selectedItem.id, startScreen: { x: screenX, y: screenY }, startBounds: bounds })
          setLocalOv({ id: selectedItem.id, ...bounds })
          return
        }
      }
    }

    // Check if touching a non-selected item — don't draw on items
    const hitItem = findItemAtPosition(canvasX, canvasY, items)
    if (hitItem) return

    // Start drawing
    isDrawingRef.current = true
    const path = Skia.Path.Make()
    path.moveTo(canvasX, canvasY)
    pathRef.current = path
    setCurrentPathString(path.toSVGString())
    dismissFlyMenu()
  }

  function handleDrawUpdate(screenX: number, screenY: number) {
    const manip = manipulationRef.current

    if (manip) {
      const dx = (screenX - manip.startScreen.x) / jsScale
      const dy = (screenY - manip.startScreen.y) / jsScale
      const b = manip.startBounds

      if (manip.type === 'move') {
        setLocalOv({ id: manip.itemId, x: b.x + dx, y: b.y + dy, width: b.width, height: b.height })
      } else if (manip.type === 'resize') {
        let newX = b.x, newY = b.y, newW = b.width, newH = b.height
        const h = manip.handle!
        if (h.includes('Right')) newW = Math.max(30, b.width + dx)
        if (h.includes('Left')) { newX = b.x + dx; newW = Math.max(30, b.width - dx) }
        if (h.includes('bottom') || h.includes('Bottom')) newH = Math.max(30, b.height + dy)
        if (h.includes('top') || h.includes('Top')) { newY = b.y + dy; newH = Math.max(30, b.height - dy) }
        setLocalOv({ id: manip.itemId, x: newX, y: newY, width: newW, height: newH })
      } else if (manip.type === 'connection') {
        setConnectionPreview((prev) => prev ? { ...prev, currentX: screenX, currentY: screenY } : null)
      }
      return
    }
    if (!isDrawingRef.current || !pathRef.current) return

    const canvasX = (screenX - jsTranslateX) / jsScale
    const canvasY = (screenY - jsTranslateY) / jsScale

    pathRef.current.lineTo(canvasX, canvasY)
    setCurrentPathString(pathRef.current.toSVGString())
  }

  function handleDrawEnd(screenX?: number, screenY?: number) {
    const manip = manipulationRef.current

    if (manip) {
      if (manip.type === 'move' || manip.type === 'resize') {
        // Save final position/size to DB — keep localOverride visible until mutation succeeds
        const ov = localOverrideRef.current
        if (ov) {
          updateItem.mutate({
            id: manip.itemId,
            data: { x: ov.x, y: ov.y, width: ov.width, height: ov.height },
          })
          // localOverride is cleared by useEffect on `items` once query refetch completes
        }
      } else if (manip.type === 'connection' && screenX !== undefined && screenY !== undefined) {
        // Check if released on another item
        const canvasX = (screenX - jsTranslateX) / jsScale
        const canvasY = (screenY - jsTranslateY) / jsScale
        const targetItem = findItemAtPosition(canvasX, canvasY, items)

        if (targetItem && targetItem.id !== manip.itemId) {
          // Determine which side of the target is closest
          const targetSide = getClosestSide(targetItem, canvasX, canvasY)

          createConnection.mutate(
            {
              fromItemId: manip.itemId,
              toItemId: targetItem.id,
              fromSide: manip.handle || 'right',
              toSide: targetSide,
            },
            {
              onError: (err) => console.error('[CONNECTION] failed:', err),
            }
          )
        } else {

        }
      }
      setManip(null)
      setConnectionPreview(null)
      // localOverride for move/resize is cleared in mutation onSuccess to avoid visual jump
      if (manip.type === 'connection') setLocalOv(null)
      return
    }
    if (!isDrawingRef.current || !pathRef.current) {
      isDrawingRef.current = false
      return
    }

    const pathData = pathRef.current.toSVGString()
    isDrawingRef.current = false
    pathRef.current = null
    saveStroke(pathData)
  }

  /** Get the canvas-space midpoint of an item's side */
  function getSideMidpoint(item: BoardItem, side: string) {
    switch (side) {
      case 'top': return { x: item.x + item.width / 2, y: item.y }
      case 'bottom': return { x: item.x + item.width / 2, y: item.y + item.height }
      case 'left': return { x: item.x, y: item.y + item.height / 2 }
      case 'right': return { x: item.x + item.width, y: item.y + item.height / 2 }
      default: return { x: item.x + item.width / 2, y: item.y + item.height / 2 }
    }
  }

  /** Get the closest side of an item to a canvas point */
  function getClosestSide(item: BoardItem, cx: number, cy: number): string {
    const sides = [
      { side: 'top', dist: Math.abs(cy - item.y) },
      { side: 'bottom', dist: Math.abs(cy - (item.y + item.height)) },
      { side: 'left', dist: Math.abs(cx - item.x) },
      { side: 'right', dist: Math.abs(cx - (item.x + item.width)) },
    ]
    return sides.sort((a, b) => a.dist - b.dist)[0].side
  }

  // Drawing gesture (one finger drag on empty space)
  const isDrawingRef = useRef(false)
  // Store original touch-down position (before Pan recognizes after minDistance)
  const touchStartRef = useRef({ x: 0, y: 0 })
  function storeTouchStart(x: number, y: number) {
    touchStartRef.current = { x, y }
  }
  const drawGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .minDistance(TAP_MOVE_THRESHOLD)
    .onBegin((e) => {
      runOnJS(storeTouchStart)(e.x, e.y)
    })
    .onStart((e) => {
      runOnJS(handleDrawStart)(e.x, e.y)
    })
    .onUpdate((e) => {
      runOnJS(handleDrawUpdate)(e.x, e.y)
    })
    .onEnd((e) => {
      runOnJS(handleDrawEnd)(e.x, e.y)
    })

  // Tap gesture — coord conversion done in JS via handleTap
  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      runOnJS(handleTapFromGesture)(e.x, e.y)
    })

  // Long press gesture — coord conversion done in JS
  const longPressGesture = Gesture.LongPress()
    .minDuration(LONG_PRESS_DURATION)
    .onStart((e) => {
      runOnJS(handleLongPressFromGesture)(e.x, e.y)
    })

  const composed = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
  )

  const exclusive = Gesture.Race(
    longPressGesture,
    drawGesture,
    tapGesture,
  )

  const allGestures = Gesture.Simultaneous(composed, exclusive)

  // ── Canvas-to-screen helpers ──────────────────────────

  function findItemAtPosition(cx: number, cy: number, itemList: BoardItem[]): BoardItem | null {
    // Search in reverse z-order (top items first)
    for (let i = itemList.length - 1; i >= 0; i--) {
      const item = itemList[i]
      // Skip empty text items (invisible, just created by tap)
      if (item.type === 'text' && !item.content) continue
      // For text items, use measured sizes as fallback when DB hasn't updated yet
      let w = item.width
      let h = item.height
      if (item.type === 'text' && w === 0 && item.content) {
        const measured = measuredSizes.current.get(item.id)
        if (measured) { w = measured.width; h = measured.height }
      }
      if (cx >= item.x && cx <= item.x + w && cy >= item.y && cy <= item.y + h) {
        return item
      }
    }
    return null
  }

  function findStrokeAtPosition(cx: number, cy: number, strokeList: BoardStroke[]): BoardStroke | null {
    const HIT_TOLERANCE = 15 // canvas-space pixels

    // Iterate in reverse z-order so topmost stroke wins
    for (let i = strokeList.length - 1; i >= 0; i--) {
      const stroke = strokeList[i]
      const tolerance = Math.max(stroke.width / 2, HIT_TOLERANCE)

      // Offset the test point to account for stroke movement
      const testX = cx - stroke.xOffset
      const testY = cy - stroke.yOffset

      // Parse SVG path to extract points (M x y L x y L x y ...)
      const points: { x: number; y: number }[] = []
      const parts = stroke.pathData.match(/[ML]\s*[-\d.e]+[\s,]+[-\d.e]+/gi)
      if (!parts) continue
      for (const part of parts) {
        const nums = part.match(/[-\d.e]+/gi)
        if (nums && nums.length >= 2) {
          points.push({ x: parseFloat(nums[0]), y: parseFloat(nums[1]) })
        }
      }
      if (points.length === 0) continue

      // Single point (dot) — check distance to that point
      if (points.length === 1) {
        const dx = testX - points[0].x
        const dy = testY - points[0].y
        if (dx * dx + dy * dy <= tolerance * tolerance) return stroke
        continue
      }

      // Check minimum distance to any line segment
      for (let j = 0; j < points.length - 1; j++) {
        const dist = pointToSegmentDist(testX, testY, points[j], points[j + 1])
        if (dist <= tolerance) return stroke
      }
    }
    return null
  }

  /** Distance from point (px, py) to the closest point on segment (a, b) */
  function pointToSegmentDist(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
    const abx = b.x - a.x
    const aby = b.y - a.y
    const lenSq = abx * abx + aby * aby
    if (lenSq === 0) {
      // Degenerate segment (a == b)
      const dx = px - a.x
      const dy = py - a.y
      return Math.sqrt(dx * dx + dy * dy)
    }
    let t = ((px - a.x) * abx + (py - a.y) * aby) / lenSq
    t = Math.max(0, Math.min(1, t))
    const closestX = a.x + t * abx
    const closestY = a.y + t * aby
    const dx = px - closestX
    const dy = py - closestY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const HANDLE_HIT_SIZE = 28 // touch target for handles

  /** Check if a screen-space tap hits a handle on the selected item. Returns handle key or null. */
  function getHandleAtPosition(screenX: number, screenY: number, item: BoardItem): string | null {
    let w = item.width
    let h = item.height
    if (item.type === 'text' && w === 0 && item.content) {
      const measured = measuredSizes.current.get(item.id)
      if (measured) { w = measured.width; h = measured.height }
    }
    const ix = item.x * jsScale + jsTranslateX
    const iy = item.y * jsScale + jsTranslateY
    const iw = w * jsScale
    const ih = h * jsScale
    const half = HANDLE_HIT_SIZE / 2

    // Side midpoint dots (connections) — check first, higher priority
    const sides = [
      { key: 'side-top', x: ix + iw / 2, y: iy },
      { key: 'side-bottom', x: ix + iw / 2, y: iy + ih },
      { key: 'side-left', x: ix, y: iy + ih / 2 },
      { key: 'side-right', x: ix + iw, y: iy + ih / 2 },
    ]
    for (const s of sides) {
      if (Math.abs(screenX - s.x) < half && Math.abs(screenY - s.y) < half) return s.key
    }

    // Corner handles (resize) — skip for audio items
    if (item.type !== 'audio') {
      const corners = [
        { key: 'topLeft', x: ix, y: iy },
        { key: 'topRight', x: ix + iw, y: iy },
        { key: 'bottomLeft', x: ix, y: iy + ih },
        { key: 'bottomRight', x: ix + iw, y: iy + ih },
      ]
      for (const c of corners) {
        if (Math.abs(screenX - c.x) < half && Math.abs(screenY - c.y) < half) return c.key
      }
    }

    return null
  }

  // ── Gesture → JS wrappers ──────────────────────────────

  function handleTapFromGesture(screenX: number, screenY: number) {
    const canvasX = (screenX - jsTranslateX) / jsScale
    const canvasY = (screenY - jsTranslateY) / jsScale
    handleTap(canvasX, canvasY, screenX, screenY)
  }

  function handleLongPressFromGesture(screenX: number, screenY: number) {
    const canvasX = (screenX - jsTranslateX) / jsScale
    const canvasY = (screenY - jsTranslateY) / jsScale
    handleLongPress(canvasX, canvasY)
  }

  // ── Tap handler ──────────────────────────────────────

  function handleTap(canvasX: number, canvasY: number, screenX: number, screenY: number) {
    console.log('[TAP] handleTap called, screenY:', screenY, 'editingTextId:', editingTextId)

    // If fly menu is visible, this tap is to dismiss it (or was on a fly menu button)
    if (flyMenu.visible) {
      dismissFlyMenu()
      // If we had a pending empty text item, delete it
      if (editingTextId && editingTextValue === '') {
        deleteItem.mutate(editingTextId)
        setEditingTextId(null)
        setEditingTextValue('')
        Keyboard.dismiss()
      }
      return
    }

    // Save any editing text first — if we were editing, this tap is to dismiss the keyboard,
    // NOT to create a new text item.
    if (editingTextId) {
      saveEditingText()
      return
    }

    // If something is selected, just deselect — don't create new text or select another item
    if (selectedItemId || selectedStrokeId || selectedConnectionId) {
      setSelectedItemId(null)
      setSelectedStrokeId(null)
      setSelectedConnectionId(null)
      return
    }

    // Check if tapping an item
    const hitItem = findItemAtPosition(canvasX, canvasY, items)

    if (hitItem) {
      if (hitItem.type === 'text' && hitItem.content) {
        // Tap on text → cursor at end
        console.log('[FOCUS] setting editingTextId to', hitItem.id, '(tap on existing text)')
        setEditingTextId(hitItem.id)
        setEditingTextValue(hitItem.content || '')
        setTimeout(() => {
          const ref = textInputRefs.current.get(hitItem.id)
          console.log('[FOCUS] calling .focus() for', hitItem.id, 'ref exists:', !!ref)
          ref?.focus()
        }, 100)
      } else if (hitItem.type === 'audio' && hitItem.audioUri) {
        // Tap on audio → play/pause
        toggleAudio(hitItem.id, resolveAttachmentUri(hitItem.audioUri) || hitItem.audioUri)
      }
      return
    }

    // Tap on empty space → show fly menu + create pending text item
    setFlyMenuCanvasPos({ x: canvasX, y: canvasY })
    setFlyMenu({ visible: true, x: screenX, y: screenY })

    // Create text item — keyboard opens so user can start typing
    createItem.mutate(
      {
        type: 'text',
        x: canvasX,
        y: canvasY,
        width: 0,
        height: 0,
        content: '',
        strokeColor: drawColor,
      },
      {
        onSuccess: (newItem) => {

          if (newItem) {
            setEditingTextId(newItem.id)
            setEditingTextValue('')
            console.log('[FOCUS] setting editingTextId to', newItem.id, '(new text item created)')
            setTimeout(() => {
              const ref = textInputRefs.current.get(newItem.id)
              console.log('[FOCUS] calling .focus() for', newItem.id, 'ref exists:', !!ref)
              ref?.focus()
            }, 200)
          }
        },
        onError: (err) => {

        },
      }
    )
  }

  // ── Long press handler ──────────────────────────────

  function handleLongPress(canvasX: number, canvasY: number) {
    if (editingTextId) {
      saveEditingText()
    }

    const hitItem = findItemAtPosition(canvasX, canvasY, items)
    if (hitItem) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setSelectedItemId(hitItem.id)
      setSelectedStrokeId(null)
      setSelectedConnectionId(null)
      setFlyMenu({ visible: false, x: 0, y: 0 })
      return
    }

    const hitStroke = findStrokeAtPosition(canvasX, canvasY, allStrokes)
    if (hitStroke) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setSelectedStrokeId(hitStroke.id)
      setSelectedItemId(null)
      setSelectedConnectionId(null)
      setFlyMenu({ visible: false, x: 0, y: 0 })
      return
    }

    // Nothing hit — deselect
    setSelectedItemId(null)
    setSelectedStrokeId(null)
    setSelectedConnectionId(null)
  }

  // ── Drawing helpers ──────────────────────────────────

  function saveStroke(pathData: string) {
    if (!pathData || pathData.length < 5) {
      setCurrentPathString(null)
      return
    }

    // Add to pending strokes immediately so there's no visual gap
    const tempId = `pending-${Date.now()}`
    setPendingStrokes((prev) => [
      ...prev,
      {
        id: tempId,
        boardId: id || '',
        pathData,
        color: drawColor,
        width: drawWidth,
        opacity: 1,
        xOffset: 0,
        yOffset: 0,
        createdAt: new Date().toISOString(),
      },
    ])
    // Clear active drawing path immediately — pending stroke takes over
    setCurrentPathString(null)

    createStroke.mutate(
      { pathData, color: drawColor, width: drawWidth },
      {
        onSuccess: (newStroke) => {

          if (newStroke) {
            setUndoStack((prev) => [...prev, newStroke.id])
            setRedoStack([])
          }
        },
        onError: (err) => {

        },
      }
    )
  }

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const lastId = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))
    setRedoStack((prev) => [...prev, lastId])
    deleteStroke.mutate(lastId)
  }, [undoStack, deleteStroke])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    // Redo would require re-creating the stroke, which we don't have data for after deletion
    // For now, redo is a no-op placeholder
    // A proper implementation would store the full stroke data
  }, [redoStack])

  // ── Text editing ──────────────────────────────────────

  function saveEditingText() {
    console.log('[SAVE] saveEditingText called, editingTextId:', editingTextId, 'value:', editingTextValue?.slice(0, 20))
    if (!editingTextId) return

    if (editingTextValue.trim() === '') {
      console.log('[SAVE] empty → deleting item', editingTextId)
      deleteItem.mutate(editingTextId)
    } else {
      console.log('[SAVE] saving content for', editingTextId)
      updateItem.mutate({ id: editingTextId, data: { content: editingTextValue } })
    }
    setEditingTextId(null)
    setEditingTextValue('')
    // Don't call Keyboard.dismiss() here — if called from onBlur (system minimize),
    // the keyboard is already hiding and dismiss() causes a re-show glitch.
    // Callers that need explicit dismiss (cleanupPendingText, fly menu) do it themselves.
  }

  function dismissFlyMenu() {
    setFlyMenu({ visible: false, x: 0, y: 0 })
  }

  // ── Fly menu actions ──────────────────────────────────

  function cleanupPendingText() {
    if (editingTextId) {
      deleteItem.mutate(editingTextId)
      setEditingTextId(null)
      setEditingTextValue('')
      Keyboard.dismiss()
    }
    dismissFlyMenu()
  }

  const handleFlyImage = useCallback(async () => {
    const pos = { ...flyMenuCanvasPos }
    cleanupPendingText()

    const result = await showImageSourcePicker()
    if (result && result.localUri) {
      createItem.mutate({
        type: 'image',
        x: pos.x,
        y: pos.y,
        width: 150,
        height: result.height && result.width ? (150 * result.height) / result.width : 150,
        imageUri: result.localUri,
      })
    }
  }, [flyMenuCanvasPos, showImageSourcePicker, createItem, editingTextId, deleteItem])

  const handleFlyRectangle = useCallback(() => {
    const pos = { ...flyMenuCanvasPos }
    cleanupPendingText()

    createItem.mutate({
      type: 'shape',
      x: pos.x,
      y: pos.y,
      width: 150,
      height: 100,
      strokeColor: drawColor,
      strokeWidth: 2,
    })
  }, [flyMenuCanvasPos, createItem, drawColor, editingTextId, deleteItem])

  const handleFlyAudio = useCallback(async () => {
    const pos = { ...flyMenuCanvasPos }
    cleanupPendingText()

    setPendingAudioPos(pos)
    const started = await startRecording()
    if (!started) {
      Alert.alert('Cannot Record', 'Unable to start recording.')
      setPendingAudioPos(null)
    }
  }, [flyMenuCanvasPos, startRecording, editingTextId, deleteItem])

  const handleStopRecording = useCallback(async () => {
    const result = await stopRecording()
    if (result && pendingAudioPos) {
      createItem.mutate({
        type: 'audio',
        x: pendingAudioPos.x,
        y: pendingAudioPos.y,
        width: 50,
        height: 50,
        audioUri: result.localUri!,
        audioDuration: result.duration,
      })
    }
    setPendingAudioPos(null)
  }, [stopRecording, pendingAudioPos, createItem])

  // ── Selected text item (for toolbar text controls) ──────
  const selectedTextItem = useMemo(() => {
    if (!selectedItemId) return null
    const item = items.find((i) => i.id === selectedItemId)
    return item?.type === 'text' ? item : null
  }, [selectedItemId, items])

  const handleFontSizeChange = useCallback((size: number) => {
    if (!selectedItemId) return
    updateItem.mutate({ id: selectedItemId, data: { fontSize: size } })
  }, [selectedItemId, updateItem])

  const handleBoldToggle = useCallback(() => {
    if (!selectedTextItem) return
    const newWeight = selectedTextItem.fontWeight === 'bold' ? 'normal' : 'bold'
    updateItem.mutate({ id: selectedTextItem.id, data: { fontWeight: newWeight } })
  }, [selectedTextItem, updateItem])

  // ── Delete selected ──────────────────────────────────

  const handleDeleteSelected = useCallback(() => {
    if (selectedItemId) {
      deleteItem.mutate(selectedItemId)
      setSelectedItemId(null)
    } else if (selectedStrokeId) {
      deleteStroke.mutate(selectedStrokeId)
      setSelectedStrokeId(null)
    } else if (selectedConnectionId) {
      deleteConnection.mutate(selectedConnectionId)
      setSelectedConnectionId(null)
    }
  }, [selectedItemId, selectedStrokeId, selectedConnectionId, deleteItem, deleteStroke, deleteConnection])

  // ── Text input on change → dismiss fly menu ──────────

  const handleTextChange = useCallback((text: string) => {
    setEditingTextValue(text)
    if (text.length > 0 && flyMenu.visible) {
      dismissFlyMenu()
    }
  }, [flyMenu.visible])

  // ── Navigation ──────────────────────────────────────

  // Returns true if something was intercepted (didn't navigate back)
  const handleBack = useCallback(() => {
    // 1. Dismiss fly menu first
    if (flyMenu.visible) {
      cleanupPendingText()
      return true
    }
    // 2. Save editing text + dismiss keyboard
    if (editingTextId) {
      saveEditingText()
      Keyboard.dismiss()
      return true
    }
    // 3. Deselect any selected item/stroke/connection
    if (selectedItemId || selectedStrokeId || selectedConnectionId) {
      setSelectedItemId(null)
      setSelectedStrokeId(null)
      setSelectedConnectionId(null)
      return true
    }
    // 4. Nothing to intercept → navigate back
    router.back()
    return false
  }, [router, editingTextId, flyMenu.visible, selectedItemId, selectedStrokeId, selectedConnectionId])

  // Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      return handleBack()
    })
    return () => sub.remove()
  }, [handleBack])

  const handleBoardPress = useCallback(() => {
    if (editingTextId) saveEditingText()
    router.push(`/board/${id}/info`)
  }, [router, id, editingTextId])

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: `Check out my board: ${board?.name}` })
    } catch {}
  }, [board?.name])

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setCanvasSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
  }, [])

  // ── Animated style for items layer ──────────────────

  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  if (!board) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <Text color="$colorSubtle">Loading...</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor="$background" paddingBottom={insets.bottom}>
      <BoardHeader
        board={board}
        zoom={jsScale}
        onBack={handleBack}
        onBoardPress={handleBoardPress}
        onShare={handleShare}
      />

      <View style={{ flex: 1 }}>
        {/* Canvas area */}
        <View style={{ flex: 1 }} onLayout={handleLayout}>
          <GestureDetector gesture={allGestures}>
            <Animated.View style={{ flex: 1 }}>
              {/* Background pattern */}
              {canvasSize.width > 0 && (
                <CanvasBackground
                  patternType={board.patternType}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  translateX={jsTranslateX}
                  translateY={jsTranslateY}
                  scale={jsScale}
                />
              )}

              {/* Strokes layer */}
              {canvasSize.width > 0 && (
                <StrokeLayer
                  strokes={allStrokes}
                  currentPath={currentPathString}
                  currentColor={drawColor}
                  currentWidth={drawWidth}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  translateX={jsTranslateX}
                  translateY={jsTranslateY}
                  scale={jsScale}
                  isDark={isDark}
                  selectedStrokeId={selectedStrokeId}
                />
              )}

              {/* Items layer — rendered as positioned RN views */}
              {items.map((item) => {
                // Use local override for the item being manipulated (smooth drag/resize)
                const ov = localOverride?.id === item.id ? localOverride : null
                const ix = ov ? ov.x : item.x
                const iy = ov ? ov.y : item.y
                let iw = ov ? ov.width : item.width
                let ih = ov ? ov.height : item.height
                const isText = item.type === 'text'

                // For text items with width=0 in DB, use measured size for hit areas & handles
                if (isText && iw === 0 && item.content) {
                  const measured = measuredSizes.current.get(item.id)
                  if (measured) { iw = measured.width; ih = measured.height }
                }

                const screenX = ix * jsScale + jsTranslateX
                const screenY = iy * jsScale + jsTranslateY
                const screenW = iw * jsScale
                const screenH = ih * jsScale
                const isSelected = selectedItemId === item.id
                const isEditing = editingTextId === item.id

                // Viewport culling (use generous bounds for text since stored size may be 0)
                const cullW = isText ? TEXT_MAX_WIDTH * jsScale : screenW
                const cullH = isText ? Math.max(100, screenH) : screenH
                if (
                  screenX + cullW < -50 || screenX > canvasSize.width + 50 ||
                  screenY + cullH < -50 || screenY > canvasSize.height + 50
                ) {
                  return null
                }

                return (
                  <View
                    key={item.id}
                    onLayout={isText && !isEditing ? (e) => {
                      // Measure actual text size and persist to DB for hit testing
                      const { width: lw, height: lh } = e.nativeEvent.layout
                      const canvasW = lw / jsScale
                      const canvasH = lh / jsScale
                      // Store locally for immediate hit-testing (before DB round-trip)
                      measuredSizes.current.set(item.id, { width: canvasW, height: canvasH })
                      if (item.content && (Math.abs(canvasW - item.width) > 5 || Math.abs(canvasH - item.height) > 5)) {
                        updateItem.mutate({ id: item.id, data: { width: canvasW, height: canvasH } })
                      }
                    } : undefined}
                    style={{
                      position: 'absolute',
                      left: screenX,
                      top: screenY,
                      // Text items auto-size; others use stored dimensions
                      width: isText ? undefined : screenW,
                      maxWidth: isText ? TEXT_MAX_WIDTH * jsScale : undefined,
                      height: isText ? undefined : screenH,
                      minHeight: isText ? 20 : screenH,
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: isSelected ? accentColor : 'transparent',
                      borderRadius: item.type === 'audio' ? screenW / 2 : 0,
                    }}
                  >
                    {/* Text item */}
                    {item.type === 'text' && (
                      isEditing ? (
                        <TextInput
                          ref={(ref) => {
                            if (ref) {
                              console.log('[TI] mount/ref set for', item.id)
                              textInputRefs.current.set(item.id, ref)
                            }
                          }}
                          value={editingTextValue}
                          onChangeText={handleTextChange}
                          onBlur={() => {
                            console.log('[TI] onBlur fired for', item.id, 'editingTextId:', editingTextId)
                            setTimeout(() => saveEditingText(), 150)
                          }}
                          onFocus={() => {
                            console.log('[TI] onFocus fired for', item.id)
                          }}
                          style={{
                            fontSize: (item.fontSize || 16) * jsScale,
                            fontWeight: item.fontWeight === 'bold' ? 'bold' : 'normal',
                            color: item.strokeColor ? resolveStrokeColor(item.strokeColor, isDark) : color,
                            minWidth: 100 * jsScale,
                            maxWidth: TEXT_MAX_WIDTH * jsScale,
                            minHeight: 24 * jsScale,
                            padding: 0,
                          }}
                          multiline
                          autoFocus
                        />
                      ) : (
                        <Text
                          fontSize={(item.fontSize || 16) * jsScale}
                          fontWeight={item.fontWeight === 'bold' ? '700' : '400'}
                          color={item.strokeColor ? resolveStrokeColor(item.strokeColor, isDark) as any : '$color'}
                          style={{ maxWidth: TEXT_MAX_WIDTH * jsScale }}
                        >
                          {item.content || ''}
                        </Text>
                      )
                    )}

                    {/* Image item */}
                    {item.type === 'image' && item.imageUri && (
                      <ExpoImage
                        source={{ uri: resolveAttachmentUri(item.imageUri) || item.imageUri }}
                        style={{ width: screenW, height: screenH, borderRadius: 4 }}
                        contentFit="cover"
                      />
                    )}

                    {/* Shape (rectangle) item */}
                    {item.type === 'shape' && (
                      <View
                        style={{
                          width: screenW,
                          height: screenH,
                          borderWidth: (item.strokeWidth || 2) * jsScale,
                          borderColor: resolveStrokeColor(item.strokeColor || '#000000', isDark),
                          borderRadius: 4,
                          backgroundColor: item.fillColor || 'transparent',
                        }}
                      />
                    )}

                    {/* Audio item — play/pause circle */}
                    {item.type === 'audio' && (
                      <View
                        style={{
                          width: screenW,
                          height: screenW,
                          borderRadius: screenW / 2,
                          backgroundColor: '#ef4444',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons
                          name={playingNoteId === item.id && isPlaying ? 'pause' : 'play'}
                          size={screenW * 0.5}
                          color="white"
                        />
                      </View>
                    )}

                    {/* Selection handles */}
                    {isSelected && (
                      <>
                        {/* Corner resize handles (not for audio) */}
                        {item.type !== 'audio' && ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].map((corner) => {
                          const left = corner.includes('Left') ? -7 : screenW - 7
                          const top = corner.includes('top') ? -7 : (screenH || 0) - 7
                          return (
                            <View
                              key={corner}
                              style={{
                                position: 'absolute',
                                left,
                                top,
                                width: 14,
                                height: 14,
                                borderRadius: 7,
                                backgroundColor: accentColor,
                                borderWidth: 2,
                                borderColor: 'white',
                              }}
                            />
                          )
                        })}

                        {/* Side midpoint connection handles — larger with arrow icon */}
                        {[
                          { side: 'top', left: screenW / 2 - 12, top: -12, rotation: '-90deg' },
                          { side: 'bottom', left: screenW / 2 - 12, top: (screenH || 0) - 12, rotation: '90deg' },
                          { side: 'left', left: -12, top: (screenH || 0) / 2 - 12, rotation: '180deg' },
                          { side: 'right', left: screenW - 12, top: (screenH || 0) / 2 - 12, rotation: '0deg' },
                        ].map(({ side, left, top, rotation }) => (
                          <View
                            key={side}
                            style={{
                              position: 'absolute',
                              left,
                              top,
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: accentColor,
                              borderWidth: 2,
                              borderColor: 'white',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons
                              name="arrow-forward"
                              size={14}
                              color="white"
                              style={{ transform: [{ rotate: rotation }] }}
                            />
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )
              })}

              {/* Connections layer */}
              {canvasSize.width > 0 && (
                <ConnectionsLayer
                  connections={connections}
                  items={items}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  translateX={jsTranslateX}
                  translateY={jsTranslateY}
                  scale={jsScale}
                  selectedConnectionId={selectedConnectionId}
                  localOverride={localOverride}
                />
              )}

              {/* Connection drag preview line */}
              {connectionPreview && (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: connectionPreview.startX,
                    top: connectionPreview.startY,
                    width: Math.max(1, Math.abs(connectionPreview.currentX - connectionPreview.startX)),
                    height: Math.max(1, Math.abs(connectionPreview.currentY - connectionPreview.startY)),
                    overflow: 'visible',
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: Math.sqrt(
                        Math.pow(connectionPreview.currentX - connectionPreview.startX, 2) +
                        Math.pow(connectionPreview.currentY - connectionPreview.startY, 2)
                      ),
                      height: 2,
                      backgroundColor: accentColor,
                      transformOrigin: 'left center',
                      transform: [{
                        rotate: `${Math.atan2(
                          connectionPreview.currentY - connectionPreview.startY,
                          connectionPreview.currentX - connectionPreview.startX
                        ) * 180 / Math.PI}deg`,
                      }],
                    }}
                  />
                </View>
              )}
            </Animated.View>
          </GestureDetector>

          {/* Fly menu overlay */}
          <FlyMenu
            visible={flyMenu.visible}
            x={flyMenu.x}
            y={flyMenu.y}
            onImage={handleFlyImage}
            onRectangle={handleFlyRectangle}
            onAudio={handleFlyAudio}
            onDismiss={cleanupPendingText}
          />

          {/* Recording overlay */}
          {isRecording && (
            <YStack
              position="absolute"
              bottom={10}
              left={0}
              right={0}
              alignItems="center"
            >
              <XStack
                backgroundColor="$backgroundStrong"
                borderRadius="$4"
                paddingHorizontal="$4"
                paddingVertical="$3"
                gap="$3"
                alignItems="center"
                elevation={4}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' }} />
                <Text color="$color">{Math.floor(voiceDuration)}s</Text>
                <Pressable onPress={handleStopRecording}>
                  <XStack
                    backgroundColor="#ef4444"
                    borderRadius="$2"
                    paddingHorizontal="$3"
                    paddingVertical="$1"
                  >
                    <Text color="white" fontWeight="600">Stop</Text>
                  </XStack>
                </Pressable>
                <Pressable onPress={() => { cancelRecording(); setPendingAudioPos(null) }}>
                  <Text color="$colorSubtle">Cancel</Text>
                </Pressable>
              </XStack>
            </YStack>
          )}
        </View>

        {/* Drawing toolbar */}
        <DrawingToolbar
          selectedColor={drawColor}
          selectedWidth={drawWidth}
          onColorChange={(c) => {
            setDrawColor(c)
            // Also update the selected item's color
            if (selectedItemId) {
              updateItem.mutate({ id: selectedItemId, data: { strokeColor: c } })
            }
          }}
          onWidthChange={setDrawWidth}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoStack.length > 0}
          canRedo={false}
          textSelected={!!selectedTextItem}
          textFontSize={selectedTextItem?.fontSize || 16}
          textBold={selectedTextItem?.fontWeight === 'bold'}
          onFontSizeChange={handleFontSizeChange}
          onBoldToggle={handleBoldToggle}
          showDelete={!!(selectedItemId || selectedStrokeId || selectedConnectionId)}
          onDelete={handleDeleteSelected}
        />
      </View>
    </YStack>
  )
}
