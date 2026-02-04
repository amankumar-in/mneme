import { XStack, Button } from 'tamagui'
import { TextInput } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useRef, useEffect } from 'react'
import { useThemeColor } from '../hooks/useThemeColor'

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
  const { iconColor, placeholderColor, color } = useThemeColor()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChangeText = useCallback(
    (text: string) => {
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
      backgroundColor="$backgroundStrong"
      borderRadius="$4"
      alignItems="center"
      paddingHorizontal="$3"
      height={44}
    >
      <Ionicons name="search" size={20} color={iconColor} />
      <TextInput
        style={{ flex: 1, marginLeft: 8, fontSize: 16, color }}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        defaultValue={value}
        onChangeText={handleChangeText}
        autoFocus={autoFocus}
      />
      {value.length > 0 && (
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
