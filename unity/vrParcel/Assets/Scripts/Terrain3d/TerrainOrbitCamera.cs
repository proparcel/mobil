using UnityEngine;

namespace ProParcel.Terrain3d
{
    public class TerrainOrbitCamera : MonoBehaviour
    {
        [SerializeField] private Camera targetCamera;
        [SerializeField] private Transform target;

        [Header("Orbit")]
        [SerializeField] private float yaw = 35f;
        [SerializeField] private float pitch = 55f;
        [SerializeField] private float orbitSpeed = 0.18f;
        [SerializeField] private float pitchMin = 25f;
        [SerializeField] private float pitchMax = 75f;

        [Header("Zoom")]
        [SerializeField] private float distance = 25f;
        [SerializeField] private float minDistance = 3f;
        [SerializeField] private float maxDistance = 420f;
        [SerializeField] private float zoomSpeed = 0.06f;

        private Vector3 targetPosition = Vector3.zero;
        private Bounds lastBounds;
        private bool hasLastBounds;

        public float CurrentDistance => distance;

        private void Awake()
        {
            if (targetCamera == null)
                targetCamera = Camera.main;

            if (target != null)
                targetPosition = target.position;

            ApplyCamera();
        }

        private void Update()
        {
            HandleTouchInput();
            ApplyCamera();
        }

        public void SetTargetBounds(Bounds bounds)
        {
            lastBounds = bounds;
            hasLastBounds = true;
            targetPosition = bounds.center;

            float planarSize = Mathf.Max(bounds.size.x, bounds.size.z, 1f);
            distance = ComputeFitDistance(bounds, planarSize);

            yaw = 35f;
            pitch = 55f;

            ApplyCamera();
            Terrain3dAndroidLog.Info("[TerrainOrbitCamera] SetTargetBounds size=" + bounds.size +
                " initialDistance=" + distance + " min=" + minDistance + " max=" + maxDistance);
        }

        public void FocusOnBounds(Bounds primaryBounds, Bounds? secondaryBounds = null)
        {
            var combined = primaryBounds;
            if (secondaryBounds.HasValue)
                combined.Encapsulate(secondaryBounds.Value);
            SetTargetBounds(combined);
        }

        public void ZoomBy(string deltaStr)
        {
            if (!float.TryParse(
                    deltaStr,
                    System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture,
                    out var delta))
            {
                return;
            }

            distance = Mathf.Clamp(distance + delta, minDistance, maxDistance);
            ApplyCamera();
            Terrain3dAndroidLog.Info("[TerrainOrbitCamera] ZoomBy delta=" + delta +
                " distance=" + distance);
        }

        public void ResetView(string _unused = "")
        {
            if (hasLastBounds)
                SetTargetBounds(lastBounds);
        }

        private float ComputeFitDistance(Bounds bounds, float planarSize)
        {
            if (targetCamera != null)
            {
                float radius = new Vector3(bounds.extents.x, bounds.extents.y * 0.35f, bounds.extents.z).magnitude;
                radius = Mathf.Max(radius, 4f);
                float halfFov = targetCamera.fieldOfView * 0.5f * Mathf.Deg2Rad;
                float halfH = Mathf.Atan(Mathf.Tan(halfFov) * targetCamera.aspect);
                float distV = radius / Mathf.Sin(halfFov);
                float distH = radius / Mathf.Sin(halfH);
                return Mathf.Clamp(Mathf.Max(distV, distH) * 1.45f, minDistance, maxDistance);
            }

            return Mathf.Clamp(planarSize * 1.35f, minDistance, maxDistance);
        }

        private void HandleTouchInput()
        {
            if (Input.touchCount == 1)
            {
                Touch t = Input.GetTouch(0);
                if (t.phase == TouchPhase.Moved)
                {
                    yaw += t.deltaPosition.x * orbitSpeed;
                    pitch -= t.deltaPosition.y * orbitSpeed;
                    pitch = Mathf.Clamp(pitch, pitchMin, pitchMax);
                }
            }
            else if (Input.touchCount == 2)
            {
                Touch t0 = Input.GetTouch(0);
                Touch t1 = Input.GetTouch(1);

                Vector2 prev0 = t0.position - t0.deltaPosition;
                Vector2 prev1 = t1.position - t1.deltaPosition;

                float prevDist = Vector2.Distance(prev0, prev1);
                float currDist = Vector2.Distance(t0.position, t1.position);
                float delta = currDist - prevDist;

                distance -= delta * zoomSpeed;
                distance = Mathf.Clamp(distance, minDistance, maxDistance);
            }
        }

        private void ApplyCamera()
        {
            if (targetCamera == null)
                return;

            Quaternion rotation = Quaternion.Euler(pitch, yaw, 0f);
            Vector3 offset = rotation * new Vector3(0f, 0f, -distance);

            targetCamera.transform.position = targetPosition + offset;
            targetCamera.transform.LookAt(targetPosition);
        }
    }
}
