import { Spinner } from '../common/Spinner'

export function ConnectingScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-[#0b141a]">
      <Spinner size="lg" />
      <div className="text-center">
        <h2 className="text-xl font-medium text-white">Connecting to your phone...</h2>
        <p className="mt-2 text-sm text-gray-400">
          Establishing a secure connection
        </p>
      </div>
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#00a884] [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#00a884] [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#00a884] [animation-delay:300ms]" />
      </div>
    </div>
  )
}
