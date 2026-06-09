#if UNITY_EDITOR
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SpatialTracking;
using UnityEngine.XR.ARFoundation;
using Unity.XR.CoreUtils;
using ProParcel.VrParcel.AR;
using ProParcel.VrParcel.Bridge;
using ProParcel.VrParcel.Calibration;
using ProParcel.VrParcel.Rendering;
using ProParcel.VrParcel.UI;
using ProParcel.Terrain3d;
using TMPro;

namespace ProParcel.VrParcel.Editor
{
    public static class VrParcelSceneSetupMenu
    {
        private const string ScenePath = "Assets/Scenes/VrParcelScene.unity";

        [MenuItem("ProParcel/VR/Create VrParcel Scene")]
        public static void CreateVrParcelScene()
        {
            EnsureFolder("Assets/Scenes");
            EnsureFolder("Assets/Materials");

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var arSessionGo = new GameObject("AR Session");
            arSessionGo.AddComponent<ARSession>();
            arSessionGo.AddComponent<ARInputManager>();
            arSessionGo.AddComponent<VrArBootstrap>();
            arSessionGo.AddComponent<VrArTrackingSetup>();

            var originGo = new GameObject("XR Origin");
            var xrOrigin = originGo.AddComponent<XROrigin>();
            var planeManager = originGo.AddComponent<ARPlaneManager>();
            planeManager.planePrefab = null;
            var raycastManager = originGo.AddComponent<ARRaycastManager>();
            originGo.AddComponent<ARAnchorManager>();
            var occlusionManager = originGo.AddComponent<AROcclusionManager>();

            var cameraOffsetGo = new GameObject("Camera Offset");
            cameraOffsetGo.transform.SetParent(originGo.transform, false);
            xrOrigin.CameraFloorOffsetObject = cameraOffsetGo;

            var cameraGo = new GameObject("Main Camera");
            cameraGo.tag = "MainCamera";
            cameraGo.transform.SetParent(cameraOffsetGo.transform, false);
            var camera = cameraGo.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = Color.black;
            cameraGo.AddComponent<ARCameraManager>();
            cameraGo.AddComponent<ARCameraBackground>();
            ConfigureTrackedPoseDriver(cameraGo);
            xrOrigin.Camera = camera;

            var meshGo = new GameObject("AR Mesh Manager");
            meshGo.transform.SetParent(originGo.transform, false);
            var meshManager = meshGo.AddComponent<ARMeshManager>();
            meshManager.enabled = false;

            var arControllerGo = new GameObject("VrArSessionController");
            var arController = arControllerGo.AddComponent<VrArSessionController>();
            SetSerialized(arController, "arSession", arSessionGo.GetComponent<ARSession>());
            SetSerialized(arController, "xrOrigin", xrOrigin);
            SetSerialized(arController, "planeManager", planeManager);
            SetSerialized(arController, "occlusionManager", occlusionManager);
            SetSerialized(arController, "meshManager", meshManager);
            SetSerialized(arController, "anchorManager", originGo.GetComponent<ARAnchorManager>());

            var readinessGo = new GameObject("VrArReadinessMonitor");
            var readiness = readinessGo.AddComponent<VrArReadinessMonitor>();
            SetSerialized(readiness, "arSession", arSessionGo.GetComponent<ARSession>());
            SetSerialized(readiness, "planeManager", planeManager);
            SetSerialized(readiness, "raycastManager", raycastManager);
            SetSerialized(readiness, "arCamera", camera);

            var bootstrap = arSessionGo.GetComponent<VrArBootstrap>();
            SetSerialized(bootstrap, "arSession", arSessionGo.GetComponent<ARSession>());
            SetSerialized(bootstrap, "xrOrigin", xrOrigin);
            SetSerialized(bootstrap, "planeManager", planeManager);

            var trackingSetup = arSessionGo.GetComponent<VrArTrackingSetup>();
            SetSerialized(trackingSetup, "arSession", arSessionGo.GetComponent<ARSession>());
            SetSerialized(trackingSetup, "arCamera", camera);

            var worldRootGo = new GameObject("VrParcelWorldRoot");
            worldRootGo.AddComponent<VrParcelWorldRoot>();

            var anchorPrefab = EnsureAnchorPrefab();
            originGo.GetComponent<ARAnchorManager>().anchorPrefab = anchorPrefab;

            var lineMaterial = CreateLineMaterial();

            var parcelRendererGo = new GameObject("ParcelBorderRenderer");
            parcelRendererGo.transform.SetParent(worldRootGo.transform, false);
            var parcelRenderer = parcelRendererGo.AddComponent<ParcelBorderRenderer>();
            SetSerialized(parcelRenderer, "lineMaterial", lineMaterial);

            var captureGo = new GameObject("ReferencePointCapture");
            var capture = captureGo.AddComponent<ReferencePointCapture>();
            SetSerialized(capture, "raycastManager", raycastManager);
            SetSerialized(capture, "planeManager", planeManager);
            SetSerialized(capture, "occlusionManager", occlusionManager);
            SetSerialized(capture, "arCamera", camera);

            var bridgeGo = new GameObject("VrParcelBridge");
            var bridge = bridgeGo.AddComponent<VrParcelBridge>();
            SetSerialized(bridge, "referenceCapture", capture);
            SetSerialized(bridge, "parcelRenderer", parcelRenderer);
            SetSerialized(bridge, "arSessionController", arController);

            var routerGo = new GameObject("ProParcelSceneRouter");
            routerGo.AddComponent<ProParcelSceneRouter>();

            var canvasGo = CreateUiCanvas(out var uiController);
            SetSerialized(bridge, "uiController", uiController);
            SetSerialized(uiController, "referenceCapture", capture);

            EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.SaveAssets();
            EditorUtility.DisplayDialog(
                "VR Parsel Sahnesi",
                "VrParcelScene oluşturuldu.\n\n" +
                "Build Settings → iOS → bu sahneyi ekleyin.\n" +
                "Player Settings → XR Plug-in Management → ARKit etkinleştirin.\n" +
                "Ardından iOS export alın (builds/ios).",
                "Tamam");
        }

