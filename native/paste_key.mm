#include <ApplicationServices/ApplicationServices.h>
#include <node_api.h>
#include <unistd.h>

namespace {

constexpr CGKeyCode kCommandKey = 55;
constexpr CGKeyCode kVKey = 9;

bool postKey(CGEventSourceRef source, CGKeyCode key, bool down, CGEventFlags flags) {
  CGEventRef event = CGEventCreateKeyboardEvent(source, key, down);
  if (!event) return false;
  CGEventSetFlags(event, flags);
  CGEventPost(kCGHIDEventTap, event);
  CFRelease(event);
  usleep(1000);
  return true;
}

bool postPasteShortcut() {
  CGEventSourceRef source = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);
  if (!source) return false;

  const CGEventFlags command = kCGEventFlagMaskCommand;
  bool ok = true;
  ok = postKey(source, kCommandKey, true, command) && ok;
  ok = postKey(source, kVKey, true, command) && ok;
  ok = postKey(source, kVKey, false, command) && ok;
  ok = postKey(source, kCommandKey, false, 0) && ok;

  CFRelease(source);
  return ok;
}

napi_value paste(napi_env env, napi_callback_info info) {
  if (!postPasteShortcut()) {
    napi_throw_error(env, nullptr, "failed to create paste keyboard events");
    return nullptr;
  }

  napi_value result;
  napi_get_boolean(env, true, &result);
  return result;
}

napi_value init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "paste", NAPI_AUTO_LENGTH, paste, nullptr, &fn);
  napi_set_named_property(env, exports, "paste", fn);
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
