using System.Runtime.InteropServices;
using UnityEngine;

namespace ProParcel.VrParcel.Bridge
{
    /// <summary>
    /// Unity → React Native olay köprüsü (iOS native plugin).
    /// </summary>
    public static class VrParcelNativeCallback
    {
#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void VrParcelEmitEvent(string eventName, string jsonPayload);
#elif UNITY_ANDROID && !UNITY_EDITOR
        private static void VrParcelEmitEvent(string eventName, string jsonPayload)
        {
            using (var emitClass = new AndroidJavaClass("com.proparcel.mobile.vrparcel.VrParcelNativeEmit"))
            {
                emitClass.CallStatic("emit", eventName, jsonPayload ?? "{}");
            }
        }
#endif

        public static void Emit(string eventName, string jsonPayload = "{}")
        {
#if UNITY_IOS && !UNITY_EDITOR
            VrParcelEmitEvent(eventName, jsonPayload ?? "{}");
#elif UNITY_ANDROID && !UNITY_EDITOR
            VrParcelEmitEvent(eventName, jsonPayload ?? "{}");
#else
            Debug.Log($"[VrParcelNativeCallback] {eventName}: {jsonPayload}");
#endif
        }
    }
}
