import ExpoModulesCore
import GCDWebServer
import AVFoundation

// MARK: - Minimal WebSocket Server

/// A lightweight WebSocket server that runs alongside GCDWebServer.
/// Handles the WebSocket protocol (RFC 6455) over raw TCP sockets.
private class WebSocketServer {
  private var serverSocket: Int32 = -1
  private var clients: [String: WebSocketClient] = [:]
  private let clientsLock = NSLock()
  private var isRunning = false
  private var acceptThread: Thread?
  weak var delegate: WebSocketServerDelegate?

  func start(port: UInt16) throws {
    serverSocket = socket(AF_INET, SOCK_STREAM, 0)
    guard serverSocket >= 0 else {
      throw NSError(domain: "WebSocket", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create socket"])
    }

    var reuse: Int32 = 1
    setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))

    var addr = sockaddr_in()
    addr.sin_family = sa_family_t(AF_INET)
    addr.sin_port = port.bigEndian
    addr.sin_addr.s_addr = INADDR_ANY.bigEndian

    let bindResult = withUnsafePointer(to: &addr) { ptr in
      ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockPtr in
        bind(serverSocket, sockPtr, socklen_t(MemoryLayout<sockaddr_in>.size))
      }
    }
    guard bindResult == 0 else {
      close(serverSocket)
      throw NSError(domain: "WebSocket", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to bind to port \(port)"])
    }

    guard listen(serverSocket, 10) == 0 else {
      close(serverSocket)
      throw NSError(domain: "WebSocket", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to listen"])
    }

    isRunning = true
    acceptThread = Thread {
      self.acceptLoop()
    }
    acceptThread?.name = "WebSocketAcceptThread"
    acceptThread?.start()
  }

  func stop() {
    isRunning = false
    if serverSocket >= 0 {
      close(serverSocket)
      serverSocket = -1
    }
    clientsLock.lock()
    for (_, client) in clients {
      client.close()
    }
    clients.removeAll()
    clientsLock.unlock()
  }

  func send(clientId: String, message: String) {
    clientsLock.lock()
    let client = clients[clientId]
    clientsLock.unlock()
    client?.send(text: message)
  }

  func broadcast(message: String) {
    clientsLock.lock()
    let allClients = Array(clients.values)
    clientsLock.unlock()
    for client in allClients {
      client.send(text: message)
    }
  }

  private func acceptLoop() {
    while isRunning {
      var clientAddr = sockaddr_in()
      var addrLen = socklen_t(MemoryLayout<sockaddr_in>.size)
      let clientFd = withUnsafeMutablePointer(to: &clientAddr) { ptr in
        ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockPtr in
          accept(serverSocket, sockPtr, &addrLen)
        }
      }

      guard clientFd >= 0, isRunning else { continue }

      let clientId = UUID().uuidString
      let client = WebSocketClient(fd: clientFd, clientId: clientId) { [weak self] event in
        self?.handleClientEvent(clientId: clientId, event: event)
      }

      // Perform WebSocket handshake
      if client.performHandshake() {
        clientsLock.lock()
        clients[clientId] = client
        clientsLock.unlock()

        delegate?.webSocketDidConnect(clientId: clientId)
        client.startReading()
      } else {
        close(clientFd)
      }
    }
  }

  private func handleClientEvent(clientId: String, event: WebSocketClientEvent) {
    switch event {
    case .message(let text):
      delegate?.webSocketDidReceiveMessage(clientId: clientId, message: text)
    case .disconnected:
      clientsLock.lock()
      clients.removeValue(forKey: clientId)
      clientsLock.unlock()
      delegate?.webSocketDidDisconnect(clientId: clientId)
    }
  }
}

private enum WebSocketClientEvent {
  case message(String)
  case disconnected
}

private class WebSocketClient {
  private let fd: Int32
  let clientId: String
  private let eventHandler: (WebSocketClientEvent) -> Void
  private var readThread: Thread?
  private var isClosed = false

