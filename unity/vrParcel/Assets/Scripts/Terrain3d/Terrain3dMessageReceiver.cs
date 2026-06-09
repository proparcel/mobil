using UnityEngine;

namespace ProParcel.Terrain3d
{
    /**
     * UnitySendMessage hedefi — Kotlin bu objeye mesaj gonderir.
     * DontDestroyOnLoad: UaaL ikinci Activity'de sahne Start/Awake tekrar calismaz;
     * receiver process boyunca tek instance kalir.
     */
    public class Terrain3dMessageReceiver : MonoBehaviour
    {
        private ParcelTerrain3dBridge bridge;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void EnsureReceiver()
        {
            if (GameObject.Find("Terrain3dMessageReceiver") != null)
            {
                Debug.Log("[Terrain3d] Terrain3dMessageReceiver already exists");
                return;
            }

            var go = new GameObject("Terrain3dMessageReceiver");
            go.AddComponent<Terrain3dMessageReceiver>();
            Object.DontDestroyOnLoad(go);
            Debug.Log("[Terrain3d] Terrain3dMessageReceiver created (BeforeSceneLoad)");
        }

        private void Awake()
        {
            if (gameObject.name != "Terrain3dMessageReceiver")
                gameObject.name = "Terrain3dMessageReceiver";

            Debug.Log("[Terrain3d] Terrain3dMessageReceiver.Awake");
            Terrain3dAndroidLog.Event("unity.receiver.awake", Terrain3dLogData.New()
                .Add("object", gameObject.name));
        }

        private void OnEnable()
        {
            Debug.Log("[Terrain3d] Terrain3dMessageReceiver.OnEnable");
            ResolveBridge();
            Terrain3dAndroidLog.Event("unity.bridge.ready", Terrain3dLogData.New()
                .Add("object", gameObject.name)
                .Add("via", "MessageReceiver")
                .Add("bridgeFound", bridge != null));
        }

        public void OnNewSession(string sessionId)
        {
            Debug.Log("[Terrain3d] Receiver.OnNewSession RECEIVED sessionId=" + sessionId);
            ResolveBridge();
            if (bridge == null)
            {
                Debug.LogError("[Terrain3d] Receiver.OnNewSession bridge=null");
                Terrain3dAndroidLog.EventError("unity.receiver.bridge.missing", Terrain3dLogData.New()
                    .Add("method", "OnNewSession"));
                return;
            }
            bridge.OnNewSession(sessionId);
        }

        public void OnOpenViewer(string payloadRef)
        {
            Debug.Log("[Terrain3d] Receiver.OnOpenViewer RECEIVED payloadRef=" + payloadRef);
            ResolveBridge();
            if (bridge == null)
            {
                Debug.LogError("[Terrain3d] Receiver.OnOpenViewer bridge=null");
                Terrain3dAndroidLog.EventError("unity.receiver.bridge.missing", Terrain3dLogData.New()
                    .Add("method", "OnOpenViewer"));
                return;
            }
            bridge.OnOpenViewer(payloadRef);
        }

        public void LoadEmbeddedDemoNow(string unused = "")
        {
            Debug.Log("[Terrain3d] Receiver.LoadEmbeddedDemoNow RECEIVED");
            ResolveBridge();
            if (bridge == null)
            {
                Debug.LogError("[Terrain3d] Receiver.LoadEmbeddedDemoNow bridge=null");
                return;
            }
            bridge.LoadEmbeddedDemoNow(unused);
        }

        private void ResolveBridge()
        {
            if (bridge != null) return;
            bridge = ParcelTerrain3dBridge.Instance;
            if (bridge == null)
                bridge = Object.FindObjectOfType<ParcelTerrain3dBridge>();
            Debug.Log("[Terrain3d] ResolveBridge found=" + (bridge != null));
        }
    }
}
