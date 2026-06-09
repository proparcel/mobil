#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using ProParcel.Terrain3d;

namespace ProParcel.Terrain3d.Editor
{
    public static class Terrain3dSceneSetupMenu
    {
        private const string ScenePath = "Assets/Scenes/ParcelTerrain3dScene.unity";

        [MenuItem("ProParcel/Terrain3D/Create ParcelTerrain3d Scene")]
        public static void CreateParcelTerrain3dScene()
        {
            EnsureFolder("Assets/Scenes");

            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);

            var mainCam = Camera.main;
            if (mainCam != null)
            {
                mainCam.clearFlags = CameraClearFlags.SolidColor;
                mainCam.backgroundColor = TerrainSlopeColorPalette.Background;
            }

            var styleGo = new GameObject("SceneStyleController");
            var sceneStyle = styleGo.AddComponent<TerrainViewerSceneStyle>();
            if (mainCam != null)
            {
                var styleSo = new SerializedObject(sceneStyle);
                styleSo.FindProperty("targetCamera").objectReferenceValue = mainCam;
                styleSo.ApplyModifiedPropertiesWithoutUndo();
            }

            var rootGo = new GameObject("ParcelTerrain3dRoot");
            var meshGo = new GameObject("TerrainMesh");
            meshGo.transform.SetParent(rootGo.transform, false);
            var meshFilter = meshGo.AddComponent<MeshFilter>();
            var meshRenderer = meshGo.AddComponent<MeshRenderer>();

            var vertexMat = AssetDatabase.LoadAssetAtPath<Material>(
                "Assets/Materials/ProParcelTerrainVertexColor.mat");

            var borderGo = new GameObject("ParcelBorder");
            borderGo.transform.SetParent(meshGo.transform, false);
            var borderRenderer = borderGo.AddComponent<ParcelBorderLineRenderer>();

            var orbitGo = new GameObject("OrbitCamera");
            orbitGo.transform.SetParent(rootGo.transform, false);
            var orbit = orbitGo.AddComponent<TerrainOrbitCamera>();
            if (mainCam != null)
            {
                var so = new SerializedObject(orbit);
                so.FindProperty("targetCamera").objectReferenceValue = mainCam;
                so.ApplyModifiedPropertiesWithoutUndo();
            }

            var bridgeGo = new GameObject("ParcelTerrain3dBridge");
            var bridge = bridgeGo.AddComponent<ParcelTerrain3dBridge>();
            bridgeGo.AddComponent<Terrain3dDebugOverlay>();
            var errorUiGo = new GameObject("Terrain3dErrorUi");
            errorUiGo.AddComponent<Terrain3dErrorUi>();
            var bridgeSo = new SerializedObject(bridge);
            bridgeSo.FindProperty("meshFilter").objectReferenceValue = meshFilter;
            bridgeSo.FindProperty("meshRenderer").objectReferenceValue = meshRenderer;
            bridgeSo.FindProperty("terrainVertexColorMaterial").objectReferenceValue = vertexMat;
            bridgeSo.FindProperty("borderRenderer").objectReferenceValue = borderRenderer;
            bridgeSo.FindProperty("orbitCamera").objectReferenceValue = orbit;
            bridgeSo.ApplyModifiedPropertiesWithoutUndo();

            EditorSceneManager.SaveScene(scene, ScenePath);

            var scenes = EditorBuildSettings.scenes;
            var list = new System.Collections.Generic.List<EditorBuildSettingsScene>(scenes);
            bool found = false;
            for (int i = 0; i < list.Count; i++)
            {
                if (list[i].path == ScenePath)
                {
                    found = true;
                    break;
                }
            }
            if (!found)
            {
                list.Add(new EditorBuildSettingsScene(ScenePath, true));
                EditorBuildSettings.scenes = list.ToArray();
            }

            EditorUtility.DisplayDialog(
                "Parcel Terrain 3D",
                "ParcelTerrain3dScene olusturuldu.\n" +
                "ProParcel → Terrain3D → Build Settings — Terrain Only (index 0, demo)\n" +
                "sonra Validate Android Export + File → Build Settings → Export.",
                "Tamam");
        }

