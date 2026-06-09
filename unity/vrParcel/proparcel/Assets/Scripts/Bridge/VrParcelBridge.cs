using System;
using System.Collections.Generic;
using UnityEngine;
using ProParcel.VrParcel.Calibration;
using ProParcel.VrParcel.Geo;
using ProParcel.VrParcel.Rendering;
using ProParcel.VrParcel.UI;

namespace ProParcel.VrParcel.Bridge
{
    [Serializable]
    public class LatLonDto
    {
        public double lat;
        public double lon;
    }

    [Serializable]
    public class MapReferencePointsDto
    {
        public LatLonDto userPoint;
        public LatLonDto referenceA;
        public LatLonDto referenceB;
    }

    [Serializable]
    public class VrParcelPayloadDto
    {
        public string parcelId;
        public string city;
        public string town;
        public string quarter;
        public string ada;
        public string parsel;
        public float areaM2;
        public LatLonDto center;
        public LatLonDto[] polygon;
    }

    [Serializable]
    public class VrSessionOpenDto
    {
        public string mode;
        public VrParcelPayloadDto parcel;
        public MapReferencePointsDto mapReferences;
    }

    public class VrParcelBridge : MonoBehaviour
    {
        public static VrParcelBridge Instance { get; private set; }

        [SerializeField] private ReferencePointCapture referenceCapture;
        [SerializeField] private ParcelBorderRenderer parcelRenderer;
        [SerializeField] private VrStepUiController uiController;
        [SerializeField] private AR.VrArSessionController arSessionController;

        public VrSessionOpenDto CurrentSession { get; private set; }
        public CalibrationTransformData Calibration { get; private set; }

        private void Awake()
        {
            Instance = this;
        }

        public void OnOpenSession(string json)
        {
            try
            {
                CurrentSession = JsonUtility.FromJson<VrSessionOpenDto>(json);
                referenceCapture?.ResetCalibration();
                referenceCapture?.SetMapReferences(CurrentSession?.mapReferences);
                referenceCapture?.ConfigureForMode(CurrentSession?.mode ?? "arkit_standard");
                arSessionController?.ConfigureForMode(CurrentSession?.mode ?? "arkit_standard");
                arSessionController?.EnsureArCameraFeed();
                VrParcelWorldRoot.Instance?.ResetToSceneRoot();
                parcelRenderer?.Clear();
                Calibration = null;
                uiController?.ShowSessionStarted(CurrentSession?.parcel, CurrentSession?.mode);
            }
            catch (Exception e)
            {
                Debug.LogError("[VrParcelBridge] JSON parse hatası: " + e.Message);
            }
        }

        public void OnCloseSession()
        {
            CurrentSession = null;
            Calibration = null;
            referenceCapture?.ResetCalibration();
            VrParcelWorldRoot.Instance?.ResetToSceneRoot();
            parcelRenderer?.Clear();
        }

        public void ComputeCalibrationFromThreePoints()
        {
            if (referenceCapture?.MapReferences == null ||
                referenceCapture.ArUser == null ||
                referenceCapture.ArReferenceA == null ||
                referenceCapture.ArReferenceB == null)
                return;

            Calibration = CalibrationTransformCalculator.ComputeThreePoint(
                referenceCapture.MapReferences,
                referenceCapture.ArUser.arPoint,
                referenceCapture.ArReferenceA.arPoint,
                referenceCapture.ArReferenceB.arPoint,
                CurrentSession?.mode ?? "arkit_standard",
                CurrentSession?.parcel?.polygon);

            uiController?.ShowCalibrationComplete(Calibration);
            VrParcelNativeCallback.Emit(
                "calibration_complete",
                "{\"qualityScore\":" + Calibration.qualityScore.ToString(System.Globalization.CultureInfo.InvariantCulture) +
                ",\"scale\":" + Calibration.scale.ToString(System.Globalization.CultureInfo.InvariantCulture) + "}");
        }