  init(fd: Int32, clientId: String, eventHandler: @escaping (WebSocketClientEvent) -> Void) {
    self.fd = fd
    self.clientId = clientId
    self.eventHandler = eventHandler
  }

  func performHandshake() -> Bool {
    var buffer = [UInt8](repeating: 0, count: 4096)
    let bytesRead = recv(fd, &buffer, buffer.count, 0)
    guard bytesRead > 0 else { return false }

    let request = String(bytes: buffer[0..<bytesRead], encoding: .utf8) ?? ""

    // Parse the Sec-WebSocket-Key header
    guard let keyLine = request.split(separator: "\r\n").first(where: { $0.lowercased().hasPrefix("sec-websocket-key:") }) else {
      return false
    }

    let key = keyLine.split(separator: ":", maxSplits: 1)[1].trimmingCharacters(in: .whitespaces)
    let acceptValue = computeAcceptKey(key: key)

    let response = "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Accept: \(acceptValue)\r\n\r\n"

    let responseData = Array(response.utf8)
    _ = Darwin.send(fd, responseData, responseData.count, 0)
    return true
  }

  func startReading() {
    readThread = Thread {
      self.readLoop()
    }
    readThread?.name = "WebSocket-\(clientId)"
    readThread?.start()
  }

  func send(text: String) {
    guard !isClosed else { return }
    let data = Array(text.utf8)
    var frame = [UInt8]()

    // Text frame, FIN bit set
    frame.append(0x81)

    if data.count < 126 {
      frame.append(UInt8(data.count))
    } else if data.count <= 65535 {
      frame.append(126)
      frame.append(UInt8((data.count >> 8) & 0xFF))
      frame.append(UInt8(data.count & 0xFF))
    } else {
      frame.append(127)
      for i in (0..<8).reversed() {
        frame.append(UInt8((data.count >> (i * 8)) & 0xFF))
      }
    }

    frame.append(contentsOf: data)
    _ = Darwin.send(fd, frame, frame.count, 0)
  }

  func close() {
    guard !isClosed else { return }
    isClosed = true
    // Send close frame
    let closeFrame: [UInt8] = [0x88, 0x00]
    _ = Darwin.send(fd, closeFrame, closeFrame.count, 0)
    Darwin.close(fd)
  }

  private func readLoop() {
    var buffer = [UInt8](repeating: 0, count: 65536)

    while !isClosed {
      let bytesRead = recv(fd, &buffer, buffer.count, 0)
      guard bytesRead > 0 else {
        isClosed = true
        eventHandler(.disconnected)
        return
      }

      var offset = 0
      while offset < bytesRead {
        guard offset + 2 <= bytesRead else { break }

        let firstByte = buffer[offset]
        let secondByte = buffer[offset + 1]
        let opcode = firstByte & 0x0F
        let isMasked = (secondByte & 0x80) != 0
        var payloadLength = UInt64(secondByte & 0x7F)
        offset += 2

        if payloadLength == 126 {
          guard offset + 2 <= bytesRead else { break }
          payloadLength = UInt64(buffer[offset]) << 8 | UInt64(buffer[offset + 1])
          offset += 2
        } else if payloadLength == 127 {
          guard offset + 8 <= bytesRead else { break }
          payloadLength = 0
          for i in 0..<8 {
            payloadLength = payloadLength << 8 | UInt64(buffer[offset + i])
          }
          offset += 8
        }

        var maskKey = [UInt8](repeating: 0, count: 4)
        if isMasked {
          guard offset + 4 <= bytesRead else { break }
          maskKey = Array(buffer[offset..<offset + 4])
          offset += 4
        }

        let payloadEnd = offset + Int(payloadLength)
        guard payloadEnd <= bytesRead else { break }

        var payload = Array(buffer[offset..<payloadEnd])
        if isMasked {
          for i in 0..<payload.count {
            payload[i] ^= maskKey[i % 4]
          }
        }
        offset = payloadEnd

        switch opcode {
        case 0x01: // Text frame
          if let text = String(bytes: payload, encoding: .utf8) {
            eventHandler(.message(text))
          }
        case 0x08: // Close frame
          isClosed = true
          let closeFrame: [UInt8] = [0x88, 0x00]
          _ = Darwin.send(fd, closeFrame, closeFrame.count, 0)
          Darwin.close(fd)
          eventHandler(.disconnected)
          return
        case 0x09: // Ping
          var pongFrame = [UInt8]()
          pongFrame.append(0x8A)
          if payload.count < 126 {
            pongFrame.append(UInt8(payload.count))
          }
          pongFrame.append(contentsOf: payload)
          _ = Darwin.send(fd, pongFrame, pongFrame.count, 0)
        default:
          break
        }
      }
    }
  }

