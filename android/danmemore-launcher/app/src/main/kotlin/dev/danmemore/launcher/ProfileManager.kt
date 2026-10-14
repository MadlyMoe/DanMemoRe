package dev.danmemore.launcher

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.util.UUID

data class Profile(val id: String, val name: String, val ready: Boolean, val eventDate: String?)

class ProfileManager(private val context: Context) {
    private val root = File(context.filesDir, "danmemore")
    private val profiles = File(root, "profiles")
    private val metadata = File(root, "profiles.json")

    init { profiles.mkdirs() }

    fun selected(): String = read().optString("selected", "default")

    fun list(): List<Profile> {
        val document = read(); val names = document.optJSONObject("names") ?: JSONObject()
        val eventDates = document.optJSONObject("eventDates") ?: JSONObject()
        val ids = linkedSetOf("default")
        profiles.listFiles { file -> file.extension == "sqlite" }?.forEach { ids += it.nameWithoutExtension }
        names.keys().forEach { ids += it }
        return ids.map { Profile(it, names.optString(it, if (it == "default") "My adventure" else "Local save"),
            File(profiles, "$it.sqlite").isFile, eventDates.optString(it).ifBlank { null }) }
    }

    fun select(id: String) { require(list().any { it.id == id }); write(read().put("selected", id)) }

    fun create(eventDate: String? = null): String {
        val date = eventDate?.let(::validEventDate)
        val id = UUID.randomUUID().toString().substring(0, 8); val document = read(); val names = document.optJSONObject("names") ?: JSONObject()
        names.put(id, "Adventure ${names.length() + 2}"); document.put("names", names).put("selected", id)
        if (date != null) document.put("eventDates", document.optJSONObject("eventDates") ?: JSONObject()).getJSONObject("eventDates").put(id, date)
        write(document); return id
    }

    fun changeEventDate(id: String, eventDate: String) {
        require(list().any { it.id == id })
        val document = read(); val dates = document.optJSONObject("eventDates") ?: JSONObject()
        dates.put(id, validEventDate(eventDate)); document.put("eventDates", dates); write(document)
    }

    fun rename(id: String, value: String) {
        val name = value.trim(); require(name.isNotEmpty() && name.length <= 48)
        val document = read(); val names = document.optJSONObject("names") ?: JSONObject(); names.put(id, name); document.put("names", names); write(document)
    }

    fun reset(id: String) {
        require(id.matches(Regex("[a-z0-9-]{1,40}")))
        for (suffix in listOf("", "-wal", "-shm")) File(profiles, "$id.sqlite$suffix").delete()
    }

    private fun read(): JSONObject = runCatching { JSONObject(metadata.readText()) }.getOrElse {
        JSONObject().put("selected", "default").put("names", JSONObject().put("default", "My adventure"))
    }

    private fun validEventDate(value: String): String = value.trim().also {
        val parsed = runCatching { LocalDate.parse(it) }.getOrNull()
        require(parsed != null && !parsed.isBefore(LocalDate.of(2017, 6, 18)) && !parsed.isAfter(LocalDate.of(2024, 2, 29)))
    }

    private fun write(value: JSONObject) {
        root.mkdirs(); val temporary = File(root, "profiles.json.tmp"); temporary.writeText(value.toString());
        if (!temporary.renameTo(metadata)) { metadata.delete(); check(temporary.renameTo(metadata)) }
    }
}
