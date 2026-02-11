import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Alert,
    AppState,
    BackHandler,
    Keyboard,
    LayoutChangeEvent,
    Pressable,
    Share,
    TextInput,
    View
} from 'react-native'
// KeyboardAvoidingView removed — infinite canvas handles keyboard avoidance
// by shifting translateY directly
import { Ionicons } from '@expo/vector-icons'
import { Skia } from '@shopify/react-native-skia'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
    Gesture,
    GestureDetector
} from 'react-native-gesture-handler'
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text, XStack, YStack } from 'tamagui'

import { Image as ExpoImage } from 'expo-image'
import { BoardHeader } from '../../../components/board/BoardHeader'
import { CanvasBackground } from '../../../components/board/CanvasBackground'
import { ConnectionsLayer } from '../../../components/board/ConnectionsLayer'
import { DrawingToolbar, getDefaultDrawColor, resolveStrokeColor } from '../../../components/board/DrawingToolbar'
import { FlyMenu } from '../../../components/board/FlyMenu'
import { StrokeLayer } from '../../../components/board/StrokeLayer'
import { useAppTheme } from '../../../contexts/ThemeContext'
import { useAttachmentHandler } from '../../../hooks/useAttachmentHandler'
import { useAudioPlayer } from '../../../hooks/useAudioPlayer'
import {
    useBatchDelete,
    useBatchUpdatePositions,
    useBoard,
    useBoardConnections,
    useBoardItems,
    useBoardStrokes,
    useCreateBoardConnection,
    useCreateBoardItem,
    useCreateBoardStroke,
    useDeleteBoardConnection,
    useDeleteBoardItem,
    useDeleteBoardStroke,
    useGroupItems,
    useSaveViewport,
    useUngroupItems,
    useUpdateBoardItem,
    useUpdateBoardStroke,
} from '../../../hooks/useBoards'
import { useThemeColor } from '../../../hooks/useThemeColor'
import { useVoiceRecorder } from '../../../hooks/useVoiceRecorder'
import { generateUUID } from '../../../services/database'
import { resolveAttachmentUri } from '../../../services/fileStorage'
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
  const groupItems = useGroupItems(id || '')
  const ungroupItems = useUngroupItems(id || '')
  const batchDelete = useBatchDelete(id || '')
  const batchUpdatePositions = useBatchUpdatePositions(id || '')

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
  // Undo stack — tracks all reversible actions
  type UndoAction =
    | { type: 'create-stroke'; strokeId: string }
    | { type: 'create-item'; itemId: string }
    | { type: 'create-connection'; connectionId: string }
    | { type: 'delete'; items: BoardItem[]; strokes: BoardStroke[]; connections: BoardConnection[] }
    | { type: 'move'; itemMoves: { id: string; x: number; y: number; width: number; height: number }[]; strokeMoves: { id: string; xOffset: number; yOffset: number }[] }
    | { type: 'resize'; itemId: string; x: number; y: number; width: number; height: number }
    | { type: 'update-item'; itemId: string; field: string; oldValue: any }
    | { type: 'group'; itemIds: string[]; strokeIds: string[]; prevGroupIds: Record<string, string | null> }
    | { type: 'ungroup'; itemIds: string[]; strokeIds: string[]; prevGroupIds: Record<string, string | null> }
    | { type: 'batch-create'; itemIds: string[]; strokeIds: string[] }
  const MAX_UNDO = 50
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack((prev) => [...prev.slice(-MAX_UNDO + 1), action])
  }, [])

  // Pending strokes — drawn but not yet in query data
  const [pendingStrokes, setPendingStrokes] = useState<BoardStroke[]>([])

  // Merge query strokes + pending strokes for flicker-free rendering
  const allStrokes = useMemo(() => {
    if (pendingStrokes.length === 0) return strokes
    return [...strokes, ...pendingStrokes]
  }, [strokes, pendingStrokes])

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

  // Selection state — Set-based for multi-select
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<Set<string>>(new Set())
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set())

  const hasSelection = selectedItemIds.size > 0 || selectedStrokeIds.size > 0 || selectedConnectionIds.size > 0
  const selectionCount = selectedItemIds.size + selectedStrokeIds.size + selectedConnectionIds.size

  const clearSelection = useCallback(() => {
    setSelectedItemIds(new Set())
    setSelectedStrokeIds(new Set())
    setSelectedConnectionIds(new Set())
    setIsMarqueeMode(false)
  }, [])

  const selectItem = useCallback((itemId: string, additive = false) => {
    if (additive) {
      setSelectedItemIds((prev) => new Set(prev).add(itemId))
    } else {
      setSelectedItemIds(new Set([itemId]))
      setSelectedStrokeIds(new Set())
      setSelectedConnectionIds(new Set())
    }
  }, [])

  const selectStroke = useCallback((strokeId: string, additive = false) => {
    if (additive) {
      setSelectedStrokeIds((prev) => new Set(prev).add(strokeId))
    } else {
      setSelectedStrokeIds(new Set([strokeId]))
      setSelectedItemIds(new Set())
      setSelectedConnectionIds(new Set())
    }
  }, [])

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  const toggleStrokeSelection = useCallback((strokeId: string) => {
    setSelectedStrokeIds((prev) => {
      const next = new Set(prev)
      if (next.has(strokeId)) next.delete(strokeId)
      else next.add(strokeId)
      return next
    })
  }, [])

  const selectGroup = useCallback((groupId: string) => {
    const groupItemIds = items.filter((i) => i.groupId === groupId).map((i) => i.id)
    const groupStrokeIds = allStrokes.filter((s) => s.groupId === groupId).map((s) => s.id)
    setSelectedItemIds(new Set(groupItemIds))
    setSelectedStrokeIds(new Set(groupStrokeIds))
    setSelectedConnectionIds(new Set())
  }, [items, allStrokes])

  const toggleGroup = useCallback((groupId: string, additive: boolean) => {
    const groupItemIds = items.filter((i) => i.groupId === groupId).map((i) => i.id)
    const groupStrokeIds = allStrokes.filter((s) => s.groupId === groupId).map((s) => s.id)
    if (additive) {
      // Check if all members already selected → deselect them, else select them
      const allSelected = groupItemIds.every((id) => selectedItemIds.has(id)) &&
                          groupStrokeIds.every((id) => selectedStrokeIds.has(id))
      if (allSelected) {
        setSelectedItemIds((prev) => {
          const next = new Set(prev)
          groupItemIds.forEach((id) => next.delete(id))
          return next
        })
        setSelectedStrokeIds((prev) => {
          const next = new Set(prev)
          groupStrokeIds.forEach((id) => next.delete(id))
          return next
        })
      } else {
        setSelectedItemIds((prev) => {
          const next = new Set(prev)
          groupItemIds.forEach((id) => next.add(id))
          return next
        })
        setSelectedStrokeIds((prev) => {
          const next = new Set(prev)
          groupStrokeIds.forEach((id) => next.add(id))
          return next
        })
      }
    } else {
      selectGroup(groupId)
    }
  }, [items, allStrokes, selectedItemIds, selectedStrokeIds, selectGroup])

  // Marquee state
  const [isMarqueeMode, setIsMarqueeMode] = useState(false)
  const [marqueeRect, setMarqueeRect] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)

  // Clipboard state
  const [clipboard, setClipboard] = useState<{ items: BoardItem[]; strokes: BoardStroke[] } | null>(null)
  const pasteOffsetRef = useRef(0)

  // Manipulation state — move, resize, connection drag, or marquee
  // Uses ref + state: ref for immediate reads inside gesture callbacks (avoids stale closures),
  // state for triggering re-renders.
  type ManipulationState = {
    type: 'move' | 'resize' | 'connection' | 'marquee'
    itemId: string
    handle?: string   // corner key for resize, side for connection
    startScreen: { x: number; y: number }
    startBounds: { x: number; y: number; width: number; height: number }
    startPositions?: Map<string, { x: number; y: number; width: number; height: number }>
    startStrokeOffsets?: Map<string, { xOffset: number; yOffset: number }>
  } | null
  const manipulationRef = useRef<ManipulationState>(null)
  const [manipulation, _setManipulation] = useState<ManipulationState>(null)
  const setManip = useCallback((val: ManipulationState) => {
    manipulationRef.current = val
    _setManipulation(val)
  }, [])

  // Optimistic local overrides for items being moved/resized (avoids DB writes per frame)
  type LocalOverridesState = Map<string, { x: number; y: number; width: number; height: number }>
  const localOverridesRef = useRef<LocalOverridesState>(new Map())
  const [localOverrides, _setLocalOverrides] = useState<LocalOverridesState>(new Map())
  const setLocalOvs = useCallback((val: LocalOverridesState) => {
    localOverridesRef.current = val
    _setLocalOverrides(val)
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

  // Clear localOverrides once items query refetches (avoids visual jump after move/resize)
  useEffect(() => {
    if (localOverrides.size > 0 && !manipulationRef.current) {
      setLocalOvs(new Map())
    }
  }, [items])

  const syncTransformToJS = useCallback(() => {
    setJsTranslateX(translateX.value)
    setJsTranslateY(translateY.value)
    setJsScale(scale.value)
  }, [])

  // ── Gesture handlers ──────────────────────────────────

  // Track whether pinch is active so pan can compensate
  const isPinching = useSharedValue(false)
  const pinchFocalX = useSharedValue(0)
  const pinchFocalY = useSharedValue(0)

  // Two-finger pan
  const panGesture = Gesture.Pan()
    .minPointers(2)
    .onStart(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })
    .onUpdate((e) => {
      // Skip translation while pinching — pinch handler manages position via focal point
      if (isPinching.value) return
      translateX.value = savedTranslateX.value + e.translationX
      translateY.value = savedTranslateY.value + e.translationY
      runOnJS(syncTransformToJS)()
    })
    .onEnd(() => {
      runOnJS(syncTransformToJS)()
      runOnJS(saveViewport)({ x: translateX.value, y: translateY.value, zoom: scale.value })
    })

  // Pinch zoom — zooms toward focal point so content stays under fingers
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = scale.value
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
      pinchFocalX.value = e.focalX
      pinchFocalY.value = e.focalY
      isPinching.value = true
    })
    .onUpdate((e) => {
      const newScale = Math.min(Math.max(savedScale.value * e.scale, 0.1), 5)
      // Adjust translation so the focal point stays fixed on screen
      const fx = pinchFocalX.value
      const fy = pinchFocalY.value
      translateX.value = fx - (fx - savedTranslateX.value) * (newScale / savedScale.value)
      translateY.value = fy - (fy - savedTranslateY.value) * (newScale / savedScale.value)
      scale.value = newScale
      runOnJS(syncTransformToJS)()
    })
    .onEnd(() => {
      isPinching.value = false
      runOnJS(syncTransformToJS)()
      runOnJS(saveViewport)({ x: translateX.value, y: translateY.value, zoom: scale.value })
    })

  // ── Draw gesture helpers (called via runOnJS) ──────────

  function handleDrawStart(screenX: number, screenY: number) {
    // Save any editing text when drawing starts
    if (editingTextId) {
      saveEditingText()
    }

    const canvasX = (screenX - jsTranslateX) / jsScale
    const canvasY = (screenY - jsTranslateY) / jsScale

    // Marquee mode — start drawing a selection rectangle
    if (isMarqueeMode) {
      setManip({ type: 'marquee', itemId: '', startScreen: { x: screenX, y: screenY }, startBounds: { x: canvasX, y: canvasY, width: 0, height: 0 } })
      setMarqueeRect({ startX: screenX, startY: screenY, currentX: screenX, currentY: screenY })
      return
    }

    // If exactly one item selected, check for handle hits (resize/connection)
    if (selectedItemIds.size === 1 && selectedStrokeIds.size === 0) {
      const singleId = Array.from(selectedItemIds)[0]
      const selectedItem = items.find((i) => i.id === singleId)

      if (selectedItem) {
        const handle = getHandleAtPosition(touchStartRef.current.x, touchStartRef.current.y, selectedItem)

        if (handle) {
          const bounds = { x: selectedItem.x, y: selectedItem.y, width: selectedItem.width, height: selectedItem.height }
          if (handle.startsWith('side-')) {
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
            setManip({ type: 'resize', itemId: selectedItem.id, handle, startScreen: { x: screenX, y: screenY }, startBounds: bounds })
            setLocalOvs(new Map([[selectedItem.id, bounds]]))
          }
          return
        }
      }
    }

    // If we have selection, check if touching inside any selected item → multi-move
    if (hasSelection) {
      const hitSelected = findItemAtPosition(canvasX, canvasY, items.filter((i) => selectedItemIds.has(i.id)))
      if (hitSelected) {
        // Build start positions for all selected items
        const startPositions = new Map<string, { x: number; y: number; width: number; height: number }>()
        const overrides = new Map<string, { x: number; y: number; width: number; height: number }>()
        for (const itemId of selectedItemIds) {
          const item = items.find((i) => i.id === itemId)
          if (item) {
            const b = { x: item.x, y: item.y, width: item.width, height: item.height }
            startPositions.set(itemId, b)
            overrides.set(itemId, b)
          }
        }
        // Build start offsets for all selected strokes
        const startStrokeOffsets = new Map<string, { xOffset: number; yOffset: number }>()
        for (const strokeId of selectedStrokeIds) {
          const stroke = allStrokes.find((s) => s.id === strokeId)
          if (stroke) {
            startStrokeOffsets.set(strokeId, { xOffset: stroke.xOffset, yOffset: stroke.yOffset })
          }
        }
        setManip({
          type: 'move',
          itemId: hitSelected.id,
          startScreen: { x: screenX, y: screenY },
          startBounds: { x: hitSelected.x, y: hitSelected.y, width: hitSelected.width, height: hitSelected.height },
          startPositions,
          startStrokeOffsets,
        })
        setLocalOvs(overrides)
        return
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
        // Multi-item move: apply delta to all selected items
        if (manip.startPositions && manip.startPositions.size > 0) {
          const overrides = new Map<string, { x: number; y: number; width: number; height: number }>()
          manip.startPositions.forEach((pos, itemId) => {
            overrides.set(itemId, { x: pos.x + dx, y: pos.y + dy, width: pos.width, height: pos.height })
          })
          setLocalOvs(overrides)
        } else {
          // Single item move
          setLocalOvs(new Map([[manip.itemId, { x: b.x + dx, y: b.y + dy, width: b.width, height: b.height }]]))
        }
      } else if (manip.type === 'resize') {
        let newX = b.x, newY = b.y, newW = b.width, newH = b.height
        const h = manip.handle!
        if (h.includes('Right')) newW = Math.max(30, b.width + dx)
        if (h.includes('Left')) { newX = b.x + dx; newW = Math.max(30, b.width - dx) }
        if (h.includes('bottom') || h.includes('Bottom')) newH = Math.max(30, b.height + dy)
        if (h.includes('top') || h.includes('Top')) { newY = b.y + dy; newH = Math.max(30, b.height - dy) }
        setLocalOvs(new Map([[manip.itemId, { x: newX, y: newY, width: newW, height: newH }]]))
      } else if (manip.type === 'connection') {
        setConnectionPreview((prev) => prev ? { ...prev, currentX: screenX, currentY: screenY } : null)
      } else if (manip.type === 'marquee') {
        setMarqueeRect((prev) => prev ? { ...prev, currentX: screenX, currentY: screenY } : null)
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
      if (manip.type === 'move') {
        // Push undo with original positions
        const originalItemMoves = manip.startPositions
          ? Array.from(manip.startPositions.entries()).map(([id, pos]) => ({ id, ...pos }))
          : [{ id: manip.itemId, ...manip.startBounds }]
        const originalStrokeMoves = manip.startStrokeOffsets
          ? Array.from(manip.startStrokeOffsets.entries()).map(([id, off]) => ({ id, ...off }))
          : []
        pushUndo({ type: 'move', itemMoves: originalItemMoves, strokeMoves: originalStrokeMoves })

        // Multi-move: save all items + strokes
        const ovs = localOverridesRef.current
        if (ovs.size > 0) {
          const posUpdates = Array.from(ovs.entries()).map(([itemId, pos]) => ({
            id: itemId, x: pos.x, y: pos.y, width: pos.width, height: pos.height,
          }))
          if (posUpdates.length > 1) {
            batchUpdatePositions.mutate(posUpdates)
          } else if (posUpdates.length === 1) {
            updateItem.mutate({ id: posUpdates[0].id, data: posUpdates[0] })
          }
        }
        // Update stroke offsets
        if (manip.startStrokeOffsets && screenX !== undefined && screenY !== undefined) {
          const dx = (screenX - manip.startScreen.x) / jsScale
          const dy = (screenY - manip.startScreen.y) / jsScale
          manip.startStrokeOffsets.forEach((startOff, strokeId) => {
            updateStroke.mutate({
              id: strokeId,
              data: { xOffset: startOff.xOffset + dx, yOffset: startOff.yOffset + dy },
            })
          })
        }
      } else if (manip.type === 'resize') {
        const ovs = localOverridesRef.current
        const ov = ovs.get(manip.itemId)
        if (ov) {
          // Push undo with original bounds
          pushUndo({ type: 'resize', itemId: manip.itemId, ...manip.startBounds })
          updateItem.mutate({
            id: manip.itemId,
            data: { x: ov.x, y: ov.y, width: ov.width, height: ov.height },
          })
        }
      } else if (manip.type === 'connection' && screenX !== undefined && screenY !== undefined) {
        const canvasX = (screenX - jsTranslateX) / jsScale
        const canvasY = (screenY - jsTranslateY) / jsScale
        const targetItem = findItemAtPosition(canvasX, canvasY, items)

        if (targetItem && targetItem.id !== manip.itemId) {
          const targetSide = getClosestSide(targetItem, canvasX, canvasY)
          createConnection.mutate(
            {
              fromItemId: manip.itemId,
              toItemId: targetItem.id,
              fromSide: manip.handle || 'right',
              toSide: targetSide,
            },
            {
              onSuccess: (newConn) => {
                if (newConn) pushUndo({ type: 'create-connection', connectionId: newConn.id })
              },
              onError: (err) => console.error('[CONNECTION] failed:', err),
            }
          )
        }
      } else if (manip.type === 'marquee') {
        finishMarquee()
      }
      setManip(null)
      setConnectionPreview(null)
      setMarqueeRect(null)
      if (manip.type === 'connection') setLocalOvs(new Map())
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
      if (e.numberOfPointers > 1) return
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
    // If marquee mode is active, exit it
    if (isMarqueeMode) {
      setIsMarqueeMode(false)
      return
    }

    // If fly menu is visible, this tap is to dismiss it (or was on a fly menu button)
    if (flyMenu.visible) {
      dismissFlyMenu()
      if (editingTextId && editingTextValue === '') {
        deleteItem.mutate(editingTextId)
        setEditingTextId(null)
        setEditingTextValue('')
        Keyboard.dismiss()
      }
      return
    }

    // Save any editing text first
    if (editingTextId) {
      saveEditingText()
      return
    }

    // When we have a selection, tap is additive
    if (hasSelection) {
      const hitItem = findItemAtPosition(canvasX, canvasY, items)
      if (hitItem) {
        if (hitItem.groupId) {
          toggleGroup(hitItem.groupId, true)
        } else {
          toggleItemSelection(hitItem.id)
        }
        return
      }

      const hitStroke = findStrokeAtPosition(canvasX, canvasY, allStrokes)
      if (hitStroke) {
        if (hitStroke.groupId) {
          toggleGroup(hitStroke.groupId, true)
        } else {
          toggleStrokeSelection(hitStroke.id)
        }
        return
      }

      // Tap on empty space → clear selection
      clearSelection()
      return
    }

    // No selection — check if tapping an item
    const hitItem = findItemAtPosition(canvasX, canvasY, items)

    if (hitItem) {
      if (hitItem.type === 'text' && hitItem.content) {
        setEditingTextId(hitItem.id)
        setEditingTextValue(hitItem.content || '')
        setTimeout(() => {
          const ref = textInputRefs.current.get(hitItem.id)
          ref?.focus()
        }, 100)
      } else if (hitItem.type === 'audio' && hitItem.audioUri) {
        toggleAudio(hitItem.id, resolveAttachmentUri(hitItem.audioUri) || hitItem.audioUri)
      }
      return
    }

    // Tap on empty space → show fly menu + create pending text item
    setFlyMenuCanvasPos({ x: canvasX, y: canvasY })
    setFlyMenu({ visible: true, x: screenX, y: screenY })

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
            pushUndo({ type: 'create-item', itemId: newItem.id })
            setEditingTextId(newItem.id)
            setEditingTextValue('')
            setTimeout(() => {
              const ref = textInputRefs.current.get(newItem.id)
              ref?.focus()
            }, 200)
          }
        },
        onError: () => {},
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
      if (hitItem.groupId) {
        selectGroup(hitItem.groupId)
      } else {
        selectItem(hitItem.id)
      }
      setFlyMenu({ visible: false, x: 0, y: 0 })
      return
    }

    const hitStroke = findStrokeAtPosition(canvasX, canvasY, allStrokes)
    if (hitStroke) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      if (hitStroke.groupId) {
        selectGroup(hitStroke.groupId)
      } else {
        selectStroke(hitStroke.id)
      }
      setFlyMenu({ visible: false, x: 0, y: 0 })
      return
    }

    // Nothing hit — deselect
    clearSelection()
    setFlyMenu({ visible: false, x: 0, y: 0 })
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
        zIndex: 0,
        xOffset: 0,
        yOffset: 0,
        groupId: null,
        syncStatus: 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
    // Clear active drawing path immediately — pending stroke takes over
    setCurrentPathString(null)

    createStroke.mutate(
      { pathData, color: drawColor, width: drawWidth },
      {
        onSuccess: (newStroke) => {
          if (newStroke) {
            pushUndo({ type: 'create-stroke', strokeId: newStroke.id })
          }
        },
        onError: () => {},
      }
    )
  }

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const action = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))

    switch (action.type) {
      case 'create-stroke':
        deleteStroke.mutate(action.strokeId)
        break
      case 'create-item':
        deleteItem.mutate(action.itemId)
        break
      case 'create-connection':
        deleteConnection.mutate(action.connectionId)
        break
      case 'delete': {
        // Recreate deleted items, strokes, and connections
        const idMap = new Map<string, string>()
        let pendingItems = action.items.length
        let pendingStrokes = action.strokes.length
        const recreateConnections = () => {
          for (const conn of action.connections) {
            const newFrom = idMap.get(conn.fromItemId) ?? conn.fromItemId
            const newTo = idMap.get(conn.toItemId) ?? conn.toItemId
            createConnection.mutate({
              fromItemId: newFrom, toItemId: newTo,
              fromSide: conn.fromSide, toSide: conn.toSide,
              color: conn.color, strokeWidth: conn.strokeWidth,
            })
          }
        }
        const checkDone = () => {
          if (pendingItems <= 0 && pendingStrokes <= 0) recreateConnections()
        }
        for (const item of action.items) {
          createItem.mutate({
            type: item.type, x: item.x, y: item.y, width: item.width, height: item.height,
            content: item.content, imageUri: item.imageUri, audioUri: item.audioUri,
            audioDuration: item.audioDuration, strokeColor: item.strokeColor,
            strokeWidth: item.strokeWidth, fillColor: item.fillColor,
            fontSize: item.fontSize, fontWeight: item.fontWeight, groupId: item.groupId,
          }, {
            onSuccess: (newItem) => {
              if (newItem) idMap.set(item.id, newItem.id)
              pendingItems--
              checkDone()
            },
            onError: () => { pendingItems--; checkDone() },
          })
        }
        for (const stroke of action.strokes) {
          createStroke.mutate({
            pathData: stroke.pathData, color: stroke.color, width: stroke.width,
            opacity: stroke.opacity, xOffset: stroke.xOffset, yOffset: stroke.yOffset,
            groupId: stroke.groupId,
          }, {
            onSuccess: () => { pendingStrokes--; checkDone() },
            onError: () => { pendingStrokes--; checkDone() },
          })
        }
        if (action.items.length === 0 && action.strokes.length === 0) recreateConnections()
        break
      }
      case 'move': {
        // Restore original positions
        if (action.itemMoves.length > 1) {
          batchUpdatePositions.mutate(action.itemMoves)
        } else if (action.itemMoves.length === 1) {
          const m = action.itemMoves[0]
          updateItem.mutate({ id: m.id, data: { x: m.x, y: m.y, width: m.width, height: m.height } })
        }
        for (const sm of action.strokeMoves) {
          updateStroke.mutate({ id: sm.id, data: { xOffset: sm.xOffset, yOffset: sm.yOffset } })
        }
        break
      }
      case 'resize':
        updateItem.mutate({
          id: action.itemId,
          data: { x: action.x, y: action.y, width: action.width, height: action.height },
        })
        break
      case 'update-item':
        updateItem.mutate({ id: action.itemId, data: { [action.field]: action.oldValue } })
        break
      case 'group':
      case 'ungroup': {
        // Restore previous group IDs
        const itemIds = action.itemIds
        const strokeIds = action.strokeIds
        // Group by target groupId for batch operations
        const groupedItems = new Map<string, string[]>()
        const groupedStrokes = new Map<string, string[]>()
        for (const iid of itemIds) {
          const prev = action.prevGroupIds[iid] ?? '__null__'
          const list = groupedItems.get(prev) || []
          list.push(iid)
          groupedItems.set(prev, list)
        }
        for (const sid of strokeIds) {
          const prev = action.prevGroupIds[sid] ?? '__null__'
          const list = groupedStrokes.get(prev) || []
          list.push(sid)
          groupedStrokes.set(prev, list)
        }
        groupedItems.forEach((ids, gid) => {
          groupItems.mutate({ itemIds: ids, strokeIds: [], groupId: gid === '__null__' ? '' : gid })
        })
        groupedStrokes.forEach((ids, gid) => {
          groupItems.mutate({ itemIds: [], strokeIds: ids, groupId: gid === '__null__' ? '' : gid })
        })
        // For null groupId, use ungroup
        const nullItemIds = groupedItems.get('__null__') || []
        const nullStrokeIds = groupedStrokes.get('__null__') || []
        if (nullItemIds.length > 0 || nullStrokeIds.length > 0) {
          ungroupItems.mutate({ itemIds: nullItemIds, strokeIds: nullStrokeIds })
        }
        break
      }
      case 'batch-create':
        batchDelete.mutate({ itemIds: action.itemIds, strokeIds: action.strokeIds })
        break
    }
    clearSelection()
  }, [undoStack, deleteStroke, deleteItem, deleteConnection, createItem, createStroke, createConnection, updateItem, updateStroke, batchUpdatePositions, batchDelete, groupItems, ungroupItems, clearSelection])

  // ── Marquee helpers ──────────────────────────────────

  function getStrokeBounds(stroke: BoardStroke): { x: number; y: number; width: number; height: number } | null {
    const points: { x: number; y: number }[] = []
    const parts = stroke.pathData.match(/[ML]\s*[-\d.e]+[\s,]+[-\d.e]+/gi)
    if (!parts) return null
    for (const part of parts) {
      const nums = part.match(/[-\d.e]+/gi)
      if (nums && nums.length >= 2) {
        points.push({ x: parseFloat(nums[0]) + stroke.xOffset, y: parseFloat(nums[1]) + stroke.yOffset })
      }
    }
    if (points.length === 0) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of points) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  function finishMarquee() {
    if (!marqueeRect) return
    // Convert screen coords to canvas coords
    const sx = Math.min(marqueeRect.startX, marqueeRect.currentX)
    const sy = Math.min(marqueeRect.startY, marqueeRect.currentY)
    const ex = Math.max(marqueeRect.startX, marqueeRect.currentX)
    const ey = Math.max(marqueeRect.startY, marqueeRect.currentY)

    const csx = (sx - jsTranslateX) / jsScale
    const csy = (sy - jsTranslateY) / jsScale
    const cex = (ex - jsTranslateX) / jsScale
    const cey = (ey - jsTranslateY) / jsScale

    const newItemIds = new Set<string>()
    const newStrokeIds = new Set<string>()

    // Test items
    for (const item of items) {
      if (item.type === 'text' && !item.content) continue
      let w = item.width, h = item.height
      if (item.type === 'text' && w === 0 && item.content) {
        const measured = measuredSizes.current.get(item.id)
        if (measured) { w = measured.width; h = measured.height }
      }
      // Check intersection
      if (item.x + w >= csx && item.x <= cex && item.y + h >= csy && item.y <= cey) {
        if (item.groupId) {
          // Select entire group
          items.filter((i) => i.groupId === item.groupId).forEach((i) => newItemIds.add(i.id))
          allStrokes.filter((s) => s.groupId === item.groupId).forEach((s) => newStrokeIds.add(s.id))
        } else {
          newItemIds.add(item.id)
        }
      }
    }

    // Test strokes
    for (const stroke of allStrokes) {
      const bounds = getStrokeBounds(stroke)
      if (!bounds) continue
      if (bounds.x + bounds.width >= csx && bounds.x <= cex && bounds.y + bounds.height >= csy && bounds.y <= cey) {
        if (stroke.groupId) {
          items.filter((i) => i.groupId === stroke.groupId).forEach((i) => newItemIds.add(i.id))
          allStrokes.filter((s) => s.groupId === stroke.groupId).forEach((s) => newStrokeIds.add(s.id))
        } else {
          newStrokeIds.add(stroke.id)
        }
      }
    }

    setSelectedItemIds(newItemIds)
    setSelectedStrokeIds(newStrokeIds)
    setSelectedConnectionIds(new Set())
    setIsMarqueeMode(false)
  }

  // ── Clipboard handlers ──────────────────────────────

  const handleCut = useCallback(() => {
    const selectedItems = items.filter((i) => selectedItemIds.has(i.id))
    const selectedStrokes = allStrokes.filter((s) => selectedStrokeIds.has(s.id))
    setClipboard({ items: selectedItems, strokes: selectedStrokes })
    // Delete originals immediately
    batchDelete.mutate({
      itemIds: Array.from(selectedItemIds),
      strokeIds: Array.from(selectedStrokeIds),
    })
    pasteOffsetRef.current = 0
    clearSelection()
  }, [items, allStrokes, selectedItemIds, selectedStrokeIds, batchDelete, clearSelection])

  const handleCopy = useCallback(() => {
    const selectedItems = items.filter((i) => selectedItemIds.has(i.id))
    const selectedStrokes = allStrokes.filter((s) => selectedStrokeIds.has(s.id))
    setClipboard({ items: selectedItems, strokes: selectedStrokes })
    pasteOffsetRef.current = 0
    clearSelection()
  }, [items, allStrokes, selectedItemIds, selectedStrokeIds, clearSelection])

  const handlePaste = useCallback(() => {
    if (!clipboard) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Compute bounding box of clipboard content
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const item of clipboard.items) {
      minX = Math.min(minX, item.x)
      minY = Math.min(minY, item.y)
      maxX = Math.max(maxX, item.x + item.width)
      maxY = Math.max(maxY, item.y + item.height)
    }
    for (const stroke of clipboard.strokes) {
      const bounds = getStrokeBounds(stroke)
      if (bounds) {
        minX = Math.min(minX, bounds.x)
        minY = Math.min(minY, bounds.y)
        maxX = Math.max(maxX, bounds.x + bounds.width)
        maxY = Math.max(maxY, bounds.y + bounds.height)
      }
    }

    // Viewport center in canvas coords
    const viewCenterX = (canvasSize.width / 2 - jsTranslateX) / jsScale
    const viewCenterY = (canvasSize.height / 2 - jsTranslateY) / jsScale

    // Offset to move clipboard center to viewport center
    const clipCenterX = (minX + maxX) / 2
    const clipCenterY = (minY + maxY) / 2
    const dx = viewCenterX - clipCenterX + pasteOffsetRef.current
    const dy = viewCenterY - clipCenterY + pasteOffsetRef.current
    pasteOffsetRef.current += 30

    for (const item of clipboard.items) {
      createItem.mutate({
        type: item.type,
        x: item.x + dx,
        y: item.y + dy,
        width: item.width,
        height: item.height,
        content: item.content,
        imageUri: item.imageUri,
        audioUri: item.audioUri,
        audioDuration: item.audioDuration,
        strokeColor: item.strokeColor,
        strokeWidth: item.strokeWidth,
        fillColor: item.fillColor,
        fontSize: item.fontSize,
        fontWeight: item.fontWeight,
      })
    }
    for (const stroke of clipboard.strokes) {
      createStroke.mutate({
        pathData: stroke.pathData,
        color: stroke.color,
        width: stroke.width,
        opacity: stroke.opacity,
        xOffset: stroke.xOffset + dx,
        yOffset: stroke.yOffset + dy,
      })
    }

    // Exit marquee mode after paste
    setIsMarqueeMode(false)
  }, [clipboard, createItem, createStroke, canvasSize, jsTranslateX, jsTranslateY, jsScale])

  // ── Group/Ungroup handlers ──────────────────────────

  const handleGroup = useCallback(() => {
    const newGroupId = generateUUID()
    groupItems.mutate({
      itemIds: Array.from(selectedItemIds),
      strokeIds: Array.from(selectedStrokeIds),
      groupId: newGroupId,
    })
  }, [selectedItemIds, selectedStrokeIds, groupItems])

  const handleUngroup = useCallback(() => {
    ungroupItems.mutate({
      itemIds: Array.from(selectedItemIds),
      strokeIds: Array.from(selectedStrokeIds),
    })
  }, [selectedItemIds, selectedStrokeIds, ungroupItems])

  // Computed group/ungroup visibility
  const showGroupAction = useMemo(() => {
    if (selectionCount < 2) return false
    // Check if all selected items already share the same group
    const selectedItems = items.filter((i) => selectedItemIds.has(i.id))
    const selectedStrks = allStrokes.filter((s) => selectedStrokeIds.has(s.id))
    const allGroupIds = new Set([
      ...selectedItems.map((i) => i.groupId).filter(Boolean),
      ...selectedStrks.map((s) => s.groupId).filter(Boolean),
    ])
    if (allGroupIds.size === 1) {
      const groupId = Array.from(allGroupIds)[0]!
      const allInGroup = selectedItems.every((i) => i.groupId === groupId) &&
                         selectedStrks.every((s) => s.groupId === groupId)
      if (allInGroup) return false // all in same group, show ungroup instead
    }
    return true
  }, [selectionCount, items, allStrokes, selectedItemIds, selectedStrokeIds])

  const showUngroupAction = useMemo(() => {
    const selectedItems = items.filter((i) => selectedItemIds.has(i.id))
    const selectedStrks = allStrokes.filter((s) => selectedStrokeIds.has(s.id))
    return selectedItems.some((i) => i.groupId) || selectedStrks.some((s) => s.groupId)
  }, [items, allStrokes, selectedItemIds, selectedStrokeIds])

  // ── Text editing ──────────────────────────────────────

  function saveEditingText() {
    console.log('[SAVE] saveEditingText called, editingTextId:', editingTextId, 'value:', editingTextValue?.slice(0, 20))
    if (!editingTextId) return

    const oldItem = items.find((i) => i.id === editingTextId)
    const oldContent = oldItem?.content ?? ''

    if (editingTextValue.trim() === '') {
      console.log('[SAVE] empty → deleting item', editingTextId)
      if (oldContent) {
        // Had content before, now empty — track as content change for undo
        pushUndo({ type: 'update-item', itemId: editingTextId, field: 'content', oldValue: oldContent })
      }
      deleteItem.mutate(editingTextId)
    } else if (editingTextValue !== oldContent) {
      console.log('[SAVE] saving content for', editingTextId)
      pushUndo({ type: 'update-item', itemId: editingTextId, field: 'content', oldValue: oldContent })
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

    // Convert hex color to 50% opacity for fill
    const hex = drawColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const fillColor = `rgba(${r},${g},${b},0.5)`

    createItem.mutate({
      type: 'shape',
      x: pos.x,
      y: pos.y,
      width: 150,
      height: 100,
      strokeColor: drawColor,
      strokeWidth: 2,
      fillColor,
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
    if (selectedItemIds.size !== 1) return null
    const singleId = Array.from(selectedItemIds)[0]
    const item = items.find((i) => i.id === singleId)
    return item?.type === 'text' ? item : null
  }, [selectedItemIds, items])

  const handleFontSizeChange = useCallback((size: number) => {
    if (selectedItemIds.size !== 1) return
    const singleId = Array.from(selectedItemIds)[0]
    updateItem.mutate({ id: singleId, data: { fontSize: size } })
  }, [selectedItemIds, updateItem])

  const handleBoldToggle = useCallback(() => {
    if (!selectedTextItem) return
    const newWeight = selectedTextItem.fontWeight === 'bold' ? 'normal' : 'bold'
    updateItem.mutate({ id: selectedTextItem.id, data: { fontWeight: newWeight } })
  }, [selectedTextItem, updateItem])

  // ── Delete selected ──────────────────────────────────

  const handleDeleteSelected = useCallback(() => {
    const itemIds = Array.from(selectedItemIds)
    const strokeIds = Array.from(selectedStrokeIds)
    const connIds = Array.from(selectedConnectionIds)

    // Snapshot items/strokes/connections for undo before deleting
    const deletedItems = items.filter((i) => selectedItemIds.has(i.id))
    const deletedStrokes = allStrokes.filter((s) => selectedStrokeIds.has(s.id))
    // Also capture connections that reference any deleted item
    const deletedConnections = connections.filter(
      (c) => connIds.includes(c.id) || selectedItemIds.has(c.fromItemId) || selectedItemIds.has(c.toItemId)
    )

    if (deletedItems.length > 0 || deletedStrokes.length > 0 || deletedConnections.length > 0) {
      pushUndo({ type: 'delete', items: deletedItems, strokes: deletedStrokes, connections: deletedConnections })
    }

    if (itemIds.length > 0 || strokeIds.length > 0) {
      batchDelete.mutate({ itemIds, strokeIds })
    }
    for (const connId of connIds) {
      deleteConnection.mutate(connId)
    }
    clearSelection()
  }, [selectedItemIds, selectedStrokeIds, selectedConnectionIds, items, allStrokes, connections, batchDelete, deleteConnection, clearSelection, pushUndo])

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
    // 3. Exit marquee mode
    if (isMarqueeMode) {
      setIsMarqueeMode(false)
      return true
    }
    // 4. Deselect any selected item/stroke/connection
    if (hasSelection) {
      clearSelection()
      return true
    }
    // 5. Navigate back (only if possible)
    if (router.canGoBack()) {
      router.back()
    }
    return false
  }, [router, editingTextId, flyMenu.visible, isMarqueeMode, hasSelection, clearSelection])

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

  const handleZoomReset = useCallback(() => {
    // Keep the viewport center at the same canvas point
    const cx = canvasSize.width / 2
    const cy = canvasSize.height / 2
    const oldScale = scale.value
    const newTx = cx - (cx - translateX.value) / oldScale
    const newTy = cy - (cy - translateY.value) / oldScale

    scale.value = withTiming(1, { duration: 200 })
    translateX.value = withTiming(newTx, { duration: 200 })
    translateY.value = withTiming(newTy, { duration: 200 })
    savedScale.value = 1
    savedTranslateX.value = newTx
    savedTranslateY.value = newTy
    setJsScale(1)
    setJsTranslateX(newTx)
    setJsTranslateY(newTy)
    saveViewport({ x: newTx, y: newTy, zoom: 1 })
  }, [canvasSize])

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
        onZoomReset={handleZoomReset}
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
                  selectedStrokeIds={selectedStrokeIds}
                />
              )}

              {/* Items layer — rendered as positioned RN views */}
              {items.map((item) => {
                // Use local override for the item being manipulated (smooth drag/resize)
                const ov = localOverrides.get(item.id) ?? null
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
                const isSelected = selectedItemIds.has(item.id)
                const isSingleSelected = isSelected && selectedItemIds.size === 1 && selectedStrokeIds.size === 0
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

                    {/* Selection border overlay — rendered on top of content */}
                    {isSelected && (
                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          top: -2,
                          left: -2,
                          right: -2,
                          bottom: -2,
                          borderWidth: 2,
                          borderColor: '#3b82f6',
                          borderRadius: item.type === 'audio' ? 9999 : 4,
                        }}
                      />
                    )}

                    {/* Selection handles — only show for single selection */}
                    {isSingleSelected && (
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
                                backgroundColor: '#3b82f6',
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
                              backgroundColor: '#3b82f6',
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
                  selectedConnectionIds={selectedConnectionIds}
                  localOverrides={localOverrides}
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
              {/* Marquee selection overlay */}
              {marqueeRect && (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: Math.min(marqueeRect.startX, marqueeRect.currentX),
                    top: Math.min(marqueeRect.startY, marqueeRect.currentY),
                    width: Math.abs(marqueeRect.currentX - marqueeRect.startX),
                    height: Math.abs(marqueeRect.currentY - marqueeRect.startY),
                    borderWidth: 2,
                    borderColor: accentColor,
                    borderStyle: 'dashed',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                  }}
                />
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
            onPaste={clipboard ? () => { cleanupPendingText(); handlePaste() } : undefined}
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
            // Also update the selected item's color (and fill for shapes)
            if (selectedItemIds.size === 1) {
              const singleId = Array.from(selectedItemIds)[0]
              const selectedItem = items.find((i) => i.id === singleId)
              const data: Record<string, any> = { strokeColor: c }
              if (selectedItem?.type === 'shape') {
                const hex = c.replace('#', '')
                const r = parseInt(hex.substring(0, 2), 16)
                const g = parseInt(hex.substring(2, 4), 16)
                const b = parseInt(hex.substring(4, 6), 16)
                data.fillColor = `rgba(${r},${g},${b},0.5)`
              }
              updateItem.mutate({ id: singleId, data })
            }
          }}
          onWidthChange={setDrawWidth}
          onUndo={handleUndo}
          onRedo={() => {}}
          canUndo={undoStack.length > 0}
          canRedo={false}
          textSelected={!!selectedTextItem}
          textFontSize={selectedTextItem?.fontSize || 16}
          textBold={selectedTextItem?.fontWeight === 'bold'}
          onFontSizeChange={handleFontSizeChange}
          onBoldToggle={handleBoldToggle}
          showDelete={hasSelection}
          onDelete={handleDeleteSelected}
          selectionCount={selectionCount}
          showGroup={showGroupAction}
          showUngroup={showUngroupAction}
          showCut={selectionCount > 0}
          showCopy={selectionCount > 0}
          showPaste={!!clipboard}
          showMarquee
          isMarqueeMode={isMarqueeMode}
          onGroup={handleGroup}
          onUngroup={handleUngroup}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onMarqueeToggle={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setIsMarqueeMode((prev) => !prev)
          }}
        />
      </View>
    </YStack>
  )
}
