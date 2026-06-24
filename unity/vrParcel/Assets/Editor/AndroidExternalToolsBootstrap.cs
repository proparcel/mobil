#if UNITY_EDITOR
using System;
using System.IO;
using UnityEditor;
using UnityEditor.Android;
using UnityEngine;

namespace ProParcel.VrParcel.Editor
{
    /// <summary>
    /// Unity 6 Android export oncesi JDK/SDK/Gradle/NDK yollarini dogrular.
    /// Edit → Preferences → External Tools ile ayni ayarlari makineye gore doldurur.
    /// </summary>
    [InitializeOnLoad]
    public static class AndroidExternalToolsBootstrap
    {
        static AndroidExternalToolsBootstrap()
        {
            EditorApplication.delayCall += EnsureAndroidExternalToolsOnce;
        }

        [MenuItem("ProParcel/VR/Fix Android JDK/SDK/Gradle Paths")]
        public static void FixAndroidExternalToolsMenu()
        {
            if (TryEnsureAndroidExternalTools(out var message))
            {
                EditorUtility.DisplayDialog("Android External Tools", message, "Tamam");
            }
            else
            {
                EditorUtility.DisplayDialog(
                    "Android External Tools",
                    message + "\n\nManuel: Edit → Preferences → External Tools\n" +
                    "JDK: JDK 17 (orn. Eclipse Temurin 17)\n" +
                    "Gradle: Installed with Unity (recommended)",
                    "Tamam");
            }
        }

        public static void FixAndroidExternalToolsMenuSilent()
        {
            TryEnsureAndroidExternalTools(out _);
        }

        private static void EnsureAndroidExternalToolsOnce()
        {
            TryEnsureAndroidExternalTools(out _);
        }

        // Unity 6.4 Android modulu bu NDK surumunu bekler (r27c).
        private static readonly string[] PreferredNdkVersions =
        {
            "27.2.12479018",
            "27.3.13750724",
        };

        private static bool TryEnsureAndroidExternalTools(out string message)
        {
            var changed = false;
            var notes = new System.Text.StringBuilder();

            var jdk = ResolveJdkRoot();
            if (IsValidJdk(jdk) &&
                !PathsEqual(AndroidExternalToolsSettings.jdkRootPath, jdk))
            {
                AndroidExternalToolsSettings.jdkRootPath = jdk;
                changed = true;
                notes.AppendLine("• JDK: " + jdk);
            }

            var sdk = ResolveAndroidSdkRoot();
            if (!string.IsNullOrEmpty(sdk) &&
                Directory.Exists(sdk) &&
                !PathsEqual(AndroidExternalToolsSettings.sdkRootPath, sdk))
            {
                AndroidExternalToolsSettings.sdkRootPath = sdk;
                changed = true;
                notes.AppendLine("• Android SDK: " + sdk);
            }

            var gradle = ResolveGradleRoot();
            if (IsValidGradleRoot(gradle) &&
                !PathsEqual(AndroidExternalToolsSettings.Gradle.path, gradle))
            {
                AndroidExternalToolsSettings.Gradle.path = gradle;
                changed = true;
                notes.AppendLine("• Gradle: " + gradle);
            }

            var ndk = ResolveNdkRoot(sdk);
            if (IsValidNdk(ndk) &&
                !PathsEqual(AndroidExternalToolsSettings.ndkRootPath, ndk))
            {
                try
                {
                    AndroidExternalToolsSettings.ndkRootPath = ndk;
                    changed = true;
                    notes.AppendLine("• Android NDK: " + ndk);
                }
                catch (Exception ex)
                {
                    notes.AppendLine("• NDK ayarlanamadi: " + ex.Message);
                }
            }

            if (!IsValidJdk(AndroidExternalToolsSettings.jdkRootPath))
            {
                message =
                    "Gecerli JDK bulunamadi.\n" +
                    "JAVA_HOME veya JDK 17 kurulumu gerekli.\n" +
                    "Ornek: C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.17.10-hotspot";
                return false;
            }

            if (!IsValidGradleRoot(AndroidExternalToolsSettings.Gradle.path))
            {
                message =
                    "Gradle yolu bulunamadi.\n" +
                    "Unity Android Build Support modulunun kurulu oldugundan emin olun.\n" +
                    "Manuel: Edit → Preferences → External Tools → Gradle → Installed with Unity";
                return false;
            }

            message = changed
                ? "Android External Tools guncellendi:\n" + notes
                : "Android External Tools hazir.\n" +
                  "JDK: " + AndroidExternalToolsSettings.jdkRootPath + "\n" +
                  "Gradle: " + AndroidExternalToolsSettings.Gradle.path + "\n" +
                  "NDK: " + AndroidExternalToolsSettings.ndkRootPath;
            return true;
        }

