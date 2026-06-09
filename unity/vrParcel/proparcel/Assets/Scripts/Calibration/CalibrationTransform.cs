using System;
using UnityEngine;
using ProParcel.VrParcel.Bridge;

namespace ProParcel.VrParcel.Calibration
{
    [Serializable]
    public class CalibrationTransformData
    {
        public double originLat;
        public double originLon;
        public float rotationYaw;
        public float rotationYawRad;
        public float translationX;
        public float translationY;
        public float translationZ;
        public float scale = 1f;
        public float accuracyScore;
        public float qualityScore;
        public string mode;
        public string createdAt;
    }

    public static class CalibrationTransformCalculator
    {
        private const float AreaBlend = 0.25f;

        public static CalibrationTransformData ComputeThreePoint(
            MapReferencePointsDto mapRefs,
            Vector3 arUser,
            Vector3 arA,
            Vector3 arB,
            string mode,
            LatLonDto[] parcelPolygon = null)
        {
            var origin = mapRefs.userPoint;
            var geoA = Geo.GeoLocalConverter.LatLonToLocalMetres(
                mapRefs.referenceA.lat, mapRefs.referenceA.lon, origin.lat, origin.lon);
            var geoB = Geo.GeoLocalConverter.LatLonToLocalMetres(
                mapRefs.referenceB.lat, mapRefs.referenceB.lon, origin.lat, origin.lon);

            var arUserXZ = new Vector2(arUser.x, arUser.z);
            var arAXZ = new Vector2(arA.x, arA.z) - arUserXZ;
            var arBXZ = new Vector2(arB.x, arB.z) - arUserXZ;

            float scale = EstimateMetricScaleWeighted(geoA, geoB, arAXZ, arBXZ);
            float rotationRad = EstimateYawRad(geoA, geoB, arAXZ, arBXZ, scale);

            var result = new CalibrationTransformData
            {
                originLat = origin.lat,
                originLon = origin.lon,
                rotationYaw = rotationRad * Mathf.Rad2Deg,
                rotationYawRad = rotationRad,
                translationX = arUser.x,
                translationY = arUser.y,
                translationZ = arUser.z,
                scale = scale,
                mode = mode,
                createdAt = DateTime.UtcNow.ToString("o"),
            };

            RefineScaleToReferenceDistances(result, geoA, geoB, arAXZ, arBXZ);
            RefineScaleToGeoPolygonArea(result, parcelPolygon, AreaBlend);

            result.qualityScore = ComputeQuality(geoA, geoB, arAXZ, arBXZ, result.scale);
            result.accuracyScore = result.qualityScore;
            Debug.Log("[Calibration] scale=" + result.scale.ToString("F4") +
                      " rotDeg=" + result.rotationYaw.ToString("F2") +
                      " quality=" + result.qualityScore.ToString("F2"));
            return result;
        }

        public static Vector3 GeoLocalToArWorld(float east, float north, CalibrationTransformData t)
        {
            var arOffset = RotateScale2D(new Vector2(east, north), t.scale, t.rotationYawRad);
            return new Vector3(
                t.translationX + arOffset.x,
                t.translationY,
                t.translationZ + arOffset.y);
        }

        /** Tum referans bacaklarinin agirlikli ortalamasindan olcek. */
        private static float EstimateMetricScaleWeighted(
            Vector2 geoA,
            Vector2 geoB,
            Vector2 arA,
            Vector2 arB)
        {
            float weightSum = 0f;
            float scaleSum = 0f;

            AccumulateLeg(geoA, arA, ref weightSum, ref scaleSum);
            AccumulateLeg(geoB, arB, ref weightSum, ref scaleSum);

            float geoAb = Vector2.Distance(geoA, geoB);
            float arAb = Vector2.Distance(arA, arB);
            if (geoAb > 0.5f)
            {
                weightSum += geoAb;
                scaleSum += (arAb / geoAb) * geoAb;
            }

            if (weightSum < 0.01f)
                return 1f;

            return Mathf.Clamp(scaleSum / weightSum, 0.2f, 5f);
        }

        private static void AccumulateLeg(
            Vector2 geo,
            Vector2 ar,
            ref float weightSum,
            ref float scaleSum)
        {
            float geoLen = geo.magnitude;
            if (geoLen < 0.5f) return;
            weightSum += geoLen;
            scaleSum += (ar.magnitude / geoLen) * geoLen;
        }

        /** Donus sabitken A/B mesafelerine gore olcegi tek adimda duzelt. */
        private static void RefineScaleToReferenceDistances(
            CalibrationTransformData cal,
            Vector2 geoA,
            Vector2 geoB,
            Vector2 arA,
            Vector2 arB)
        {
            float weightSum = 0f;
            float ratioSum = 0f;

            AccumulateDistanceRatio(geoA, arA, cal, ref weightSum, ref ratioSum);
            AccumulateDistanceRatio(geoB, arB, cal, ref weightSum, ref ratioSum);

            if (weightSum < 0.01f) return;
            cal.scale = Mathf.Clamp(cal.scale * (ratioSum / weightSum), 0.2f, 5f);
        }

