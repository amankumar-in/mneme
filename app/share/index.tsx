import { useState, useCallback } from 'react'
import { TextInput, Keyboard } from 'react-native'
import { YStack, XStack, Text, Button, ScrollView } from 'tamagui'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useShareIntent } from 'expo-share-intent'
import { ScreenBackground } from '../../components/ScreenBackground'
import { useThemeColor } from '../../hooks/useThemeColor'
import { SharePreview } from '../../components/share/SharePreview'
import { ThreadPicker } from '../../components/share/ThreadPicker'
import { useProcessShareIntent } from '../../hooks/useProcessShareIntent'

export default function ShareScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, color, placeholderColor } = useThemeColor()
  const { shareIntent, resetShareIntent, hasShareIntent } = useShareIntent()
  const processShareIntent = useProcessShareIntent()

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [caption, setCaption] = useState('')

  const handleClose = useCallback(() => {
    resetShareIntent()
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [resetShareIntent, router])

  const handleSave = useCallback(async () => {
    if (!selectedThreadId || !hasShareIntent) return

    Keyboard.dismiss()

    processShareIntent.mutate(
      {
        shareIntent,
        threadId: selectedThreadId,
        caption: caption.trim() || undefined,
      },
      {
        onSuccess: () => {
          resetShareIntent()
          router.replace(`/thread/${selectedThreadId}`)
        },
      }
    )
  }, [selectedThreadId, hasShareIntent, shareIntent, caption, processShareIntent, resetShareIntent, router])

  return (
    <ScreenBackground>
      {/* Header */}
      <XStack
        paddingTop={insets.top + 8}
        paddingHorizontal="$4"
        paddingBottom="$2"
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={handleClose}
          icon={<Ionicons name="close" size={24} color={iconColorStrong} />}
        />
        <Text fontSize="$5" fontWeight="700" color="$color">
          Share to LaterBox
        </Text>
        <Button
          size="$3"
          circular
          chromeless
          disabled={!selectedThreadId || processShareIntent.isPending}
          opacity={selectedThreadId ? 1 : 0.4}
          onPress={handleSave}
          icon={
            <Ionicons
              name="checkmark"
              size={24}
              color={selectedThreadId ? iconColorStrong : placeholderColor}
            />
          }
        />
      </XStack>

      {/* Preview + Caption (compact, non-scrollable) */}
      <YStack paddingHorizontal="$4" paddingTop="$3" paddingBottom="$2" gap="$3">
        <SharePreview shareIntent={shareIntent} />

        <XStack
          backgroundColor="$backgroundStrong"
          borderRadius="$3"
          borderWidth={1}
          borderColor="$borderColor"
          paddingHorizontal="$3"
          minHeight={44}
          alignItems="center"
        >
          <TextInput
            style={{ flex: 1, fontSize: 14, color, paddingVertical: 10 }}
            placeholder="Add a caption..."
            placeholderTextColor={placeholderColor}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={2000}
          />
        </XStack>
      </YStack>

      {/* Thread Picker (takes remaining space — owns its own FlatList) */}
      <YStack flex={1} paddingHorizontal="$4" gap="$2">
        <Text fontSize="$3" fontWeight="600" color="$colorSubtle">
          SAVE TO THREAD
        </Text>
        <ThreadPicker
          selectedThreadId={selectedThreadId}
          onSelectThread={setSelectedThreadId}
        />
      </YStack>

      {/* Save Button */}
      <YStack
        paddingHorizontal="$4"
        paddingTop="$2"
        paddingBottom={insets.bottom + 8}
        borderTopWidth={1}
        borderTopColor="$borderColor"
      >
        <Button
          size="$5"
          backgroundColor={selectedThreadId ? '$accentColor' : '$backgroundStrong'}
          borderRadius="$4"
          disabled={!selectedThreadId || processShareIntent.isPending}
          opacity={processShareIntent.isPending ? 0.6 : 1}
          onPress={handleSave}
        >
          <Text fontWeight="700" color={selectedThreadId ? '#fff' : '$colorSubtle'}>
            {processShareIntent.isPending ? 'Saving...' : 'Save'}
          </Text>
        </Button>
      </YStack>
    </ScreenBackground>
  )
}
