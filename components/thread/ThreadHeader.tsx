import { useState, useRef, useEffect } from 'react'
import { XStack, YStack, Text, Button, Popover } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { TextInput, Image } from 'react-native'
import { useThemeColor } from '../../hooks/useThemeColor'
import type { ThreadWithLastNote } from '../../types'

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

interface ThreadHeaderProps {
  thread: ThreadWithLastNote
  onBack: () => void
  onThreadPress: () => void
  onSearch: () => void
  onTasks: () => void
  onMenu: () => void
  taskCount?: number
  isEditingName?: boolean
  onNameChange?: (name: string) => void
  onNameSubmit?: () => void
  // Search mode props
  isSearching?: boolean
  searchQuery?: string
  onSearchChange?: (query: string) => void
  onSearchClose?: () => void
  onSearchPrev?: () => void
  onSearchNext?: () => void
  searchResultIndex?: number
  searchResultCount?: number
}

const menuOptions = [
  { id: 'media', icon: 'images', label: 'Media Files' },
  { id: 'wallpaper', icon: 'color-palette', label: 'Thread Wallpaper' },
  { id: 'shortcut', icon: 'add-circle', label: 'Add Shortcut' },
  { id: 'export', icon: 'download', label: 'Export Thread' },
  { id: 'share', icon: 'share', label: 'Share' },
] as const

export function ThreadHeader({
  thread,
  onBack,
  onThreadPress,
  onSearch,
  onTasks,
  onMenu,
  taskCount = 0,
  isEditingName = false,
  onNameChange,
  onNameSubmit,
  isSearching = false,
  searchQuery = '',
  onSearchChange,
  onSearchClose,
  onSearchPrev,
  onSearchNext,
  searchResultIndex = 0,
  searchResultCount = 0,
}: ThreadHeaderProps) {
  const insets = useSafeAreaInsets()
  const { iconColorStrong, brandText, iconColor, colorSubtle } = useThemeColor()
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const searchInputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isEditingName])

  useEffect(() => {
    if (isSearching && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isSearching])

  const handleMenuSelect = (id: string) => {
    setMenuOpen(false)
    console.log('Menu selected:', id, thread.id)
    onMenu()
  }

  if (isSearching) {
    return (
      <XStack
        paddingTop={insets.top + 8}
        paddingHorizontal="$4"
        paddingBottom="$2"
        backgroundColor="$background"
        alignItems="center"
        gap="$2"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={onSearchClose}
          icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
        />

        <XStack
          flex={1}
          backgroundColor="$backgroundStrong"
          borderRadius="$3"
          paddingHorizontal="$3"
          alignItems="center"
          height={40}
        >
          <Ionicons name="search" size={18} color={iconColor} />
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search in thread..."
            placeholderTextColor={colorSubtle}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 16,
              color: iconColorStrong,
            }}
            returnKeyType="search"
          />
          {searchResultCount > 0 && (
            <Text fontSize="$2" color="$colorSubtle" marginRight="$2">
              {searchResultIndex + 1}/{searchResultCount}
            </Text>
          )}
        </XStack>

        <Button
          size="$3"
          circular
          chromeless
          onPress={onSearchPrev}
          disabled={searchResultCount === 0}
          opacity={searchResultCount === 0 ? 0.3 : 1}
          icon={<Ionicons name="chevron-up" size={22} color={iconColorStrong} />}
        />
        <Button
          size="$3"
          circular
          chromeless
          onPress={onSearchNext}
          disabled={searchResultCount === 0}
          opacity={searchResultCount === 0 ? 0.3 : 1}
          icon={<Ionicons name="chevron-down" size={22} color={iconColorStrong} />}
        />
      </XStack>
    )
  }

  return (
    <XStack
      paddingTop={insets.top + 8}
      paddingHorizontal="$4"
      paddingBottom="$2"
      backgroundColor="$background"
      alignItems="center"
      gap="$2"
    >
      <Button
        size="$3"
        circular
        chromeless
        onPress={onBack}
        icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
      />

      <XStack
        flex={1}
        alignItems="center"
        gap="$2"
        onPress={isEditingName ? undefined : onThreadPress}
        pressStyle={isEditingName ? undefined : { opacity: 0.7 }}
      >
        {thread.icon ? (
          thread.icon.startsWith('file://') || thread.icon.startsWith('content://') ? (
            <Image
              source={{ uri: thread.icon }}
              style={{ width: 36, height: 36, borderRadius: 18 }}
            />
          ) : (
            <Text fontSize="$5">{thread.icon}</Text>
          )
        ) : (
          <XStack
            width={36}
            height={36}
            borderRadius={18}
            backgroundColor="$brandBackground"
            alignItems="center"
            justifyContent="center"
          >
            <Text color={brandText} fontWeight="600" fontSize="$3">
              {getInitials(thread.name)}
            </Text>
          </XStack>
        )}
        {isEditingName ? (
          <TextInput
            ref={inputRef}
            style={{ flex: 1, fontSize: 20, fontWeight: '600', color: iconColorStrong }}
            value={thread.name}
            onChangeText={onNameChange}
            onSubmitEditing={onNameSubmit}
            selectTextOnFocus
            returnKeyType="done"
          />
        ) : (
          <Text fontSize="$5" fontWeight="600" numberOfLines={1} flex={1} color="$color">
            {thread.name}
          </Text>
        )}
      </XStack>

      <Button
        size="$3"
        circular
        chromeless
        onPress={onSearch}
        icon={<Ionicons name="search" size={22} color={iconColorStrong} />}
      />

      <XStack position="relative">
        <Button
          size="$3"
          circular
          chromeless
          onPress={onTasks}
          icon={<Ionicons name="checkbox-outline" size={22} color={iconColorStrong} />}
        />
        {taskCount > 0 && (
          <XStack
            position="absolute"
            top={6}
            right={6}
            backgroundColor="$errorColor"
            borderRadius={7}
            minWidth={14}
            height={14}
            alignItems="center"
            justifyContent="center"
            onPress={onTasks}
          >
            <Text color={brandText} fontSize={9} fontWeight="700">
              {taskCount > 99 ? '99+' : taskCount}
            </Text>
          </XStack>
        )}
      </XStack>

      <Popover open={menuOpen} onOpenChange={setMenuOpen} placement="bottom-end">
        <Popover.Trigger asChild>
          <Button
            size="$3"
            circular
            chromeless
            icon={<Ionicons name="ellipsis-vertical" size={22} color={iconColorStrong} />}
          />
        </Popover.Trigger>
        <Popover.Content
          backgroundColor="$background"
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius="$3"
          padding="$1"
          elevation={4}
          enterStyle={{ opacity: 0, y: -10 }}
          exitStyle={{ opacity: 0, y: -10 }}
          animation="quick"
          right={0}
        >
          <YStack>
            {menuOptions.map((option) => (
              <XStack
                key={option.id}
                paddingHorizontal="$3"
                paddingVertical="$2.5"
                gap="$3"
                alignItems="center"
                pressStyle={{ backgroundColor: '$backgroundStrong' }}
                borderRadius="$2"
                onPress={() => handleMenuSelect(option.id)}
              >
                <Ionicons name={option.icon as any} size={20} color={iconColor} />
                <Text fontSize="$3" color="$color">{option.label}</Text>
              </XStack>
            ))}
          </YStack>
        </Popover.Content>
      </Popover>
    </XStack>
  )
}
