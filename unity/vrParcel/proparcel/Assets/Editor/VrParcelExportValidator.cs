#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

namespace ProParcel.VrParcel.Editor
{
    public static class VrParcelExportValidator
    {
        private const string ScenePath = "Assets/Scenes/VrParcelScene.unity";
        private const string ExportAssembliesPath =
            "builds/android/unityLibrary/src/main/assets/bin/Data/ScriptingAssemblies.json";

        [MenuItem("ProParcel/VR/Validate Android Export")]
        public static void ValidateAndroidExport()
        {
            var messages = new System.Text.StringBuilder();

            if (!File.Exists(ScenePath))
            {
                messages.AppendLine("• VrParcelScene yok — ProParcel → VR → Create VrParcel Scene calistirin.");
            }

            messages.AppendLine("• XR Plug-in Management → Android → ARCore kutusunu elle kontrol edin.");

            var projectRoot = Directory.GetParent(Application.dataPath)?.FullName ?? "";
            var assembliesPath = Path.Combine(projectRoot, ExportAssembliesPath.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(assembliesPath))
            {
                messages.AppendLine("• Export henuz alinmamis: builds/android/unityLibrary yok.");
            }
            else
            {
                var json = File.ReadAllText(assembliesPath);
                if (!json.Contains("Assembly-CSharp"))
                    messages.AppendLine("• Assembly-CSharp export'ta yok — VrParcelScene build listesinde mi?");
                if (!json.Contains("Unity.XR.ARFoundation") && !json.Contains("Unity.XR.ARCore"))
                    messages.AppendLine("• AR Foundation / ARCore DLL'leri export'ta yok.");
            }

            if (messages.Length == 0)
            {
                EditorUtility.DisplayDialog("VR Export", "Android AR export hazir gorunuyor.\npm run prebuild:android:safe && npm run android", "Tamam");
                return;
            }

            EditorUtility.DisplayDialog(
                "VR Export — eksik",
                messages + "\nSonra:\nFile → Build Settings → Export → builds/android/",
                "Tamam");
        }
    }
}
#endif
