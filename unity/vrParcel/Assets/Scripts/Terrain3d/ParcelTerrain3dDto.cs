using System;
using System.Collections.Generic;
using UnityEngine;

namespace ProParcel.Terrain3d
{
    [Serializable]
    public class Terrain3dLatLonDto
    {
        public double lat;
        public double lon;
    }

    [Serializable]
    public class Terrain3dPointXZ
    {
        public float x;
        public float z;
    }

    [Serializable]
    public class Terrain3dOriginDto
    {
        public float x;
        public float z;
    }

    [Serializable]
    public class Terrain3dParcelDto
    {
        public string ada;
        public string parsel;
        public float areaM2;
        public Terrain3dLatLonDto center;
        public Terrain3dPointXZ[] localPolygon;
    }

    [Serializable]
    public class Terrain3dGridDto
    {
        public string gridType;
        public int width;
        public int height;
        public float cellSizeM;
        public Terrain3dOriginDto origin;
        public float heightScaleSuggestion;
        public float[] elevations;
        public float[] slopes;
        public int[] mask;
    }

    [Serializable]
    public class Terrain3dColorStopDto
    {
        public float maxSlopeDeg;
        public string label;
        public string color;
    }

    [Serializable]
    public class Terrain3dStatsDto
    {
        public float slope_avg_poly;
        public float slope_max_poly;
        public float elevation_min;
        public float elevation_max;
    }

    [Serializable]
    public class Terrain3dRenderDto
    {
        public Terrain3dColorStopDto[] slopeColorStops;
        public bool showParcelBorder;
        public bool showSlopeLegend;
        public bool showElevationLegend;
    }

    [Serializable]
    public class ParcelTerrain3dDto
    {
        public int version;
        public string type;
        public Terrain3dParcelDto parcel;
        public Terrain3dGridDto terrain;
        public Terrain3dStatsDto stats;
        public Terrain3dRenderDto render;
    }
}
