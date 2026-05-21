export type ExpertOpinionPdfOpts = {
  title: string;
  location: {
    city: string;
    district: string;
    neighborhood: string;
    ada: string;
    parsel: string;
  };
  expertName: string;
  dateStr: string;
  responseText: string;
  surveyAnswers: Record<string, unknown>;
  surveyQuestions: unknown[];
  totalPrice: number | null;
  attachmentUrls: string[];
};

export async function generateExpertOpinionPdf(
  _opts: ExpertOpinionPdfOpts,
): Promise<{ pdfUri: string; filename: string }> {
  throw new Error("PDF oluşturma henüz yapılandırılmadı.");
}
