package dev.danmemore.launcher

import android.app.*
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.StatFs
import org.json.JSONObject
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.security.MessageDigest
import java.time.Instant
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import kotlin.concurrent.thread

class ContentImportService : Service() {
    private val importing = AtomicBoolean(false)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action != ACTION_IMPORT || !importing.compareAndSet(false, true)) return START_NOT_STICKY
        val uri = intent.data
        if (uri == null) {
            publish("Content import failed: no ZIP was selected")
            stopSelf()
            return START_NOT_STICKY
        }
        startForeground(NOTIFICATION_ID, notification("Preparing preserved assets"))
        thread(name = "danmemore-content-import", isDaemon = true) {
            try {
                ContentImporter(this).importZip(uri) { status ->
                    publish(status)
                    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification(status))
                }
                publish("Content import complete; the preserved assets are ready")
            } catch (error: Throwable) {
                publish("Content import failed: ${error.message ?: error.javaClass.simpleName}")
            } finally {
                importing.set(false)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun notification(text: String): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "DanMemoRe content import", NotificationManager.IMPORTANCE_LOW))
        val pending = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, CHANNEL_ID).setContentTitle("DanMemoRe")
            .setContentText(text).setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentIntent(pending).setOngoing(true).build()
    }

    private fun publish(message: String) {
        getSharedPreferences("content-import", MODE_PRIVATE).edit()
            .putString("last-status", "${Instant.now()} $message").apply()
        sendBroadcast(Intent(NodeListenerService.ACTION_STATUS).setPackage(packageName)
            .putExtra(NodeListenerService.EXTRA_MESSAGE, message), NodeListenerService.INTERNAL_PERMISSION)
    }

    companion object {
        const val ACTION_IMPORT = "dev.danmemore.launcher.content.IMPORT"
        private const val CHANNEL_ID = "danmemore_content_import"
        private const val NOTIFICATION_ID = 6602
    }
}

internal object DanMemoContentCache {
    private const val MARKER = ".danmemore-content.json"

    fun activeRoot(context: Context): File? {
        val root = File(File(context.filesDir, "danmemore/content"), "active")
        val marker = runCatching { JSONObject(File(root, MARKER).readText(Charsets.UTF_8)) }.getOrNull() ?: return null
        if (marker.optInt("schemaVersion") != 1 || marker.optLong("archiveFiles") < 1L ||
            marker.optLong("expandedBytes") < 1L || marker.optInt("verifiedAssets") < 1) return null
        if (CONTENT_ROOTS.any { !File(root, it).isDirectory }) return null
        if ((1..8).any { !File(root, "$it/project.manifest").isFile }) return null
        return root
    }

    internal val CONTENT_ROOTS = listOf("1", "2", "3", "4", "5", "6", "7", "8",
        "area_atlas_root", "single_image_root", "voice_root", "cache")
}

private class ContentImporter(private val context: Context) {
    private data class ExpectedAsset(val size: Long, val md5: String)

    private val expected = LinkedHashMap<String, ExpectedAsset>()
    private val verified = HashSet<String>()
    private val archiveFiles = HashSet<String>()
    private val roots = HashSet<String>()
    private var expandedBytes = 0L
    private var fileCount = 0L
    private var entryCount = 0L
    private var lastProgress = 0L
    private lateinit var progress: (String) -> Unit

    fun importZip(uri: Uri, progress: (String) -> Unit) {
        this.progress = progress
        loadExpectedAssets()
        val cacheRoot = File(context.filesDir, "danmemore/content")
        val staging = File(cacheRoot, ".importing")
        val active = File(cacheRoot, "active")
        val previous = File(cacheRoot, ".previous")
        val sourceArchive = File(cacheRoot, ".selected.zip")
        cacheRoot.mkdirs()
        check(cacheRoot.isDirectory) { "could not create the private content cache" }

        val archiveBytes = context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length }.takeIf { it != null && it > 0L }
        if (archiveBytes != null) {
            val available = StatFs(cacheRoot.absolutePath).availableBytes
            val required = Math.addExact(Math.multiplyExact(archiveBytes, 2L), STORAGE_HEADROOM_BYTES)
            check(available >= required) {
                "not enough free storage: importing and installing the game data needs ${formatBytes(required)}, " +
                    "but ${formatBytes(available)} is available"
            }
        }

