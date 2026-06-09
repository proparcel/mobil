using System.IO;
using UnityEngine;

namespace ProParcel.Terrain3d
{
    public static class TerrainPayloadIO
    {
        public static string Resolve(string jsonOrFileRef)
        {
            Terrain3dAndroidLog.Info("[TerrainPayloadIO] Resolve called ref=" +
                Truncate(jsonOrFileRef, 120));

            if (string.IsNullOrEmpty(jsonOrFileRef))
            {
                Terrain3dAndroidLog.Error("[TerrainPayloadIO] Bos parametre");
                return string.Empty;
            }

            if (jsonOrFileRef.StartsWith("@cache:"))
            {
                var cacheRel = jsonOrFileRef.Substring("@cache:".Length);
                var cachePath = Path.Combine(Application.temporaryCachePath, cacheRel);
                Terrain3dAndroidLog.Info("[TerrainPayloadIO] @cache path=" + cachePath +
                    " exists=" + File.Exists(cachePath));
                return ReadFromPath(cachePath);
            }

            if (jsonOrFileRef.StartsWith("@file:"))
            {
                var path = jsonOrFileRef.Substring("@file:".Length);
                Terrain3dAndroidLog.Info("[TerrainPayloadIO] @file path=" + path +
                    " exists=" + File.Exists(path));

                if (File.Exists(path))
                {
                    return ReadFromPath(path);
                }

                var fileName = Path.GetFileName(path);
                var fallbackPath = Path.Combine(Application.temporaryCachePath, fileName);
                Terrain3dAndroidLog.Info("[TerrainPayloadIO] @file yok, cache deneniyor: " +
                    fallbackPath + " exists=" + File.Exists(fallbackPath));
                return ReadFromPath(fallbackPath);
            }

            Terrain3dAndroidLog.Info("[TerrainPayloadIO] inline json length=" + jsonOrFileRef.Length);
            return jsonOrFileRef;
        }

        private static string ReadFromPath(string path)
        {
            if (!File.Exists(path))
            {
                Terrain3dAndroidLog.Error("[TerrainPayloadIO] Dosya yok: " + path +
                    " unityCache=" + Application.temporaryCachePath);
                return string.Empty;
            }

            var text = File.ReadAllText(path);
            Terrain3dAndroidLog.Info("[TerrainPayloadIO] Okundu jsonLength=" + text.Length +
                " <- " + path);
            return text;
        }

        private static string Truncate(string value, int max)
        {
            if (string.IsNullOrEmpty(value) || value.Length <= max) return value;
            return value.Substring(0, max) + "...";
        }
    }
}
