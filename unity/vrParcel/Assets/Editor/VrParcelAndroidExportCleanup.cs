#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

namespace ProParcel.VrParcel.Editor
{
    /// <summary>
    /// Unity 6, eski Gradle export (template v7) uzerine yazmayi reddeder.
    /// Export oncesi builds/android klasorunu temizler.
    /// </summary>
    public static class VrParcelAndroidExportCleanup
    {
        private const string ExportRoot = "builds/android";
        private const string ReadmeFile = "README.md";

        [MenuItem("ProParcel/VR/Clean Android Export Folder")]
        public static void CleanAndroidExportFolderMenu()
        {
            var removed = CleanAndroidExportFolder(out var message);
            EditorUtility.DisplayDialog(
                removed ? "Android Export Temizlendi" : "Android Export",
                message,
                "Tamam");
        }

        internal static bool CleanAndroidExportFolder(out string message)
        {
            var projectRoot = Path.GetDirectoryName(Application.dataPath);
            var exportRoot = Path.Combine(projectRoot, ExportRoot.Replace('/', Path.DirectorySeparatorChar));

            if (!Directory.Exists(exportRoot))
            {
                Directory.CreateDirectory(exportRoot);
                message = "Export klasoru olusturuldu:\n" + exportRoot;
                return true;
            }

            var removedCount = 0;
            foreach (var entry in Directory.GetFileSystemEntries(exportRoot))
            {
                var name = Path.GetFileName(entry);
                if (string.Equals(name, ReadmeFile, System.StringComparison.OrdinalIgnoreCase))
                    continue;

                if (Directory.Exists(entry))
                    Directory.Delete(entry, true);
                else
                    File.Delete(entry);

                removedCount++;
            }

            CleanXrSimulationTempAssetsSilent();
            AssetDatabase.Refresh();

            message = removedCount == 0
                ? "Export klasoru zaten bos (README haric).\n\nSimdi:\nFile → Build Settings → Export → builds/android/"
                : removedCount + " oge silindi.\n\nSimdi:\nFile → Build Settings → Export → builds/android/";
            return true;
        }

        internal static void CleanXrSimulationTempAssetsSilent()
        {
            const string tempFolder = "Assets/XR/Temp";
            if (AssetDatabase.IsValidFolder(tempFolder))
                AssetDatabase.DeleteAsset(tempFolder);
        }
    }
}
#endif
