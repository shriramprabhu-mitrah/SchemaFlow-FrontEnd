export type DocStatus = 'draft' | 'published';

export interface DocSection {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  showHeading?: boolean;
}

export interface DocPage {
  id: string;
  title: string;
  slug: string;
  description: string;
  sectionId: string;
  parentId?: string | null;
  content: string; // Raw Markdown text
  sortOrder: number;
  status: DocStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  featuredImage?: string;
}

export interface DocRevision {
  id: string;
  pageId: string;
  version: number;
  title: string;
  content: string;
  status: DocStatus;
  createdAt: string;
  createdBy: string;
  changeSummary: string;
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}
