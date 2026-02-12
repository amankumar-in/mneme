import { useCallback } from 'react'
import { ScrollView } from 'react-native'
import { YStack, XStack, Text, Button } from 'tamagui'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { SquareDashedMousePointer, Group, Scissors } from 'lucide-react-native'

import { ScreenBackground } from '../../../components/ScreenBackground'
import { useThemeColor } from '../../../hooks/useThemeColor'

interface GestureItemProps {
  icon: React.ReactNode
  title: string
  description: string
}

function GestureItem({ icon, title, description }: GestureItemProps) {
  return (
    <XStack paddingHorizontal="$4" paddingVertical="$3" gap="$3" alignItems="center">
      <XStack
        width={40}
        height={40}
        borderRadius="$3"
        backgroundColor="$backgroundStrong"
        alignItems="center"
        justifyContent="center"
      >
        {icon}
      </XStack>
      <YStack flex={1}>
        <Text fontSize="$4" fontWeight="600" color="$color">
          {title}
        </Text>
        <Text fontSize="$2" color="$colorSubtle" lineHeight={18}>
          {description}
        </Text>
      </YStack>
    </XStack>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      fontSize="$2"
      fontWeight="600"
      color="$colorSubtle"
      paddingHorizontal="$4"
      paddingTop="$5"
      paddingBottom="$2"
      textTransform="uppercase"
    >
      {title}
    </Text>
  )
}

export default function BoardHelpScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, iconColor, accentColor, warningColor, infoColor, successColor } = useThemeColor()

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  return (
    <ScreenBackground>
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
          How to use Boards
        </Text>
      </XStack>

      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionHeader title="Navigation" />
        <GestureItem
          icon={<Ionicons name="move-outline" size={20} color={accentColor} />}
          title="Pan the canvas"
          description="Drag with two fingers to move around the canvas."
        />
        <GestureItem
          icon={<Ionicons name="expand-outline" size={20} color={accentColor} />}
          title="Zoom in & out"
          description="Pinch with two fingers to zoom. Tap the zoom percentage in the header to reset to 100%."
        />

        <SectionHeader title="Creating content" />
        <GestureItem
          icon={<Ionicons name="text-outline" size={20} color={infoColor} />}
          title="Add text"
          description="Tap on any empty space. A text cursor and a quick-action menu will appear."
        />
        <GestureItem
          icon={<Ionicons name="image-outline" size={20} color={infoColor} />}
          title="Add image"
          description="Tap empty space, then pick the image icon from the quick-action menu."
        />
        <GestureItem
          icon={<Ionicons name="square-outline" size={20} color={infoColor} />}
          title="Add shape"
          description="Tap empty space, then pick the shape icon from the quick-action menu."
        />
        <GestureItem
          icon={<Ionicons name="mic-outline" size={20} color={infoColor} />}
          title="Record audio"
          description="Tap empty space, then pick the microphone icon from the quick-action menu."
        />
        <GestureItem
          icon={<Ionicons name="brush-outline" size={20} color={infoColor} />}
          title="Freehand drawing"
          description="Drag one finger across empty space to draw strokes. Change color and thickness from the bottom toolbar."
        />

        <SectionHeader title="Editing" />
        <GestureItem
          icon={<Ionicons name="tap-outline" size={20} color={warningColor} />}
          title="Edit text"
          description="Tap an existing text item to edit it. The keyboard will open with the text selected."
        />
        <GestureItem
          icon={<Ionicons name="finger-print-outline" size={20} color={warningColor} />}
          title="Select"
          description="Long press on any item, stroke, or connection line to select it."
        />
        <GestureItem
          icon={<Ionicons name="hand-left-outline" size={20} color={warningColor} />}
          title="Move"
          description="After selecting, drag the selected items to reposition them."
        />
        <GestureItem
          icon={<Ionicons name="resize-outline" size={20} color={warningColor} />}
          title="Resize"
          description="Select an item, then drag a corner handle to resize it."
        />
        <GestureItem
          icon={<Ionicons name="git-network-outline" size={20} color={warningColor} />}
          title="Connect items"
          description="Select an item, then drag from a side dot to another item to create an arrow connection."
        />

        <SectionHeader title="Toolbar actions" />
        <GestureItem
          icon={<Ionicons name="color-palette-outline" size={20} color={successColor} />}
          title="Color & thickness"
          description="Use the bottom toolbar to change stroke color and line thickness for drawing and text."
        />
        <GestureItem
          icon={<Ionicons name="arrow-undo-outline" size={20} color={successColor} />}
          title="Undo & redo"
          description="Tap the undo or redo buttons in the toolbar to reverse or replay actions."
        />
        <GestureItem
          icon={<SquareDashedMousePointer size={20} color={successColor} />}
          title="Marquee select"
          description="Tap the marquee tool in the toolbar, then drag a rectangle to select multiple items at once."
        />
        <GestureItem
          icon={<Group size={20} color={successColor} />}
          title="Group & ungroup"
          description="Select multiple items, then tap group to move them as one unit. Ungroup to separate."
        />
        <GestureItem
          icon={<Scissors size={20} color={successColor} />}
          title="Cut, copy & paste"
          description="Select items to cut or copy them. Tap paste on the quick-action menu or toolbar to place them."
        />
        <GestureItem
          icon={<Ionicons name="trash-outline" size={20} color={successColor} />}
          title="Delete"
          description="Select items, strokes, or connections and tap the delete button in the toolbar."
        />

        <YStack height={insets.bottom + 40} />
      </ScrollView>
    </ScreenBackground>
  )
}
