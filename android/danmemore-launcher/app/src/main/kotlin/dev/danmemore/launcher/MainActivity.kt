package dev.danmemore.launcher

import android.Manifest
import android.app.ActivityManager
import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.*
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.net.InetSocketAddress
import java.net.Socket
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    private var running by mutableStateOf(false)
    private var busy by mutableStateOf(false)
    private var message by mutableStateOf("Checking the local listener…")
    private var profiles by mutableStateOf<List<Profile>>(emptyList())
    private var selected by mutableStateOf("default")
    private var pendingLaunch = false
    private var stopping = false
    private val handler = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private lateinit var manager: ProfileManager
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val text = intent.getStringExtra(NodeListenerService.EXTRA_MESSAGE) ?: return
            message = text
            if (text.startsWith("DanMemoRe server ready")) {
                running = true; busy = false; refreshProfiles()
                if (pendingLaunch) { pendingLaunch = false; openGame() }
            } else if (text.startsWith("Content import complete") || text.startsWith("Content import failed")) {
                busy = false; message = text
            } else if (text.startsWith("Content import")) {
                busy = true; message = text
            } else if (text.startsWith("Listener failed") || text.startsWith("Listener exited") || text.startsWith("Listener readiness")) {
                busy = false; pendingLaunch = false
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState); manager = ProfileManager(this); refreshProfiles()
        setContent { Launcher(running, busy, message, profiles, selected, ::action) }
        val filter = IntentFilter(NodeListenerService.ACTION_STATUS)
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, filter, RECEIVER_NOT_EXPORTED)
        else @Suppress("DEPRECATION") registerReceiver(receiver, filter, NodeListenerService.INTERNAL_PERMISSION, null)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 44)
        poll()
    }

    override fun onDestroy() { handler.removeCallbacksAndMessages(null); worker.shutdown(); runCatching { unregisterReceiver(receiver) }; super.onDestroy() }

    private fun poll() {
        worker.execute {
            val active = runCatching { Socket().use { it.connect(InetSocketAddress("127.0.0.1", 28766), 250) }; true }.getOrDefault(false)
            handler.post {
                if (stopping && !active) {
                    stopping = false; busy = false; message = "Game and listener stopped"
                }
                if (!busy && (running != active || message == "Checking the local listener…"))
                    message = if (active) "SQLite listener ready" else "Ready for offline play"
                running = active; handler.postDelayed(::poll, 1500)
            }
        }
    }

    private fun refreshProfiles() { profiles = manager.list(); selected = manager.selected() }

    private fun action(name: String, value: String) {
        val idle = !running && !busy
        when (name) {
            "launch" -> {
                if (!installed(GAME_PACKAGE)) { message = "DanMemoRe game client is not installed"; return }
                if (DanMemoContentCache.activeRoot(this) == null) {
                    message = "Import the preserved contents ZIP before launching the game"
                    return
                }
                if (running) openGame() else {
                    stopGame()
                    busy = true; pendingLaunch = true; message = "Starting SQLite listener…"
                    startForegroundService(Intent(this, NodeListenerService::class.java).setAction(NodeListenerService.ACTION_START)
                        .putExtra(NodeListenerService.EXTRA_PROFILE, selected))
                }
            }
            "stop" -> {
                pendingLaunch = false; stopping = true; busy = true; message = "Stopping game and listener…"
                stopGame()
                startService(Intent(this, NodeListenerService::class.java).setAction(NodeListenerService.ACTION_STOP))
            }
            "select" -> if (idle) { manager.select(value); refreshProfiles(); message = "Selected for next launch" }
            "create" -> if (idle) { manager.create(); refreshProfiles(); message = "New local save selected" }
            "create-historical" -> if (idle) runCatching { manager.create(value) }
                .onSuccess { refreshProfiles(); message = "Historical event clock selected" }
                .onFailure { message = "Use an original service date from 2017-06-18 through 2024-02-29" }
            "change-clock" -> if (idle) runCatching { manager.changeEventDate(selected, value) }
                .onSuccess { refreshProfiles(); message = "Event clock changed for the selected save" }
                .onFailure { message = "Use an original service date from 2017-06-18 through 2024-02-29" }
            "rename" -> if (idle) { manager.rename(selected, value); refreshProfiles(); message = "Save renamed" }
            "reset" -> if (idle) { manager.reset(selected); refreshProfiles(); message = "Save reset; it will be rebuilt from the preserved seed" }
            "refresh" -> { refreshProfiles(); message = if (running) "SQLite listener ready" else "Profiles refreshed" }
            "import-content" -> if (idle) importContent(Uri.parse(value))
            "iris-free" -> if (running && !busy) addOfflineIris("free")
            "iris-paid" -> if (running && !busy) addOfflineIris("paid")
        }
    }

    private fun importContent(uri: Uri) {
        val permission = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        runCatching { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
            .onFailure { message = "The selected ZIP did not grant lasting read access"; return }
        busy = true; message = "ZIP import queued; keep the emulator powered on"
        startForegroundService(Intent(this, ContentImportService::class.java)
            .setAction(ContentImportService.ACTION_IMPORT)
            .setData(uri)
            .addFlags(permission))
    }

    private fun addOfflineIris(kind: String) {
        val profile = selected
        busy = true; message = "Saving offline ${kind} Iris…"
        worker.execute {
            val result = runCatching {
                val preferences = getSharedPreferences("offline-iris", MODE_PRIVATE)
                val key = if (kind == "free") "pending-$profile" else "pending-paid-$profile"
                val requestId = preferences.getString(key, null) ?: UUID.randomUUID().toString().also {
                    check(preferences.edit().putString(key, it).commit()) { "Cannot preserve the retry identifier" }
                }
                val body = JSONObject().put("requestId", requestId).put("profileId", profile).put("amount", 1000).put("kind", kind)
                    .toString().toByteArray(Charsets.UTF_8)
                val connection = URL("http://127.0.0.1:28766/offline/iris").openConnection() as HttpURLConnection
                try {
                    connection.requestMethod = "POST"; connection.doOutput = true
                    connection.connectTimeout = 3000; connection.readTimeout = 5000
                    connection.setRequestProperty("Content-Type", "application/json")
                    connection.setRequestProperty("X-DanMemoRe-Offline", "1")
                    connection.setFixedLengthStreamingMode(body.size)
                    connection.outputStream.use { it.write(body) }
                    check(connection.responseCode == 200) { "Local grant rejected (${connection.responseCode}); retry uses the same request" }
                    val response = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
                    check(response.getBoolean("offline") && response.getString("requestId") == requestId &&
                        response.getString("profileId") == profile && response.getInt("amount") == 1000 &&
                        response.getString("kind") == kind) { "Invalid local grant response" }
                    check(preferences.edit().remove(key).commit()) { "Grant saved; tap again to confirm this same request" }
                } finally { connection.disconnect() }
                "Added 1,000 offline $kind Iris. Reopen the game's shop to refresh its balance."
            }
            handler.post { busy = false; message = result.getOrElse { it.message ?: "Offline grant failed; safe to retry" } }
        }
    }

    // MuMu's Android 12 permits closing this background client without root.
    // A new listener must not inherit the previous session's native clock/cache.
    // Android 14+ restricts this API to the caller; that platform is unverified.
    private fun stopGame() { getSystemService(ActivityManager::class.java).killBackgroundProcesses(GAME_PACKAGE) }

    // CLEAR_TOP alone destroys the standard-mode Cocos activity without ending
    // its native process. Reuse it instead of attaching a new GL view to old state.
    private fun openGame() = packageManager.getLaunchIntentForPackage(GAME_PACKAGE)?.let {
        it.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP); startActivity(it)
    }
        ?: run { message = "DanMemoRe game client is not installed" }
    private fun installed(name: String) = runCatching { packageManager.getApplicationInfo(name, 0) }.isSuccess
    companion object { private val GAME_PACKAGE = BuildConfig.GAME_PACKAGE_ID }
}