        public void ApplyScaleFineTune(string factorText)
        {
            if (Calibration == null) return;
            if (!float.TryParse(factorText, System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out float factor))
                return;
            if (factor <= 0f) return;
            Calibration.scale = Mathf.Clamp(Calibration.scale * factor, 0.2f, 5f);
            DrawParcel();
        }

        public void DrawParcel()
        {
            if (CurrentSession?.parcel == null || Calibration == null || parcelRenderer == null)
                return;

            if (referenceCapture?.ArUser == null)
                return;

            var anchorPose = new Pose(referenceCapture.ArUser.arPoint, Quaternion.identity);
            var worldRoot = VrParcelWorldRoot.Instance;
            bool anchored = worldRoot != null && worldRoot.AttachSessionAnchor(
                arSessionController?.AnchorManager,
                anchorPose,
                referenceCapture.UserFloorPlane);

            var renderPoints = new List<Vector3>();
            double originLat = Calibration.originLat;
            double originLon = Calibration.originLon;

            foreach (var p in CurrentSession.parcel.polygon)
            {
                var geoLocal = GeoLocalConverter.LatLonToLocalMetres(p.lat, p.lon, originLat, originLon);
                var world = CalibrationTransformCalculator.GeoLocalToArWorld(geoLocal.x, geoLocal.y, Calibration);
                renderPoints.Add(anchored && worldRoot != null ? worldRoot.WorldToLocal(world) : world);
            }

            parcelRenderer.RenderPolygon(
                renderPoints,
                CurrentSession.parcel.ada,
                CurrentSession.parcel.parsel,
                CurrentSession.parcel.areaM2,
                localSpace: anchored);
            referenceCapture?.SetStep(VrCalibrationStep.DrawParcel);
            UpdateLiveDistanceUi();
            VrParcelNativeCallback.Emit("parcel_drawn", "{}");
        }

        public void ApplyFineTune(float dx, float dz, float dyawDeg)
        {
            if (Calibration == null) return;
            Calibration.translationX += dx;
            Calibration.translationZ += dz;
            Calibration.rotationYaw += dyawDeg;
            Calibration.rotationYawRad = Calibration.rotationYaw * Mathf.Deg2Rad;
            DrawParcel();
        }

        /** UnitySendMessage yalnızca string taşır: "dx,dz,dyaw" */
        public void ApplyFineTune(string csv)
        {
            if (string.IsNullOrEmpty(csv)) return;
            var parts = csv.Split(',');
            if (parts.Length < 3) return;
            if (!float.TryParse(parts[0], System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out float dx))
                return;
            if (!float.TryParse(parts[1], System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out float dz))
                return;
            if (!float.TryParse(parts[2], System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out float dyaw))
                return;
            ApplyFineTune(dx, dz, dyaw);
        }

        public void OnScreenTap(string screenXy)
        {
            if (referenceCapture == null) return;
            VrParcelNativeCallback.Emit("ar_tap_received", "{\"stage\":\"unity\"}");
            var parts = screenXy.Split(',');
            if (parts.Length < 2) return;
            if (!float.TryParse(parts[0], System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out float x))
                return;
            if (!float.TryParse(parts[1], System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out float y))
                return;

            if (parts.Length >= 4 &&
                float.TryParse(parts[2], System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out float viewW) &&
                float.TryParse(parts[3], System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out float viewH) &&
                viewW > 0f && viewH > 0f && Screen.width > 0 && Screen.height > 0)
            {
                x = x * Screen.width / viewW;
                y = y * Screen.height / viewH;
            }

            referenceCapture.TryHandleScreenTap(new Vector2(x, y));
            UpdateLiveDistanceUi();
        }

        private void UpdateLiveDistanceUi()
        {
            if (referenceCapture == null || uiController == null) return;
            uiController.ShowLiveDistances(
                referenceCapture.GetDistanceUserToA(),
                referenceCapture.GetDistanceUserToB(),
                referenceCapture.GetDistanceAToB());
        }

        public void LockCalibration()
        {
            uiController?.ShowMessage("Kalibrasyon kilitlendi.");
        }
    }
}
