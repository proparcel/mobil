/**
 * 3D Model Type Definitions
 */

export type ModelWithUsage = {
  id: number;
  name: string;
  file: string;
  remaining_uses: number | null; // null = sınırsız
  is_available: boolean;
  tepe_credits: number;
};

export type OwnedModel = {
  model_id: number;
  model_name: string;
  category: string;
  file: string;
  usegCount: number | null; // null = sınırsız
  picture_path?: string;
  thumbnail_path?: string;
};

export type DecrementUsageResponse = {
  success: boolean;
  remaining_uses: number | null;
  error?: string;
};

export type OwnedModelsResponse = {
  owned_models: OwnedModel[];
};

export type ModelsListResponse = {
  [key: string]: ModelWithUsage[]; // key = "house" | "car" | "tree" | "grass"
};
