using System.Globalization;
using System.Text;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using ProParcel.VrParcel.Bridge;

namespace ProParcel.VrParcel.AR
{
    /// <summary>
    /// ARCore zemin algilama + dokunma hazirligi durumunu RN'e periyodik bildirir.
    /// </summary>
    public class VrArReadinessMonitor : MonoBehaviour
    {
        [SerializeField] private ARSession arSession;
        [SerializeField] private ARPlaneManager planeManager;
        [SerializeField] private ARRaycastManager raycastManager;
        [SerializeField] private Camera arCamera;
        [SerializeField] private float emitIntervalSec = 0.35f;

        private float _lastEmitTime;
        private string _lastPayload = "";

        private void Awake()
        {
            if (arSession == null) arSession = FindObjectOfType<ARSession>();
            if (planeManager == null) planeManager = FindObjectOfType<ARPlaneManager>();
            if (raycastManager == null) raycastManager = FindObjectOfType<ARRaycastManager>();
            if (arCamera == null)
            {
                var origin = FindObjectOfType<Unity.XR.CoreUtils.XROrigin>();
                arCamera = origin != null ? origin.Camera : Camera.main;
            }
        }

        private void Update()
        {
            if (Time.unscaledTime - _lastEmitTime < emitIntervalSec) return;
            _lastEmitTime = Time.unscaledTime;

            var payload = BuildPayload();
            if (payload == _lastPayload) return;
            _lastPayload = payload;
            VrParcelNativeCallback.Emit("ar_readiness_changed", payload);
        }

        private string BuildPayload()
        {
            int horizontalPlanes = CountHorizontalPlanes();
            bool sessionRunning = arSession != null &&
                                  arSession.subsystem != null &&
                                  arSession.subsystem.running;
            string tracking = sessionRunning ? "ok" : "none";
            if (sessionRunning && horizontalPlanes == 0)
                tracking = "scanning";

            bool probeHit = ProbeFeetTapPoint(out float probeX, out float probeY);
            bool ready = sessionRunning && (horizontalPlanes > 0 || probeHit) && probeHit;

            string message;
            if (!sessionRunning)
                message = "AR oturumu baslatiliyor…";
            else if (horizontalPlanes <= 0)
                message = "Zemin taranıyor — telefonu yavas hareket ettirin";
            else if (!probeHit)
                message = "Zemin algilandi — ekranin altina bakip dokunun";
            else
                message = "Zemin hazir — ayaklarinizin oldugu yere dokunun";

            var sb = new StringBuilder(160);
            sb.Append('{');
            sb.Append("\"ready\":").Append(ready ? "true" : "false").Append(',');
            sb.Append("\"planeCount\":").Append(horizontalPlanes).Append(',');
            sb.Append("\"tracking\":\"").Append(tracking).Append("\",");
            sb.Append("\"probeHit\":").Append(probeHit ? "true" : "false").Append(',');
            sb.Append("\"probeX\":").Append(probeX.ToString(CultureInfo.InvariantCulture)).Append(',');
            sb.Append("\"probeY\":").Append(probeY.ToString(CultureInfo.InvariantCulture)).Append(',');
            sb.Append("\"message\":\"").Append(EscapeJson(message)).Append('"');
            sb.Append('}');
            return sb.ToString();
        }

        private int CountHorizontalPlanes()
        {
            if (planeManager == null) return 0;
            var count = 0;
            foreach (var plane in planeManager.trackables)
            {
                if (plane.alignment == PlaneAlignment.HorizontalUp ||
                    plane.alignment == PlaneAlignment.HorizontalDown)
                    count++;
            }
            return count;
        }

        /** Ayak hizasi icin ekran alt-orta noktada raycast dener. */
        private bool ProbeFeetTapPoint(out float probeX, out float probeY)
        {
            probeX = Screen.width * 0.5f;
            probeY = Screen.height * 0.22f;

            if (raycastManager == null || Screen.width <= 0 || Screen.height <= 0)
                return false;

            var point = new Vector2(probeX, probeY);
            var hits = new System.Collections.Generic.List<ARRaycastHit>();

            if (raycastManager.Raycast(point, hits, TrackableType.PlaneWithinPolygon))
                return true;
            if (raycastManager.Raycast(point, hits, TrackableType.PlaneEstimated))
                return true;
            if (raycastManager.Raycast(point, hits, TrackableType.FeaturePoint))
                return hits.Count > 0;

            if (arCamera == null) return false;
            var ray = arCamera.ScreenPointToRay(point);
            var floorY = EstimateFloorY();
            var plane = new Plane(Vector3.up, new Vector3(0f, floorY, 0f));
            return plane.Raycast(ray, out _);
        }

        private float EstimateFloorY()
        {
            if (planeManager != null)
            {
                var lowest = float.MaxValue;
                foreach (var plane in planeManager.trackables)
                {
                    if (plane.alignment != PlaneAlignment.HorizontalUp &&
                        plane.alignment != PlaneAlignment.HorizontalDown)
                        continue;
                    if (plane.center.y < lowest)
                        lowest = plane.center.y;
                }
                if (lowest < float.MaxValue)
                    return lowest;
            }

            return arCamera != null ? arCamera.transform.position.y - 1.4f : 0f;
        }

        private static string EscapeJson(string value)
        {
            return (value ?? "").Replace("\\", "\\\\").Replace("\"", "'");
        }
    }
}
