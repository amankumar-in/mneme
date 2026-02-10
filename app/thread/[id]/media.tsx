import { useState, useCallback, useMemo, useRef } from 'react'
import { SectionList, Dimensions, Pressable, Alert } from 'react-native'
import { YStack, XStack, Text, Button } from 'tamagui'
import { Image } from 'expo-image'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import PagerView from 'react-native-pager-view'
import FileViewer from 'react-native-file-viewer'

import { useThread } from '../../../hooks/useThreads'
import { useThreadMedia } from '../../../hooks/useNotes'
import { ScreenBackground } from '../../../components/ScreenBackground'
import { useThemeColor } from '../../../hooks/useThemeColor'
import { ImageViewerModal } from '../../../components/note/ImageViewerModal'
import { VideoPlayerModal } from '../../../components/note/VideoPlayerModal'
import { resolveAttachmentUri, attachmentExists } from '../../../services/fileStorage'
import type { NoteType, NoteWithDetails } from '../../../services/database/types'

const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_PADDING = 16
const GRID_GAP = 2
const NUM_COLUMNS = 3
const CELL_SIZE = Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS)

type TabKey = 'photos' | 'videos' | 'files'

const TAB_KEYS: TabKey[] = ['photos', 'videos', 'files']

const TAB_OPTIONS = [
  { key: 'photos', label: 'Photos' },
  { key: 'videos', label: 'Videos' },
  { key: 'files', label: 'Files' },
]

const TAB_TYPES: Record<TabKey, NoteType[]> = {
  photos: ['image'],
  videos: ['video'],
  files: ['file', 'audio', 'voice'],
}

const TAB_EMPTY: Record<TabKey, string> = {
  photos: 'No photos yet',
  videos: 'No videos yet',
  files: 'No files yet',
}

const TAB_ICONS: Record<TabKey, keyof typeof Ionicons.glyphMap> = {
  photos: 'images-outline',
  videos: 'videocam-outline',
  files: 'document-outline',
}

interface MediaSection {
  title: string
  data: NoteWithDetails[][]
}

function groupByMonth(notes: NoteWithDetails[]): MediaSection[] {
  const groups = new Map<string, NoteWithDetails[]>()

  for (const note of notes) {
    const date = new Date(note.createdAt)
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(note)
  }

  const sections: MediaSection[] = []
  for (const [, items] of groups) {
    const date = new Date(items[0].createdAt)
    const title = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    const rows: NoteWithDetails[][] = []
    for (let i = 0; i < items.length; i += NUM_COLUMNS) {
      rows.push(items.slice(i, i + NUM_COLUMNS))
    }

    sections.push({ title, data: rows })
  }

  return sections
}

function openDocument(storedPath: string) {
  const uri = resolveAttachmentUri(storedPath)
  const path = uri.startsWith('file://') ? uri.slice(7) : uri
  FileViewer.open(path).catch(() => {
    Alert.alert('Cannot Open', 'No app available to open this file.')
  })
}

export default function MediaScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, iconColor } = useThemeColor()

  const { data: thread } = useThread(id || '')
  const [activeTab, setActiveTab] = useState(0)
  const [viewerImage, setViewerImage] = useState<string | null>(null)
  const [viewerVideo, setViewerVideo] = useState<string | null>(null)
  const pagerRef = useRef<PagerView>(null)

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleTabPress = useCallback((index: number) => {
    pagerRef.current?.setPage(index)
    setActiveTab(index)
  }, [])

  const handlePageSelected = useCallback((e: { nativeEvent: { position: number } }) => {
    setActiveTab(e.nativeEvent.position)
  }, [])

  const handleItemPress = useCallback((note: NoteWithDetails) => {
    if (!note.attachment?.url || !attachmentExists(note.attachment.url)) {
      Alert.alert('File Unavailable', 'This file is no longer available on this device.')
      return
    }
    if (note.type === 'image') {
      setViewerImage(resolveAttachmentUri(note.attachment.url))
    } else if (note.type === 'video') {
      setViewerVideo(resolveAttachmentUri(note.attachment.url))
    } else {
      openDocument(note.attachment.url)
    }
  }, [])

  const headerTitle = thread ? `Media from ${thread.name}` : 'Media'

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
        <Text fontSize="$5" fontWeight="600" color="$color" flex={1} numberOfLines={1}>
          {headerTitle}
        </Text>
      </XStack>

      {/* Tab Bar */}
      <XStack borderBottomWidth={1} borderBottomColor="$borderColor">
        {TAB_OPTIONS.map((tab, index) => {
          const isActive = activeTab === index
          return (
            <YStack
              key={tab.key}
              flex={1}
              alignItems="center"
              paddingVertical="$3"
              borderBottomWidth={2}
              borderBottomColor={isActive ? '$accentColor' : 'transparent'}
              pressStyle={{ opacity: 0.7 }}
              onPress={() => handleTabPress(index)}
            >
              <Text
                fontSize="$3"
                fontWeight={isActive ? '600' : '400'}
                color={isActive ? '$accentColor' : '$colorSubtle'}
              >
                {tab.label}
              </Text>
            </YStack>
          )
        })}
      </XStack>

      {/* Swipeable Pages */}
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        {TAB_KEYS.map((tabKey) => (
          <TabPage
            key={tabKey}
            threadId={id || ''}
            tabKey={tabKey}
            iconColor={iconColor}
            bottomInset={insets.bottom}
            onItemPress={handleItemPress}
          />
        ))}
      </PagerView>

      {/* Modals */}
      <ImageViewerModal uri={viewerImage} onClose={() => setViewerImage(null)} />
      <VideoPlayerModal uri={viewerVideo} onClose={() => setViewerVideo(null)} />
    </ScreenBackground>
  )
}

