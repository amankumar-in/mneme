package expo.modules.localserver

import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import fi.iki.elonen.NanoHTTPD
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer as JWebSocketServer
import java.io.File
import java.io.FileInputStream
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class ExpoLocalServerModule : Module() {

  private var httpServer: LocalHttpServer? = null
  private var wsServer: LocalWebSocketServer? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoLocalServer")

    Events("onRequest", "onWebSocketConnect", "onWebSocketMessage", "onWebSocketDisconnect")

    AsyncFunction("startServer") { port: Int, promise: Promise ->
      try {
        stopServers()

        val http = LocalHttpServer(port)
        httpServer = http
        http.start()

        val ws = LocalWebSocketServer(port + 1)
        ws.isReuseAddr = true
        wsServer = ws
        ws.start()

        val ip = getLocalIp()
        promise.resolve(mapOf("url" to "http://$ip:$port"))
      } catch (e: Exception) {
        promise.reject("START_ERROR", "Failed to start server: ${e.message}", e)
      }
    }

    AsyncFunction("stopServer") { promise: Promise ->
      stopServers()
      promise.resolve(null)
    }

    Function("sendResponse") { requestId: String, statusCode: Int, headers: Map<String, String>, body: String ->
      httpServer?.sendResponse(requestId, statusCode, headers, body)
    }

    Function("sendFileResponse") { requestId: String, statusCode: Int, headers: Map<String, String>, filePath: String ->
      httpServer?.sendFileResponse(requestId, statusCode, headers, filePath)
    }

    Function("sendWebSocketMessage") { clientId: String, message: String ->
      wsServer?.sendToClient(clientId, message)
    }

    Function("broadcastWebSocket") { message: String ->
      wsServer?.broadcastMessage(message)
    }

    AsyncFunction("getLocalIpAddress") { promise: Promise ->
      promise.resolve(getLocalIp())
    }

    Function("startForegroundService") {
      val context = appContext.reactContext ?: return@Function null
      val intent = Intent(context, LocalServerForegroundService::class.java)
      ContextCompat.startForegroundService(context, intent)
    }

    Function("stopForegroundService") {
      val context = appContext.reactContext ?: return@Function null
      val intent = Intent(context, LocalServerForegroundService::class.java)
      context.stopService(intent)
    }
  }

  private fun stopServers() {
    httpServer?.stop()
    httpServer = null
    wsServer?.stop()
    wsServer = null
  }

  private fun getLocalIp(): String {
    try {
      val interfaces = NetworkInterface.getNetworkInterfaces()
      while (interfaces.hasMoreElements()) {
        val networkInterface = interfaces.nextElement()
        if (networkInterface.isLoopback || !networkInterface.isUp) continue
        // Prefer wlan interfaces
        val name = networkInterface.name.lowercase()
        if (!name.startsWith("wlan") && !name.startsWith("en") && !name.startsWith("eth")) continue

        val addresses = networkInterface.inetAddresses
        while (addresses.hasMoreElements()) {
          val addr = addresses.nextElement()
          if (!addr.isLoopbackAddress && addr is java.net.Inet4Address) {
            return addr.hostAddress ?: "0.0.0.0"
          }
        }
      }
    } catch (_: Exception) {}
    return "0.0.0.0"
  }

  // MARK: - HTTP Server (NanoHTTPD)

  private class PendingRequest(
    val latch: CountDownLatch = CountDownLatch(1),
    @Volatile var response: NanoHTTPD.Response? = null
  )

  private inner class LocalHttpServer(port: Int) : NanoHTTPD(port) {

    private val pendingRequests = ConcurrentHashMap<String, PendingRequest>()
    private val REQUEST_TIMEOUT_SECONDS = 30L

    override fun serve(session: IHTTPSession): Response {
      val requestId = UUID.randomUUID().toString()
      val pending = PendingRequest()
      pendingRequests[requestId] = pending

      // Extract headers
      val headers = mutableMapOf<String, String>()
      session.headers?.forEach { (key, value) ->
        headers[key] = value
      }

      // Extract query params
      val query = mutableMapOf<String, String>()
      session.parms?.forEach { (key, value) ->
        if (value != null) query[key] = value
      }

      // Extract body
      var body = ""
      try {
        val method = session.method
        if (method == Method.POST || method == Method.PUT || method == Method.PATCH) {
          val files = mutableMapOf<String, String>()
          session.parseBody(files)
          body = files["postData"] ?: ""
        }
      } catch (_: Exception) {}

      // Emit event to JS
      this@ExpoLocalServerModule.sendEvent("onRequest", mapOf(
        "id" to requestId,
        "method" to session.method.name,
        "path" to (session.uri ?: "/"),
        "headers" to headers,
        "query" to query,
        "body" to body
      ))

      // Wait for JS to provide the response
      val responded = pending.latch.await(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)

      pendingRequests.remove(requestId)

      if (!responded || pending.response == null) {
        return newFixedLengthResponse(Response.Status.REQUEST_TIMEOUT, "text/plain", "Request timeout")
      }

      return pending.response!!
    }

    fun sendResponse(requestId: String, statusCode: Int, headers: Map<String, String>, body: String) {
      val pending = pendingRequests[requestId] ?: return

      val status = Response.Status.lookup(statusCode)
        ?: Response.Status.INTERNAL_ERROR
      val contentType = headers["Content-Type"] ?: headers["content-type"] ?: "text/plain"
      val response = newFixedLengthResponse(status, contentType, body)

      headers.forEach { (key, value) ->
        val lower = key.lowercase()
        if (lower != "content-type" && lower != "content-length") {
          response.addHeader(key, value)
        }
      }

      pending.response = response
      pending.latch.countDown()
    }

    fun sendFileResponse(requestId: String, statusCode: Int, headers: Map<String, String>, filePath: String) {
      val pending = pendingRequests[requestId] ?: return

      val file = File(filePath)
      if (!file.exists()) {
        val response = newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "File not found")
        pending.response = response
        pending.latch.countDown()
        return
      }

      val contentType = headers["Content-Type"] ?: headers["content-type"] ?: mimeTypeFor(file.extension)
      val fis = FileInputStream(file)
      val status = Response.Status.lookup(statusCode)
        ?: Response.Status.OK

      val response = newFixedLengthResponse(status, contentType, fis, file.length())

      headers.forEach { (key, value) ->
        val lower = key.lowercase()
        if (lower != "content-type" && lower != "content-length") {
          response.addHeader(key, value)
        }
      }

      pending.response = response
      pending.latch.countDown()
    }

    override fun stop() {
      // Unblock all pending requests before stopping
      pendingRequests.forEach { (_, pending) ->
        if (pending.response == null) {
          pending.response = newFixedLengthResponse(
            Response.Status.SERVICE_UNAVAILABLE, "text/plain", "Server shutting down"
          )
        }
        pending.latch.countDown()
      }
      pendingRequests.clear()
      super.stop()
    }

    private fun mimeTypeFor(ext: String): String = when (ext.lowercase()) {
      "html", "htm" -> "text/html"
      "css" -> "text/css"
      "js", "mjs" -> "application/javascript"
      "json" -> "application/json"
      "png" -> "image/png"
      "jpg", "jpeg" -> "image/jpeg"
      "gif" -> "image/gif"
      "webp" -> "image/webp"
      "svg" -> "image/svg+xml"
      "ico" -> "image/x-icon"
      "mp4" -> "video/mp4"
      "mp3" -> "audio/mpeg"
      "wav" -> "audio/wav"
      "pdf" -> "application/pdf"
      "woff" -> "font/woff"
      "woff2" -> "font/woff2"
      "ttf" -> "font/ttf"
      "txt" -> "text/plain"
      "xml" -> "application/xml"
      "zip" -> "application/zip"
      else -> "application/octet-stream"
    }
  }

  // MARK: - WebSocket Server (Java-WebSocket)

  private inner class LocalWebSocketServer(port: Int) :
    JWebSocketServer(InetSocketAddress(port)) {

    private val clientMap = ConcurrentHashMap<String, WebSocket>()
    private val socketToId = ConcurrentHashMap<WebSocket, String>()

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake?) {
      val clientId = UUID.randomUUID().toString()
      clientMap[clientId] = conn
      socketToId[conn] = clientId
      this@ExpoLocalServerModule.sendEvent("onWebSocketConnect", mapOf("clientId" to clientId))
    }

    override fun onClose(conn: WebSocket, code: Int, reason: String?, remote: Boolean) {
      val clientId = socketToId.remove(conn) ?: return
      clientMap.remove(clientId)
      this@ExpoLocalServerModule.sendEvent("onWebSocketDisconnect", mapOf("clientId" to clientId))
    }

    override fun onMessage(conn: WebSocket, message: String?) {
      val clientId = socketToId[conn] ?: return
      this@ExpoLocalServerModule.sendEvent("onWebSocketMessage", mapOf(
        "clientId" to clientId,
        "message" to (message ?: "")
      ))
    }

    override fun onError(conn: WebSocket?, ex: Exception?) {
      if (conn != null) {
        val clientId = socketToId.remove(conn)
        if (clientId != null) {
          clientMap.remove(clientId)
          this@ExpoLocalServerModule.sendEvent("onWebSocketDisconnect", mapOf("clientId" to clientId))
        }
      }
    }

    override fun onStart() {
      // Server started successfully
    }

    fun sendToClient(clientId: String, message: String) {
      clientMap[clientId]?.send(message)
    }

    fun broadcastMessage(message: String) {
      broadcast(message)
    }

    override fun stop() {
      try {
        super.stop(1000)
      } catch (_: Exception) {}
      clientMap.clear()
      socketToId.clear()
    }
  }
}
