using UnityEngine;
using TMPro;
using ProParcel.VrParcel.Bridge;
using ProParcel.VrParcel.Calibration;

namespace ProParcel.VrParcel.UI
{
    public class VrStepUiController : MonoBehaviour
    {
        [SerializeField] private TextMeshProUGUI titleText;
        [SerializeField] private TextMeshProUGUI messageText;
        [SerializeField] private TextMeshProUGUI statusText;
        [SerializeField] private GameObject fineTunePanel;
        [SerializeField] private ReferencePointCapture referenceCapture;

        private const float FineTuneStepM = 0.1f;
        private const float FineTuneYawDeg = 1f;

        public void ShowSessionStarted(VrParcelPayloadDto payload, string mode)
        {
            if (titleText != null)
            {
                titleText.text = mode == "lidar_precise"
                    ? "LiDAR Hassas Kalibrasyon"
                    : mode == "arcore_standard"
                        ? "Android AR Kalibrasyon"
                        : "Standart AR Kalibrasyon";
            }
            if (messageText != null)
                messageText.text = "Kamerada ayaklarınızın olduğu zemine dokunun.";
            if (statusText != null && payload != null)
                statusText.text = $"Ada {payload.ada} / Parsel {payload.parsel}";
            if (fineTunePanel != null) fineTunePanel.SetActive(false);
        }

        public void ShowCalibrationComplete(CalibrationTransformData data)
        {
            ShowMessage("Kalibrasyon tamamlandı. Parseli Çiz butonuna basın.");
            if (statusText != null)
                statusText.text = $"Kalite: {data.qualityScore:P0}";
            if (fineTunePanel != null) fineTunePanel.SetActive(true);
        }

        public void ShowLiveDistances(float? userToA, float? userToB, float? aToB)
        {
            if (statusText == null) return;
            var parts = new System.Collections.Generic.List<string>();
            if (userToA.HasValue) parts.Add($"Konum→A: {userToA.Value:F1} m");
            if (userToB.HasValue) parts.Add($"Konum→B: {userToB.Value:F1} m");
            if (aToB.HasValue) parts.Add($"A→B: {aToB.Value:F1} m");
            if (parts.Count > 0)
                statusText.text = string.Join(" · ", parts);
        }

        public void ShowMessage(string msg)
        {
            if (messageText != null) messageText.text = msg;
        }

        public void OnComputeCalibration()
        {
            VrParcelBridge.Instance?.ComputeCalibrationFromThreePoints();
        }

        public void OnDrawParcel()
        {
            VrParcelBridge.Instance?.DrawParcel();
        }

        public void OnRecalibrate()
        {
            referenceCapture?.ResetCalibration();
            if (fineTunePanel != null) fineTunePanel.SetActive(false);
            ShowMessage("Kalibrasyon sıfırlandı.");
        }

        public void OnMoveForward() => VrParcelBridge.Instance?.ApplyFineTune(0, FineTuneStepM, 0);
        public void OnMoveBack() => VrParcelBridge.Instance?.ApplyFineTune(0, -FineTuneStepM, 0);
        public void OnMoveLeft() => VrParcelBridge.Instance?.ApplyFineTune(-FineTuneStepM, 0, 0);
        public void OnMoveRight() => VrParcelBridge.Instance?.ApplyFineTune(FineTuneStepM, 0, 0);
        public void OnRotateCw() => VrParcelBridge.Instance?.ApplyFineTune(0, 0, FineTuneYawDeg);
        public void OnRotateCcw() => VrParcelBridge.Instance?.ApplyFineTune(0, 0, -FineTuneYawDeg);
        public void OnLockCalibration() => VrParcelBridge.Instance?.LockCalibration();
    }
}
