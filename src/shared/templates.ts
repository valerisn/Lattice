export interface PageTemplate {
  id: string;
  name: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
}
export type TemplateSummary = Pick<
  PageTemplate,
  "id" | "name" | "version" | "updated_at"
>;
