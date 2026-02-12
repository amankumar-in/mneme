import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { ScrollView, Alert, TextInput, Pressable, Switch, useWindowDimensions } from 'react-native'
import * as Haptics from 'expo-haptics'
import { YStack, XStack, Text, Button } from 'tamagui'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Canvas, Line, Circle, vec } from '@shopify/react-native-skia'

import { useBoard, useUpdateBoard, useDeleteBoard } from '../../../hooks/useBoards'
import { ScreenBackground } from '../../../components/ScreenBackground'
import { useThemeColor } from '../../../hooks/useThemeColor'
import type { BoardPatternType } from '../../../types'

const EMOJI_OPTIONS = ['💡', '📝', '🎯', '💼', '🏠', '❤️', '🎨', '🎵', '📚', '✈️', '🍕']

const PATTERN_OPTIONS: { key: BoardPatternType; label: string }[] = [
  { key: 'plain', label: 'Plain' },
  { key: 'grid', label: 'Grid' },
  { key: 'dots', label: 'Dots' },
  { key: 'rules', label: 'Rules' },
]

const THUMB_HEIGHT = 64
const THUMB_GAP = 10
const HORIZONTAL_PADDING = 16

function PatternThumbnail({
  type,
  width,
  patternColor,
}: {
  type: BoardPatternType
  width: number
  patternColor: string
}) {
  const elements = useMemo(() => {
    if (type === 'plain') return null

    const spacing = type === 'rules' ? 16 : type === 'dots' ? 16 : 20
    const els: React.ReactElement[] = []
    let key = 0

    if (type === 'grid') {
      for (let x = spacing; x < width; x += spacing) {
        els.push(<Line key={key++} p1={vec(x, 0)} p2={vec(x, THUMB_HEIGHT)} color={patternColor} strokeWidth={1} />)
      }
      for (let y = spacing; y < THUMB_HEIGHT; y += spacing) {
        els.push(<Line key={key++} p1={vec(0, y)} p2={vec(width, y)} color={patternColor} strokeWidth={1} />)
      }
    } else if (type === 'rules') {
      for (let y = spacing; y < THUMB_HEIGHT; y += spacing) {
        els.push(<Line key={key++} p1={vec(0, y)} p2={vec(width, y)} color={patternColor} strokeWidth={1} />)
      }
    } else if (type === 'dots') {
      for (let x = spacing; x < width; x += spacing) {
        for (let y = spacing; y < THUMB_HEIGHT; y += spacing) {
          els.push(<Circle key={key++} cx={x} cy={y} r={1.5} color={patternColor} />)
        }
      }
    }

    return els
  }, [type, width, patternColor])

  if (type === 'plain' || !elements) return null

  return (
    <Canvas style={{ position: 'absolute', top: 0, left: 0, width, height: THUMB_HEIGHT, pointerEvents: 'none' }}>
      {elements}
    </Canvas>
  )
}

