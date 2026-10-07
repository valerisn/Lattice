export interface DocumentationSettings {
  default_state: "draft" | "published";
  reading_width: "comfortable" | "wide";
  show_toc: boolean;
  show_author: boolean;
  show_updated: boolean;
  show_reading_time: boolean;
  footer_text: string;
}

export const defaultDocumentation: DocumentationSettings = {
  default_state: "published",
  reading_width: "comfortable",
  show_toc: true,
  show_author: true,
  show_updated: true,
  show_reading_time: true,
  footer_text: "Made with care. Kept in Lattice.",
};

export function documentationSettings(
  value?: Partial<DocumentationSettings>,
): DocumentationSettings {
  return { ...defaultDocumentation, ...value };
}
