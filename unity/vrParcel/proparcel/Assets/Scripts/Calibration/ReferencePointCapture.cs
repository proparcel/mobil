using System;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using ProParcel.VrParcel.Bridge;

namespace ProParcel.VrParcel.Calibration
{
    public enum VrCalibrationStep
    {
        TapUserPoint,
        TapReferenceA,
        TapReferenceB,
        Review,
        DrawParcel,
    }

    [Serializable]
    public class ScreenTapCapture
    {
        public Vector2 screenPoint;
        public Vector3 arPoint;
        public bool raycastHit;
        [NonSerialized] public ARPlane hitPlane;
    }

    public class ReferencePointCapture : MonoBehaviour
    {
        [SerializeField] private ARRaycastManager raycastManager;
        [SerializeField] private ARPlaneManager planeManager;
        [SerializeField] private AROcclusionManager occlusionManager;
        [SerializeField] private Camera arCamera;
        [SerializeField] private bool preferDepthRaycast = true;

        public MapReferencePointsDto MapReferences { get; private set; }
        public ScreenTapCapture ArUser { get; private set; }
        public ScreenTapCapture ArReferenceA { get; private set; }
        public ScreenTapCapture ArReferenceB { get; private set; }
        public VrCalibrationStep CurrentStep { get; private set; } = VrCalibrationStep.TapUserPoint;
        public bool PreferDepthRaycast => preferDepthRaycast;
        public ARPlane UserFloorPlane => ArUser?.hitPlane;

        public event Action<VrCalibrationStep> StepChanged;
        public event Action<string> UserMessage;

        public void ConfigureForMode(string mode)
        {
            preferDepthRaycast = mode == "lidar_precise";
            if (occlusionManager != null)
                occlusionManager.enabled = preferDepthRaycast;
        }

        public void ResetCalibration()
        {
            MapReferences = null;
            ArUser = null;
            ArReferenceA = null;
            ArReferenceB = null;
            SetStep(VrCalibrationStep.TapUserPoint);
        }

        public void SetMapReferences(MapReferencePointsDto mapRefs)
        {
            MapReferences = mapRefs;
            SetStep(VrCalibrationStep.TapUserPoint);
            UserMessage?.Invoke("Kamerada ayaklarınızın olduğu zemine dokunun.");
            EmitStep("ar_user");
        }

        public void SetStep(VrCalibrationStep step)
        {
            CurrentStep = step;
            StepChanged?.Invoke(step);
        }

        public bool TryHandleScreenTap(Vector2 screenPoint)
        {
            if (CurrentStep != VrCalibrationStep.TapUserPoint &&
                CurrentStep != VrCalibrationStep.TapReferenceA &&
                CurrentStep != VrCalibrationStep.TapReferenceB)
                return false;

            var capture = RaycastScreen(screenPoint);
            if (!capture.raycastHit)
            {
                var msg = CalibrationValidator.GetUserMessage(CalibrationValidationResult.RaycastFailed);
                UserMessage?.Invoke(msg);
                EmitTapFailed(msg);
                return false;
            }

            if (CurrentStep == VrCalibrationStep.TapUserPoint)
            {
                ArUser = capture;
                SetStep(VrCalibrationStep.TapReferenceA);
                UserMessage?.Invoke("Kamerada Hedef A'yı işaretleyin.");
                EmitStep("ar_ref_a");
                EmitTapSuccess("Konum kaydedildi");
                return true;
            }

            if (CurrentStep == VrCalibrationStep.TapReferenceA)
            {
                var distToUser = Vector3.Distance(capture.arPoint, ArUser.arPoint);
                if (distToUser < CalibrationValidator.MinScreenTapSeparationM)
                {
                    var msg = CalibrationValidator.GetUserMessage(CalibrationValidationResult.TapTooClose);
                    UserMessage?.Invoke(msg);
                    EmitTapFailed(msg);
                    return false;
                }
                if (distToUser < CalibrationValidator.MinArReferenceDistanceM)
                {
                    var msg = CalibrationValidator.GetUserMessage(CalibrationValidationResult.TooClose);
                    UserMessage?.Invoke(msg);
                    EmitTapFailed(msg);
                    return false;
                }
                ArReferenceA = capture;
                SetStep(VrCalibrationStep.TapReferenceB);
                UserMessage?.Invoke("Kamerada Hedef B'yi işaretleyin.");
                EmitStep("ar_ref_b");
                EmitTapSuccess("Hedef A kaydedildi");
                return true;
            }

            var distToA = Vector3.Distance(capture.arPoint, ArReferenceA.arPoint);
            if (distToA < CalibrationValidator.MinScreenTapSeparationM)
            {
                var msg = CalibrationValidator.GetUserMessage(CalibrationValidationResult.TapTooClose);
                UserMessage?.Invoke(msg);
                EmitTapFailed(msg);
                return false;
            }
            if (distToA < CalibrationValidator.MinArReferenceDistanceM)
            {
                var msg = CalibrationValidator.GetUserMessage(CalibrationValidationResult.TooClose);
                UserMessage?.Invoke(msg);
                EmitTapFailed(msg);
                return false;
            }

            if (IsCollinear(ArUser.arPoint, ArReferenceA.arPoint, capture.arPoint))
            {
                var msg = "Üç nokta aynı hizada. Farklı yönlerde hedef seçin.";
                UserMessage?.Invoke(msg);
                EmitTapFailed(msg);
                return false;
            }

            ArReferenceB = capture;
            SetStep(VrCalibrationStep.Review);
            UserMessage?.Invoke("Kalibrasyon hesaplanıyor…");
            EmitStep("review");
            EmitTapSuccess("Hedef B kaydedildi");
            VrParcelBridge.Instance?.ComputeCalibrationFromThreePoints();
            return true;
        }