  private func computeAcceptKey(key: String) -> String {
    let magic = key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
    let data = Array(magic.utf8)
    var digest = [UInt8](repeating: 0, count: 20)
    // CC_SHA1
    _ = data.withUnsafeBufferPointer { ptr in
      CC_SHA1(ptr.baseAddress, CC_LONG(data.count), &digest)
    }
    return Data(digest).base64EncodedString()
  }
}

private protocol WebSocketServerDelegate: AnyObject {
  func webSocketDidConnect(clientId: String)
  func webSocketDidReceiveMessage(clientId: String, message: String)
  func webSocketDidDisconnect(clientId: String)
}

// MARK: - Import CommonCrypto for SHA1 (needed for WebSocket handshake)
import CommonCrypto

// MARK: - Expo Module

public class ExpoLocalServerModule: Module, WebSocketServerDelegate {
  private var webServer: GCDWebServer?
  private var wsServer: WebSocketServer?
  private var pendingRequests: [String: GCDWebServerCompletionBlock] = [:]
  private let pendingLock = NSLock()
  private let requestTimeout: TimeInterval = 30.0
  private var silentAudioPlayer: AVAudioPlayer?

  public func definition() -> ModuleDefinition {
    Name("ExpoLocalServer")

    Events("onRequest", "onWebSocketConnect", "onWebSocketMessage", "onWebSocketDisconnect")

    AsyncFunction("startServer") { (port: Int, promise: Promise) in
      self.doStartServer(port: UInt16(port), promise: promise)
    }

    AsyncFunction("stopServer") { (promise: Promise) in
      self.doStopServer()
      promise.resolve(nil)
    }

    Function("sendResponse") { (requestId: String, statusCode: Int, headers: [String: String], body: String) in
      self.doSendResponse(requestId: requestId, statusCode: statusCode, headers: headers, body: body)
    }

    Function("sendFileResponse") { (requestId: String, statusCode: Int, headers: [String: String], filePath: String) in
      self.doSendFileResponse(requestId: requestId, statusCode: statusCode, headers: headers, filePath: filePath)
    }

    Function("sendWebSocketMessage") { (clientId: String, message: String) in
      self.wsServer?.send(clientId: clientId, message: message)
    }

    Function("broadcastWebSocket") { (message: String) in
      self.wsServer?.broadcast(message: message)
    }

    AsyncFunction("getLocalIpAddress") { (promise: Promise) in
      promise.resolve(self.getWiFiAddress() ?? "0.0.0.0")
    }

    Function("startBackgroundKeepAlive") {
      self.doStartBackgroundKeepAlive()
    }

    Function("stopBackgroundKeepAlive") {
      self.doStopBackgroundKeepAlive()
    }
  }

  // MARK: - Server Lifecycle

