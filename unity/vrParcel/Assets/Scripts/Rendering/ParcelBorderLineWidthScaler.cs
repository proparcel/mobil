using UnityEngine;

namespace ProParcel.VrParcel.Rendering
{
    /// <summary>
    /// Kamera mesafesine gore cizgi kalinligini ayarlar — uzaktan da okunakli kalir.
    /// </summary>
    public class ParcelBorderLineWidthScaler : MonoBehaviour
    {
        private LineRenderer lineRenderer;
        private float baseWidthM;
        private float minWidthM = 0.08f;
        private float maxWidthM = 0.65f;
        private float distanceFactor = 0.045f;

        public void Configure(LineRenderer lr, float baseWidth)
        {
            lineRenderer = lr;
            baseWidthM = baseWidth;
        }

        private void LateUpdate()
        {
            if (lineRenderer == null) return;
            var cam = Camera.main;
            if (cam == null) return;

            float dist = Vector3.Distance(cam.transform.position, transform.position);
            float width = Mathf.Clamp(baseWidthM + dist * distanceFactor, minWidthM, maxWidthM);
            lineRenderer.startWidth = width;
            lineRenderer.endWidth = width;
        }
    }
}