        private static bool IsCollinear(Vector3 a, Vector3 b, Vector3 c)
        {
            Vector3 ab = b - a;
            Vector3 ac = c - a;
            float crossMag = Vector3.Cross(ab, ac).magnitude;
            return crossMag < 0.05f;
        }

        private static void EmitStep(string step)
        {
            VrParcelNativeCallback.Emit("ar_step_changed", "{\"step\":\"" + step + "\"}");
        }

        private static void EmitTapFailed(string message)
        {
            var safe = (message ?? "").Replace("\\", "\\\\").Replace("\"", "'");
            VrParcelNativeCallback.Emit("ar_tap_failed", "{\"message\":\"" + safe + "\"}");
        }

        private static void EmitTapSuccess(string message)
        {
            var safe = (message ?? "").Replace("\\", "\\\\").Replace("\"", "'");
            VrParcelNativeCallback.Emit("ar_tap_success", "{\"message\":\"" + safe + "\"}");
        }

        public float? GetDistanceUserToA()
        {
            if (ArUser == null || ArReferenceA == null) return null;
            return Vector3.Distance(ArUser.arPoint, ArReferenceA.arPoint);
        }

        public float? GetDistanceUserToB()
        {
            if (ArUser == null || ArReferenceB == null) return null;
            return Vector3.Distance(ArUser.arPoint, ArReferenceB.arPoint);
        }

        public float? GetDistanceAToB()
        {
            if (ArReferenceA == null || ArReferenceB == null) return null;
            return Vector3.Distance(ArReferenceA.arPoint, ArReferenceB.arPoint);
        }

        private static bool TryCaptureHit(
            ARRaycastHit hit,
            Vector2 screenPoint,
            ScreenTapCapture result)
        {
            result.screenPoint = screenPoint;
            result.arPoint = hit.pose.position;
            result.raycastHit = true;
            if (hit.trackable is ARPlane plane)
                result.hitPlane = plane;
            return true;
        }

        private ScreenTapCapture RaycastScreen(Vector2 screenPoint)
        {
            var result = new ScreenTapCapture { screenPoint = screenPoint, raycastHit = false };

            if (raycastManager != null)
            {
                var hits = new System.Collections.Generic.List<ARRaycastHit>();

                if (preferDepthRaycast)
                {
                    if (TryDepthRaycast(screenPoint, hits))
                    {
                        TryCaptureHit(hits[0], screenPoint, result);
                        return result;
                    }
                }

                if (raycastManager.Raycast(screenPoint, hits, TrackableType.PlaneWithinPolygon))
                {
                    TryCaptureHit(hits[0], screenPoint, result);
                    return result;
                }

                if (raycastManager.Raycast(screenPoint, hits, TrackableType.PlaneEstimated))
                {
                    TryCaptureHit(hits[0], screenPoint, result);
                    return result;
                }

                hits.Clear();
                if (raycastManager.Raycast(screenPoint, hits, TrackableType.FeaturePoint) && hits.Count > 0)
                {
                    TryCaptureHit(hits[0], screenPoint, result);
                    return result;
                }
            }

            if (arCamera != null)
            {
                var ray = arCamera.ScreenPointToRay(screenPoint);
                var floorY = EstimateFloorY();
                var plane = new Plane(Vector3.up, new Vector3(0f, floorY, 0f));
                if (plane.Raycast(ray, out float enter))
                {
                    result.arPoint = ray.GetPoint(Mathf.Min(enter, 8f));
                    result.raycastHit = true;
                }
            }

            return result;
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

        private bool TryDepthRaycast(Vector2 screenPoint, System.Collections.Generic.List<ARRaycastHit> hits)
        {
            if (raycastManager == null) return false;

            hits.Clear();
            if (raycastManager.Raycast(screenPoint, hits, TrackableType.Depth))
                return hits.Count > 0;

            hits.Clear();
            if (occlusionManager != null && occlusionManager.enabled)
            {
                if (raycastManager.Raycast(screenPoint, hits, TrackableType.PlaneWithinPolygon))
                    return hits.Count > 0;
            }

            return false;
        }
    }
}
