import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AppState,
  Dimensions,
  Keyboard,
  LayoutChangeEvent,
  Pressable,
  Share,
  TextInput,
  View,
} from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
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
import { DrawingToolbar, getDefaultDrawColor } from '../../../components/board/DrawingToolbar'
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

  // Dragging state
  const [isDragging, setIsDragging] = useState(false)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const dragItemStartPos = useRef({ x: 0, y: 0 })

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

  // Save text on keyboard dismiss
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (editingTextId) {
        saveEditingText()
      }
    })
    return () => sub.remove()
  }, [editingTextId, editingTextValue])

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
    // Save any editing text when drawing starts
    if (editingTextId) {
      saveEditingText()
    }

    const canvasX = (screenX - jsTranslateX) / jsScale
    const canvasY = (screenY - jsTranslateY) / jsScale

    // Check if touching an item — don't draw on items
    const hitItem = findItemAtPosition(canvasX, canvasY, items)

    if (hitItem && selectedItemId === hitItem.id) {
      startDragItem(hitItem, screenX, screenY)
      return
    }

    if (hitItem) {
      return // Don't draw on existing items
    }

    // Start drawing
    isDrawingRef.current = true
    const path = Skia.Path.Make()
    path.moveTo(canvasX, canvasY)
    pathRef.current = path
    setCurrentPathString(path.toSVGString())
    dismissFlyMenu()
  }

  function handleDrawUpdate(screenX: number, screenY: number) {
    if (isDragging) {
      updateDragItem(screenX, screenY)
      return
    }
    if (!isDrawingRef.current || !pathRef.current) return

    const canvasX = (screenX - jsTranslateX) / jsScale
    const canvasY = (screenY - jsTranslateY) / jsScale

    pathRef.current.lineTo(canvasX, canvasY)
    setCurrentPathString(pathRef.current.toSVGString())
  }

  function handleDrawEnd() {
    if (isDragging) {
      endDragItem()
      return
    }
    if (!isDrawingRef.current || !pathRef.current) {
      isDrawingRef.current = false
      return
    }

    const pathData = pathRef.current.toSVGString()
    isDrawingRef.current = false
    pathRef.current = null
    // Keep currentPathString visible until DB save + refetch completes
    saveStroke(pathData)
  }

  // Drawing gesture (one finger drag on empty space)
  const isDrawingRef = useRef(false)
  const drawGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .minDistance(TAP_MOVE_THRESHOLD)
    .onStart((e) => {
      runOnJS(handleDrawStart)(e.x, e.y)
    })
    .onUpdate((e) => {
      runOnJS(handleDrawUpdate)(e.x, e.y)
    })
    .onEnd(() => {
      runOnJS(handleDrawEnd)()
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
      if (cx >= item.x && cx <= item.x + item.width && cy >= item.y && cy <= item.y + item.height) {
        return item
      }
    }
    return null
  }

  function findStrokeAtPosition(_cx: number, _cy: number, _strokeList: BoardStroke[]): BoardStroke | null {
    // Simplified — proper hit testing would use path bounds
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
    // Save any editing text first
    if (editingTextId) {
      saveEditingText()
    }

    // Check if tapping an item
    const hitItem = findItemAtPosition(canvasX, canvasY, items)

    if (hitItem) {
      if (hitItem.type === 'text') {
        // Tap on text → cursor at end
        setEditingTextId(hitItem.id)
        setEditingTextValue(hitItem.content || '')
        setTimeout(() => {
          const ref = textInputRefs.current.get(hitItem.id)
          ref?.focus()
        }, 100)
      } else if (hitItem.type === 'audio' && hitItem.audioUri) {
        // Tap on audio → play/pause
        toggleAudio(hitItem.id, resolveAttachmentUri(hitItem.audioUri) || hitItem.audioUri)
      }
      // Deselect if something was selected
      setSelectedItemId(null)
      setSelectedStrokeId(null)
      setSelectedConnectionId(null)
      setFlyMenu({ visible: false, x: 0, y: 0 })
      return
    }

    // Tap on empty space → show fly menu + keyboard
    setSelectedItemId(null)
    setSelectedStrokeId(null)
    setSelectedConnectionId(null)
    setFlyMenuCanvasPos({ x: canvasX, y: canvasY })
    setFlyMenu({ visible: true, x: screenX, y: screenY })

    // Create a text item immediately (invisible until they type)
    createItem.mutate(
      {
        type: 'text',
        x: canvasX,
        y: canvasY,
        width: TEXT_MAX_WIDTH,
        height: 30,
        content: '',
      },
      {
        onSuccess: (newItem) => {
          if (newItem) {
            setEditingTextId(newItem.id)
            setEditingTextValue('')
            setTimeout(() => {
              const ref = textInputRefs.current.get(newItem.id)
              ref?.focus()
            }, 200)
          }
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

    // TODO: hit-test strokes for selection
    // For now, just deselect
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
          console.log('[BoardStroke] saved:', newStroke?.id)
          if (newStroke) {
            setUndoStack((prev) => [...prev, newStroke.id])
            setRedoStack([])
          }
        },
        onError: (err) => {
          console.error('[BoardStroke] save failed:', err)
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
    if (!editingTextId) return

    if (editingTextValue.trim() === '') {
      // Empty text → delete the item
      deleteItem.mutate(editingTextId)
    } else {
      updateItem.mutate({ id: editingTextId, data: { content: editingTextValue } })
    }
    setEditingTextId(null)
    setEditingTextValue('')
    Keyboard.dismiss()
  }

  function dismissFlyMenu() {
    setFlyMenu({ visible: false, x: 0, y: 0 })
  }

  // ── Item dragging ──────────────────────────────────────

  function startDragItem(item: BoardItem, screenX: number, screenY: number) {
    setIsDragging(true)
    dragStartPos.current = { x: screenX, y: screenY }
    dragItemStartPos.current = { x: item.x, y: item.y }
  }

  function updateDragItem(screenX: number, screenY: number) {
    if (!selectedItemId || !isDragging) return
    const dx = (screenX - dragStartPos.current.x) / jsScale
    const dy = (screenY - dragStartPos.current.y) / jsScale
    const newX = dragItemStartPos.current.x + dx
    const newY = dragItemStartPos.current.y + dy
    // Optimistic update via mutation
    updateItem.mutate({ id: selectedItemId, data: { x: newX, y: newY } })
  }

  function endDragItem() {
    setIsDragging(false)
  }

  // ── Fly menu actions ──────────────────────────────────

  const handleFlyImage = useCallback(async () => {
    dismissFlyMenu()
    // Delete the pending text item
    if (editingTextId) {
      deleteItem.mutate(editingTextId)
      setEditingTextId(null)
      setEditingTextValue('')
      Keyboard.dismiss()
    }

    const result = await showImageSourcePicker()
    if (result && result.localUri) {
      createItem.mutate({
        type: 'image',
        x: flyMenuCanvasPos.x,
        y: flyMenuCanvasPos.y,
        width: 150,
        height: result.height && result.width ? (150 * result.height) / result.width : 150,
        imageUri: result.localUri,
      })
    }
  }, [flyMenuCanvasPos, showImageSourcePicker, createItem, editingTextId, deleteItem])

  const handleFlyRectangle = useCallback(() => {
    dismissFlyMenu()
    if (editingTextId) {
      deleteItem.mutate(editingTextId)
      setEditingTextId(null)
      setEditingTextValue('')
      Keyboard.dismiss()
    }

    createItem.mutate({
      type: 'shape',
      x: flyMenuCanvasPos.x,
      y: flyMenuCanvasPos.y,
      width: 150,
      height: 100,
      strokeColor: isDark ? '#ffffff' : '#000000',
      strokeWidth: 2,
    })
  }, [flyMenuCanvasPos, createItem, isDark, editingTextId, deleteItem])

  const handleFlyAudio = useCallback(async () => {
    dismissFlyMenu()
    if (editingTextId) {
      deleteItem.mutate(editingTextId)
      setEditingTextId(null)
      setEditingTextValue('')
      Keyboard.dismiss()
    }

    setPendingAudioPos(flyMenuCanvasPos)
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

  const handleBack = useCallback(() => {
    if (editingTextId) saveEditingText()
    router.back()
  }, [router, editingTextId])

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
        onBack={handleBack}
        onBoardPress={handleBoardPress}
        onShare={handleShare}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
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
                />
              )}

              {/* Items layer — rendered as positioned RN views */}
              {items.map((item) => {
                const screenX = item.x * jsScale + jsTranslateX
                const screenY = item.y * jsScale + jsTranslateY
                const screenW = item.width * jsScale
                const screenH = item.height * jsScale
                const isSelected = selectedItemId === item.id
                const isEditing = editingTextId === item.id

                // Viewport culling
                if (
                  screenX + screenW < -50 || screenX > canvasSize.width + 50 ||
                  screenY + screenH < -50 || screenY > canvasSize.height + 50
                ) {
                  return null
                }

                return (
                  <View
                    key={item.id}
                    style={{
                      position: 'absolute',
                      left: screenX,
                      top: screenY,
                      width: screenW,
                      height: item.type === 'text' ? undefined : screenH,
                      minHeight: item.type === 'text' ? 20 : screenH,
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
                            if (ref) textInputRefs.current.set(item.id, ref)
                          }}
                          value={editingTextValue}
                          onChangeText={handleTextChange}
                          onBlur={() => saveEditingText()}
                          style={{
                            fontSize: (item.fontSize || 16) * jsScale,
                            color,
                            maxWidth: TEXT_MAX_WIDTH * jsScale,
                            padding: 0,
                          }}
                          multiline
                          autoFocus
                        />
                      ) : (
                        <Text
                          fontSize={(item.fontSize || 16) * jsScale}
                          color="$color"
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
                          borderColor: item.strokeColor || (isDark ? '#ffffff' : '#000000'),
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
                          backgroundColor: accentColor,
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
                    {isSelected && item.type !== 'audio' && (
                      <>
                        {/* Corner resize handles */}
                        {['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].map((corner) => {
                          const left = corner.includes('Left') ? -6 : screenW - 6
                          const top = corner.includes('top') ? -6 : (screenH || 0) - 6
                          return (
                            <View
                              key={corner}
                              style={{
                                position: 'absolute',
                                left,
                                top,
                                width: 12,
                                height: 12,
                                borderRadius: 6,
                                backgroundColor: accentColor,
                                borderWidth: 2,
                                borderColor: 'white',
                              }}
                            />
                          )
                        })}

                        {/* Side midpoint dots for connections */}
                        {[
                          { side: 'top', left: screenW / 2 - 5, top: -5 },
                          { side: 'bottom', left: screenW / 2 - 5, top: (screenH || 0) - 5 },
                          { side: 'left', left: -5, top: (screenH || 0) / 2 - 5 },
                          { side: 'right', left: screenW - 5, top: (screenH || 0) / 2 - 5 },
                        ].map(({ side, left, top }) => (
                          <View
                            key={side}
                            style={{
                              position: 'absolute',
                              left,
                              top,
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: '#3b82f6',
                              borderWidth: 2,
                              borderColor: 'white',
                            }}
                          />
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
            onDismiss={dismissFlyMenu}
          />

          {/* Selected item delete button */}
          {(selectedItemId || selectedStrokeId || selectedConnectionId) && (
            <Pressable
              onPress={handleDeleteSelected}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                backgroundColor: 'rgba(239,68,68,0.9)',
                borderRadius: 20,
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="trash-outline" size={20} color="white" />
            </Pressable>
          )}

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
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'red' }} />
                <Text color="$color">{Math.floor(voiceDuration)}s</Text>
                <Pressable onPress={handleStopRecording}>
                  <XStack
                    backgroundColor="$accentColor"
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
          onColorChange={setDrawColor}
          onWidthChange={setDrawWidth}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoStack.length > 0}
          canRedo={false}
        />
      </KeyboardAvoidingView>
    </YStack>
  )
}
