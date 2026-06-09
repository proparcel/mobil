using UnityEngine;
using UnityEngine.XR.ARFoundation;

namespace ProParcel.VrParcel.Rendering
{
    /// <summary>
    /// Parsel kökü sahne kökünde veya ARAnchor altında kalmalı — asla XR Origin altına alinmaz
    /// (XR Origin cihazla birlikte hareket eder, ekrana yapışik cizim yapar).
    /// </summary>
    public class VrParcelWorldRoot : MonoBehaviour
    {
        public static VrParcelWorldRoot Instance { get; private set; }

        private ARAnchor _sessionAnchor;

        public Transform Root => transform;
        public bool IsAnchored => _sessionAnchor != null;

        private void Awake()
        {
            Instance = this;
        }

        public void ResetToSceneRoot()
        {
            ClearSessionAnchor();
            transform.SetParent(null);
            transform.localPosition = Vector3.zero;
            transform.localRotation = Quaternion.identity;
            transform.localScale = Vector3.one;
        }

        public void ClearSessionAnchor()
        {
            if (_sessionAnchor != null)
            {
                Destroy(_sessionAnchor.gameObject);
                _sessionAnchor = null;
            }
        }

        /** Zemin plane'ine veya world pose'a sabitle. Basarisizsa sahne kökünde world-space kal. */
        public bool AttachSessionAnchor(ARAnchorManager anchorManager, Pose pose, ARPlane floorPlane)
        {
            ClearSessionAnchor();
            transform.SetParent(null);

            if (anchorManager != null && floorPlane != null)
            {
                _sessionAnchor = anchorManager.AttachAnchor(floorPlane, pose);
                if (_sessionAnchor != null)
                {
                    ParentUnderAnchor();
                    return true;
                }
            }

            if (anchorManager != null)
            {
#pragma warning disable 618
                _sessionAnchor = anchorManager.AddAnchor(pose);
#pragma warning restore 618
                if (_sessionAnchor != null)
                {
                    ParentUnderAnchor();
                    return true;
                }
            }

            Debug.LogWarning("[VrParcelWorldRoot] ARAnchor olusturulamadi — world-space fallback kullanilacak");
            return false;
        }

        private void ParentUnderAnchor()
        {
            transform.SetParent(_sessionAnchor.transform, false);
            transform.localPosition = Vector3.zero;
            transform.localRotation = Quaternion.identity;
            transform.localScale = Vector3.one;
        }

        public Vector3 WorldToLocal(Vector3 worldPoint)
        {
            return transform.InverseTransformPoint(worldPoint);
        }
    }
}
