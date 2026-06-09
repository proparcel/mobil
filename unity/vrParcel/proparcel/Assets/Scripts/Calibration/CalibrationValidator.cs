using UnityEngine;

namespace ProParcel.VrParcel.Calibration
{
    public enum CalibrationValidationResult
    {
        Ok,
        TooClose,
        LowPrecisionWarning,
        GpsPoor,
        TapTooClose,
        RaycastFailed,
        TrackingUnreliable,
    }

    public static class CalibrationValidator
    {
        public const float MinAbDistanceM = 3f;
        public const float LowPrecisionAbDistanceM = 5f;
        public const float MaxGpsAccuracyM = 25f;
        /** Aynı noktaya çift dokunmayı engeller */
        public const float MinScreenTapSeparationM = 0.3f;
        /** AR referans noktaları arası minimum mesafe (metre) */
        public const float MinArReferenceDistanceM = 3f;

        public static CalibrationValidationResult ValidateGpsReference(
            double aLat, double aLon,
            double bLat, double bLon,
            float gpsAccuracyA,
            float gpsAccuracyB)
        {
            double dist = Geo.GeoLocalConverter.HaversineMetres(aLat, aLon, bLat, bLon);
            if (dist < MinAbDistanceM) return CalibrationValidationResult.TooClose;
            if (gpsAccuracyA > MaxGpsAccuracyM || gpsAccuracyB > MaxGpsAccuracyM)
                return CalibrationValidationResult.GpsPoor;
            if (dist < LowPrecisionAbDistanceM) return CalibrationValidationResult.LowPrecisionWarning;
            return CalibrationValidationResult.Ok;
        }

        public static CalibrationValidationResult ValidateScreenTaps(Vector3 arA, Vector3 arB, bool raycastOk)
        {
            if (!raycastOk) return CalibrationValidationResult.RaycastFailed;
            float dist = Vector3.Distance(arA, arB);
            if (dist < MinArReferenceDistanceM) return CalibrationValidationResult.TooClose;
            return CalibrationValidationResult.Ok;
        }

        public static string GetUserMessage(CalibrationValidationResult result)
        {
            switch (result)
            {
                case CalibrationValidationResult.TooClose:
                    return $"Referans noktaları birbirine çok yakın. En az {MinArReferenceDistanceM:0} m mesafe bırakın.";
                case CalibrationValidationResult.LowPrecisionWarning:
                    return $"Referans mesafesi kısa; hassasiyet düşük olabilir. Mümkünse {LowPrecisionAbDistanceM:0} m+ yürüyün.";
                case CalibrationValidationResult.GpsPoor:
                    return "Konum hassasiyeti düşük. Açık alanda tekrar deneyin.";
                case CalibrationValidationResult.TapTooClose:
                    return "Kamerada işaretlediğiniz noktalar çok yakın. Lütfen tekrar deneyin.";
                case CalibrationValidationResult.RaycastFailed:
                    return "Kamera zemini algılayamadı. Telefonu yavaşça sağa sola hareket ettirin.";
                case CalibrationValidationResult.TrackingUnreliable:
                    return "AR takibi güvenilir değil. Bir süre bekleyip tekrar deneyin.";
                default:
                    return "";
            }
        }
    }
}