        staging.deleteRecursively()
        sourceArchive.delete()
        check(staging.mkdirs()) { "could not create the content staging directory" }
        try {
            copySelectedArchive(uri, sourceArchive)
            extractArchive(sourceArchive, staging)
            val missingRoots = DanMemoContentCache.CONTENT_ROOTS.filterNot(roots::contains)
            check(missingRoots.isEmpty()) { "archive is missing ${missingRoots.joinToString()}" }
            check((1..8).all { File(staging, "$it/project.manifest").isFile }) {
                "archive is missing one or more project manifests"
            }

            progress("Content import: applying offline manifests and banner artwork")
            writePatches(staging)
            val missingAssets = expected.keys.filterNot(verified::contains)
            check(missingAssets.isEmpty()) {
                "archive is incomplete: ${missingAssets.size} manifest assets are missing (first: ${missingAssets.first()})"
            }
            File(staging, MARKER).writeText(
                JSONObject().put("schemaVersion", 1).put("archiveFiles", fileCount)
                    .put("expandedBytes", expandedBytes).put("verifiedAssets", verified.size)
                    .put("importedAt", Instant.now().toString()).toString() + "\n",
                Charsets.UTF_8,
            )

            previous.deleteRecursively()
            if (active.exists()) check(active.renameTo(previous)) { "could not preserve the active content cache" }
            try {
                check(staging.renameTo(active)) { "could not activate the verified content cache" }
                check(DanMemoContentCache.activeRoot(context) != null) { "activated content failed its final validation" }
                previous.deleteRecursively()
            } catch (error: Throwable) {
                if (!active.exists() && previous.exists()) previous.renameTo(active)
                throw error
            }
        } catch (error: Throwable) {
            staging.deleteRecursively()
            throw error
        } finally {
            sourceArchive.delete()
        }
    }

    private fun loadExpectedAssets() {
        for (phase in 1..8) {
            val manifest = context.assets.open("runtime/manifests/project.manifest.$phase")
                .bufferedReader(Charsets.UTF_8).use { JSONObject(it.readText()) }
            val assets = manifest.getJSONObject("assets")
            val keys = assets.keys()
            while (keys.hasNext()) {
                val raw = keys.next()
                val relative = normalizeRelative(raw)
                val metadata = assets.getJSONObject(raw)
                val size = metadata.getLong("size")
                val md5 = metadata.getString("md5").lowercase(Locale.US)
                check(size >= 0L && md5.matches(Regex("[a-f0-9]{32}"))) { "invalid bundled manifest entry: $phase/$relative" }
                check(expected.put("$phase/$relative", ExpectedAsset(size, md5)) == null) {
                    "duplicate bundled manifest entry: $phase/$relative"
                }
            }
        }
        check(expected.isNotEmpty()) { "bundled content manifests are empty" }
    }

    private fun copySelectedArchive(uri: Uri, destination: File) {
        progress("Content import: copying the selected ZIP into private storage")
        var copied = 0L
        var lastCopyProgress = 0L
        context.contentResolver.openInputStream(uri)?.buffered(COPY_BUFFER_BYTES)?.use { source ->
            BufferedOutputStream(FileOutputStream(destination), COPY_BUFFER_BYTES).use { output ->
                val buffer = ByteArray(COPY_BUFFER_BYTES)
                while (true) {
                    val count = source.read(buffer)
                    if (count < 0) break
                    copied = Math.addExact(copied, count.toLong())
                    check(copied <= MAX_ARCHIVE_BYTES) { "selected ZIP is larger than the supported payload size" }
                    output.write(buffer, 0, count)
                    val now = android.os.SystemClock.elapsedRealtime()
                    if (now - lastCopyProgress >= PROGRESS_INTERVAL_MS) {
                        lastCopyProgress = now
                        progress("Content import: ${formatBytes(copied)} copied into private storage")
                    }
                }
            }
        } ?: error("Android could not open the selected ZIP")
        check(copied > 0L && destination.length() == copied) { "selected ZIP could not be staged completely" }
    }

    private fun extractArchive(archive: File, staging: File) {
        progress("Content import: extracting the selected ZIP into private storage")
        ZipFile(archive).use { zip ->
            val entries = zip.entries()
            while (entries.hasMoreElements()) {
                val entry = entries.nextElement()
                entryCount = Math.addExact(entryCount, 1L)
                check(entryCount <= MAX_ARCHIVE_ENTRIES) { "archive contains too many entries" }
                val path = normalizeArchivePath(entry.name)
                if (path != null) {
                    val root = path.substringBefore('/')
                    if (root in DanMemoContentCache.CONTENT_ROOTS) {
                        roots += root
                        if (entry.isDirectory) safeFile(staging, path).mkdirs()
                        else zip.getInputStream(entry).buffered(COPY_BUFFER_BYTES).use { source ->
                            extractFile(source, entry, staging, path)
                        }
                    } else {
                        check('/' !in path && (path == "Directory.txt" || path.endsWith(".apk", ignoreCase = true))) {
                            "unexpected archive path: $path"
                        }
                    }
                }
            }
        }
    }

    private fun extractFile(source: InputStream, entry: ZipEntry, staging: File, path: String) {
        check(archiveFiles.add(path)) { "duplicate archive file: $path" }
        val output = safeFile(staging, path)
        output.parentFile?.mkdirs()
        val expectedAsset = expected[path]
        val digest = if (expectedAsset != null && path !in PATCHED_PATHS) MessageDigest.getInstance("MD5") else null
        val crc = CRC32()
        var size = 0L
        BufferedOutputStream(FileOutputStream(output), COPY_BUFFER_BYTES).use { destination ->
            val buffer = ByteArray(COPY_BUFFER_BYTES)
            while (true) {
                val count = source.read(buffer)
                if (count < 0) break
                size = Math.addExact(size, count.toLong())
                expandedBytes = Math.addExact(expandedBytes, count.toLong())
                check(expandedBytes <= MAX_EXPANDED_BYTES) { "archive expands beyond the supported content size" }
                if (expectedAsset != null && path !in PATCHED_PATHS) check(size <= expectedAsset.size) {
                    "asset is larger than its original manifest record: $path"
                }
                destination.write(buffer, 0, count)
                digest?.update(buffer, 0, count)
                crc.update(buffer, 0, count)
                reportProgress(path)
            }
        }
        check(entry.size < 0L || size == entry.size) { "asset size does not match the ZIP directory: $path" }
        check(entry.crc < 0L || crc.value == entry.crc) { "asset failed ZIP CRC verification: $path" }
        if (expectedAsset != null && path !in PATCHED_PATHS) {
            val md5 = digest!!.digest().toHex()
            check(size == expectedAsset.size && md5 == expectedAsset.md5) { "asset failed original manifest verification: $path" }
            verified += path
        }
        fileCount = Math.addExact(fileCount, 1L)
        reportProgress(path, force = fileCount % 250L == 0L)
    }

    private fun writePatches(staging: File) {
        for (phase in listOf("1", "3"))
            writeAsset(staging, "runtime/manifests/project.manifest.$phase", "$phase/project.manifest", verify = false)
        writeAsset(staging, "runtime/manifests/resources/gacha/lottery.enc", "1/master/divide_enc/lottery.enc")
        writeAsset(staging, "runtime/manifests/resources/gacha/lotteryPickup.enc", "1/master/divide_enc/lotteryPickup.enc")
        writeAsset(staging, "runtime/manifests/resources/shop/shopProduct.enc", "1/master/divide_enc/shopProduct.enc")
        writeAssetTree(staging, "runtime/manifests/resources/gacha/background", "3/files/lottery/background")
    }

    private fun writeAssetTree(staging: File, assetPath: String, targetPath: String) {
        val children = context.assets.list(assetPath).orEmpty()
        check(children.isNotEmpty()) { "bundled offline asset folder is empty: $assetPath" }
        File(staging, targetPath).mkdirs()
        for (name in children.sorted()) {
            val safeName = normalizeName(name)
            val source = "$assetPath/$safeName"
            val target = "$targetPath/$safeName"
            if (context.assets.list(source).orEmpty().isEmpty()) writeAsset(staging, source, target)
            else writeAssetTree(staging, source, target)
        }
    }

    private fun writeAsset(staging: File, assetPath: String, targetPath: String, verify: Boolean = true) {
        val normalized = normalizeRelative(targetPath)
        val expectedAsset = expected[normalized]
        if (verify && BuildConfig.STRICT_CONTENT_MANIFEST)
            check(expectedAsset != null) { "offline patch is absent from the bundled manifest: $normalized" }
        val digest = MessageDigest.getInstance("MD5")
        var size = 0L
        val output = safeFile(staging, normalized)
        output.parentFile?.mkdirs()
        context.assets.open(assetPath).use { input ->
            BufferedOutputStream(FileOutputStream(output), COPY_BUFFER_BYTES).use { destination ->
                val buffer = ByteArray(COPY_BUFFER_BYTES)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    destination.write(buffer, 0, count)
                    digest.update(buffer, 0, count)
                    size = Math.addExact(size, count.toLong())
                }
            }
        }
        if (expectedAsset != null) {
            check(size == expectedAsset.size && digest.digest().toHex() == expectedAsset.md5) {
                "bundled offline patch failed manifest verification: $normalized"
            }
            verified += normalized
        }
    }

    private fun normalizeArchivePath(value: String): String? {
        var path = value.replace('\\', '/').trimEnd('/')
        if (path == "contents" || path.isEmpty()) return null
        if (path.startsWith("contents/")) path = path.removePrefix("contents/")
        return normalizeRelative(path)
    }

    private fun normalizeRelative(value: String): String {
        val path = value.replace('\\', '/')
        check(path.isNotBlank() && !path.startsWith('/') && path.split('/').none { it.isBlank() || it == "." || it == ".." }) {
            "unsafe content path: $value"
        }
        return path
    }

    private fun normalizeName(value: String): String {
        check(value.isNotEmpty() && value != "." && value != ".." && '/' !in value && '\\' !in value &&
            value.none { it.code < 32 }) { "unsafe bundled asset name" }
        return value
    }

    private fun safeFile(root: File, relative: String): File {
        val candidate = File(root, normalizeRelative(relative).replace('/', File.separatorChar)).canonicalFile
        val parent = root.canonicalFile.path + File.separator
        check(candidate.path.startsWith(parent)) { "unsafe content path: $relative" }
        return candidate
    }

    private fun reportProgress(path: String, force: Boolean = false) {
        val now = android.os.SystemClock.elapsedRealtime()
        if (force || now - lastProgress >= PROGRESS_INTERVAL_MS) {
            lastProgress = now
            progress("Content import: ${formatBytes(expandedBytes)} extracted · $fileCount files · ${path.takeLast(72)}")
        }
    }

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(Locale.US, it.toInt() and 0xff) }

    private fun formatBytes(value: Long): String {
        val gib = value.toDouble() / 1_073_741_824.0
        return if (gib >= 1.0) "%.2f GB".format(Locale.US, gib)
        else "%.0f MB".format(Locale.US, value / 1_048_576.0)
    }

    companion object {
        private const val MARKER = ".danmemore-content.json"
        private const val COPY_BUFFER_BYTES = 1024 * 1024
        private const val PROGRESS_INTERVAL_MS = 500L
        private const val STORAGE_HEADROOM_BYTES = 2L * 1024L * 1024L * 1024L
        private const val MAX_ARCHIVE_BYTES = 20L * 1024L * 1024L * 1024L
        private const val MAX_ARCHIVE_ENTRIES = 500_000L
        private const val MAX_EXPANDED_BYTES = 32L * 1024L * 1024L * 1024L
        private val PATCHED_PATHS = setOf(
            "1/master/divide_enc/lottery.enc",
            "1/master/divide_enc/lotteryPickup.enc",
            "1/master/divide_enc/shopProduct.enc",
        )
    }
}