private enum class Tab(val label: String) { Home("Home"), Saves("Saves"), Tools("Tools") }
private val Emerald = Color(0xff78dbc0)
private val Gold = Color(0xffecd29b)
private val Navy = Color(0xff0d151e)

@Composable private fun Launcher(running: Boolean, busy: Boolean, message: String, profiles: List<Profile>, selected: String,
                                 action: (String, String) -> Unit) {
    var tab by remember { mutableStateOf(Tab.Home) }; var rename by remember { mutableStateOf(false) }; var reset by remember { mutableStateOf(false) }
    var historical by remember { mutableStateOf(false) }; var changeClock by remember { mutableStateOf(false) }; var importContent by remember { mutableStateOf(false) }
    val contentPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) action("import-content", uri.toString())
    }
    val selectedProfile = profiles.firstOrNull { it.id == selected }
    val idle = !running && !busy
    MaterialTheme(colorScheme = darkColorScheme(primary = Emerald, onPrimary = Navy, secondary = Gold, background = Navy,
        surface = Color(0xff15212d), surfaceVariant = Color(0xff233343), onSurface = Color(0xffecf2f5),
        onSurfaceVariant = Color(0xffa7b8c7), outline = Color(0xff3b5061))) {
        Scaffold(containerColor = Navy, bottomBar = {
            NavigationBar(containerColor = Color(0xff101d28), tonalElevation = 0.dp) {
                Tab.entries.forEach { item -> NavigationBarItem(selected = tab == item, onClick = { tab = item },
                    icon = { Text(when (item) { Tab.Home -> "⌂"; Tab.Saves -> "▣"; Tab.Tools -> "⚙" }, fontSize = 20.sp) },
                    label = { Text(item.label) }) }
            }
        }) { padding ->
            Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 20.dp)) {
                Row(Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("✦", color = Emerald, fontSize = 30.sp)
                    Column(Modifier.weight(1f).padding(start = 12.dp)) {
                        Text("DANMEMORE", fontSize = 12.sp, letterSpacing = 2.sp, color = Emerald, fontWeight = FontWeight.Bold)
                        Text("Your Memoria Freese offline companion", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    AssistChip(onClick = { tab = Tab.Home }, label = { Text(if (running) "Running" else "Offline") })
                }
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                Text(message, Modifier.padding(bottom = 8.dp), fontSize = 12.sp, color = Gold)
                when (tab) {
                    Tab.Home -> Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Box(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Color(0xff254d48), Color(0xff1c2c42))), RoundedCornerShape(24.dp)).padding(24.dp)) {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text("THE LABYRINTH AWAITS", color = Gold, fontSize = 11.sp, letterSpacing = 1.5.sp)
                                Text("Orario lives on.\nAlways yours.", fontSize = 32.sp, lineHeight = 37.sp, fontWeight = FontWeight.Bold)
                                Text(selectedProfile?.name ?: "My adventure", color = Emerald, fontWeight = FontWeight.SemiBold)
                                Text(selectedProfile?.eventDate?.let { "Event clock · $it" } ?: "Current timeline",
                                    fontSize = 12.sp, color = Gold)
                                Text("Continue Bell's story with your preserved game data and local save.", fontSize = 13.sp, color = Color(0xffbfd2d9))
                                Button(onClick = { action(if (running) "stop" else "launch", "") }, enabled = !busy,
                                    modifier = Modifier.fillMaxWidth()) {
                                    Text(if (running) "Stop Memoria Freese" else "Launch Memoria Freese")
                                }
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Metric("Profiles", profiles.size.toString(), Modifier.weight(1f)); Metric("Storage", "SQLite", Modifier.weight(1f)); Metric("Server", if (running) "Ready" else "Local", Modifier.weight(1f))
                        }
                        ActionRow("Local profiles", "Select a separate adventure", true) { tab = Tab.Saves }
                        ActionRow("Protocol status", "Strict client-derived routes and replay-safe saves", true) { tab = Tab.Tools }
                    }
                    Tab.Saves -> Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Heading("Your saves", "Choose which adventure to continue")
                        profiles.forEach { profile -> Surface(shape = RoundedCornerShape(16.dp), color = if (profile.id == selected) Color(0xff203c3a) else MaterialTheme.colorScheme.surface) {
                            Row(Modifier.fillMaxWidth().clickable(enabled = idle) { action("select", profile.id) }.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(if (profile.id == selected) "●" else "○", color = Emerald); Column(Modifier.padding(start = 12.dp)) {
                                    Text(profile.name, fontWeight = FontWeight.SemiBold); Text(profile.eventDate?.let { "Event clock · $it" }
                                        ?: if (profile.ready) "SQLite profile · current timeline" else "Created on first launch",
                                        fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        } }
                        ActionRow("New local save", "Start a separate adventure", idle) { action("create", "") }
                        ActionRow("New historical save", "Choose which original event calendar is active", idle) { historical = true }
                        ActionRow("Change selected event clock", "Switch this save to another original date", idle) { changeClock = true }
                        ActionRow("Rename selected save", "Changes the launcher label only", idle) { rename = true }
                        ActionRow("Reset selected save", "Rebuild from the preserved offline seed", idle) { reset = true }
                    }
                    Tab.Tools -> Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Heading("Tools & connection", "Local-first. Your saves stay yours.")
                        ActionRow("Refresh profiles", "Reload SQLite profile state", true) { action("refresh", "") }
                        ActionRow("Import preserved contents ZIP", "Rootless · verified in private launcher storage", idle) { importContent = true }
                        ActionRow("Add 1,000 free Iris", "Offline local-save grant · no store transaction", running && !busy) { action("iris-free", "") }
                        ActionRow("Add 1,000 paid Iris", "Funds archived paid-Iris shop packs locally", running && !busy) { action("iris-paid", "") }
                        Section("Save protection") { Text("Gameplay deltas, request ordering, operation acknowledgements, and exact retries are committed in SQLite transactions."); Text("Stop the listener before switching, renaming, or resetting a save.", color = Gold) }
                        Section("Event clock") { Text("Historical saves expose only banners, shops, and events active on their selected original date."); Text("Stop the listener before changing the selected save's event date.", color = Gold) }
                        Section("Preserved content") { Text("The 14 GB archive remains outside this launcher and Git. Select the original contents-complete.zip here. DanMemoRe extracts and verifies it inside private launcher storage, then serves it to the game's own downloader over localhost. Root, broad storage permission, and direct access to the game's files are not used.") }
                    }
                }
            }
        }
        if (rename) TextDialog("Name this save", selectedProfile?.name.orEmpty(), { rename = false }) { rename = false; action("rename", it) }
        if (historical) TextDialog("Historical date (YYYY-MM-DD)", "2019-10-18", { historical = false }) {
            historical = false; action("create-historical", it)
        }
        if (changeClock) TextDialog("Event date (YYYY-MM-DD)", selectedProfile?.eventDate ?: "2019-10-18", { changeClock = false }) {
            changeClock = false; action("change-clock", it)
        }
        if (reset) AlertDialog(onDismissRequest = { reset = false }, title = { Text("Reset this save?") },
            text = { Text("This deletes the selected local SQLite profile and rebuilds it from the preserved seed on next launch.") },
            confirmButton = { TextButton(onClick = { reset = false; action("reset", "") }) { Text("Reset") } },
            dismissButton = { TextButton(onClick = { reset = false }) { Text("Cancel") } })
        if (importContent) AlertDialog(onDismissRequest = { importContent = false }, title = { Text("Import preserved assets?") },
            text = { Text("Select the preserved 15.1.0 content ZIP. DanMemoRe will verify the exact payload checksum, extract it into a private staging cache, verify every extracted file, apply the offline content overlays, and activate it only when all eight phases are complete. The game downloads from that localhost cache itself; no root access is needed and saves are left untouched.") },
            confirmButton = { TextButton(onClick = { importContent = false; contentPicker.launch(arrayOf("application/zip", "application/x-zip-compressed", "application/octet-stream")) }) { Text("Choose ZIP") } },
            dismissButton = { TextButton(onClick = { importContent = false }) { Text("Cancel") } })
    }
}

