using System.Globalization;
using System.Text;

namespace ProParcel.Terrain3d
{
    /**
     * Yapisal Unity log payload'u uretir. JsonUtility null/dinamik alanlarda zayif oldugu icin
     * elle, dogru escape edilmis JSON kurar. attempt log "data" alanina yazilir.
     */
    public sealed class Terrain3dLogData
    {
        private readonly StringBuilder sb = new StringBuilder(128);
        private bool first = true;

        public static Terrain3dLogData New()
        {
            return new Terrain3dLogData();
        }

        public Terrain3dLogData Add(string key, string value)
        {
            Prefix(key);
            if (value == null)
            {
                sb.Append("null");
            }
            else
            {
                sb.Append('"').Append(Escape(value)).Append('"');
            }
            return this;
        }

        public Terrain3dLogData Add(string key, int value)
        {
            Prefix(key);
            sb.Append(value.ToString(CultureInfo.InvariantCulture));
            return this;
        }

        public Terrain3dLogData Add(string key, long value)
        {
            Prefix(key);
            sb.Append(value.ToString(CultureInfo.InvariantCulture));
            return this;
        }

        public Terrain3dLogData Add(string key, bool value)
        {
            Prefix(key);
            sb.Append(value ? "true" : "false");
            return this;
        }

        public Terrain3dLogData Add(string key, float value)
        {
            Prefix(key);
            if (float.IsNaN(value) || float.IsInfinity(value))
            {
                sb.Append("null");
            }
            else
            {
                sb.Append(value.ToString("0.######", CultureInfo.InvariantCulture));
            }
            return this;
        }

        public string Build()
        {
            return "{" + sb + "}";
        }

        public override string ToString()
        {
            return Build();
        }

        private void Prefix(string key)
        {
            if (!first) sb.Append(',');
            first = false;
            sb.Append('"').Append(Escape(key)).Append("\":");
        }

        private static string Escape(string value)
        {
            var builder = new StringBuilder(value.Length + 8);
            foreach (var c in value)
            {
                switch (c)
                {
                    case '"': builder.Append("\\\""); break;
                    case '\\': builder.Append("\\\\"); break;
                    case '\n': builder.Append("\\n"); break;
                    case '\r': builder.Append("\\r"); break;
                    case '\t': builder.Append("\\t"); break;
                    default:
                        if (c < 0x20)
                        {
                            builder.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            builder.Append(c);
                        }
                        break;
                }
            }
            return builder.ToString();
        }
    }
}
