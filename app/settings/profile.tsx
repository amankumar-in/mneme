import React, { useState, useCallback, useEffect, useRef } from 'react'
import { ScrollView, Alert, Image, Pressable, Platform, Modal, TextInput, FlatList } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { YStack, XStack, Text, Button, Input, Spinner } from 'tamagui'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Country, CountryCode, getAllCountries, FlagType } from 'react-native-country-picker-modal'

import { useThemeColor } from '../../hooks/useThemeColor'
import { useUser, useUpdateUser, useIsAuthenticated } from '../../hooks/useUser'
import { getAuthToken } from '../../services/storage'
import {
  signup,
  login,
  getPasswordStatus,
  setPassword as setPasswordApi,
  changePassword as changePasswordApi,
  checkUsername as checkUsernameApi,
} from '../../services/api'
import { useSyncService } from '../../hooks/useSyncService'
import axios from 'axios'

const countryCodeToEmoji = (code: string) => {
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

const getApiUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api'
  }
  return 'http://localhost:3000/api'
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || getApiUrl()

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

  const { data: user, refetch: refetchUser } = useUser()
  const updateUser = useUpdateUser()
  const { data: isAuthenticated, refetch: refetchAuth } = useIsAuthenticated()
  const { schedulePush } = useSyncService()

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
        schedulePush()
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
        schedulePush()
        await refetchAuth()
        Alert.alert('Success', 'Logged in!')
      }
      setEditingField(null)
      await refetchUser()
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
    if (!isAuthenticated) {
      setEmailError('Set username first')
      return
    }
    setSavingEmail(true)
    setEmailError('')
    try {
      const token = await getAuthToken()
      await axios.post(`${API_URL}/verify/email/send`, { email: emailValue }, {
        headers: { Authorization: `Bearer ${token}` }
      })
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
      const token = await getAuthToken()
      await axios.post(`${API_URL}/verify/email/verify`, { email: emailValue, code: emailCode }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      await updateUser.mutateAsync({ email: emailValue })
      schedulePush()
      setEditingField(null)
      await refetchUser()
    } catch (err: any) {
      setEmailError(err.response?.data?.error || 'Verification failed')
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
    if (!isAuthenticated) {
      setPhoneError('Set username first')
      return
    }
    const fullPhone = `+${callingCode}${phoneValue}`
    setSavingPhone(true)
    setPhoneError('')
    try {
      const token = await getAuthToken()
      await axios.post(`${API_URL}/verify/phone/send`, { phone: fullPhone }, {
        headers: { Authorization: `Bearer ${token}` }
      })
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
      const token = await getAuthToken()
      await axios.post(`${API_URL}/verify/phone/verify`, { phone: fullPhone, code: phoneCode }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      await updateUser.mutateAsync({ phone: fullPhone })
      schedulePush()
      setEditingField(null)
      await refetchUser()
    } catch (err: any) {
      setPhoneError(err.response?.data?.error || 'Verification failed')
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
                      {(user?.name || 'Me').slice(0, 2).toUpperCase()}
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
                <Input
                  ref={nameInputRef}
                  flex={1}
                  size="$3"
                  value={nameValue}
                  onChangeText={setNameValue}
                  placeholder="Your name"
                  placeholderTextColor={placeholderColor as any}
                  borderWidth={0}
                  backgroundColor="transparent"
                  paddingHorizontal={0}
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
                  <Input
                    ref={usernameInputRef}
                    flex={1}
                    size="$3"
                    value={usernameValue}
                    onChangeText={(t) => setUsernameValue(t.toLowerCase())}
                    placeholder="username"
                    placeholderTextColor={placeholderColor as any}
                    autoCapitalize="none"
                    borderWidth={0}
                    backgroundColor="transparent"
                    paddingHorizontal={0}
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
                    <Input
                      flex={1}
                      size="$3"
                      value={passwordValue}
                      onChangeText={setPasswordValue}
                      placeholder={usernameAvailable ? 'Create password (8+)' : 'Enter password'}
                      placeholderTextColor={placeholderColor as any}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      borderWidth={0}
                      backgroundColor="transparent"
                      paddingHorizontal={0}
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
                    <Input
                      ref={emailInputRef}
                      flex={1}
                      size="$3"
                      value={emailValue}
                      onChangeText={setEmailValue}
                      placeholder="email@example.com"
                      placeholderTextColor={placeholderColor as any}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      borderWidth={0}
                      backgroundColor="transparent"
                      paddingHorizontal={0}
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
                    <Input
                      ref={emailCodeInputRef}
                      flex={1}
                      size="$3"
                      value={emailCode}
                      onChangeText={setEmailCode}
                      placeholder="Enter code"
                      placeholderTextColor={placeholderColor as any}
                      keyboardType="number-pad"
                      maxLength={6}
                      borderWidth={0}
                      backgroundColor="transparent"
                      paddingHorizontal={0}
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
                    <Input
                      ref={phoneInputRef}
                      flex={1}
                      size="$3"
                      value={phoneValue}
                      onChangeText={setPhoneValue}
                      placeholder="Phone number"
                      placeholderTextColor={placeholderColor as any}
                      keyboardType="phone-pad"
                      borderWidth={0}
                      backgroundColor="transparent"
                      paddingHorizontal={0}
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
                    <Input
                      ref={phoneCodeInputRef}
                      flex={1}
                      size="$3"
                      value={phoneCode}
                      onChangeText={setPhoneCode}
                      placeholder="Enter code"
                      placeholderTextColor={placeholderColor as any}
                      keyboardType="number-pad"
                      maxLength={6}
                      borderWidth={0}
                      backgroundColor="transparent"
                      paddingHorizontal={0}
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
                    <Input
                      ref={passwordInputRef}
                      flex={1}
                      size="$3"
                      value={currentPasswordValue}
                      onChangeText={setCurrentPasswordValue}
                      placeholder="Current password"
                      placeholderTextColor={placeholderColor as any}
                      secureTextEntry
                      borderWidth={0}
                      backgroundColor="transparent"
                      paddingHorizontal={0}
                    />
                  </XStack>
                )}
                <XStack paddingVertical="$3" paddingHorizontal="$4" alignItems="center">
                  <Text width={80} fontSize="$3" color="$colorSubtle">New</Text>
                  <Input
                    ref={hasPassword ? undefined : passwordInputRef}
                    flex={1}
                    size="$3"
                    value={newPasswordValue}
                    onChangeText={setNewPasswordValue}
                    placeholder="New password (8+)"
                    placeholderTextColor={placeholderColor as any}
                    secureTextEntry
                    borderWidth={0}
                    backgroundColor="transparent"
                    paddingHorizontal={0}
                  />
                </XStack>
                <XStack paddingVertical="$3" paddingHorizontal="$4" alignItems="center">
                  <Text width={80} fontSize="$3" color="$colorSubtle">Confirm</Text>
                  <XStack flex={1} alignItems="center" gap="$2">
                    <Input
                      flex={1}
                      size="$3"
                      value={confirmPasswordValue}
                      onChangeText={setConfirmPasswordValue}
                      placeholder="Confirm password"
                      placeholderTextColor={placeholderColor as any}
                      secureTextEntry
                      borderWidth={0}
                      backgroundColor="transparent"
                      paddingHorizontal={0}
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
                Create an account with username + password to enable cloud sync and backup.
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
