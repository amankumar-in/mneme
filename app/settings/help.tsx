import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Linking, ScrollView, TextInput } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Text, XStack, YStack } from 'tamagui'
import { ScreenBackground } from '../../components/ScreenBackground'
import { useThemeColor } from '../../hooks/useThemeColor'

interface FAQItem {
  question: string
  answer: string
}

interface FAQSection {
  title: string
  items: FAQItem[]
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    title: 'Getting Started',
    items: [
      {
        question: 'What is LaterBox?',
        answer:
          'LaterBox is a privacy-focused, offline-first notes app with a familiar messaging interface. Your notes are organized into threads that look and feel like chat conversations. Everything is stored locally on your device by default — no account or internet connection required. Cloud sync is entirely optional.',
      },
      {
        question: 'How do I create a thread?',
        answer:
          'Tap the + button at the bottom right corner of the home screen. A new thread will be created and you can immediately type a name for it. Threads are like folders or conversations — use them to organize your notes by topic, project, or anything else.',
      },
      {
        question: 'How do I write a note?',
        answer:
          'Open a thread and type in the text field at the bottom of the screen. Tap the send button to save your note. You can also attach media using the paperclip icon, or record a voice note using the microphone button.',
      },
      {
        question: 'What types of notes can I create?',
        answer:
          'You can create text notes, attach images (from camera or gallery), record or attach videos, record voice notes, attach audio files, attach documents of any type, share your current location, and share contacts from your device.',
      },
    ],
  },
  {
    title: 'Threads',
    items: [
      {
        question: 'What are threads?',
        answer:
          'Threads are the main way to organize your notes. Think of them like chat conversations — each thread has a name, an optional icon, and contains all the notes you add to it. They appear on the home screen ordered by most recent activity, with pinned threads always at the top.',
      },
      {
        question: 'How do I rename a thread?',
        answer:
          'Open the thread, then tap the thread name in the header to edit it. You can also tap the three-dot menu in the top right and go to the thread info screen, where you can tap "Edit" next to the name. Thread names can be up to 32 characters.',
      },
      {
        question: 'How do I change a thread icon?',
        answer:
          'Open the thread info screen by tapping the three-dot menu. Tap the thread avatar at the top to choose from preset emoji icons or select a custom photo from your gallery. You can also remove the icon to go back to the default initials display.',
      },
      {
        question: 'How do I pin a thread?',
        answer:
          'Long-press a thread on the home screen to enter selection mode, then tap the bookmark icon in the action bar at the bottom. Pinned threads always appear at the top of your thread list, making them easy to find.',
      },
      {
        question: 'How do I delete a thread?',
        answer:
          'Long-press a thread on the home screen to enter selection mode, then tap the delete icon. You will be asked to confirm. Deleting a thread removes it and all its unlocked notes. Any locked notes will be automatically moved to the Protected Notes thread for safekeeping.',
      },
      {
        question: 'What happens to locked notes when I delete a thread?',
        answer:
          'Locked notes are never deleted with a thread. Instead, they are automatically moved to the Protected Notes thread. This ensures your important locked notes are always preserved, even if the original thread is removed.',
      },
    ],
  },
  {
    title: 'Notes',
    items: [
      {
        question: 'How do I edit a note?',
        answer:
          'Long-press a note to enter selection mode, make sure only one note is selected, then tap the edit (pencil) icon in the action bar. The note content will appear in the input field for editing. Tap send to save your changes. Edited notes will show an "edited" label.',
      },
      {
        question: 'How do I delete a note?',
        answer:
          'Long-press a note to enter selection mode, select the notes you want to remove, then tap the delete icon. You will be asked to confirm. Locked notes cannot be deleted — you need to unlock them first.',
      },
      {
        question: 'How do I star a note?',
        answer:
          'Long-press a note to enter selection mode, then tap the star icon in the action bar. Starred notes display a star icon and a gold accent border to help them stand out. You can star multiple notes at once. Tap the star icon again to unstar.',
      },
      {
        question: 'How do I lock a note?',
        answer:
          'Long-press a note to enter selection mode, then tap the lock icon in the action bar. Locked notes are marked with a lock icon and are also listed in the Protected Notes thread. Locking protects a note from being deleted when you delete its thread.',
      },
      {
        question: 'Can I select multiple notes at once?',
        answer:
          'Yes. Long-press any note to enter selection mode, then tap additional notes to select them. The action bar at the bottom lets you perform bulk actions like copy, star, lock, convert to task, or delete on all selected notes at once.',
      },
    ],
  },
  {
    title: 'Protected Notes',
    items: [
      {
        question: 'What is the Protected Notes thread?',
        answer:
          'Protected Notes is a special system thread that collects all your locked notes from every thread in one place. It is automatically created when you first use the app and is marked with a lock icon. It cannot be deleted.',
      },
      {
        question: 'How do notes end up in Protected Notes?',
        answer:
          'When you lock a note in any thread, it automatically appears in the Protected Notes thread. If you delete a thread that contains locked notes, those locked notes are moved to Protected Notes instead of being deleted.',
      },
      {
        question: 'Can I add notes directly to Protected Notes?',
        answer:
          'No. The Protected Notes thread is read-only — you cannot type new notes into it. Notes only appear there when you lock them in their original thread. To remove a note from Protected Notes, unlock it and it will only appear in its original thread.',
      },
    ],
  },
  {
    title: 'Tasks & Reminders',
    items: [
      {
        question: 'How do I create a task from a note?',
        answer:
          'Long-press a note to enter selection mode, then tap the task icon (alarm clock) in the action bar. A date and time picker will appear so you can set a reminder. The note will then show a checkbox and the reminder date.',
      },
      {
        question: 'How do I set a reminder?',
        answer:
          'When converting a note to a task, you will be asked to pick a date and time for the reminder. The default is tomorrow at 9:00 AM. A local notification will be scheduled at that exact time to remind you.',
      },
      {
        question: 'How do I complete a task?',
        answer:
          'Tap the checkbox on any task note, either in the thread view or on the Tasks screen. Completed tasks show a green checkmark and the text gets a strikethrough. You can also uncomplete a task by tapping the checkbox again.',
      },
      {
        question: 'How do I view all my tasks?',
        answer:
          'Tap the "Tasks" filter chip on the home screen to see all tasks across all threads. You can filter by Pending, Completed, or All. You can also view tasks for a specific thread from the thread header menu or thread info screen.',
      },
      {
        question: 'How do task reminders work?',
        answer:
          'Task reminders are delivered as local push notifications at the date and time you set. They work entirely offline — no internet connection needed. When you complete or delete a task, its scheduled reminder is automatically cancelled.',
      },
      {
        question: 'How do I turn off task reminders?',
        answer:
          'Go to Settings and toggle off "Task Reminders." This cancels all currently scheduled reminder notifications. When you turn it back on, reminders for all future uncompleted tasks will be rescheduled automatically.',
      },
    ],
  },
  {
    title: 'Media & Attachments',
    items: [
      {
        question: 'What types of files can I attach?',
        answer:
          'You can attach images, videos (up to 5 minutes), voice recordings, audio files (up to 100 MB), documents of any type (up to 100 MB), your current location with address, and contacts from your device.',
      },
      {
        question: 'How do I attach an image or video?',
        answer:
          'Tap the paperclip icon in the input bar to open the attachment menu. Choose "Camera" to capture a new photo or video, or "Gallery" to pick one from your device. You can add an optional caption before sending.',
      },
      {
        question: 'How do I record a voice note?',
        answer:
          'When the text input is empty and there is no pending attachment, a microphone button appears on the right side of the input bar. Tap it to start recording. You will see a live waveform and a duration counter. Tap the stop button to finish, or the trash icon to cancel. Voice notes must be at least 1 second long.',
      },
      {
        question: 'How do I attach a document or audio file?',
        answer:
          'Tap the paperclip icon and choose "Document" to attach any file type, or "Audio" to browse for audio files specifically. Files can be up to 100 MB in size. Documents open with your device\'s default viewer when tapped.',
      },
      {
        question: 'How do I share my location?',
        answer:
          'Tap the paperclip icon and choose "Location." The app will request permission to access your device\'s GPS, determine your current position, and reverse-geocode it into a readable address. Tapping a shared location opens it in your device\'s Maps app.',
      },
      {
        question: 'How do I share a contact?',
        answer:
          'Tap the paperclip icon and choose "Contact." A contact picker screen will open where you can search and select a contact from your device. The shared contact will show the person\'s name, phone numbers, and email addresses.',
      },
      {
        question: 'How do I view all media in a thread?',
        answer:
          'Open the thread, tap the three-dot menu in the top right, and select "Media Files." This opens the media gallery where you can browse all photos, videos, and files in that thread, organized by month in a grid layout.',
      },
    ],
  },
  {
    title: 'Privacy & Security',
    items: [
      {
        question: 'Is my data private?',
        answer:
          'Yes. All your notes are stored locally on your device in a private database. No one else can access them. Cloud sync is entirely optional — if you never set up an identity, your data never leaves your device.',
      },
      {
        question: 'What does the "Who can find me" setting do?',
        answer:
          'This controls whether other people can find you by your username, email, or phone number to share notes with you. You can set it to "Everyone," "Contacts Only," or "No One." This does not affect your own notes — they are always private regardless of this setting.',
      },
      {
        question: 'Where is my data stored?',
        answer:
          'Your notes, threads, and tasks are stored in a local SQLite database on your device. Media attachments are saved to your device\'s app storage. If you enable cloud sync, a copy of your data is also stored on the LaterBox server. You can delete your remote data at any time from Settings.',
      },
    ],
  },
  {
    title: 'Cloud Sync & Account',
    items: [
      {
        question: 'Do I need an account to use LaterBox?',
        answer:
          'No. LaterBox works fully offline with no account. You can use all features — threads, notes, tasks, media, and more — without signing up. An account is only needed if you want to sync your data across devices.',
      },
      {
        question: 'What are the identity types?',
        answer:
          'You can set up your account using any of three identity types: a username (with password), an email address (verified with a one-time code), or a phone number (verified with a one-time code). All three are equal — you can use any one to enable sync.',
      },
      {
        question: 'How do I set up cloud sync?',
        answer:
          'Go to Settings > View Profile and set up at least one identity (username, email, or phone). Once verified, sync is enabled automatically. You can then toggle it on or off from the "Data Sync" option in Settings.',
      },
      {
        question: 'What gets synced to the cloud?',
        answer:
          'Your profile information, threads (names, icons, pins), and notes (content, types, attachments metadata, stars, locks, tasks) are synced. Local file paths and notification IDs are not sent to the server — only attachment filenames are shared.',
      },
      {
        question: 'How do I turn sync off?',
        answer:
          'Go to Settings and toggle off "Data Sync." Your data remains on the server but will no longer be updated. You can turn it back on at any time to resume syncing. To remove your data from the server entirely, use "Delete Remote Data."',
      },
      {
        question: 'Can I restore my account on a new device?',
        answer:
          'Yes. If you set up your account with a username and password, enter the same credentials on the new device to log in and pull your data. For email or phone, verify the same email or phone number on the new device. Your synced data will be downloaded automatically.',
      },
    ],
  },
  {
    title: 'Managing Your Data',
    items: [
      {
        question: 'How do I export a thread?',
        answer:
          'You can export a thread as a text file in three ways: long-press a thread on the home screen and tap the export icon, use the three-dot menu inside a thread and select "Export Thread," or go to the thread info screen and tap "Export Thread." The formatted file opens in your device\'s share sheet.',
      },
      {
        question: 'What is a home screen shortcut?',
        answer:
          'A home screen shortcut lets you open a specific thread directly from your device\'s home screen without navigating through the app. It appears as a quick action linked to the LaterBox app icon.',
      },
      {
        question: 'How do I add a home screen shortcut?',
        answer:
          'Long-press a thread on the home screen and tap the shortcut icon in the action bar. You can also use the three-dot menu inside a thread or the thread info screen. The shortcut will be added to your device\'s home screen quick actions.',
      },
      {
        question: 'How do I delete my remote data?',
        answer:
          'Go to Settings and tap "Delete Remote Data" under Data Control. This permanently removes all your threads, tasks, and notes from the cloud server. Your local data on your device is not affected. This cannot be undone.',
      },
      {
        question: 'How do I delete my account information?',
        answer:
          'Go to Settings and tap "Delete Account Information" under Data Control. This removes your name, email, phone number, username, and password from the server and clears your local identity. Sync will be disabled until you set up a new identity.',
      },
      {
        question: 'How do I delete all media?',
        answer:
          'Go to Settings and tap "Delete All Media" under Data Control. This removes all locally stored photos, videos, documents, and audio files from your device. The notes themselves remain, but media attachments will show as unavailable.',
      },
      {
        question: 'How do I reset everything?',
        answer:
          'Go to Settings and tap "Delete Everything" under Data Control. This removes all remote data (if synced), clears all local data including notes, threads, and tasks, deletes all media files, and resets all settings. The app will return to a fresh state as if newly installed. This cannot be undone.',
      },
    ],
  },
  {
    title: 'Appearance',
    items: [
      {
        question: 'How do I change the app theme?',
        answer:
          'Go to Settings > Customize. You can choose between three options: Auto (follows your device\'s system setting), Dark, or Light. The change takes effect immediately.',
      },
    ],
  },
]

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      fontSize="$2"
      fontWeight="600"
      color="$colorSubtle"
      paddingHorizontal="$4"
      paddingTop="$4"
      paddingBottom="$2"
      textTransform="uppercase"
    >
      {title}
    </Text>
  )
}

