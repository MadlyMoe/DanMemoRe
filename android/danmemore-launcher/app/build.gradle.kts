plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val repositoryRoot = rootProject.file("../..").canonicalFile
val gamePackageId = providers.gradleProperty("danmemoreGamePackage").getOrElse("com.eu.danmore")
require(gamePackageId.matches(Regex("[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+"))) { "Invalid DanMemoRe game package" }
val strictContentManifest = providers.gradleProperty("danmemoreStrictContentManifest").getOrElse("true").toBooleanStrict()
val libnodeRoot = providers.environmentVariable("DANMEMORE_LIBNODE_DIR")
    .map(::file).orElse(rootProject.file("../../../RevivalSide/kmp/app/libnode")).get().canonicalFile
require(file("$libnodeRoot/bin/arm64-v8a/libnode.so").isFile) {
    "Set DANMEMORE_LIBNODE_DIR to a Node Mobile libnode directory."
}
val generatedAssets = layout.buildDirectory.dir("generated/danmemore-assets")
val contentManifestDirectory = providers.gradleProperty("danmemoreContentManifestDir")
    .map(::file).orElse(file("$repositoryRoot/data/manifests"))
val prepareRuntimeAssets by tasks.registering(Sync::class) {
    into(generatedAssets.map { it.dir("runtime") })
    from("$repositoryRoot/tools/danmemore_server.cjs")
    from("$repositoryRoot/tools/gacha_details.cjs")
    from("$repositoryRoot/tools/under_pvp.cjs")
    from("$repositoryRoot/tools/under_pvp_ranking.cjs")
    from("$repositoryRoot/tools/serial_pvp.cjs")
    from("$repositoryRoot/tools/war_game.cjs")
    from("$repositoryRoot/tools/pvb_rewards.cjs")
    from("$repositoryRoot/tools/element_rewards.cjs")
    from("$repositoryRoot/data/danmemore-seed.json") { rename { "seed.json" } }
    from("$repositoryRoot/data/danmemore-master.json") { rename { "master.json" } }
    from("$repositoryRoot/data/danmemore-gacha-art.json") { rename { "gacha-art.json" } }
    from("$repositoryRoot/data/danmemore-lotto-prizes.json") { into("data") }
    from(contentManifestDirectory) { include("project.manifest.*"); into("manifests") }
    from("$repositoryRoot/data/manifests/resources") { into("manifests/resources") }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
android {
    namespace = "dev.danmemore.launcher"
    compileSdk = 36
    ndkVersion = "27.2.12479018"
    defaultConfig {
        applicationId = "dev.danmemore.launcher"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-alpha.1"
        buildConfigField("String", "GAME_PACKAGE_ID", "\"$gamePackageId\"")
        buildConfigField("boolean", "STRICT_CONTENT_MANIFEST", strictContentManifest.toString())
        ndk { abiFilters += "arm64-v8a" }
        externalNativeBuild { cmake { arguments += listOf("-DNODE_ROOT=${libnodeRoot.invariantSeparatorsPath}", "-DANDROID_STL=c++_shared") } }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    buildFeatures { compose = true; buildConfig = true }
    externalNativeBuild { cmake { path = file("CMakeLists.txt") } }
    sourceSets.getByName("main") {
        jniLibs.srcDir(file("$libnodeRoot/bin"))
        assets.srcDir(generatedAssets)
    }
    packaging { jniLibs { useLegacyPackaging = true } }
}
tasks.named("preBuild").configure { dependsOn(prepareRuntimeAssets) }
dependencies {
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3:1.3.2")
}
