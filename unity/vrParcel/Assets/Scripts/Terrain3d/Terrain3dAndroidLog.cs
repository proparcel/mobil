using UnityEngine;

namespace ProParcel.Terrain3d
{
    /**
     * Unity -> Android attempt log koprusu.
     * adb logcat -s TerrainUnityHost:* ile de gorulebilir.
     *
     * NOT: Onceki surum com.proparcel.mobile.vrparcel.VrUnityHost cagiriyordu; o host'un appContext'i
     * yalnizca VR session akisinda set edildigi icin terrain-only acilislarda Unity eventleri
     * sessizce dusuyordu (unityEvents: 0). Artik terrain paketindeki TerrainUnityHost cagriliyor;
     * appContext attachTo'da set edilir.
     */
    public static class Terrain3dAndroidLog
    {
        private const string TerrainHostClass = "com.proparcel.mobile.parcelterrain3d.TerrainUnityHost";

        /** Yapisal event: message = event adi (orn. unity.mesh.build.success), data = JSON payload. */
        public static void Event(string eventName, Terrain3dLogData data = null)
        {
            var json = data?.Build() ?? "{}";
            Debug.Log("[Terrain3d] " + eventName + " " + json);
            Send(eventName, "info", json);
        }

        public static void EventError(string eventName, Terrain3dLogData data = null)
        {
            var json = data?.Build() ?? "{}";
            Debug.LogError("[Terrain3d] " + eventName + " " + json);
            Send(eventName, "error", json);
        }

        public static void Info(string message)
        {
            Debug.Log(message);
            Send(message, "info", "{}");
        }

        public static void Error(string message)
        {
            Debug.LogError(message);
            Send(message, "error", "{}");
        }

        private static void Send(string message, string level, string dataJson)
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using var host = new AndroidJavaClass(TerrainHostClass);
                host.CallStatic("logUnityEvent", message, level, dataJson ?? "{}");
            }
            catch (System.Exception e)
            {
                // Tam exception logcat'e: ClassNotFound / no static method / NPE ayrimi icin.
                Debug.LogError("[Terrain3dAndroidLog] logUnityEvent FAIL class=" + TerrainHostClass +
                    " msg=" + message + " ex=" + e);
            }
#endif
        }
    }
}
