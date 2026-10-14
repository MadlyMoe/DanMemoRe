package dev.danmemore.launcher

import android.app.*
import android.content.Intent
import android.os.Build
import android.os.IBinder
import java.io.File
import java.io.RandomAccessFile
import java.nio.channels.FileLock
import java.time.Instant
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

class NodeListenerService : Service() {
    private val running = AtomicBoolean(false)
    private var lockFile: RandomAccessFile? = null
    private var lock: FileLock? = null
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); android.os.Process.killProcess(android.os.Process.myPid()); return START_NOT_STICKY
        }
        if (!running.compareAndSet(false, true)) return START_STICKY
        val profile = intent?.getStringExtra(EXTRA_PROFILE).orEmpty().ifBlank { "default" }
        startForeground(NOTIFICATION_ID, notification("Preparing local server"))
        thread(name = "danmemore-node", isDaemon = true) { startNode(profile) }
        return START_NOT_STICKY
    }

    private fun startNode(profile: String) {
        try {
            require(profile.matches(Regex("[a-z0-9-]{1,40}"))) { "Invalid profile" }
            val root = File(filesDir, "danmemore").apply { mkdirs() }
            lockFile = RandomAccessFile(File(root, "listener.lock"), "rw"); lock = lockFile!!.channel.tryLock()
            check(lock != null) { "Another listener owns this save" }
            check(NodeMobileBridge.isLoaded()) { NodeMobileBridge.loadErrorMessage() }
            val runtime = File(filesDir, "runtime")
            val stamp = File(runtime, ".installed-apk")
            val apk = File(applicationInfo.sourceDir)
            val installed = "${apk.absolutePath}:${apk.length()}:${apk.lastModified()}"
            if (!stamp.isFile || stamp.readText().trim() != installed) {
                stamp.delete(); copyAssets("runtime", runtime); stamp.writeText(installed)
            }
            File(root, "listener-status.json").delete()
            thread(name = "danmemore-ready", isDaemon = true) {
                repeat(120) {
                    if (File(root, "listener-status.json").isFile) {
                        publish("DanMemoRe server ready on 127.0.0.1:28766")
                        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification("Local server ready")); return@thread
                    }
                    Thread.sleep(250)
                }
                publish("Listener readiness timed out")
            }
            val code = NodeMobileBridge.startNodeWithArguments(arrayOf("node", File(runtime, "main.cjs").absolutePath, root.absolutePath, profile))
            publish("Listener exited with code $code")
        } catch (error: Throwable) { publish("Listener failed: ${error.message ?: error.javaClass.simpleName}") }
        finally {
            runCatching { lock?.release() }; runCatching { lockFile?.close() }; running.set(false)
            stopForeground(STOP_FOREGROUND_REMOVE); stopSelf()
        }
    }

    private fun copyAssets(assetPath: String, destination: File) {
        val children = assets.list(assetPath).orEmpty()
        if (children.isEmpty()) { destination.parentFile?.mkdirs(); assets.open(assetPath).use { input -> destination.outputStream().use(input::copyTo) } }
        else { destination.mkdirs(); children.forEach { copyAssets("$assetPath/$it", File(destination, it)) } }
    }

    private fun notification(text: String): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "DanMemoRe listener", NotificationManager.IMPORTANCE_LOW))
        val pending = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, CHANNEL_ID).setContentTitle("DanMemoRe").setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_download_done).setContentIntent(pending).setOngoing(true).build()
    }

    private fun publish(message: String) {
        File(filesDir, "danmemore-listener.log").appendText("${Instant.now()} $message\n")
        sendBroadcast(Intent(ACTION_STATUS).setPackage(packageName).putExtra(EXTRA_MESSAGE, message), INTERNAL_PERMISSION)
    }

    companion object {
        const val ACTION_START = "dev.danmemore.launcher.listener.START"
        const val ACTION_STOP = "dev.danmemore.launcher.listener.STOP"
        const val ACTION_STATUS = "dev.danmemore.launcher.listener.STATUS"
        const val EXTRA_PROFILE = "profile"
        const val EXTRA_MESSAGE = "message"
        const val INTERNAL_PERMISSION = "dev.danmemore.launcher.INTERNAL_STATUS"
        private const val CHANNEL_ID = "danmemore_listener"
        private const val NOTIFICATION_ID = 6601
    }
}
