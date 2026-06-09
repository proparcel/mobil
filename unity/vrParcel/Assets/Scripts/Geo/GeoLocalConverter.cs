using System;
using UnityEngine;

namespace ProParcel.VrParcel.Geo
{
    public static class GeoLocalConverter
    {
        private const double EarthRadiusM = 6378137.0;

        public static Vector2 LatLonToLocalMetres(double lat, double lon, double originLat, double originLon)
        {
            double latRad = originLat * Math.PI / 180.0;
            double dLat = lat - originLat;
            double dLon = lon - originLon;
            double north = dLat * (Math.PI / 180.0) * EarthRadiusM;
            double east = dLon * (Math.PI / 180.0) * EarthRadiusM * Math.Cos(latRad);
            return new Vector2((float)east, (float)north);
        }

        public static Vector3 LocalMetresToUnity(float east, float north, float y = 0f)
        {
            return new Vector3(east, y, north);
        }

        public static double HaversineMetres(double lat1, double lon1, double lat2, double lon2)
        {
            double dLat = (lat2 - lat1) * Math.PI / 180.0;
            double dLon = (lon2 - lon1) * Math.PI / 180.0;
            double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                       Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                       Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return EarthRadiusM * c;
        }
    }
}