@Composable private fun Heading(title: String, subtitle: String) { Column(Modifier.padding(top = 12.dp, bottom = 8.dp)) { Text(title, fontSize = 27.sp, fontWeight = FontWeight.Bold); Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
@Composable private fun Metric(label: String, value: String, modifier: Modifier) { Surface(modifier, shape = RoundedCornerShape(16.dp)) { Column(Modifier.padding(14.dp)) { Text(value, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Emerald); Text(label, fontSize = 11.sp) } } }
@Composable private fun Section(title: String, content: @Composable ColumnScope.() -> Unit) { Surface(shape = RoundedCornerShape(18.dp)) { Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { Text(title, fontWeight = FontWeight.Bold); content() } } }
@Composable private fun ActionRow(title: String, subtitle: String, enabled: Boolean, onClick: () -> Unit) { Surface(shape = RoundedCornerShape(16.dp)) { Row(Modifier.fillMaxWidth().clickable(enabled = enabled, onClick = onClick).padding(16.dp), verticalAlignment = Alignment.CenterVertically) { Text("›", color = if (enabled) Emerald else MaterialTheme.colorScheme.outline, fontSize = 26.sp); Column(Modifier.padding(start = 12.dp)) { Text(title, fontWeight = FontWeight.SemiBold); Text(subtitle, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) } } } }
@Composable private fun TextDialog(title: String, initial: String, dismiss: () -> Unit, commit: (String) -> Unit) { var text by remember { mutableStateOf(initial) }; AlertDialog(onDismissRequest = dismiss, title = { Text(title) }, text = { OutlinedTextField(text, { text = it }, singleLine = true) }, confirmButton = { TextButton(onClick = { commit(text) }, enabled = text.isNotBlank()) { Text("Apply") } }, dismissButton = { TextButton(onClick = dismiss) { Text("Cancel") } }) }
