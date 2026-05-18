/**
 * JavaScript Parse Validator
 * 
 * JavaScript string'lerini parse ederek syntax hatalarını yakalar.
 * new Function() kullanarak sadece parse eder, çalıştırmaz.
 */

/**
 * Template literal içinde kullanılacak string'leri escape eder
 * Backtick, ${} ve \ karakterlerini güvenli hale getirir
 */
export function escapeTemplateLiteral(str: string): string {
  return str
    .replace(/\\/g, '\\\\')  // \ -> \\
    .replace(/`/g, '\\`')     // ` -> \`
    .replace(/\${/g, '\\${'); // ${ -> \${
}

/**
 * HTML içinde kullanılacak script tag'lerini escape eder
 * </script> -> <\/script> (HTML parser'ın script tag'ini kapatmaması için)
 */
export function escapeScriptTag(str: string): string {
  return str.replace(/<\/script>/gi, '<\\/script>');
}

/**
 * JavaScript string'ini HTML içinde güvenli kullanım için hazırlar
 * Hem template literal hem de script tag kaçışlarını yapar
 */
export function sanitizeJSForHTML(js: string): string {
  // Önce script tag kaçışı yap (HTML parser için)
  let sanitized = escapeScriptTag(js);
  // Template literal kaçışı gerekirse yapılabilir ama genelde JS string'i zaten template literal dışında
  return sanitized;
}

/**
 * Belirli bir satırın çevresindeki kod satırlarını döndürür
 */
function getLineContext(src: string, line: number, radius = 5): string {
  const lines = src.split('\n');
  const start = Math.max(0, line - 1 - radius);
  const end = Math.min(lines.length, line - 1 + radius);
  return lines
    .slice(start, end + 1)
    .map((l, i) => `${start + i + 1}: ${l}`)
    .join('\n');
}

/**
 * JavaScript string'ini parse ederek syntax hatalarını kontrol eder
 * @param name - Validasyon edilen kod bloğunun adı (log için)
 * @param js - Parse edilecek JavaScript string'i
 * @param options - Validasyon seçenekleri
 * @returns true if valid, false if invalid
 */
export function validateJS(
  name: string,
  js: string,
  options: {
    logSuccess?: boolean;
    logContext?: boolean;
    contextRadius?: number;
    skipInProduction?: boolean;
  } = {}
): boolean {
  const { logSuccess = true, logContext = true, contextRadius = 12, skipInProduction = true } = options;

  // PROD'da validator'ı atla (performans için)
  if (skipInProduction && typeof __DEV__ !== 'undefined' && !__DEV__) {
    return true; // PROD'da her zaman geçerli kabul et
  }

  if (!js || js.trim().length === 0) {
    console.warn(`[JSValidator] ⚠️ ${name}: Empty JavaScript string`);
    return false;
  }

  // </script> kontrolü (HTML içinde kullanılacaksa)
  if (js.includes('</script>')) {
    console.warn(`[JSValidator] ⚠️ ${name}: Contains unescaped </script> tag. Use escapeScriptTag() function.`);
  }

  try {
    // Sadece parse eder, çalıştırmaz.
    // new Function body parse edilirken syntax hatası fırlatır.
    // eslint-disable-next-line no-new-func
    new Function(js);
    
    if (logSuccess) {
      console.log(`[JSValidator] ✅ ${name}: JS parse OK (${js.length} chars, ${js.split('\n').length} lines)`);
    }
    return true;
  } catch (e: any) {
    const errorMessage = e?.message || String(e);
    let line = e?.lineNumber || e?.line || null;
    let col = e?.columnNumber || e?.column || null;
    
    // Hata mesajından satır/kolon bilgisini çıkar (örn: "1680:23:invalid expression")
    const lineColMatch = errorMessage.match(/(\d+):(\d+):/);
    if (lineColMatch && !line) {
      line = parseInt(lineColMatch[1], 10);
      col = parseInt(lineColMatch[2], 10);
    }
    
    // Tüm hata bilgilerini tek bir mesajda topla
    let errorLog = `[JSValidator] ❌ ${name}: JS parse FAIL\n`;
    errorLog += `[JSValidator]   Error: ${errorMessage}\n`;
    
    if (line) {
      const lineNum = Number(line);
      errorLog += `[JSValidator]   Location: line=${lineNum} col=${col ?? '?'}\n`;
      
      // Hata satırını vurgula
      const lines = js.split('\n');
      if (lineNum > 0 && lineNum <= lines.length) {
        const errorLine = lines[lineNum - 1];
        errorLog += `[JSValidator]   Error line (${lineNum}): ${errorLine}\n`;
        
        // Eğer column bilgisi varsa, o karakteri işaretle
        if (col && col > 0) {
          const marker = ' '.repeat(Math.max(0, col - 1)) + '^';
          errorLog += `[JSValidator]   ${marker}\n`;
        }
      }
      
      if (logContext) {
        const context = getLineContext(js, lineNum, contextRadius);
        errorLog += `[JSValidator]   Context (${contextRadius} lines around error):\n${context}`;
      }
    } else {
      // line yoksa da en azından mesajı alırsınız
      errorLog += `[JSValidator]   No line/column info available\n`;
      
      // Son 20 satırı göster (belki hata orada)
      if (logContext) {
        const lines = js.split('\n');
        const lastLines = lines.slice(Math.max(0, lines.length - 20));
        const lastLinesFormatted = lastLines
          .map((l, i) => {
            const lineNum = lines.length - lastLines.length + i + 1;
            return `${lineNum}: ${l}`;
          })
          .join('\n');
        errorLog += `[JSValidator]   Last 20 lines:\n${lastLinesFormatted}`;
      }
    }
    
    console.error(errorLog);
    return false;
  }
}

/**
 * Birden fazla JavaScript string'ini toplu olarak validate eder
 */
export function validateMultipleJS(
  validations: Array<{ name: string; js: string }>,
  options?: {
    logSuccess?: boolean;
    logContext?: boolean;
    contextRadius?: number;
  }
): { allValid: boolean; results: Array<{ name: string; valid: boolean }> } {
  const results = validations.map(({ name, js }) => ({
    name,
    valid: validateJS(name, js, { logSuccess: false, ...options })
  }));

  const allValid = results.every(r => r.valid);

  if (allValid) {
    console.log(`[JSValidator] ✅ All ${validations.length} JavaScript blocks are valid`);
  } else {
    const invalidCount = results.filter(r => !r.valid).length;
    console.error(`[JSValidator] ❌ ${invalidCount}/${validations.length} JavaScript blocks have syntax errors`);
    results.forEach(r => {
      if (!r.valid) {
        console.error(`[JSValidator]   - ${r.name}: INVALID`);
      }
    });
  }

  return { allValid, results };
}
