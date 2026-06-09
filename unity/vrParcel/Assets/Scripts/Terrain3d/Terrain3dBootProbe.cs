using UnityEngine;
using UnityEngine.SceneManagement;

namespace ProParcel.Terrain3d
{
    /** Unity IL2CPP calisiyor mu — en erken asamada logcat'e yazar. */
    public static class Terrain3dBootProbe
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void LogSubsystemRegistration()
        {
            Terrain3dAndroidLog.Info("[Terrain3dBoot] SubsystemRegistration (IL2CPP ayakta)");
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void LogBeforeSceneLoad()
        {
            Terrain3dAndroidLog.Info("[Terrain3dBoot] BeforeSceneLoad");
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void LogBootScene()
        {
            var scene = SceneManager.GetActiveScene().name;
            Terrain3dAndroidLog.Info("[Terrain3dBoot] AfterSceneLoad scene=" + scene +
                " cache=" + Application.temporaryCachePath +
                " files=" + Application.persistentDataPath);

            var router = Object.FindObjectOfType<ProParcelSceneRouter>();
            Terrain3dAndroidLog.Info("[Terrain3dBoot] ProParcelSceneRouter found=" + (router != null));

            var bridge = Object.FindObjectOfType<VrParcel.Bridge.VrParcelBridge>();
            Terrain3dAndroidLog.Info("[Terrain3dBoot] VrParcelBridge found=" + (bridge != null));

            var terrainBridge = Object.FindObjectOfType<ParcelTerrain3dBridge>();
            Terrain3dAndroidLog.Info("[Terrain3dBoot] ParcelTerrain3dBridge found=" + (terrainBridge != null));
            Debug.LogError("[Terrain3dBoot] scene=" + scene + " terrainBridge=" + (terrainBridge != null));
        }
    }
}