  private func doStartServer(port: UInt16, promise: Promise) {
    // Stop existing servers first
    doStopServer()

    let server = GCDWebServer()
    self.webServer = server

    // Handle all methods and paths asynchronously
    server.addDefaultHandler(forMethod: "GET", request: GCDWebServerRequest.self) { [weak self] request, completionBlock in
      self?.handleRequest(request: request, completionBlock: completionBlock)
    }
    server.addDefaultHandler(forMethod: "POST", request: GCDWebServerDataRequest.self) { [weak self] request, completionBlock in
      self?.handleRequest(request: request, completionBlock: completionBlock)
    }
    server.addDefaultHandler(forMethod: "PUT", request: GCDWebServerDataRequest.self) { [weak self] request, completionBlock in
      self?.handleRequest(request: request, completionBlock: completionBlock)
    }
    server.addDefaultHandler(forMethod: "DELETE", request: GCDWebServerRequest.self) { [weak self] request, completionBlock in
      self?.handleRequest(request: request, completionBlock: completionBlock)
    }
    server.addDefaultHandler(forMethod: "PATCH", request: GCDWebServerDataRequest.self) { [weak self] request, completionBlock in
      self?.handleRequest(request: request, completionBlock: completionBlock)
    }
    server.addDefaultHandler(forMethod: "OPTIONS", request: GCDWebServerRequest.self) { [weak self] request, completionBlock in
      self?.handleRequest(request: request, completionBlock: completionBlock)
    }

    do {
      try server.start(options: [
        GCDWebServerOption_Port: port,
        GCDWebServerOption_BindToLocalhost: false,
        GCDWebServerOption_AutomaticallySuspendInBackground: false,
      ])
    } catch {
      promise.reject("START_ERROR", "Failed to start HTTP server: \(error.localizedDescription)")
      return
    }

    // Start WebSocket server on port+1
    let wsPort = port + 1
    let ws = WebSocketServer()
    ws.delegate = self
    self.wsServer = ws

    do {
      try ws.start(port: wsPort)
    } catch {
      // WebSocket failing to start is non-fatal; HTTP still works
      print("[ExpoLocalServer] WebSocket server failed to start on port \(wsPort): \(error.localizedDescription)")
    }

    let ipAddress = getWiFiAddress() ?? "0.0.0.0"
    promise.resolve(["url": "http://\(ipAddress):\(port)"])
  }

  private func doStopServer() {
    webServer?.stop()
    webServer = nil
    wsServer?.stop()
    wsServer = nil

    // Resolve any pending requests with 503
    pendingLock.lock()
    let pending = pendingRequests
    pendingRequests.removeAll()
    pendingLock.unlock()

    for (_, completionBlock) in pending {
      let response = GCDWebServerDataResponse(text: "Server shutting down")!
      response.statusCode = 503
      completionBlock(response)
    }
  }

  // MARK: - HTTP Request Handling

  private func handleRequest(request: GCDWebServerRequest, completionBlock: @escaping GCDWebServerCompletionBlock) {
    let requestId = UUID().uuidString

    // Store the pending completion block
    pendingLock.lock()
    pendingRequests[requestId] = completionBlock
    pendingLock.unlock()

    // Extract headers
    var headers: [String: String] = [:]
    for (key, value) in request.headers {
      if let k = key as? String, let v = value as? String {
        headers[k] = v
      }
    }

    // Extract query parameters
    var query: [String: String] = [:]
    if let queryDict = request.query {
      for (key, value) in queryDict {
        if let k = key as? String {
          query[k] = "\(value)"
        }
      }
    }

    // Extract body
    var body = ""
    if let dataRequest = request as? GCDWebServerDataRequest, let data = dataRequest.data {
      body = String(data: data, encoding: .utf8) ?? ""
    }

    // Emit event to JS
    sendEvent("onRequest", [
      "id": requestId,
      "method": request.method,
      "path": request.path,
      "headers": headers,
      "query": query,
      "body": body,
    ])

    // Set up timeout
    DispatchQueue.global().asyncAfter(deadline: .now() + requestTimeout) { [weak self] in
      guard let self = self else { return }
      self.pendingLock.lock()
      let pending = self.pendingRequests.removeValue(forKey: requestId)
      self.pendingLock.unlock()

      if let completionBlock = pending {
        let response = GCDWebServerDataResponse(text: "Request timeout")!
        response.statusCode = 504
        completionBlock(response)
      }
    }
  }

