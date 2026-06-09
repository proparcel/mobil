#include <stddef.h>

typedef void (*VrParcelEmitCallbackFn)(const char *eventName, const char *jsonPayload);

static VrParcelEmitCallbackFn s_hostEmitCallback = NULL;

extern "C" void VrParcelSetEmitCallback(VrParcelEmitCallbackFn callback)
{
    s_hostEmitCallback = callback;
}

extern "C" void VrParcelEmitEvent(const char *eventName, const char *jsonPayload)
{
    if (s_hostEmitCallback != NULL)
    {
        s_hostEmitCallback(eventName, jsonPayload);
    }
}
