import React, { useState, useCallback, useEffect, useRef } from 'react'
import { ScrollView, Alert, Image, Pressable, Modal, TextInput, FlatList } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { YStack, XStack, Text, Button, Spinner } from 'tamagui'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Country, CountryCode, getAllCountries, FlagType } from 'react-native-country-picker-modal'

import { useQueryClient } from '@tanstack/react-query'
import { useThemeColor } from '../../hooks/useThemeColor'
import { useUser, useUpdateUser, useIsAuthenticated } from '../../hooks/useUser'
import {
  signup,
  login,
  getPasswordStatus,
  setPassword as setPasswordApi,
  changePassword as changePasswordApi,
  checkUsername as checkUsernameApi,
  sendPhoneCode as sendPhoneCodeApi,
  verifyPhoneCode as verifyPhoneCodeApi,
  sendEmailCode as sendEmailCodeApi,
  verifyEmailCode as verifyEmailCodeApi,
} from '../../services/api'
import { useSyncService } from '../../hooks/useSyncService'

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const countryCodeToEmoji = (code: string) => {
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}


// Row component for consistent styling - defined outside to prevent remounting
const FieldRow = ({ children }: { children: React.ReactNode }) => (
  <XStack
    paddingVertical="$3"
    paddingHorizontal="$4"
    borderBottomWidth={1}
    borderBottomColor="$borderColor"
    alignItems="center"
    minHeight={56}
  >
    {children}
  </XStack>
)

