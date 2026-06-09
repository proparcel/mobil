using UnityEngine;

namespace ProParcel.Terrain3d
{
    /** Vertex color shader + texture fallback material cozucu. */
    public static class TerrainVertexColorMaterial
    {
        private const string ShaderName = "ProParcel/TerrainVertexColor";
        private static Shader cachedVertexShader;

        public static bool TryResolveMaterial(
            Material assignedMaterial,
            Texture2D slopeTexture,
            out Material material,
            out TerrainSurfaceRenderMode mode)
        {
            material = null;
            mode = TerrainSurfaceRenderMode.VertexColor;

            if (assignedMaterial != null)
            {
                material = assignedMaterial;
                mode = assignedMaterial.shader != null &&
                    assignedMaterial.shader.name == ShaderName
                    ? TerrainSurfaceRenderMode.VertexColor
                    : TerrainSurfaceRenderMode.TextureFallback;
                Terrain3dAndroidLog.Info("[TerrainVertexColorMaterial] assigned material shader=" +
                    (assignedMaterial.shader != null ? assignedMaterial.shader.name : "null") +
                    " mode=" + mode);
                return true;
            }

            var vertexShader = ResolveVertexShader();
            var shaderFound = vertexShader != null;
            Terrain3dAndroidLog.Info("[TerrainVertexColorMaterial] shader found=" + shaderFound);

            if (shaderFound)
            {
                material = new Material(vertexShader);
                material.name = "ProParcelTerrainVertexColorRuntime";
                mode = TerrainSurfaceRenderMode.VertexColor;
                Terrain3dAndroidLog.Info("[TerrainVertexColorMaterial] material mode=vertex-color");
                return true;
            }

            material = TerrainMeshBuilder.CreateTextureFallbackMaterial(slopeTexture);
            if (material != null)
            {
                mode = TerrainSurfaceRenderMode.TextureFallback;
                Terrain3dAndroidLog.Info("[TerrainVertexColorMaterial] material mode=texture-fallback");
                return true;
            }

            Terrain3dAndroidLog.Error("[TerrainVertexColorMaterial] vertex shader ve texture fallback basarisiz");
            return false;
        }

        private static Shader ResolveVertexShader()
        {
            if (cachedVertexShader != null) return cachedVertexShader;
            cachedVertexShader = Shader.Find(ShaderName);
            return cachedVertexShader;
        }
    }
}
