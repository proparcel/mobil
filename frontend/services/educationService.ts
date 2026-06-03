/**
 * Üniversite ve bölüm listeleri (kayıt / profil formları).
 */

import { DJANGO_API_URL } from "../config/api";

export type UniversityItem = {
  id: number;
  name: string;
};

export type DepartmentItem = {
  id: number;
  name: string;
  degree_level: number;
  category?: string;
};

const ENDPOINTS = {
  UNIVERSITIES: "/api/education/universities/",
  DEPARTMENTS: "/api/education/departments/",
} as const;

let universitiesCache: UniversityItem[] | null = null;
const departmentsCache: Partial<Record<1 | 2, DepartmentItem[]>> = {};

async function publicFetch<T>(endpoint: string): Promise<T | null> {
  const url = `${DJANGO_API_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        "ngrok-skip-browser-warning": "true",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch (error) {
    console.error(`[educationService] API hatası (${endpoint}):`, error);
    return null;
  }
}

class EducationService {
  async listUniversities(): Promise<UniversityItem[]> {
    if (universitiesCache) return universitiesCache;
    const data = await publicFetch<{ universities?: UniversityItem[] }>(ENDPOINTS.UNIVERSITIES);
    universitiesCache = Array.isArray(data?.universities) ? data.universities : [];
    return universitiesCache;
  }

  async listDepartments(degreeLevel: 1 | 2): Promise<DepartmentItem[]> {
    if (departmentsCache[degreeLevel]) return departmentsCache[degreeLevel]!;
    const data = await publicFetch<{ departments?: DepartmentItem[] }>(
      `${ENDPOINTS.DEPARTMENTS}?degree_level=${degreeLevel}`,
    );
    departmentsCache[degreeLevel] = Array.isArray(data?.departments) ? data.departments : [];
    return departmentsCache[degreeLevel]!;
  }
}

export const educationService = new EducationService();
export default educationService;