        [MenuItem("ProParcel/VR/Configure Android Build Settings")]
        public static void ConfigureAndroidBuildSettings()
        {
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            EditorUserBuildSettings.exportAsGoogleAndroidProject = true;
            EditorUserBuildSettings.androidBuildSystem = AndroidBuildSystem.Gradle;

            var scene = AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath);
            if (scene != null)
            {
                EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            }

            PlayerSettings.SetScriptingBackend(BuildTargetGroup.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            // S25 ve modern cihazlar arm64-v8a — yalnizca ARMv7 export RN entegrasyonunda calismaz.
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            // ARCore Vulkan desteklemez — yalnizca OpenGLES3
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.OpenGLES3 });
            // VR dokunusu RN native katmandan gelir; Input System paketi yoksa da derlenir
            TrySetActiveInputHandlerInputManagerOnly();
            PlayerSettings.SplashScreen.show = false;
            PlayerSettings.SplashScreen.showUnityLogo = false;

            EditorUtility.DisplayDialog(
                "Android Build Settings",
                "Platform Android seçildi.\n" +
                "Export Project (Gradle) etkin.\n" +
                "Scripting Backend: IL2CPP\n" +
                "Target Architectures: ARM64\n" +
                "Graphics API: OpenGLES3 (Vulkan kapali — ARCore zorunlu)\n\n" +
                "Export hedefi:\n" +
                "unity/vrParcel/builds/android/\n\n" +
                "Sonra Windows'ta:\n" +
                "npm run android",
                "Tamam");
        }

        [MenuItem("ProParcel/VR/Configure iOS Build Settings")]
        public static void ConfigureIosBuildSettings()
        {
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.iOS, BuildTarget.iOS);
            EditorUserBuildSettings.iOSXcodeBuildConfig = XcodeBuildConfig.Release;

            var scene = AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath);
            if (scene != null)
            {
                var scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
                EditorBuildSettings.scenes = scenes;
            }

            PlayerSettings.SetScriptingBackend(BuildTargetGroup.iOS, ScriptingImplementation.IL2CPP);
            PlayerSettings.iOS.targetOSVersionString = "15.0";

            EditorUtility.DisplayDialog(
                "iOS Build Settings",
                "Platform iOS seçildi.\n" +
                "VrParcelScene build listesine eklendi.\n\n" +
                "Export: File → Build Settings → Export Project\n" +
                "Hedef: ../builds/ios (unity/vrParcel/builds/ios)",
                "Tamam");
        }

        private static void ConfigureTrackedPoseDriver(GameObject cameraGo)
        {
            var driver = cameraGo.AddComponent<TrackedPoseDriver>();
            driver.trackingType = TrackedPoseDriver.TrackingType.RotationAndPosition;
            driver.updateType = TrackedPoseDriver.UpdateType.UpdateAndBeforeRender;
            driver.SetPoseSource(
                TrackedPoseDriver.DeviceType.GenericXRDevice,
                TrackedPoseDriver.TrackedPose.Center);
        }

        private static GameObject EnsureAnchorPrefab()
        {
            EnsureFolder("Assets/Prefabs");
            var prefabPath = "Assets/Prefabs/VrArAnchor.prefab";
            var existing = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);
            if (existing != null) return existing;

            var go = new GameObject("VrArAnchor");
            go.AddComponent<ARAnchor>();
            var prefab = PrefabUtility.SaveAsPrefabAsset(go, prefabPath);
            Object.DestroyImmediate(go);
            return prefab;
        }

        private static Material CreateLineMaterial()
        {
            var matPath = "Assets/Materials/VrParcelLine.mat";
            var existing = AssetDatabase.LoadAssetAtPath<Material>(matPath);
            if (existing != null) return existing;

            var shader = Shader.Find("Sprites/Default");
            var mat = new Material(shader) { color = new Color(0.23f, 0.51f, 0.96f, 0.95f) };
            AssetDatabase.CreateAsset(mat, matPath);
            return mat;
        }

        private static GameObject CreateUiCanvas(out VrStepUiController controller)
        {
            var canvasGo = new GameObject("Canvas");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvasGo.AddComponent<UnityEngine.UI.CanvasScaler>();
            canvasGo.AddComponent<UnityEngine.UI.GraphicRaycaster>();

            var title = CreateTmpText(canvasGo.transform, "TitleText", new Vector2(0, -40), 22);
            var message = CreateTmpText(canvasGo.transform, "MessageText", new Vector2(0, -90), 16);
            var status = CreateTmpText(canvasGo.transform, "StatusText", new Vector2(0, -140), 14);

            controller = canvasGo.AddComponent<VrStepUiController>();
            SetSerialized(controller, "titleText", title);
            SetSerialized(controller, "messageText", message);
            SetSerialized(controller, "statusText", status);

            return canvasGo;
        }

        private static TextMeshProUGUI CreateTmpText(Transform parent, string name, Vector2 anchoredPos, float fontSize)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var rect = go.AddComponent<RectTransform>();
            rect.anchorMin = new Vector2(0.5f, 1f);
            rect.anchorMax = new Vector2(0.5f, 1f);
            rect.pivot = new Vector2(0.5f, 1f);
            rect.sizeDelta = new Vector2(680, 80);
            rect.anchoredPosition = anchoredPos;
            var tmp = go.AddComponent<TextMeshProUGUI>();
            tmp.fontSize = fontSize;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.color = Color.white;
            tmp.text = name;
            return tmp;
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

        private static void SetSerialized(Object target, string fieldName, Object value)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop != null)
            {
                prop.objectReferenceValue = value;
                so.ApplyModifiedPropertiesWithoutUndo();
            }
        }

        /** Input System paketi kurulu degilken ActiveInputHandler enum derlenmez — reflection ile ayarla. */
        private static void TrySetActiveInputHandlerInputManagerOnly()
        {
            var prop = typeof(PlayerSettings).GetProperty(
                "activeInputHandler",
                BindingFlags.Static | BindingFlags.Public);
            if (prop == null) return;

            object inputManager;
            try
            {
                inputManager = System.Enum.Parse(prop.PropertyType, "InputManager");
            }
            catch
            {
                return;
            }

            prop.SetValue(null, inputManager);
        }
    }
}
#endif
