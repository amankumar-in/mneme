# Mneme: Talk to yourself, store important notes in a hurry.

I want to build a chat app that will act as an idea, quick note dump.

Clone of whatsapp in terms of design. Homepage has a contact list and a search. Filter chips All, and Tasks. Instead of green, we will use blue for accent.

Plus float button on home \- click on it to start a new chat.

Main app header

1. Scan QR \- open the app on web like whatsapp  
2. Settings icon \- opens a new page  
   1. Profile \- Can set phone number, email address, username, name, profile picture  
   2. Privacy  
      1. Public \- anyone can share chats with you using email, username, phone  
      2. Private \- No one can find you on app  
      3. Contacts only (default)  
      4. Notifications \- Task reminder (on by default), Messages from contacts (off by default)

Search will search all chats for all messages, or chat names. 

Long press on a chat to select, then action icons at top header.

1. Delete \- whole chat deleted if no locked messages, all expect locked if there is a locked message  
2. Export \- Export whole chat from very start as a txt file with timestamp for each message, for media only use media names.  
3. Pin \- pins at top. Can have multiple pins one after another  
4. Add shortcut \- Add a shortcut on home

Or open a contact and chat with yourself. 

1. Attachment \- Text, image, video, or any file as a document like whatsapp does, location.  
2. Camera \- open camera, take picture, and share  
3. Voice message  
4. Show timestamp, show dates in chat like whatsapp does. Not for every individual message but whenever there is a message for a new date then a date change will be there in chat. We will also have labels like Yesterday. (whole behaoviour is like whatsapp).  
5. Chat header  
   1. Chat name \- click to open chat info page like whatsapp, where we can set chat icon, name. View chat members \- View all media, docs, url, files. And view all tasks. Share, export etc.  
   2. Search icon \- clickin expands into header \- this chat  
   3. Tasks \- view tasks in this chat on a new page  
   4. 3 dot action menu  
      1. Media, Links, and Docs \- shows a new page with 3 tabs  
      2. Chat wallpaper  
      3. Add shortcut \- Add a shortcut to home screen  
      4. Export chat \- Export whole chat from very start as a txt file with timestamp for each message, for media only use media names.  
      5. Share \- open a new page to share with a person using their username, email address, or phone number.

Long press on a chat message to delete, edit, lock, or make a task (action icons at top header)

1. Lock \- it will never be deleted until unlocked. Even if the whole chat is deleted, the message will stay inside that app \- all other messages will get deleted.  
2. Make a task \- set a time and date. App will send a notification on that time and date with that messages and clicking on it will take users to the said message.

On whatsapp you chat with a person by default and then send messages. On our app you will chat with yourself by default but you share that chat with a person using their phone number

We will use React Native, Nodejs, Mongodb