export default function ProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, iconColor, brandText, accentColor, placeholderColor, background, color, borderColor, successColor } = useThemeColor()

  const queryClient = useQueryClient()
  const { data: user } = useUser()
  const updateUser = useUpdateUser()
  const { data: isAuthenticated, refetch: refetchAuth } = useIsAuthenticated()
  const { schedulePush, pull, push } = useSyncService()

  // Editing states - which field is active
  const [editingField, setEditingField] = useState<'name' | 'username' | 'email' | 'phone' | 'password' | null>(null)

  // Input refs for focus
  const nameInputRef = useRef<any>(null)
  const usernameInputRef = useRef<any>(null)
  const emailInputRef = useRef<any>(null)
  const emailCodeInputRef = useRef<any>(null)
  const phoneInputRef = useRef<any>(null)
  const phoneCodeInputRef = useRef<any>(null)
  const passwordInputRef = useRef<any>(null)

  // Focus input when editing starts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingField === 'name') nameInputRef.current?.focus()
      else if (editingField === 'username') usernameInputRef.current?.focus()
      else if (editingField === 'email') emailInputRef.current?.focus()
      else if (editingField === 'phone') phoneInputRef.current?.focus()
      else if (editingField === 'password') passwordInputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [editingField])

  // Name
  const [nameValue, setNameValue] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Username
  const [usernameValue, setUsernameValue] = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const usernameCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Email
  const [emailValue, setEmailValue] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailStep, setEmailStep] = useState<'input' | 'verify'>('input')
  const [emailError, setEmailError] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  // Phone
  const [phoneValue, setPhoneValue] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneStep, setPhoneStep] = useState<'input' | 'verify'>('input')
  const [phoneError, setPhoneError] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [callingCode, setCallingCode] = useState('1')
  const [countryCode, setCountryCode] = useState<CountryCode>('US')
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [countries, setCountries] = useState<Country[]>([])
  const [countryFilter, setCountryFilter] = useState('')

  // Focus code input when verification step starts
  useEffect(() => {
    if (emailStep === 'verify') {
      setTimeout(() => emailCodeInputRef.current?.focus(), 100)
    }
  }, [emailStep])

  useEffect(() => {
    if (phoneStep === 'verify') {
      setTimeout(() => phoneCodeInputRef.current?.focus(), 100)
    }
  }, [phoneStep])

  // Password
  const [hasPassword, setHasPassword] = useState(false)
  const [currentPasswordValue, setCurrentPasswordValue] = useState('')
  const [newPasswordValue, setNewPasswordValue] = useState('')
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Load countries
  useEffect(() => {
    getAllCountries('flat' as FlagType).then(setCountries).catch(console.warn)
  }, [])

  // Check password status
  useEffect(() => {
    if (isAuthenticated) {
      getPasswordStatus()
        .then(status => setHasPassword(status.hasPassword))
        .catch(() => setHasPassword(false))
    }
  }, [isAuthenticated])

  // Username availability check with debounce
  useEffect(() => {
    if (usernameCheckTimeout.current) clearTimeout(usernameCheckTimeout.current)

    if (!usernameValue || usernameValue === user?.username) {
      setUsernameAvailable(null)
      setUsernameError('')
      return
    }

    const regex = /^[a-z0-9_]{3,30}$/
    if (!regex.test(usernameValue.toLowerCase())) {
      setUsernameError('3-30 chars, lowercase, numbers, underscores')
      setUsernameAvailable(false)
      return
    }

    setCheckingUsername(true)
    usernameCheckTimeout.current = setTimeout(async () => {
      try {
        const res = await checkUsernameApi(usernameValue)
        setUsernameAvailable(res.available)
        setUsernameError(res.available ? '' : 'Username taken')
      } catch {
        setUsernameError('Check failed')
        setUsernameAvailable(false)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)
  }, [usernameValue, user?.username])

  const handleBack = useCallback(() => router.back(), [router])

  const handleChangeAvatar = useCallback(async () => {
    Alert.alert(
      'Change Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync()
            if (!perm.granted) return Alert.alert('Permission needed', 'Camera access required')
            const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
            if (!result.canceled && result.assets[0]) {
              await updateUser.mutateAsync({ avatar: result.assets[0].uri })
              if (isAuthenticated) schedulePush()
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
            if (!perm.granted) return Alert.alert('Permission needed', 'Photo library access required')
            const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
            if (!result.canceled && result.assets[0]) {
              await updateUser.mutateAsync({ avatar: result.assets[0].uri })
              if (isAuthenticated) schedulePush()
            }
          },
        },
        {
          text: 'Remove Photo',
          style: 'destructive',
          onPress: async () => {
            await updateUser.mutateAsync({ avatar: null })
            if (isAuthenticated) schedulePush()
          },
        },
        { text: 'Cancel', style: 'cancel', onPress: () => {} },
      ],
      { cancelable: true }
    )
  }, [updateUser, isAuthenticated, schedulePush])

  // ===== NAME =====
  const startEditName = () => {
    setNameValue(user?.name || '')
    setEditingField('name')
  }

  const saveName = async () => {
    if (!nameValue.trim()) return
    setSavingName(true)
    try {
      await updateUser.mutateAsync({ name: nameValue.trim() })
      if (isAuthenticated) schedulePush()
      setEditingField(null)
    } catch {
      Alert.alert('Error', 'Failed to save')
    } finally {
      setSavingName(false)
    }
  }

  // ===== USERNAME =====
  const startEditUsername = () => {
    setUsernameValue('')
    setPasswordValue('')
    setUsernameError('')
    setUsernameAvailable(null)
    setEditingField('username')
  }

  const saveUsername = async () => {
    if (!usernameValue || !passwordValue || passwordValue.length < 8) {
      setUsernameError('Password must be 8+ characters')
      return
    }

    setSavingUsername(true)
    setUsernameError('')
    try {
      if (usernameAvailable) {
        const res = await signup({ username: usernameValue, password: passwordValue, name: user?.name || 'Me' })
        await updateUser.mutateAsync({ username: res.user.username, name: res.user.name })
        queryClient.setQueryData(['user'], (old: any) => old ? {
          ...old, username: res.user.username, name: res.user.name,
        } : old)
        await push()
        await pull().catch(() => {})
        await refetchAuth()
        Alert.alert('Success', 'Account created!')
      } else if (usernameAvailable === false && !usernameError) {
        const res = await login({ username: usernameValue, password: passwordValue })
        await updateUser.mutateAsync({
          username: res.user.username,
          name: res.user.name,
          email: res.user.email,
          phone: res.user.phone,
          avatar: res.user.avatar,
        })
        queryClient.setQueryData(['user'], (old: any) => old ? {
          ...old,
          username: res.user.username,
          name: res.user.name,
          email: res.user.email ?? old.email,
          phone: res.user.phone ?? old.phone,
          avatar: res.user.avatar ?? old.avatar,
        } : old)
        await push()
        await pull().catch(() => {})
        await refetchAuth()
        Alert.alert('Success', 'Logged in!')
      }
      setEditingField(null)
    } catch (err: any) {
      setUsernameError(err.response?.data?.error || 'Failed')
    } finally {
      setSavingUsername(false)
    }
  }

  // ===== EMAIL =====
  const startEditEmail = () => {
    setEmailValue('')
    setEmailCode('')
    setEmailStep('input')
    setEmailError('')
    setEditingField('email')
  }

  const sendEmailCode = async () => {
    if (!emailValue) return
    setSavingEmail(true)
    setEmailError('')
    try {
      await sendEmailCodeApi(emailValue)
      setEmailStep('verify')
    } catch (err: any) {
      setEmailError(err.response?.data?.error || 'Failed to send')
    } finally {
      setSavingEmail(false)
    }
  }

  const verifyEmail = async () => {
    if (!emailCode) return
    setSavingEmail(true)
    setEmailError('')
    try {
      const result = await verifyEmailCodeApi(emailValue, emailCode, user?.name)

      // Update local SQLite (may return null if local user not found — that's ok)
      await updateUser.mutateAsync({
        email: result.user.email ?? null,
        username: result.user.username ?? null,
        phone: result.user.phone ?? null,
        name: result.user.name || user?.name || 'Me',
        avatar: result.user.avatar ?? null,
      }).catch(err => console.warn('[Profile] SQLite update failed:', err))

      // Force-set cache using component's user ref — guaranteed non-null since we're on this screen
      if (user) {
        queryClient.setQueryData(['user'], {
          ...user,
          email: result.user.email ?? user.email,
          username: result.user.username ?? user.username,
          phone: result.user.phone ?? user.phone,
          name: result.user.name || user.name,
          avatar: result.user.avatar ?? user.avatar,
        })
      }

      await refetchAuth()
      await push()
      await pull().catch(() => {})
      setEditingField(null)
    } catch (err: any) {
      setEmailError(err.response?.data?.error || err.message || 'Verification failed')
    } finally {
      setSavingEmail(false)
    }
  }

  // ===== PHONE =====
  const startEditPhone = () => {
    setPhoneValue('')
    setPhoneCode('')
    setPhoneStep('input')
    setPhoneError('')
    setEditingField('phone')
  }

  const sendPhoneCode = async () => {
    if (!phoneValue) return
    const fullPhone = `+${callingCode}${phoneValue}`
    setSavingPhone(true)
    setPhoneError('')
    try {
      await sendPhoneCodeApi(fullPhone)
      setPhoneStep('verify')
    } catch (err: any) {
      setPhoneError(err.response?.data?.error || 'Failed to send')
    } finally {
      setSavingPhone(false)
    }
  }

  const verifyPhone = async () => {
    if (!phoneCode) return
    const fullPhone = `+${callingCode}${phoneValue}`
    setSavingPhone(true)
    setPhoneError('')
    try {
      const result = await verifyPhoneCodeApi(fullPhone, phoneCode, user?.name)

      // Update local SQLite (may return null if local user not found — that's ok)
      await updateUser.mutateAsync({
        phone: result.user.phone ?? null,
        username: result.user.username ?? null,
        email: result.user.email ?? null,
        name: result.user.name || user?.name || 'Me',
        avatar: result.user.avatar ?? null,
      }).catch(err => console.warn('[Profile] SQLite update failed:', err))

      // Force-set cache using component's user ref
      if (user) {
        queryClient.setQueryData(['user'], {
          ...user,
          phone: result.user.phone ?? user.phone,
          username: result.user.username ?? user.username,
          email: result.user.email ?? user.email,
          name: result.user.name || user.name,
          avatar: result.user.avatar ?? user.avatar,
        })
      }

      await refetchAuth()
      await push()
      await pull().catch(() => {})
      setEditingField(null)
    } catch (err: any) {
      setPhoneError(err.response?.data?.error || err.message || 'Verification failed')
    } finally {
      setSavingPhone(false)
    }
  }

  // ===== PASSWORD =====
  const startEditPassword = () => {
    setCurrentPasswordValue('')
    setNewPasswordValue('')
    setConfirmPasswordValue('')
    setPasswordError('')
    setEditingField('password')
  }

  const savePassword = async () => {
    if (newPasswordValue.length < 8) {
      setPasswordError('Password must be 8+ characters')
      return
    }
    if (newPasswordValue !== confirmPasswordValue) {
      setPasswordError('Passwords do not match')
      return
    }
    setSavingPassword(true)
    setPasswordError('')
    try {
      if (hasPassword) {
        await changePasswordApi(currentPasswordValue, newPasswordValue)
      } else {
        await setPasswordApi(newPasswordValue)
      }
      setHasPassword(true)
      setEditingField(null)
      Alert.alert('Success', hasPassword ? 'Password changed' : 'Password set')
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Failed')
    } finally {
      setSavingPassword(false)
    }
  }

  const cancelEdit = () => setEditingField(null)

  const filteredCountries = countries.filter((c) => {
    if (!countryFilter) return true
    const s = countryFilter.toLowerCase()
    return (c.name?.toString().toLowerCase() || '').includes(s) || (c.cca2?.toLowerCase() || '').includes(s)
  })

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <XStack
        paddingTop={insets.top + 8}
        paddingHorizontal="$4"
        paddingBottom="$2"
        backgroundColor="$background"
        alignItems="center"
        gap="$2"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
      >
        <Button
          size="$3"
          circular
          chromeless
          onPress={handleBack}
          icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
        />
        <Text fontSize="$6" fontWeight="700" flex={1} color="$color">
          Profile
        </Text>
      </XStack>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <YStack alignItems="center" paddingVertical="$5">
            <Pressable onPress={handleChangeAvatar}>
              <XStack position="relative">
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={{ width: 90, height: 90, borderRadius: 45 }} />
                ) : (
                  <XStack width={90} height={90} borderRadius={45} backgroundColor="$brandBackground" alignItems="center" justifyContent="center">
                    <Text color={brandText} fontSize="$7" fontWeight="600">
                      {getInitials(user?.name || 'Me')}
                    </Text>
                  </XStack>
                )}
                <XStack
                  position="absolute"
                  bottom={0}
                  right={0}
                  width={28}
                  height={28}
                  borderRadius={14}
                  backgroundColor="$backgroundStrong"
                  borderWidth={2}
                  borderColor="$background"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Ionicons name="camera" size={14} color={iconColor} />
                </XStack>
              </XStack>
            </Pressable>
          </YStack>

          {/* NAME ROW */}
          <FieldRow>
            <Text width={80} fontSize="$3" color="$colorSubtle">Name</Text>
            {editingField === 'name' ? (
              <XStack flex={1} alignItems="center" gap="$2">
                <TextInput
                  ref={nameInputRef}
                  style={{ flex: 1, fontSize: 14, color }}
                  value={nameValue}
                  onChangeText={setNameValue}
                  placeholder="Your name"
                  placeholderTextColor={placeholderColor}
                />
                <Pressable onPress={cancelEdit} hitSlop={8}>
                  <Text fontSize="$3" color="$colorSubtle">Cancel</Text>
                </Pressable>
                <Pressable onPress={saveName} disabled={!nameValue.trim() || savingName} hitSlop={8}>
                  {savingName ? <Spinner size="small" /> : <Text fontSize="$3" color="$accentColor" fontWeight="600">Save</Text>}
                </Pressable>
              </XStack>
            ) : (
              <XStack flex={1} alignItems="center" justifyContent="space-between">
                <Text fontSize="$4" color={user?.name ? '$color' : '$colorSubtle'}>{user?.name || 'Not set'}</Text>
                <Pressable onPress={startEditName} hitSlop={8}>
                  <Text fontSize="$3" color="$accentColor">Edit</Text>
                </Pressable>
              </XStack>
            )}
          </FieldRow>

          {/* USERNAME ROW */}
          {user?.username ? (
            // Already has username - just display it
            <FieldRow>
              <Text width={80} fontSize="$3" color="$colorSubtle">Username</Text>
              <XStack flex={1} alignItems="center" gap="$2">
                <Ionicons name="checkmark-circle" size={16} color={successColor} />
                <Text flex={1} fontSize="$4" color="$color">@{user.username}</Text>
              </XStack>
            </FieldRow>
          ) : editingField === 'username' ? (
            // Editing username - show input inline
            <YStack borderBottomWidth={1} borderBottomColor="$borderColor">
              <XStack paddingVertical="$3" paddingHorizontal="$4" alignItems="center">
                <Text width={80} fontSize="$3" color="$colorSubtle">Username</Text>
                <XStack flex={1} alignItems="center" gap="$2">
                  <TextInput
                    ref={usernameInputRef}
                    style={{ flex: 1, fontSize: 14, color }}
                    value={usernameValue}
                    onChangeText={(t) => setUsernameValue(t.toLowerCase())}
                    placeholder="username"
                    placeholderTextColor={placeholderColor}
                    autoCapitalize="none"
                  />
                  {checkingUsername && <Spinner size="small" />}
                  {!checkingUsername && usernameAvailable === true && (
                    <Text fontSize="$2" color="$green10">Available</Text>
                  )}
                  {!checkingUsername && usernameAvailable === false && !usernameError && (
                    <Text fontSize="$2" color="$orange10">Login</Text>
                  )}
                  <Pressable onPress={cancelEdit} hitSlop={8}>
                    <Text fontSize="$3" color="$colorSubtle">Cancel</Text>
                  </Pressable>
                </XStack>
              </XStack>
              {usernameError && (
                <Text fontSize="$2" color="$red10" paddingHorizontal="$4" paddingBottom="$2">{usernameError}</Text>
              )}
              {/* Password row appears when username is valid */}
              {(usernameAvailable === true || (usernameAvailable === false && !usernameError)) && (
                <XStack paddingVertical="$3" paddingHorizontal="$4" alignItems="center">
                  <Text width={80} fontSize="$3" color="$colorSubtle">Password</Text>
                  <XStack flex={1} alignItems="center" gap="$2">
                    <TextInput
                      style={{ flex: 1, fontSize: 14, color }}
                      value={passwordValue}
                      onChangeText={setPasswordValue}
                      placeholder={usernameAvailable ? 'Create password (8+)' : 'Enter password'}
                      placeholderTextColor={placeholderColor}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                      <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={iconColor} />
                    </Pressable>
                    <Pressable
                      onPress={saveUsername}
                      disabled={!passwordValue || passwordValue.length < 8 || savingUsername}
                      hitSlop={8}
                    >
                      {savingUsername ? (
                        <Spinner size="small" />
                      ) : (
                        <Text fontSize="$3" color="$accentColor" fontWeight="600">
                          {usernameAvailable ? 'Create' : 'Login'}
                        </Text>
                      )}
                    </Pressable>
                  </XStack>
                </XStack>
              )}
            </YStack>
          ) : (
            // Not editing - show "Add" button
            <FieldRow>
              <Text width={80} fontSize="$3" color="$colorSubtle">Username</Text>
              <XStack flex={1} alignItems="center" justifyContent="space-between">
                <Text fontSize="$4" color="$colorSubtle">Not set</Text>
                <Pressable onPress={startEditUsername} hitSlop={8}>
                  <Text fontSize="$3" color="$accentColor">Add</Text>
                </Pressable>
              </XStack>
            </FieldRow>
          )}

          {/* EMAIL ROW */}
          {user?.email ? (
            <FieldRow>
              <Text width={80} fontSize="$3" color="$colorSubtle">Email</Text>
              <XStack flex={1} alignItems="center" gap="$2">
                <Ionicons name="checkmark-circle" size={16} color={successColor} />
                <Text flex={1} fontSize="$4" color="$color">{user.email}</Text>
                <Pressable onPress={startEditEmail} hitSlop={8}>
                  <Text fontSize="$3" color="$accentColor">Change</Text>
                </Pressable>
              </XStack>
            </FieldRow>
          ) : editingField === 'email' ? (
            <YStack borderBottomWidth={1} borderBottomColor="$borderColor">
              <XStack paddingVertical="$3" paddingHorizontal="$4" alignItems="center">
                <Text width={80} fontSize="$3" color="$colorSubtle">Email</Text>
                {emailStep === 'input' ? (
                  <XStack flex={1} alignItems="center" gap="$2">
                    <TextInput
                      ref={emailInputRef}
                      style={{ flex: 1, fontSize: 14, color }}
                      value={emailValue}
                      onChangeText={setEmailValue}
                      placeholder="email@example.com"
                      placeholderTextColor={placeholderColor}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <Pressable onPress={cancelEdit} hitSlop={8}>
                      <Text fontSize="$3" color="$colorSubtle">Cancel</Text>
                    </Pressable>
                    <Pressable onPress={sendEmailCode} disabled={!emailValue || savingEmail} hitSlop={8}>
                      {savingEmail ? <Spinner size="small" /> : <Text fontSize="$3" color="$accentColor" fontWeight="600">Verify</Text>}
                    </Pressable>
                  </XStack>
                ) : (
                  <XStack flex={1} alignItems="center" gap="$2">
                    <TextInput
                      ref={emailCodeInputRef}
                      style={{ flex: 1, fontSize: 14, color }}
                      value={emailCode}
                      onChangeText={setEmailCode}
                      placeholder="Enter code"
                      placeholderTextColor={placeholderColor}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <Pressable onPress={cancelEdit} hitSlop={8}>
                      <Text fontSize="$3" color="$colorSubtle">Cancel</Text>
                    </Pressable>
                    <Pressable onPress={verifyEmail} disabled={emailCode.length !== 6 || savingEmail} hitSlop={8}>
                      {savingEmail ? <Spinner size="small" /> : <Text fontSize="$3" color="$accentColor" fontWeight="600">Confirm</Text>}
                    </Pressable>
                  </XStack>
                )}
              </XStack>
              {emailError && (
                <Text fontSize="$2" color="$red10" paddingHorizontal="$4" paddingBottom="$2">{emailError}</Text>
              )}
            </YStack>
          ) : (
            <FieldRow>
              <Text width={80} fontSize="$3" color="$colorSubtle">Email</Text>
              <XStack flex={1} alignItems="center" justifyContent="space-between">
                <Text fontSize="$4" color="$colorSubtle">Not set</Text>
                <Pressable onPress={startEditEmail} hitSlop={8}>
                  <Text fontSize="$3" color="$accentColor">Add</Text>
                </Pressable>
              </XStack>
            </FieldRow>
          )}

          {/* PHONE ROW */}
          {user?.phone ? (
            <FieldRow>
              <Text width={80} fontSize="$3" color="$colorSubtle">Phone</Text>
              <XStack flex={1} alignItems="center" gap="$2">
                <Ionicons name="checkmark-circle" size={16} color={successColor} />
                <Text flex={1} fontSize="$4" color="$color">{user.phone}</Text>
                <Pressable onPress={startEditPhone} hitSlop={8}>
                  <Text fontSize="$3" color="$accentColor">Change</Text>
                </Pressable>
              </XStack>
            </FieldRow>
          ) : editingField === 'phone' ? (
            <YStack borderBottomWidth={1} borderBottomColor="$borderColor">
              <XStack paddingVertical="$3" paddingHorizontal="$4" alignItems="center">
                <Text width={80} fontSize="$3" color="$colorSubtle">Phone</Text>
                {phoneStep === 'input' ? (
                  <XStack flex={1} alignItems="center" gap="$2">
                    <Pressable onPress={() => setShowCountryPicker(true)}>
                      <XStack alignItems="center" gap="$1">
                        <Text fontSize={18}>{countryCodeToEmoji(countryCode)}</Text>
                        <Text fontSize="$3" color="$color">+{callingCode}</Text>
                        <Ionicons name="chevron-down" size={12} color={iconColor} />
                      </XStack>
                    </Pressable>
                    <TextInput
                      ref={phoneInputRef}
                      style={{ flex: 1, fontSize: 14, color }}
                      value={phoneValue}
                      onChangeText={setPhoneValue}
                      placeholder="Phone number"
                      placeholderTextColor={placeholderColor}
                      keyboardType="phone-pad"
                    />
                    <Pressable onPress={cancelEdit} hitSlop={8}>
                      <Text fontSize="$3" color="$colorSubtle">Cancel</Text>
                    </Pressable>
                    <Pressable onPress={sendPhoneCode} disabled={!phoneValue || savingPhone} hitSlop={8}>
                      {savingPhone ? <Spinner size="small" /> : <Text fontSize="$3" color="$accentColor" fontWeight="600">Verify</Text>}
                    </Pressable>
                  </XStack>
                ) : (
                  <XStack flex={1} alignItems="center" gap="$2">
                    <TextInput
                      ref={phoneCodeInputRef}
                      style={{ flex: 1, fontSize: 14, color }}
                      value={phoneCode}
                      onChangeText={setPhoneCode}
                      placeholder="Enter code"
                      placeholderTextColor={placeholderColor}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <Pressable onPress={cancelEdit} hitSlop={8}>
                      <Text fontSize="$3" color="$colorSubtle">Cancel</Text>
                    </Pressable>
                    <Pressable onPress={verifyPhone} disabled={phoneCode.length !== 6 || savingPhone} hitSlop={8}>
                      {savingPhone ? <Spinner size="small" /> : <Text fontSize="$3" color="$accentColor" fontWeight="600">Confirm</Text>}
                    </Pressable>
                  </XStack>
                )}
              </XStack>
              {phoneError && (
                <Text fontSize="$2" color="$red10" paddingHorizontal="$4" paddingBottom="$2">{phoneError}</Text>
              )}
            </YStack>
          ) : (
            <FieldRow>
              <Text width={80} fontSize="$3" color="$colorSubtle">Phone</Text>
              <XStack flex={1} alignItems="center" justifyContent="space-between">
                <Text fontSize="$4" color="$colorSubtle">Not set</Text>
                <Pressable onPress={startEditPhone} hitSlop={8}>
                  <Text fontSize="$3" color="$accentColor">Add</Text>
                </Pressable>
              </XStack>
            </FieldRow>
          )}

          {/* PASSWORD ROW - only for authenticated users */}
          {isAuthenticated && (
            editingField === 'password' ? (
              <YStack borderBottomWidth={1} borderBottomColor="$borderColor">
                {hasPassword && (
                  <XStack paddingVertical="$3" paddingHorizontal="$4" alignItems="center">
                    <Text width={80} fontSize="$3" color="$colorSubtle">Current</Text>
                    <TextInput
                      ref={passwordInputRef}
                      style={{ flex: 1, fontSize: 14, color }}
                      value={currentPasswordValue}
                      onChangeText={setCurrentPasswordValue}
                      placeholder="Current password"
                      placeholderTextColor={placeholderColor}
                      secureTextEntry
                    />
                  </XStack>
                )}
                <XStack paddingVertical="$3" paddingHorizontal="$4" alignItems="center">
                  <Text width={80} fontSize="$3" color="$colorSubtle">New</Text>
                  <TextInput
                    ref={hasPassword ? undefined : passwordInputRef}
                    style={{ flex: 1, fontSize: 14, color }}
                    value={newPasswordValue}
                    onChangeText={setNewPasswordValue}
                    placeholder="New password (8+)"
                    placeholderTextColor={placeholderColor}
                    secureTextEntry
                  />
                </XStack>
                <XStack paddingVertical="$3" paddingHorizontal="$4" alignItems="center">
                  <Text width={80} fontSize="$3" color="$colorSubtle">Confirm</Text>
                  <XStack flex={1} alignItems="center" gap="$2">
                    <TextInput
                      style={{ flex: 1, fontSize: 14, color }}
                      value={confirmPasswordValue}
                      onChangeText={setConfirmPasswordValue}
                      placeholder="Confirm password"
                      placeholderTextColor={placeholderColor}
                      secureTextEntry
                    />
                    <Pressable onPress={cancelEdit} hitSlop={8}>
                      <Text fontSize="$3" color="$colorSubtle">Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={savePassword}
                      disabled={!newPasswordValue || !confirmPasswordValue || (hasPassword && !currentPasswordValue) || savingPassword}
                      hitSlop={8}
                    >
                      {savingPassword ? <Spinner size="small" /> : <Text fontSize="$3" color="$accentColor" fontWeight="600">Save</Text>}
                    </Pressable>
                  </XStack>
                </XStack>
                {passwordError && (
                  <Text fontSize="$2" color="$red10" paddingHorizontal="$4" paddingBottom="$2">{passwordError}</Text>
                )}
              </YStack>
            ) : (
              <FieldRow>
                <Text width={80} fontSize="$3" color="$colorSubtle">Password</Text>
                <XStack flex={1} alignItems="center" justifyContent="space-between">
                  <Text fontSize="$4" color={hasPassword ? '$color' : '$colorSubtle'}>
                    {hasPassword ? '••••••••' : 'Not set'}
                  </Text>
                  <Pressable onPress={startEditPassword} hitSlop={8}>
                    <Text fontSize="$3" color="$accentColor">{hasPassword ? 'Change' : 'Set'}</Text>
                  </Pressable>
                </XStack>
              </FieldRow>
            )
          )}

          {/* Info note */}
          <YStack padding="$4">
            <XStack backgroundColor="$blue2" padding="$3" borderRadius="$3" gap="$2" alignItems="flex-start">
              <Ionicons name="information-circle-outline" size={18} color={accentColor} />
              <Text fontSize="$2" color="$blue10" flex={1}>
                Set any identifier (username, email, or phone) to enable cloud sync and backup.
              </Text>
            </XStack>
          </YStack>

          <YStack height={insets.bottom + 20} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" onRequestClose={() => { setShowCountryPicker(false); setCountryFilter('') }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: background }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <XStack paddingHorizontal="$4" paddingVertical="$3" alignItems="center" borderBottomWidth={1} borderBottomColor="$borderColor" gap="$3">
              <Button size="$3" circular chromeless onPress={() => { setShowCountryPicker(false); setCountryFilter('') }} icon={<Ionicons name="close" size={24} color={iconColorStrong} />} />
              <XStack flex={1} backgroundColor="$backgroundStrong" borderRadius="$3" paddingHorizontal="$3" alignItems="center" height={40}>
                <Ionicons name="search" size={18} color={iconColor} />
                <TextInput
                  value={countryFilter}
                  onChangeText={setCountryFilter}
                  placeholder="Search country..."
                  placeholderTextColor={placeholderColor}
                  style={{ flex: 1, marginLeft: 8, fontSize: 16, color }}
                  autoFocus
                />
              </XStack>
            </XStack>
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.cca2}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCountryCode(item.cca2)
                    if (item.callingCode?.[0]) setCallingCode(item.callingCode[0])
                    setShowCountryPicker(false)
                    setCountryFilter('')
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 12,
                    backgroundColor: pressed ? borderColor : 'transparent',
                  })}
                >
                  <Text fontSize={28}>{countryCodeToEmoji(item.cca2)}</Text>
                  <Text flex={1} fontSize="$4" color="$color" numberOfLines={1}>{item.name?.toString()}</Text>
                  <Text fontSize="$4" color="$colorSubtle">+{item.callingCode?.[0]}</Text>
                </Pressable>
              )}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </YStack>
  )
}
