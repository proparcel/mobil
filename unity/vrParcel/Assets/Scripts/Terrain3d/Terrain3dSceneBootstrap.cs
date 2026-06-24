using UnityEngine;
using UnityEngine.SceneManagement;

namespace ProParcel.Terrain3d
{
    /** Sahne yuklendiginde bridge var mi / hangi objeler aktif — logcat teşhisi. */
    public static class Terrain3dSceneBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void OnAfterSceneLoad()
        {
            var scene = SceneManager.GetActiveScene();
            if (!scene.name.Contains("ParcelTerrain3d") &&
                !scene.path.Contains("ParcelTerrain3dScene"))
            {
                return;
            }

            Debug.Log("[Terrain3d] SceneBootstrap.AfterSceneLoad scene=" + scene.name +
                " path=" + scene.path);

            var bridge = Object.FindAnyObjectByType<ParcelTerrain3dBridge>();
            Debug.Log("[Terrain3d] SceneBootstrap bridgeFound=" + (bridge != null) +
                (bridge != null ? " name=" + bridge.gameObject.name + " active=" + bridge.gameObject.activeInHierarchy : ""));

            foreach (var root in scene.GetRootGameObjects())
                LogTree(root, 0);
        }

        private static void LogTree(GameObject go, int depth)
        {
            if (depth > 5) return;
            var indent = new string(' ', depth * 2);
            if (go.name.Contains("Bridge") || go.name.Contains("Terrain") || go.name.Contains("Parcel"))
            {
                Debug.Log("[Terrain3d] scene object:" + indent + go.name +
                    " active=" + go.activeInHierarchy);
            }
            foreach (Transform child in go.transform)
                LogTree(child.gameObject, depth + 1);
        }
    }
}
