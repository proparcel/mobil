using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace ProParcel.Terrain3d
{
    /** Sahne acilinca gomulu demo yukler — sahnedeki SerializeField false kalsa bile. */
    internal sealed class Terrain3dEmbeddedDemoBootRunner : MonoBehaviour
    {
        private IEnumerator Start()
        {
            yield return null;
            yield return null;

            var bridge = Object.FindObjectOfType<ParcelTerrain3dBridge>();
            if (bridge != null)
            {
                bridge.LoadEmbeddedDemoNow();
            }
            else
            {
                Debug.LogError("[Terrain3dEmbeddedDemoBoot] ParcelTerrain3dBridge yok");
            }

            Destroy(gameObject);
        }
    }

    public static class Terrain3dEmbeddedDemoBoot
    {
        /** Activity UnitySendMessage ile yukler — otomatik demo boot kapali. */
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void ScheduleEmbeddedDemoLoad()
        {
            // TerrainUnityActivity schedulePayloadDelivery kontrol eder.
        }
    }
}