  private func doSendResponse(requestId: String, statusCode: Int, headers: [String: String], body: String) {
    pendingLock.lock()
    let completionBlock = pendingRequests.removeValue(forKey: requestId)
    pendingLock.unlock()

    guard let completionBlock = completionBlock else { return }

    let contentType = headers["Content-Type"] ?? headers["content-type"] ?? "text/plain"
    let data = body.data(using: .utf8) ?? Data()
    let response = GCDWebServerDataResponse(data: data, contentType: contentType)!
    response.statusCode = statusCode

    for (key, value) in headers {
      let lowerKey = key.lowercased()
      if lowerKey != "content-type" && lowerKey != "content-length" {
        response.setValue(value, forAdditionalHeader: key)
      }
    }

    completionBlock(response)
  }

  private func doSendFileResponse(requestId: String, statusCode: Int, headers: [String: String], filePath: String) {
    pendingLock.lock()
    let completionBlock = pendingRequests.removeValue(forKey: requestId)
    pendingLock.unlock()

    guard let completionBlock = completionBlock else { return }

    let url = URL(fileURLWithPath: filePath)
    guard FileManager.default.fileExists(atPath: filePath) else {
      let response = GCDWebServerDataResponse(text: "File not found")!
      response.statusCode = 404
      completionBlock(response)
      return
    }

    let contentType = headers["Content-Type"] ?? headers["content-type"] ?? mimeType(for: url.pathExtension)

    if let response = GCDWebServerFileResponse(file: filePath) {
      response.statusCode = statusCode
      response.contentType = contentType

      for (key, value) in headers {
        let lowerKey = key.lowercased()
        if lowerKey != "content-type" && lowerKey != "content-length" {
          response.setValue(value, forAdditionalHeader: key)
        }
      }

      completionBlock(response)
    } else {
      let response = GCDWebServerDataResponse(text: "Failed to read file")!
      response.statusCode = 500
      completionBlock(response)
    }
  }

  // MARK: - WebSocket Delegate

  func webSocketDidConnect(clientId: String) {
    sendEvent("onWebSocketConnect", ["clientId": clientId])
  }

  func webSocketDidReceiveMessage(clientId: String, message: String) {
    sendEvent("onWebSocketMessage", ["clientId": clientId, "message": message])
  }

  func webSocketDidDisconnect(clientId: String) {
    sendEvent("onWebSocketDisconnect", ["clientId": clientId])
  }

  // MARK: - Background Keep-Alive

  private func doStartBackgroundKeepAlive() {
    let audioSession = AVAudioSession.sharedInstance()
    do {
      try audioSession.setCategory(.playback, mode: .default, options: [.mixWithOthers])
      try audioSession.setActive(true)
    } catch {
      print("[ExpoLocalServer] Failed to configure audio session: \(error.localizedDescription)")
      return
    }

    // Generate a 1-second silent WAV in memory
    let silentData = generateSilentWAV(durationSeconds: 1, sampleRate: 44100)

    do {
      let player = try AVAudioPlayer(data: silentData)
      player.numberOfLoops = -1 // infinite loop
      player.play()
      silentAudioPlayer = player
    } catch {
      print("[ExpoLocalServer] Failed to start silent audio: \(error.localizedDescription)")
    }
  }

  private func doStopBackgroundKeepAlive() {
    silentAudioPlayer?.stop()
    silentAudioPlayer = nil

    do {
      try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    } catch {
      print("[ExpoLocalServer] Failed to deactivate audio session: \(error.localizedDescription)")
    }
  }