function FAQItemRow({
  question,
  answer,
  isExpanded,
  onToggle,
  iconColor,
}: {
  question: string
  answer: string
  isExpanded: boolean
  onToggle: () => void
  iconColor: string
}) {
  return (
    <YStack>
      <XStack
        paddingHorizontal="$4"
        paddingVertical="$3"
        alignItems="center"
        gap="$3"
        pressStyle={{ backgroundColor: '$backgroundHover' }}
        onPress={onToggle}
      >
        <Text fontSize="$4" fontWeight="500" color="$color" flex={1}>
          {question}
        </Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={iconColor}
        />
      </XStack>
      {isExpanded && (
        <YStack paddingHorizontal="$4" paddingBottom="$3">
          <Text fontSize="$3" color="$colorSubtle" lineHeight={20}>
            {answer}
          </Text>
        </YStack>
      )}
    </YStack>
  )
}

export default function HelpScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { iconColorStrong, iconColor, accentColor, backgroundStrong, colorSubtle } = useThemeColor()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<TextInput>(null)

  const handleBack = useCallback(() => {
    if (isSearching) {
      setIsSearching(false)
      setSearchQuery('')
    } else {
      router.back()
    }
  }, [router, isSearching])

  const handleSearch = useCallback(() => {
    setIsSearching(true)
    setSearchQuery('')
  }, [])

  const handleSearchClose = useCallback(() => {
    setIsSearching(false)
    setSearchQuery('')
  }, [])

  useEffect(() => {
    if (isSearching && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isSearching])

  const toggleItem = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }, [])

  const handleEmailPress = useCallback(() => {
    Linking.openURL('mailto:help@xcoreapps.com')
  }, [])

  // Filter FAQs based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_SECTIONS

    const query = searchQuery.toLowerCase()
    return FAQ_SECTIONS
      .map(section => ({
        ...section,
        items: section.items.filter(
          item =>
            item.question.toLowerCase().includes(query) ||
            item.answer.toLowerCase().includes(query)
        ),
      }))
      .filter(section => section.items.length > 0)
  }, [searchQuery])

  return (
    <ScreenBackground>
      {isSearching ? (
        <XStack
          paddingTop={insets.top + 8}
          paddingHorizontal="$4"
          paddingBottom="$2"
          alignItems="center"
          gap="$2"
        >
          <Button
            size="$3"
            circular
            chromeless
            onPress={handleSearchClose}
            icon={<Ionicons name="arrow-back" size={24} color={iconColorStrong} />}
          />

          <XStack
            flex={1}
            backgroundColor={backgroundStrong + '80'}
            borderRadius="$3"
            paddingHorizontal="$3"
            alignItems="center"
            height={40}
          >
            <Ionicons name="search" size={18} color={iconColor} />
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search help..."
              placeholderTextColor={colorSubtle}
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 16,
                color: iconColorStrong,
              }}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Button
                size="$2"
                circular
                chromeless
                onPress={() => setSearchQuery('')}
                icon={<Ionicons name="close" size={16} color={iconColor} />}
              />
            )}
          </XStack>
        </XStack>
      ) : (
        <XStack
          paddingTop={insets.top + 8}
          paddingHorizontal="$4"
          paddingBottom="$2"
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
            Help
          </Text>
          <Button
            size="$3"
            circular
            chromeless
            onPress={handleSearch}
            icon={<Ionicons name="search" size={22} color={iconColorStrong} />}
          />
        </XStack>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {filteredSections.length === 0 ? (
          <YStack flex={1} justifyContent="center" alignItems="center" padding="$8" paddingBottom={insets.bottom + 100}>
            <Ionicons name="search-outline" size={64} color={iconColor} />
            <Text fontSize="$5" color="$colorSubtle" marginTop="$4" textAlign="center">
              No results found
            </Text>
            <Text fontSize="$3" color="$colorMuted" marginTop="$2" textAlign="center">
              Try a different search term
            </Text>
          </YStack>
        ) : (
          filteredSections.map((section, sectionIndex) => (
            <YStack key={section.title}>
              <SectionHeader title={section.title} />
              {section.items.map((item, itemIndex) => {
                const itemId = `${sectionIndex}-${itemIndex}`
                return (
                  <FAQItemRow
                    key={itemId}
                    question={item.question}
                    answer={item.answer}
                    isExpanded={expandedItems.has(itemId)}
                    onToggle={() => toggleItem(itemId)}
                    iconColor={iconColor}
                  />
                )
              })}
            </YStack>
          ))
        )}

        <YStack
          paddingHorizontal="$4"
          paddingTop="$6"
          paddingBottom="$4"
          gap="$2"
          alignItems="center"
        >
          <Text fontSize="$4" fontWeight="600" color="$color">
            Need more help?
          </Text>
          <Text fontSize="$3" color="$colorSubtle" textAlign="center">
            Write to us and we'll get back to you as soon as possible.
          </Text>
          <Text
            fontSize="$4"
            color="$accentColor"
            marginTop="$2"
            onPress={handleEmailPress}
          >
            help@xcoreapps.com
          </Text>
        </YStack>

        <YStack height={insets.bottom + 20} />
      </ScrollView>
    </ScreenBackground>
  )
}