function TabPage({
  threadId,
  tabKey,
  iconColor,
  bottomInset,
  onItemPress,
}: {
  threadId: string
  tabKey: TabKey
  iconColor: string
  bottomInset: number
  onItemPress: (note: NoteWithDetails) => void
}) {
  const { data: mediaResult } = useThreadMedia(threadId, TAB_TYPES[tabKey], 200)

  const sections = useMemo(() => {
    if (!mediaResult?.data?.length) return []
    return groupByMonth(mediaResult.data)
  }, [mediaResult?.data])

  const renderSectionHeader = useCallback(({ section }: { section: MediaSection }) => (
    <YStack paddingHorizontal={GRID_PADDING} paddingTop="$3" paddingBottom="$2">
      <Text fontSize="$3" fontWeight="600" color="$colorSubtle">{section.title}</Text>
    </YStack>
  ), [])

  const renderRow = useCallback(({ item: row }: { item: NoteWithDetails[] }) => (
    <XStack paddingHorizontal={GRID_PADDING} gap={GRID_GAP} marginBottom={GRID_GAP}>
      {row.map((note) => (
        <GridCell
          key={note.id}
          note={note}
          tab={tabKey}
          iconColor={iconColor}
          onPress={onItemPress}
        />
      ))}
      {row.length < NUM_COLUMNS && Array.from({ length: NUM_COLUMNS - row.length }).map((_, i) => (
        <YStack key={`empty-${i}`} width={CELL_SIZE} height={CELL_SIZE} />
      ))}
    </XStack>
  ), [tabKey, iconColor, onItemPress])

  if (sections.length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
        <Ionicons name={TAB_ICONS[tabKey]} size={64} color={iconColor} />
        <Text fontSize="$5" color="$colorSubtle" marginTop="$4" textAlign="center">
          {TAB_EMPTY[tabKey]}
        </Text>
      </YStack>
    )
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, index) => `row-${index}-${item.map(n => n.id).join('-')}`}
      renderItem={renderRow}
      renderSectionHeader={renderSectionHeader}
      contentContainerStyle={{ paddingBottom: bottomInset + 20 }}
      stickySectionHeadersEnabled={false}
    />
  )
}

function GridCell({
  note,
  tab,
  iconColor,
  onPress,
}: {
  note: NoteWithDetails
  tab: TabKey
  iconColor: string
  onPress: (note: NoteWithDetails) => void
}) {
  const fileMissing = note.attachment?.url ? !attachmentExists(note.attachment.url) : true

  if (tab === 'photos') {
    const uri = !fileMissing && note.attachment?.url ? resolveAttachmentUri(note.attachment.url) : null
    return (
      <Pressable onPress={() => onPress(note)}>
        <YStack width={CELL_SIZE} height={CELL_SIZE} backgroundColor="$backgroundStrong" overflow="hidden" justifyContent="center" alignItems="center">
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: CELL_SIZE, height: CELL_SIZE }}
              contentFit="cover"
            />
          ) : (
            <YStack alignItems="center" opacity={0.5}>
              <Ionicons name="image-outline" size={24} color={iconColor} />
              <Text fontSize={9} color="$colorSubtle" marginTop={2}>Unavailable</Text>
            </YStack>
          )}
        </YStack>
      </Pressable>
    )
  }

  if (tab === 'videos') {
    const thumbExists = note.attachment?.thumbnail ? attachmentExists(note.attachment.thumbnail) : false
    const thumbUri = !fileMissing && thumbExists && note.attachment?.thumbnail
      ? resolveAttachmentUri(note.attachment.thumbnail)
      : null

    return (
      <Pressable onPress={() => onPress(note)}>
        <YStack width={CELL_SIZE} height={CELL_SIZE} backgroundColor="$backgroundStrong" overflow="hidden" justifyContent="center" alignItems="center">
          {fileMissing ? (
            <YStack alignItems="center" opacity={0.5}>
              <Ionicons name="videocam-outline" size={24} color={iconColor} />
              <Text fontSize={9} color="$colorSubtle" marginTop={2}>Unavailable</Text>
            </YStack>
          ) : (
            <>
              {thumbUri && (
                <Image
                  source={{ uri: thumbUri }}
                  style={{ width: CELL_SIZE, height: CELL_SIZE }}
                  contentFit="cover"
                />
              )}
              <YStack
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                justifyContent="center"
                alignItems="center"
              >
                <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.85)" />
              </YStack>
              {note.attachment?.duration != null && (
                <YStack position="absolute" bottom={4} right={4}>
                  <Text fontSize={10} color="white" backgroundColor="rgba(0,0,0,0.6)" paddingHorizontal={4} paddingVertical={1} borderRadius={2}>
                    {formatDuration(note.attachment.duration)}
                  </Text>
                </YStack>
              )}
            </>
          )}
        </YStack>
      </Pressable>
    )
  }

  const iconName: keyof typeof Ionicons.glyphMap =
    note.type === 'audio' || note.type === 'voice' ? 'musical-note-outline' : 'document-outline'

  return (
    <Pressable onPress={() => onPress(note)}>
      <YStack
        width={CELL_SIZE}
        height={CELL_SIZE}
        backgroundColor="$backgroundStrong"
        justifyContent="center"
        alignItems="center"
        padding="$2"
        opacity={fileMissing ? 0.5 : 1}
      >
        <Ionicons name={iconName} size={28} color={iconColor} />
        <Text
          fontSize={10}
          color="$colorSubtle"
          numberOfLines={2}
          textAlign="center"
          marginTop="$1"
        >
          {fileMissing ? 'Unavailable' : (note.attachment?.filename || note.content || 'File')}
        </Text>
      </YStack>
    </Pressable>
  )
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}