  private func generateSilentWAV(durationSeconds: Int, sampleRate: Int) -> Data {
    let numChannels: Int = 1
    let bitsPerSample: Int = 16
    let numSamples = sampleRate * durationSeconds * numChannels
    let dataSize = numSamples * (bitsPerSample / 8)
    let fileSize = 44 + dataSize

    var data = Data()

    // RIFF header
    data.append(contentsOf: [0x52, 0x49, 0x46, 0x46]) // "RIFF"
    data.append(contentsOf: withUnsafeBytes(of: UInt32(fileSize - 8).littleEndian) { Array($0) })
    data.append(contentsOf: [0x57, 0x41, 0x56, 0x45]) // "WAVE"

    // fmt subchunk
    data.append(contentsOf: [0x66, 0x6D, 0x74, 0x20]) // "fmt "
    data.append(contentsOf: withUnsafeBytes(of: UInt32(16).littleEndian) { Array($0) }) // subchunk size
    data.append(contentsOf: withUnsafeBytes(of: UInt16(1).littleEndian) { Array($0) }) // PCM format
    data.append(contentsOf: withUnsafeBytes(of: UInt16(numChannels).littleEndian) { Array($0) })
    data.append(contentsOf: withUnsafeBytes(of: UInt32(sampleRate).littleEndian) { Array($0) })
    let byteRate = sampleRate * numChannels * (bitsPerSample / 8)
    data.append(contentsOf: withUnsafeBytes(of: UInt32(byteRate).littleEndian) { Array($0) })
    let blockAlign = numChannels * (bitsPerSample / 8)
    data.append(contentsOf: withUnsafeBytes(of: UInt16(blockAlign).littleEndian) { Array($0) })
    data.append(contentsOf: withUnsafeBytes(of: UInt16(bitsPerSample).littleEndian) { Array($0) })

    // data subchunk
    data.append(contentsOf: [0x64, 0x61, 0x74, 0x61]) // "data"
    data.append(contentsOf: withUnsafeBytes(of: UInt32(dataSize).littleEndian) { Array($0) })
    data.append(Data(count: dataSize)) // silence (all zeros)

    return data
  }

  // MARK: - Network Utilities

  private func getWiFiAddress() -> String? {
    var address: String?
    var ifaddr: UnsafeMutablePointer<ifaddrs>?

    guard getifaddrs(&ifaddr) == 0, let firstAddr = ifaddr else { return nil }
    defer { freeifaddrs(ifaddr) }

    for ptr in sequence(first: firstAddr, next: { $0.pointee.ifa_next }) {
      let interface = ptr.pointee
      let addrFamily = interface.ifa_addr.pointee.sa_family

      if addrFamily == UInt8(AF_INET) {
        let name = String(cString: interface.ifa_name)
        if name == "en0" {
          var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
          getnameinfo(
            interface.ifa_addr,
            socklen_t(interface.ifa_addr.pointee.sa_len),
            &hostname,
            socklen_t(hostname.count),
            nil,
            0,
            NI_NUMERICHOST
          )
          address = String(cString: hostname)
        }
      }
    }
    return address
  }

  // MARK: - MIME Type Helper

  private func mimeType(for ext: String) -> String {
    switch ext.lowercased() {
    case "html", "htm": return "text/html"
    case "css": return "text/css"
    case "js", "mjs": return "application/javascript"
    case "json": return "application/json"
    case "png": return "image/png"
    case "jpg", "jpeg": return "image/jpeg"
    case "gif": return "image/gif"
    case "webp": return "image/webp"
    case "svg": return "image/svg+xml"
    case "ico": return "image/x-icon"
    case "mp4": return "video/mp4"
    case "mp3": return "audio/mpeg"
    case "wav": return "audio/wav"
    case "pdf": return "application/pdf"
    case "woff": return "font/woff"
    case "woff2": return "font/woff2"
    case "ttf": return "font/ttf"
    case "txt": return "text/plain"
    case "xml": return "application/xml"
    case "zip": return "application/zip"
    default: return "application/octet-stream"
    }
  }
}
