using UnityEngine;
using UnityEngine.XR.ARFoundation;

namespace ProParcel.VrParcel.AR
{
    /// <summary>
    /// Sahne kurulumunda ARInputManager + TrackedPoseDriver unutulursa runtime'da uyarir.
    /// </summary>
    [DefaultExecutionOrder(-200)]
    public class VrArTrackingSetup : MonoBehaviour
    {
        [SerializeField] private ARSession arSession;
        [SerializeField] private Camera arCamera;

        private void Awake()
        {
            if (arSession == null)
                arSession = FindObjectOfType<ARSession>();
            if (arCamera == null)
                arCamera = Camera.main;

            if (FindObjectOfType<ARInputManager>() == null)
            {
                Debug.LogError(
                    "[VrArTrackingSetup] ARInputManager yok — kamera hareket etmez, parsel ekrana yapışır. " +
                    "ProParcel → VR → Create VrParcel Scene ile sahneyi yeniden oluşturun.");
            }

            if (arCamera != null && arCamera.GetComponent<UnityEngine.SpatialTracking.TrackedPoseDriver>() == null)
            {
                Debug.LogError(
                    "[VrArTrackingSetup] Main Camera'da TrackedPoseDriver yok — 6DOF takip çalışmaz. " +
                    "Create VrParcel Scene + yeni Android export gerekli.");
            }
        }
    }
}