        private static string ResolveJdkRoot()
        {
            if (IsValidJdk(AndroidExternalToolsSettings.jdkRootPath))
                return AndroidExternalToolsSettings.jdkRootPath;

            var javaHome = Environment.GetEnvironmentVariable("JAVA_HOME");
            if (IsValidJdk(javaHome))
                return javaHome;

            var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            try
            {
                var adoptiumRoot = Path.Combine(programFiles, "Eclipse Adoptium");
                if (Directory.Exists(adoptiumRoot))
                {
                    foreach (var dir in Directory.GetDirectories(adoptiumRoot, "jdk-17*"))
                    {
                        if (IsValidJdk(dir))
                            return dir;
                    }
                }
            }
            catch
            {
                // ignore
            }

            var unityOpenJdk = Path.GetFullPath(Path.Combine(
                EditorApplication.applicationContentsPath,
                "PlaybackEngines",
                "AndroidPlayer",
                "OpenJDK"));
            if (IsValidJdk(unityOpenJdk))
                return unityOpenJdk;

            var studioJbr = Path.Combine(programFiles, "Android", "Android Studio", "jbr");
            if (IsValidJdk(studioJbr))
                return studioJbr;

            return null;
        }

        private static string ResolveAndroidSdkRoot()
        {
            if (!string.IsNullOrEmpty(AndroidExternalToolsSettings.sdkRootPath) &&
                Directory.Exists(AndroidExternalToolsSettings.sdkRootPath))
            {
                return AndroidExternalToolsSettings.sdkRootPath;
            }

            var androidHome = Environment.GetEnvironmentVariable("ANDROID_HOME") ??
                              Environment.GetEnvironmentVariable("ANDROID_SDK_ROOT");
            if (!string.IsNullOrEmpty(androidHome) && Directory.Exists(androidHome))
                return androidHome;

            var defaultSdk = @"C:\Android\Sdk";
            if (Directory.Exists(defaultSdk))
                return defaultSdk;

            return null;
        }

        private static string ResolveGradleRoot()
        {
            if (IsValidGradleRoot(AndroidExternalToolsSettings.Gradle.path))
                return AndroidExternalToolsSettings.Gradle.path;

            var unityGradle = Path.GetFullPath(Path.Combine(
                EditorApplication.applicationContentsPath,
                "PlaybackEngines",
                "AndroidPlayer",
                "Tools",
                "gradle"));
            if (IsValidGradleRoot(unityGradle))
                return unityGradle;

            return null;
        }

        private static string ResolveNdkRoot(string sdkRoot)
        {
            var current = AndroidExternalToolsSettings.ndkRootPath;
            if (IsPreferredNdk(current))
                return current;

            if (!string.IsNullOrEmpty(sdkRoot))
            {
                foreach (var version in PreferredNdkVersions)
                {
                    var candidate = Path.Combine(sdkRoot, "ndk", version);
                    if (IsValidNdk(candidate))
                        return candidate;
                }

                var ndkParent = Path.Combine(sdkRoot, "ndk");
                if (Directory.Exists(ndkParent))
                {
                    try
                    {
                        string best = null;
                        foreach (var dir in Directory.GetDirectories(ndkParent))
                        {
                            if (!IsValidNdk(dir))
                                continue;
                            if (best == null ||
                                string.Compare(dir, best, StringComparison.OrdinalIgnoreCase) > 0)
                            {
                                best = dir;
                            }
                        }

                        if (best != null)
                            return best;
                    }
                    catch
                    {
                        // ignore
                    }
                }
            }

            return IsValidNdk(current) ? current : null;
        }

        private static bool IsPreferredNdk(string path)
        {
            if (!IsValidNdk(path))
                return false;

            var folder = Path.GetFileName(path.TrimEnd('\\', '/'));
            foreach (var version in PreferredNdkVersions)
            {
                if (string.Equals(folder, version, StringComparison.OrdinalIgnoreCase))
                    return true;
            }

            return false;
        }

        private static bool IsValidGradleRoot(string path)
        {
            if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
                return false;

            try
            {
                return Directory.GetFiles(
                    Path.Combine(path, "lib"),
                    "gradle-launcher-*.jar").Length > 0;
            }
            catch
            {
                return false;
            }
        }

        private static bool IsValidNdk(string path)
        {
            return !string.IsNullOrWhiteSpace(path) &&
                   File.Exists(Path.Combine(path, "ndk-build.cmd"));
        }

        private static bool IsValidJdk(string path)
        {
            return !string.IsNullOrWhiteSpace(path) &&
                   File.Exists(Path.Combine(path, "bin", "java.exe"));
        }

        private static bool PathsEqual(string a, string b)
        {
            if (string.IsNullOrWhiteSpace(a) || string.IsNullOrWhiteSpace(b))
                return false;
            try
            {
                return string.Equals(
                    Path.GetFullPath(a).TrimEnd('\\', '/'),
                    Path.GetFullPath(b).TrimEnd('\\', '/'),
                    StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }
    }
}
#endif
