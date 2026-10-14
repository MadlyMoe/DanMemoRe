#include <jni.h>
#include <cstring>
#include <string>
#include <vector>
#include "node.h"

static JavaVM* javaVm;
static jclass sqliteClass;
static jmethodID sqliteCall;

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
    javaVm = vm;
    JNIEnv* env = nullptr;
    if (vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK) return JNI_ERR;
    jclass local = env->FindClass("dev/danmemore/launcher/SqliteBridge");
    if (!local) return JNI_ERR;
    sqliteClass = static_cast<jclass>(env->NewGlobalRef(local)); env->DeleteLocalRef(local);
    sqliteCall = env->GetStaticMethodID(sqliteClass, "call", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
    return sqliteCall ? JNI_VERSION_1_6 : JNI_ERR;
}

static void SqliteCall(const v8::FunctionCallbackInfo<v8::Value>& args) {
    auto* isolate = args.GetIsolate(); JNIEnv* env = nullptr;
    if (args.Length() != 3 || javaVm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK) {
        isolate->ThrowException(v8::Exception::Error(v8::String::NewFromUtf8Literal(isolate, "SQLite bridge unavailable"))); return;
    }
    jstring inputs[3];
    for (int i = 0; i < 3; ++i) { v8::String::Value value(isolate, args[i]); inputs[i] = env->NewString(reinterpret_cast<const jchar*>(*value), value.length()); }
    auto result = static_cast<jstring>(env->CallStaticObjectMethod(sqliteClass, sqliteCall, inputs[0], inputs[1], inputs[2]));
    for (auto input : inputs) env->DeleteLocalRef(input);
    if (env->ExceptionCheck()) {
        auto error = env->ExceptionOccurred(); env->ExceptionClear(); auto type = env->GetObjectClass(error);
        auto method = env->GetMethodID(type, "toString", "()Ljava/lang/String;"); auto message = static_cast<jstring>(env->CallObjectMethod(error, method));
        const jchar* chars = env->GetStringChars(message, nullptr);
        auto text = v8::String::NewFromTwoByte(isolate, reinterpret_cast<const uint16_t*>(chars), v8::NewStringType::kNormal, env->GetStringLength(message)).ToLocalChecked();
        env->ReleaseStringChars(message, chars); env->DeleteLocalRef(message); env->DeleteLocalRef(type); env->DeleteLocalRef(error);
        isolate->ThrowException(v8::Exception::Error(text)); return;
    }
    const jchar* chars = env->GetStringChars(result, nullptr);
    args.GetReturnValue().Set(v8::String::NewFromTwoByte(isolate, reinterpret_cast<const uint16_t*>(chars), v8::NewStringType::kNormal, env->GetStringLength(result)).ToLocalChecked());
    env->ReleaseStringChars(result, chars); env->DeleteLocalRef(result);
}

static void InitializeSqlite(v8::Local<v8::Object> exports, v8::Local<v8::Value>, v8::Local<v8::Context>) { NODE_SET_METHOD(exports, "call", SqliteCall); }
NODE_MODULE_LINKED(danmemore_sqlite, InitializeSqlite)

extern "C" JNIEXPORT jint JNICALL
Java_dev_danmemore_launcher_NodeMobileBridge_startNodeWithArguments(JNIEnv* env, jclass, jobjectArray arguments) {
    const jsize count = env->GetArrayLength(arguments); std::vector<std::string> storage; storage.reserve(static_cast<size_t>(count)); size_t bytes = 0;
    for (jsize i = 0; i < count; ++i) { auto value = static_cast<jstring>(env->GetObjectArrayElement(arguments, i)); const char* text = env->GetStringUTFChars(value, nullptr);
        storage.emplace_back(text == nullptr ? "" : text); if (text != nullptr) env->ReleaseStringUTFChars(value, text); env->DeleteLocalRef(value); bytes += storage.back().size() + 1; }
    std::vector<char> block(bytes == 0 ? 1 : bytes); std::vector<char*> argv(static_cast<size_t>(count)); char* cursor = block.data();
    for (jsize i = 0; i < count; ++i) { const auto& value = storage[static_cast<size_t>(i)]; std::memcpy(cursor, value.c_str(), value.size()); cursor[value.size()] = '\0'; argv[static_cast<size_t>(i)] = cursor; cursor += value.size() + 1; }
    return static_cast<jint>(node::Start(static_cast<int>(count), argv.data()));
}

