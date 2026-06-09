using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using Unity.XR.CoreUtils;

namespace ProParcel.VrParcel.AR
{
    public class VrArSessionController : MonoBehaviour
    {
        [SerializeField] private ARSession arSession;
        [SerializeField] private XROrigin xrOrigin;
        [SerializeField] private ARPlaneManager planeManager;
        [SerializeField] private AROcclusionManager occlusionManager;
        [SerializeField] private ARMeshManager meshManager;
        [SerializeField] private ARAnchorManager anchorManager;

        public Camera ArCamera => xrOrigin != null ? xrOrigin.Camera : Camera.main;
        public XROrigin GetXROrigin() => xrOrigin;
        public ARAnchorManager AnchorManager => anchorManager;
        public bool IsSessionReady =>
            arSession != null && arSession.subsystem != null && arSession.subsystem.running;

        private void Awake()
        {
            if (planeManager != null)
                planeManager.requestedDetectionMode = PlaneDetectionMode.Horizontal;
        }

        public void ConfigureForMode(string mode)
        {
            bool lidarMode = mode == "lidar_precise";

            if (meshManager != null)
                meshManager.enabled = lidarMode;

            if (occlusionManager != null)
                occlusionManager.enabled = lidarMode;

            if (planeManager != null)
                planeManager.requestedDetectionMode = PlaneDetectionMode.Horizontal;

            EnsureArCameraFeed();
        }

        public void EnsureArCameraFeed()
        {
            var bootstrap = FindObjectOfType<VrArBootstrap>();
            if (bootstrap != null)
            {
                bootstrap.EnsureArCameraFeed();
                return;
            }

            if (arSession != null && !arSession.enabled)
                arSession.enabled = true;

            var cam = ArCamera;
            if (cam == null) return;

            var background = cam.GetComponent<ARCameraBackground>();
            if (background != null)
                background.enabled = true;

            cam.clearFlags = CameraClearFlags.Depth;
            cam.backgroundColor = Color.black;
        }

        public void ResetSession()
        {
            if (arSession != null)
                arSession.Reset();
        }

        public Vector3 GetCameraWorldPosition()
        {
            return ArCamera != null ? ArCamera.transform.position : Vector3.zero;
        }
    }
}
