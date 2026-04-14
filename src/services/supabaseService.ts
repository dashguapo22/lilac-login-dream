import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AlumniRow = Database["public"]["Tables"]["alumni"]["Row"];
export type FeedbackRow = Database["public"]["Tables"]["feedback"]["Row"];
export type SkillRow = Database["public"]["Tables"]["skills"]["Row"];

export type FeedbackWithAlumni = FeedbackRow & {
  alumni?: Pick<AlumniRow, "id" | "name" | "program" | "year_graduated">;
};

export type DashboardOverview = {
  totalRespondents: number;
  employmentRate: number;
  topIndustry: string;
  avgSkillRelevance: number;
};

const normalizeString = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

export async function fetchAlumni(): Promise<AlumniRow[]> {
  const { data, error } = await supabase.from("alumni").select("*");
  if (error) throw error;
  return (data as AlumniRow[]) ?? [];
}

export async function fetchFeedback(): Promise<FeedbackRow[]> {
  const { data, error } = await supabase.from("feedback").select("*");
  if (error) throw error;
  return (data as FeedbackRow[]) ?? [];
}

export async function fetchSkills(): Promise<SkillRow[]> {
  const { data, error } = await supabase.from("skills").select("*");
  if (error) throw error;
  return (data as SkillRow[]) ?? [];
}

export async function fetchAllFeedbackWithAlumni(): Promise<FeedbackWithAlumni[]> {
  const [feedbackRows, alumniRows] = await Promise.all([fetchFeedback(), fetchAlumni()]);

  const alumniMap = new Map(alumniRows.map((alumni) => [alumni.id, alumni]));
  return feedbackRows.map((feedback) => ({
    ...feedback,
    alumni: alumniMap.get(feedback.alumni_id) ?? undefined,
  }));
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const [alumniRows, feedbackRows] = await Promise.all([fetchAlumni(), fetchFeedback()]);

  const totalRespondents = alumniRows.length;
  const employedCount = feedbackRows.filter((item) => normalizeString(item.employment_status).includes("employ")).length;
  const industryCounts = feedbackRows.reduce<Record<string, number>>((acc, item) => {
    const industry = item.industry?.trim() || "Unknown";
    acc[industry] = (acc[industry] ?? 0) + 1;
    return acc;
  }, {});

  const topIndustry = Object.entries(industryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No industry data";
  const ratingValues = feedbackRows.map((item) => item.skill_relevance_rating ?? 0).filter((rating) => rating > 0);
  const avgSkillRelevance = ratingValues.length ? Number((ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length).toFixed(1)) : 0;

  const employmentRate = totalRespondents ? Math.round((employedCount / totalRespondents) * 100) : 0;

  return {
    totalRespondents,
    employmentRate,
    topIndustry,
    avgSkillRelevance,
  };
}

export async function fetchIndustryDistribution(): Promise<{ name: string; value: number }[]> {
  const feedbackRows = await fetchFeedback();
  const counts = feedbackRows.reduce<Record<string, number>>((acc, item) => {
    const industry = item.industry?.trim() || "Unknown";
    acc[industry] = (acc[industry] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

export async function fetchEmploymentTrends(): Promise<{ date: string; employed: number }[]> {
  const feedbackRows = await fetchFeedback();
  const trendMap = new Map<string, number>();

  feedbackRows.forEach((item) => {
    if (!item.created_at) return;
    const date = new Date(item.created_at);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (normalizeString(item.employment_status).includes("employ")) {
      trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
    }
  });

  return Array.from(trendMap.entries())
    .sort(([left], [right]) => (left > right ? 1 : left < right ? -1 : 0))
    .map(([date, employed]) => ({ date, employed }));
}

export function downloadCsv(rows: any[], filename: string) {
  if (!rows.length) return;

  const headers = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set()),
  );

  const csv = [headers.join(",")].concat(
    rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          const stringValue = typeof value === "string" ? value.replace(/"/g, '""') : String(value);
          return `"${stringValue}"`;
        })
        .join(","),
    ),
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
