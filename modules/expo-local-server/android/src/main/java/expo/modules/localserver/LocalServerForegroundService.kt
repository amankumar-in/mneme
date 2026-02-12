package expo.modules.localserver

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder

class LocalServerForegroundService : Service() {

  companion object {
    private const val CHANNEL_ID = "laterbox-web-server"
    private const val NOTIFICATION_ID = 9001
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    createNotificationChannel()

    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle("Web Client Connected")
      .setContentText("LaterBox is serving your notes to the browser")
      .setSmallIcon(resources.getIdentifier("notification_icon", "drawable", packageName).takeIf { it != 0 } ?: android.R.drawable.stat_sys_upload_done)
      .setOngoing(true)
      .setContentIntent(pendingIntent)
      .build()

    startForeground(NOTIFICATION_ID, notification)

    return START_STICKY
  }

  override fun onDestroy() {
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  private fun createNotificationChannel() {
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Web Server",
      NotificationManager.IMPORTANCE_DEFAULT
    ).apply {
      description = "Shows when LaterBox is serving notes to a browser"
    }
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(channel)
  }
}