        [MenuItem("ProParcel/Terrain3D/Build Settings — Terrain Only (index 0, demo)")]
        public static void SetTerrainOnlyBuildSettings()
        {
            if (!File.Exists(ScenePath))
            {
                EditorUtility.DisplayDialog(
                    "Parcel Terrain 3D",
                    "Once ProParcel → Terrain3D → Create ParcelTerrain3d Scene calistirin.",
                    "Tamam");
                return;
            }

            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(ScenePath, true),
            };
            Debug.Log("[Terrain3D] Build Settings: yalnizca ParcelTerrain3dScene (index 0) — gomulu demo.");
        }

        [MenuItem("ProParcel/Terrain3D/Validate Android Export")]
        public static void ValidateAndroidTerrainExport()
        {
            var messages = new System.Text.StringBuilder();
            var terrainScene = ScenePath;

            if (!File.Exists(terrainScene))
                messages.AppendLine("• ParcelTerrain3dScene yok — ProParcel → Terrain3D → Create ParcelTerrain3d Scene");

            var scenes = EditorBuildSettings.scenes;
            bool terrainIndex0 = scenes.Length > 0 && scenes[0].path == terrainScene;
            if (!terrainIndex0)
            {
                messages.AppendLine("• Build index 0 ParcelTerrain3dScene olmali");
                messages.AppendLine("  (ProParcel → Terrain3D → Build Settings — Terrain Only)");
            }

            var projectRoot = Directory.GetParent(Application.dataPath)?.FullName ?? "";
            var metadataPath = Path.Combine(
                projectRoot,
                "builds/android/unityLibrary/src/main/assets/bin/Data/Managed/Metadata/global-metadata.dat");
            if (!File.Exists(metadataPath))
            {
                messages.AppendLine("• Export yok — File → Build Settings → Export → builds/android/");
            }
            else
            {
                var meta = File.ReadAllText(metadataPath);
                if (!meta.Contains("ParcelTerrain3dScene"))
                    messages.AppendLine("• Export eski — ParcelTerrain3dScene metadata'da yok; yeniden export alin");
                if (!meta.Contains("ParcelTerrain3dBridge"))
                    messages.AppendLine("• Export eski — ParcelTerrain3dBridge metadata'da yok");
                if (!meta.Contains("TerrainPayloadIO"))
                    messages.AppendLine("• Export eski — TerrainPayloadIO yok; scriptler eklendikten sonra yeniden export alin");
                if (!meta.Contains("TerrainSlopeColorPalette"))
                    messages.AppendLine("• Export eski — TerrainSlopeColorPalette yok; vertex color paleti export'a girmemis");
                if (!meta.Contains("ProParcel/TerrainVertexColor") && !meta.Contains("TerrainVertexColor"))
                    messages.AppendLine("• Export eski — ProParcel/TerrainVertexColor shader export'a girmemis");
            }

            if (messages.Length == 0)
            {
                EditorUtility.DisplayDialog(
                    "Terrain Export",
                    "Android terrain export hazir gorunuyor.\nnpm run android",
                    "Tamam");
                return;
            }

            EditorUtility.DisplayDialog("Terrain Export — eksik", messages.ToString(), "Tamam");
        }

        [MenuItem("ProParcel/Terrain3D/Ensure Vertex Color Shader Included")]
        public static void EnsureVertexColorShaderIncluded()
        {
            var shader = Shader.Find("ProParcel/TerrainVertexColor");
            if (shader == null)
            {
                EditorUtility.DisplayDialog(
                    "Terrain Shader",
                    "ProParcel/TerrainVertexColor shader bulunamadi.\nAssets/Shaders/ProParcelVertexColor.shader var mi?",
                    "Tamam");
                return;
            }

            var graphicsSettings = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset");
            if (graphicsSettings == null || graphicsSettings.Length == 0)
            {
                EditorUtility.DisplayDialog("Terrain Shader", "GraphicsSettings.asset bulunamadi.", "Tamam");
                return;
            }

            var so = new SerializedObject(graphicsSettings[0]);
            var prop = so.FindProperty("m_AlwaysIncludedShaders");
            if (prop == null)
            {
                EditorUtility.DisplayDialog("Terrain Shader", "m_AlwaysIncludedShaders bulunamadi.", "Tamam");
                return;
            }

            for (int i = 0; i < prop.arraySize; i++)
            {
                if (prop.GetArrayElementAtIndex(i).objectReferenceValue == shader)
                {
                    EditorUtility.DisplayDialog(
                        "Terrain Shader",
                        "ProParcel/TerrainVertexColor zaten Always Included Shaders listesinde.",
                        "Tamam");
                    return;
                }
            }

            prop.InsertArrayElementAtIndex(prop.arraySize);
            prop.GetArrayElementAtIndex(prop.arraySize - 1).objectReferenceValue = shader;
            so.ApplyModifiedPropertiesWithoutUndo();
            AssetDatabase.SaveAssets();

            EditorUtility.DisplayDialog(
                "Terrain Shader",
                "ProParcel/TerrainVertexColor Always Included Shaders listesine eklendi.\nSimdi Android export alin.",
                "Tamam");
        }

        private static void EnsureFolder(string path)
        {
            if (!AssetDatabase.IsValidFolder(path))
            {
                var parent = Path.GetDirectoryName(path)?.Replace("\\", "/");
                var leaf = Path.GetFileName(path);
                if (!string.IsNullOrEmpty(parent) && !string.IsNullOrEmpty(leaf))
                {
                    AssetDatabase.CreateFolder(parent, leaf);
                }
            }
        }
    }
}
#endif