        private static void AccumulateDistanceRatio(
            Vector2 geo,
            Vector2 ar,
            CalibrationTransformData cal,
            ref float weightSum,
            ref float ratioSum)
        {
            float geoLen = geo.magnitude;
            if (geoLen < 0.5f) return;

            var predicted = RotateScale2D(geo, cal.scale, cal.rotationYawRad);
            if (predicted.sqrMagnitude < 0.01f) return;

            float ratio = ar.magnitude / predicted.magnitude;
            weightSum += geoLen;
            ratioSum += ratio * geoLen;
        }

        /** GPS alani ile hafif duzeltme — agresif iterasyon yok. */
        private static void RefineScaleToGeoPolygonArea(
            CalibrationTransformData cal,
            LatLonDto[] polygon,
            float blend)
        {
            if (polygon == null || polygon.Length < 3 || blend <= 0f) return;

            float geoArea = ComputeGeoPolygonArea(polygon, cal.originLat, cal.originLon);
            if (geoArea < 2f) return;

            float arArea = ComputeArPolygonArea(polygon, cal);
            if (arArea < 0.5f) return;

            float corr = Mathf.Sqrt(geoArea / arArea);
            float blended = Mathf.Lerp(1f, corr, blend);
            cal.scale = Mathf.Clamp(cal.scale * blended, 0.2f, 5f);
        }

        private static float ComputeGeoPolygonArea(LatLonDto[] polygon, double originLat, double originLon)
        {
            return PolygonAreaXZ(polygon, p =>
            {
                var local = Geo.GeoLocalConverter.LatLonToLocalMetres(p.lat, p.lon, originLat, originLon);
                return new Vector2(local.x, local.y);
            });
        }

        private static float ComputeArPolygonArea(LatLonDto[] polygon, CalibrationTransformData cal)
        {
            return PolygonAreaXZ(polygon, p =>
            {
                var local = Geo.GeoLocalConverter.LatLonToLocalMetres(
                    p.lat, p.lon, cal.originLat, cal.originLon);
                var ar = GeoLocalToArWorld(local.x, local.y, cal);
                return new Vector2(ar.x, ar.z);
            });
        }

        private static float PolygonAreaXZ<T>(T[] polygon, Func<T, Vector2> toXZ)
        {
            double sum = 0d;
            for (int i = 0; i < polygon.Length; i++)
            {
                var a = toXZ(polygon[i]);
                var b = toXZ(polygon[(i + 1) % polygon.Length]);
                sum += (double)a.x * b.y - (double)b.x * a.y;
            }
            return Mathf.Abs((float)(sum * 0.5d));
        }

        private static float EstimateYawRad(
            Vector2 geoA,
            Vector2 geoB,
            Vector2 arA,
            Vector2 arB,
            float scale)
        {
            float rotA = 0f;
            float rotB = 0f;
            int count = 0;

            if (geoA.sqrMagnitude > 0.25f && arA.sqrMagnitude > 0.25f)
            {
                rotA = Mathf.Atan2(arA.y, arA.x) - Mathf.Atan2(geoA.y * scale, geoA.x * scale);
                count++;
            }
            if (geoB.sqrMagnitude > 0.25f && arB.sqrMagnitude > 0.25f)
            {
                rotB = Mathf.Atan2(arB.y, arB.x) - Mathf.Atan2(geoB.y * scale, geoB.x * scale);
                count++;
            }

            if (count == 2)
            {
                float diff = Mathf.Abs(Mathf.DeltaAngle(rotA * Mathf.Rad2Deg, rotB * Mathf.Rad2Deg));
                if (diff < 25f)
                    return (rotA + rotB) * 0.5f;
            }
            if (count >= 1)
                return count == 2 && geoA.sqrMagnitude >= geoB.sqrMagnitude ? rotA : rotB;

            return 0f;
        }

        private static Vector2 RotateScale2D(Vector2 geo, float scale, float rotRad)
        {
            float cos = Mathf.Cos(rotRad);
            float sin = Mathf.Sin(rotRad);
            float sx = geo.x * scale;
            float sy = geo.y * scale;
            return new Vector2(cos * sx - sin * sy, sin * sx + cos * sy);
        }

        private static float ComputeQuality(Vector2 geoA, Vector2 geoB, Vector2 arA, Vector2 arB, float scale)
        {
            float distGeo = Vector2.Distance(geoA, geoB);
            float distAr = Vector2.Distance(arA, arB);
            float distScore = distGeo >= 8f ? 1f : distGeo >= 5f ? 0.85f : distGeo >= 3f ? 0.6f : 0.3f;

            float ratioErr = distGeo > 0.5f ? Mathf.Abs((distAr / distGeo) - scale) / Mathf.Max(scale, 0.01f) : 0f;
            float ratioScore = ratioErr < 0.06f ? 1f : ratioErr < 0.12f ? 0.75f : 0.45f;

            float cross = geoA.x * geoB.y - geoB.x * geoA.y;
            float collinearScore = Mathf.Abs(cross) > 2f ? 1f : 0.3f;
            return Mathf.Clamp01(distScore * 0.4f + ratioScore * 0.35f + collinearScore * 0.25f);
        }
    }
}
