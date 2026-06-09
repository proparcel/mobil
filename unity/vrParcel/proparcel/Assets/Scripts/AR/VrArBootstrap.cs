using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.XR.ARFoundation;
using Unity.XR.CoreUtils;

namespace ProParcel.VrParcel.AR
{
    /// <summary>
    /// Embedded RN view: AR kamera arka plani, splash kapatma, Unity UI/skybox gizleme.
    /// </summary>
    [DefaultExecutionOrder(-100)]
    public class VrArBootstrap : MonoBehaviour
    {
        [SerializeField] private ARSession arSession;
        [SerializeField] private XROrigin xrOrigin;
        [SerializeField] private ARPlaneManager planeManager;
        [SerializeField] private bool hideUnityUi = true;

        private void Awake()
        {
            StopUnitySplash();
            DisableSkyAndAmbient();
            HideUnityOverlayUi();
            BindSessionReferences();
            HidePlaneVisuals();
        }

        private void OnEnable()
        {
            EnsureArCameraFeed();
        }

        public void EnsureArCameraFeed()
        {
            StopUnitySplash();
            DisableSkyAndAmbient();
            HideUnityOverlayUi();
            HidePlaneVisuals();

            if (arSession != null && !arSession.enabled)
                arSession.enabled = true;

            var cam = xrOrigin != null ? xrOrigin.Camera : Camera.main;
            if (cam == null) return;

            var background = cam.GetComponent<ARCameraBackground>();
            if (background != null)
                background.enabled = true;

            cam.clearFlags = CameraClearFlags.Depth;
            cam.backgroundColor = Color.black;
        }

        private void BindSessionReferences()
        {
            if (arSession == null)
                arSession = FindObjectOfType<ARSession>();
            if (xrOrigin == null)
                xrOrigin = FindObjectOfType<XROrigin>();
            if (planeManager == null)
                planeManager = FindObjectOfType<ARPlaneManager>();
        }

        private static void StopUnitySplash()
        {
#if !UNITY_EDITOR
            try
            {
                SplashScreen.Stop(SplashScreen.StopBehavior.StopImmediate);
            }
            catch
            {
                // optional
            }
#endif
        }

        private static void DisableSkyAndAmbient()
        {
            RenderSettings.skybox = null;
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = Color.black;
        }

        private void HideUnityOverlayUi()
        {
            if (!hideUnityUi) return;
            var canvases = FindObjectsOfType<Canvas>(true);
            foreach (var canvas in canvases)
                canvas.gameObject.SetActive(false);
        }

        private void HidePlaneVisuals()
        {
            if (planeManager == null) return;
            HideAllPlaneMeshes();
        }

        private void Update()
        {
            HideAllPlaneMeshes();
        }

        private void HideAllPlaneMeshes()
        {
            if (planeManager == null) return;
            foreach (var plane in planeManager.trackables)
            {
                foreach (var renderer in plane.GetComponentsInChildren<MeshRenderer>(true))
                    renderer.enabled = false;
                foreach (var line in plane.GetComponentsInChildren<LineRenderer>(true))
                    line.enabled = false;
            }
        }
    }
}