export default function BoardInfoScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()
  const { iconColorStrong, iconColor, brandText, color, accentColor, errorColor, borderColor, infoColor } = useThemeColor()

  const { data: board, isLoading } = useBoard(id || '')
  const updateBoard = useUpdateBoard()
  const deleteBoard = useDeleteBoard()

  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const nameInputRef = useRef<TextInput>(null)

  const patternColor = borderColor + '80'
  const thumbWidth = (screenWidth - HORIZONTAL_PADDING * 2 - THUMB_GAP * (PATTERN_OPTIONS.length - 1)) / PATTERN_OPTIONS.length

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      setTimeout(() => {
        nameInputRef.current?.focus()
        nameInputRef.current?.setSelection(0, editedName.length)
      }, 100)
    }
  }, [isEditingName])

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleEditName = useCallback(() => {
    setEditedName(board?.name || '')
    setIsEditingName(true)
  }, [board?.name])

  const handleSaveName = useCallback(() => {
    if (editedName.trim() && editedName !== board?.name) {
      updateBoard.mutate({ id: id || '', data: { name: editedName.trim() } })
    }
    setIsEditingName(false)
  }, [editedName, board?.name, updateBoard, id])

  const handleSelectEmoji = useCallback((emoji: string) => {
    updateBoard.mutate({ id: id || '', data: { icon: emoji } })
    setShowEmojiPicker(false)
  }, [updateBoard, id])

  const handleRemoveEmoji = useCallback(() => {
    updateBoard.mutate({ id: id || '', data: { icon: '' } })
    setShowEmojiPicker(false)
  }, [updateBoard, id])

  const handlePatternSelect = useCallback((pattern: BoardPatternType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateBoard.mutate({ id: id || '', data: { patternType: pattern } })
  }, [updateBoard, id])

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Board',
      `Are you sure you want to delete "${board?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteBoard.mutate(id || '')
            router.dismissAll()
          },
        },
      ]
    )
  }, [board?.name, deleteBoard, id, router])

  if (isLoading || !board) {
    return (
      <ScreenBackground>
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Text color="$colorSubtle">Loading...</Text>
        </YStack>
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground>
      {/* Header */}
      <XStack
        paddingTop={insets.top + 8}
        paddingHorizontal="$4"
        paddingBottom="$2"
        alignItems="center"
        gap="$3"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={handleBack}
          icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
        />
        <Text fontSize="$5" fontWeight="600" color="$color" flex={1}>
          Board Info
        </Text>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <Pressable onPress={() => showEmojiPicker && setShowEmojiPicker(false)}>
          {/* Board Icon & Name */}
          <YStack alignItems="center" padding="$6" gap="$4">
            <Pressable onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
              <YStack width={80} height={80} borderRadius={40} backgroundColor="$brandBackground" alignItems="center" justifyContent="center" overflow="hidden">
                {board.icon ? (
                  <Text fontSize={40}>{board.icon}</Text>
                ) : (
                  <Ionicons name="easel-outline" size={36} color={brandText} />
                )}
              </YStack>
              <YStack
                position="absolute"
                bottom={0}
                right={0}
                width={26}
                height={26}
                borderRadius={13}
                backgroundColor="$accentColor"
                alignItems="center"
                justifyContent="center"
                borderWidth={2}
                borderColor="$background"
              >
                <Ionicons name="pencil" size={13} color="white" />
              </YStack>
            </Pressable>

            {showEmojiPicker && (
              <Pressable onPress={(e) => e.stopPropagation()}>
                <YStack backgroundColor="$backgroundStrong" borderRadius="$4" padding="$3">
                  <XStack flexWrap="wrap" justifyContent="center" gap="$2">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <Button
                        key={emoji}
                        size="$4"
                        chromeless
                        onPress={() => handleSelectEmoji(emoji)}
                      >
                        <Text fontSize={24}>{emoji}</Text>
                      </Button>
                    ))}
                  </XStack>
                  {board.icon && (
                    <Button
                      size="$3"
                      chromeless
                      marginTop="$2"
                      onPress={handleRemoveEmoji}
                    >
                      <Text color="$colorSubtle" fontSize="$2">Remove avatar</Text>
                    </Button>
                  )}
                </YStack>
              </Pressable>
            )}

            {isEditingName ? (
              <YStack width="100%" paddingHorizontal="$4" paddingVertical="$2">
                <TextInput
                  ref={nameInputRef}
                  value={editedName}
                  onChangeText={(text) => setEditedName(text.slice(0, 32))}
                  style={{
                    fontSize: 20,
                    fontWeight: '600',
                    textAlign: 'center',
                    color,
                    borderBottomWidth: 1,
                    borderBottomColor: iconColor,
                    paddingBottom: 4,
                  }}
                  onSubmitEditing={handleSaveName}
                  onBlur={handleSaveName}
                  maxLength={32}
                  returnKeyType="done"
                />
              </YStack>
            ) : (
              <YStack alignItems="center" gap="$1">
                <Text fontSize="$6" fontWeight="600" color="$color">
                  {board.name}
                </Text>
                <Text fontSize="$2" color="$accentColor" onPress={handleEditName}>
                  Edit
                </Text>
              </YStack>
            )}
          </YStack>

          {/* Background Pattern Picker */}
          <YStack paddingHorizontal={HORIZONTAL_PADDING} marginBottom="$4">
            <Text fontSize="$3" fontWeight="600" color="$color" marginBottom="$3">
              Background Pattern
            </Text>
            <XStack gap={THUMB_GAP}>
              {PATTERN_OPTIONS.map((option) => {
                const isSelected = board.patternType === option.key
                return (
                  <Pressable key={option.key} onPress={() => handlePatternSelect(option.key)}>
                    <YStack
                      width={thumbWidth}
                      height={THUMB_HEIGHT}
                      borderRadius="$3"
                      backgroundColor={isSelected ? '$backgroundTinted' : '$backgroundStrong'}
                      borderWidth={2}
                      borderColor={isSelected ? '$accentColor' : 'transparent'}
                      overflow="hidden"
                      justifyContent="flex-end"
                      alignItems="center"
                      paddingBottom="$1.5"
                    >
                      <PatternThumbnail type={option.key} width={thumbWidth} patternColor={patternColor} />
                      <Text fontSize={10} color={isSelected ? '$accentColor' : '$colorSubtle'}>
                        {option.label}
                      </Text>
                    </YStack>
                  </Pressable>
                )
              })}
            </XStack>
          </YStack>

          <ToggleItem
            icon="lock-closed-outline"
            iconColor={accentColor}
            title="Lock Board"
            subtitle="Require authentication to open"
            value={board.isLocked}
            onValueChange={(value) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              updateBoard.mutate({ id: id || '', data: { isLocked: value } })
            }}
            trackColor={accentColor}
          />
          <MenuItem
            icon="document-outline"
            iconColor={infoColor}
            label="Export as PDF"
            onPress={() => Alert.alert('Coming Soon', 'Export as PDF will be available in a future update.')}
          />
          <MenuItem
            icon="trash-outline"
            iconColor={errorColor}
            label="Delete Board"
            onPress={handleDelete}
            danger
          />

          {/* Created Info */}
          <YStack alignItems="center" paddingTop="$6" paddingBottom="$2">
            <Text color="$colorSubtle" fontSize="$3">
              Created {new Date(board.createdAt).toLocaleDateString()}
            </Text>
          </YStack>
        </Pressable>
      </ScrollView>
    </ScreenBackground>
  )
}

function MenuItem({
  icon,
  iconColor,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  label: string
  onPress: () => void
  danger?: boolean
}) {
  const { iconColor: defaultIconColor, errorColor } = useThemeColor()

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      gap="$3"
      alignItems="center"
      pressStyle={{ backgroundColor: '$backgroundHover' }}
      onPress={onPress}
    >
      <XStack
        width={36}
        height={36}
        borderRadius="$2"
        backgroundColor={danger ? '$red3' : '$backgroundStrong'}
        alignItems="center"
        justifyContent="center"
      >
        <Ionicons name={icon} size={20} color={danger ? errorColor : iconColor} />
      </XStack>
      <Text fontSize="$4" color={danger ? '$errorColor' : '$color'} flex={1}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={20} color={defaultIconColor} />
    </XStack>
  )
}

function ToggleItem({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  onValueChange,
  trackColor,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  title: string
  subtitle?: string
  value: boolean
  onValueChange: (value: boolean) => void
  trackColor: string
}) {
  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      gap="$3"
      alignItems="center"
    >
      <XStack
        width={36}
        height={36}
        borderRadius="$2"
        backgroundColor="$backgroundStrong"
        alignItems="center"
        justifyContent="center"
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </XStack>
      <YStack flex={1}>
        <Text fontSize="$4" color="$color">
          {title}
        </Text>
        {subtitle && (
          <Text fontSize="$2" color="$colorSubtle">
            {subtitle}
          </Text>
        )}
      </YStack>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#767577', true: trackColor }}
        thumbColor="white"
      />
    </XStack>
  )
}
