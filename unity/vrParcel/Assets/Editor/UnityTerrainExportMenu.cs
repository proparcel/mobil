#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.Rendering;
using ProParcel.VrParcel.Editor;

namespace ProParcel.Terrain3d.Editor
{
    public static class UnityTerrainExportMenu
    {
        private const string TerrainScenePath = "Assets/Scenes/ParcelTerrain3dScene.unity";

        [MenuItem("ProParcel/Terrain3D/Configure Android Build Settings")]
        public static void ConfigureAndroidBuildSettings()
        {
            AndroidExternalToolsBootstrap.FixAndroidExternalToolsMenuSilent();
            VrParcelAndroidExportCleanup.CleanXrSimulationTempAssetsSilent();

            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            EditorUserBuildSettings.exportAsGoogleAndroidProject = true;
            EditorUserBuildSettings.androidBuildSystem = AndroidBuildSystem.Gradle;

            var scene = AssetDatabase.LoadAssetAtPath<SceneAsset>(TerrainScenePath);
            if (scene != null)
            {
                EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(TerrainScenePath, true) };
            }

            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel25;
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.OpenGLES3 });
            PlayerSettings.SplashScreen.show = false;
            PlayerSettings.SplashScreen.showUnityLogo = false;

            EditorUtility.DisplayDialog(
                "Android Build Settings (Terrain)",
                "Platform Android.\nExport Project → builds/android/\n" +
                "Build list: ParcelTerrain3dScene\n\n" +
                "Sonra: npm run validate:unity-export && npm run fix:android-native",
                "Tamam");
        }

        [MenuItem("ProParcel/Terrain3D/Clean Android Export Folder")]
        public static void CleanAndroidExportFolder()
        {
            VrParcelAndroidExportCleanup.CleanAndroidExportFolderMenu();
        }

        [MenuItem("ProParcel/Terrain3D/Fix Android JDK/SDK/Gradle Paths")]
        public static void FixAndroidPaths()
        {
            AndroidExternalToolsBootstrap.FixAndroidExternalToolsMenu();
        }
    }
}
#endif
