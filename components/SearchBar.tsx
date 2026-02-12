import { XStack, Button } from 'tamagui'
import { TextInput } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useRef, useEffect, useState } from 'react'
import { useThemeColor } from '../hooks/useThemeColor'
import { useWallpaper } from '../contexts/WallpaperContext'

interface SearchBarProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  autoFocus = false,
}: SearchBarProps) {
  const { iconColor, placeholderColor, color, backgroundStrong } = useThemeColor()
  const { homeWallpaper } = useWallpaper()
  const inputRef = useRef<TextInput>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localText, setLocalText] = useState(value)

  const handleChangeText = useCallback(
    (text: string) => {
      setLocalText(text)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        onChangeText(text)
      }, 300)
    },
    [onChangeText]
  )

  const handleClear = useCallback(() => {
    setLocalText('')
    inputRef.current?.clear()
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    onChangeText('')
  }, [onChangeText])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <XStack
      marginHorizontal="$4"
      marginVertical="$2"
      backgroundColor={homeWallpaper ? backgroundStrong + '80' : '$backgroundStrong'}
      borderRadius="$4"
      alignItems="center"
      paddingHorizontal="$3"
      height={44}
    >
      <Ionicons name="search" size={20} color={iconColor} />
      <TextInput
        ref={inputRef}
        style={{ flex: 1, marginLeft: 8, fontSize: 16, color }}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        defaultValue={value}
        onChangeText={handleChangeText}
        autoFocus={autoFocus}
      />
      {localText.length > 0 && (
        <Button
          size="$2"
          circular
          chromeless
          onPress={handleClear}
          icon={<Ionicons name="close-circle" size={20} color={iconColor} />}
        />
      )}
    </XStack>
  )
}
