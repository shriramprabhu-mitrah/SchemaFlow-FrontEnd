import { Injectable, signal } from '@angular/core';
import { DocPage, DocRevision, DocSection, DocStatus } from '../models/cms-docs.model';

const STORAGE_KEY_SECTIONS = 'dbnexus_cms_v45_sections';
const STORAGE_KEY_PAGES = 'dbnexus_cms_v45_pages';
const STORAGE_KEY_REVISIONS = 'dbnexus_cms_v45_revisions';

@Injectable({
  providedIn: 'root'
})
export class CmsDocsService {
  sections = signal<DocSection[]>([]);
  pages = signal<DocPage[]>([]);
  lastBackendPayload = signal<{ method: string; url: string; payload: any; timestamp: string } | null>(null);

  constructor() {
    this.initStorage();
  }

  private initStorage(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    // Clean up all legacy storage keys
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('dbnexus_cms_') || key.startsWith('msdb_cms_')) && !key.startsWith('dbnexus_cms_v45_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // Ignore storage cleanup issues
    }

    const storedSections = localStorage.getItem(STORAGE_KEY_SECTIONS);
    const storedPages = localStorage.getItem(STORAGE_KEY_PAGES);

    let needsReseed = !storedSections || !storedPages;
    if (storedSections && storedPages) {
      try {
        const parsedSec = JSON.parse(storedSections);
        const parsedPg = JSON.parse(storedPages);
        if (
          parsedSec.length < 5 ||
          !parsedPg.some((p: any) => p.slug === 'refund-policy') ||
          !parsedPg.some((p: any) => p.slug === 'terms-of-service') ||
          !parsedPg.some((p: any) => p.slug === 'privacy-policy') ||
          parsedPg.some((p: any) => p.slug === 'cms-documentation-management' || p.id === '124' || p.id === '102' || p.id === '125' || p.id === '127' || p.slug === 'release-notes-and-changelog')
        ) {
          needsReseed = true;
        }
      } catch {
        needsReseed = true;
      }
    }

    if (needsReseed) {
      const seedSections = this.getSeedSections();
      const seedPages = this.getSeedPages();
      this.saveSectionsToStorage(seedSections);
      this.savePagesToStorage(seedPages);
      this.initSeedRevisions(seedPages);
      this.sections.set(seedSections);
      this.pages.set(seedPages);
    } else {
      try {
        let parsedSections: DocSection[] = JSON.parse(storedSections!);
        let parsedPages: DocPage[] = JSON.parse(storedPages!);

        // Filter out obsolete sections and pages
        parsedSections = parsedSections.filter(s => s.id !== 'sec-cms-management' && s.slug !== 'documentation-cms-management');
        parsedPages = parsedPages.filter(p =>
          p.id !== '102' &&
          p.id !== '108b' &&
          p.id !== '124' &&
          p.slug !== 'architecture-and-compiler-pipeline' &&
          p.slug !== 'keyboard-shortcuts' &&
          p.slug !== 'cms-documentation-management' &&
          p.slug !== 'sso-and-security-compliance' &&
          p.slug !== 'branching-and-pull-requests'
        );

        // Ensure refund-policy is in parsedPages with correct section and status
        let refundPolicyPage = parsedPages.find(p => p.slug === 'refund-policy');
        if (!refundPolicyPage) {
          const refundSeed = this.getSeedPages().find(p => p.slug === 'refund-policy');
          if (refundSeed) {
            parsedPages.push(refundSeed);
          }
        } else {
          refundPolicyPage.sectionId = 'sec-legal';
          refundPolicyPage.status = 'published';
          refundPolicyPage.sortOrder = 2;
        }

        const termsPage = parsedPages.find(p => p.slug === 'terms-of-service');
        if (termsPage) {
          termsPage.sortOrder = 3;
        }

        // Sanitize any legacy text references, YouTube videos, and image URLs inside stored pages
        parsedPages = parsedPages.map(p => {
          let updatedContent = p.content ? p.content.replace(/MSDBDiagram/gi, 'DB Nexus') : p.content;
          if (updatedContent) {
            updatedContent = updatedContent
              .replace(/!\[[^\]]*\]\(assets\/images\/[^\)]+\)/gi, '')
              .replace(/assets\/images\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|gif)/gi, '')
              .replace(/!\[(?:canvas:)?[^\]]*\]\((?:assets\/images\/|url)[^\)]*\)/gi, '')
              .replace(/## Video Walkthrough & Platform Overview\s*Watch the 3-minute video overview below to see DB Nexus in action:\s*!\[video:[^\]]*\]\(https:\/\/www\.youtube\.com\/[^\)]+\)/g, '')
              .replace(/## Video Tutorial\s*Watch this quick 2-minute video walkthrough:\s*!\[video:[^\]]*\]\(https:\/\/www\.youtube\.com\/[^\)]+\)/g, '')
              .replace(/!\[video:[^\]]*\]\(https:\/\/www\.youtube\.com\/[^\)]+\)/g, '');
          }
          return {
            ...p,
            title: p.title.replace(/MSDBDiagram/gi, 'DB Nexus'),
            slug: p.slug.replace(/msdbdiagram/gi, 'db-nexus'),
            description: p.description ? p.description.replace(/MSDBDiagram/gi, 'DB Nexus') : p.description,
            content: updatedContent,
            seoTitle: p.seoTitle ? p.seoTitle.replace(/MSDBDiagram/gi, 'DB Nexus') : p.seoTitle,
            seoDescription: p.seoDescription ? p.seoDescription.replace(/MSDBDiagram/gi, 'DB Nexus') : p.seoDescription
          };
        });

        this.savePagesToStorage(parsedPages);
        this.sections.set(parsedSections);
        this.pages.set(parsedPages);
      } catch (e) {
        console.error('Failed to parse CMS docs storage, reinitializing seed data', e);
        const seedSections = this.getSeedSections();
        const seedPages = this.getSeedPages();
        this.saveSectionsToStorage(seedSections);
        this.savePagesToStorage(seedPages);
        this.sections.set(seedSections);
        this.pages.set(seedPages);
      }
    }
  }

  // ================= SECTIONS CRUD =================

  getSections(): DocSection[] {
    return this.sections();
  }

  saveSection(section: Partial<DocSection>): DocSection {
    const list = [...this.sections()];
    let saved: DocSection;
    if (section.id) {
      const idx = list.findIndex(s => s.id === section.id);
      if (idx !== -1) {
        saved = { ...list[idx], ...section } as DocSection;
        list[idx] = saved;
      } else {
        saved = section as DocSection;
        list.push(saved);
      }
    } else {
      saved = {
        id: 'sec-' + Date.now(),
        title: section.title || 'New Section',
        slug: section.slug || this.slugify(section.title || 'New Section'),
        sortOrder: list.length + 1,
        showHeading: true
      };
      list.push(saved);
    }
    this.saveSectionsToStorage(list);
    this.sections.set(list);
    this.recordBackendLog('POST', '/api/v1/cms/sections', saved);
    return saved;
  }

  deleteSection(id: string): void {
    const list = this.sections().filter(s => s.id !== id);
    this.saveSectionsToStorage(list);
    this.sections.set(list);
    this.recordBackendLog('DELETE', `/api/v1/cms/sections/${id}`, { id });
  }

  // ================= PAGES CRUD =================

  getPages(): DocPage[] {
    return this.pages();
  }

  getPublishedPages(): DocPage[] {
    return this.pages().filter(p => p.status === 'published');
  }

  getPageById(id: string): DocPage | undefined {
    return this.pages().find(p => p.id === id);
  }

  getPageBySlug(slug: string): DocPage | undefined {
    return this.pages().find(p => p.slug === slug && p.status === 'published') ||
      this.pages().find(p => p.slug === slug);
  }

  savePage(pageData: Partial<DocPage>, changeSummary: string = 'Updated page content'): DocPage {
    const list = [...this.pages()];
    let savedPage: DocPage;
    const now = new Date().toISOString();

    if (pageData.id) {
      const idx = list.findIndex(p => p.id === pageData.id);
      if (idx !== -1) {
        const existing = list[idx];
        savedPage = {
          ...existing,
          ...pageData,
          updatedAt: now,
          updatedBy: 'Super Admin'
        } as DocPage;
        list[idx] = savedPage;
      } else {
        savedPage = {
          id: pageData.id,
          title: pageData.title || 'Untitled Page',
          slug: pageData.slug || this.slugify(pageData.title || 'Untitled Page'),
          description: pageData.description || '',
          sectionId: pageData.sectionId || 'sec-intro',
          parentId: pageData.parentId || null,
          content: pageData.content || '',
          sortOrder: pageData.sortOrder ?? list.length + 1,
          status: pageData.status || 'draft',
          createdBy: 'Super Admin',
          updatedBy: 'Super Admin',
          createdAt: now,
          updatedAt: now,
          publishedAt: pageData.status === 'published' ? now : undefined,
          seoTitle: pageData.seoTitle,
          seoDescription: pageData.seoDescription,
          featuredImage: pageData.featuredImage
        };
        list.push(savedPage);
      }
    } else {
      const newId = '10' + (list.length + 1);
      savedPage = {
        id: newId,
        title: pageData.title || 'Untitled Page',
        slug: pageData.slug || this.slugify(pageData.title || 'Untitled Page'),
        description: pageData.description || '',
        sectionId: pageData.sectionId || 'sec-intro',
        parentId: pageData.parentId || null,
        content: pageData.content || '',
        sortOrder: pageData.sortOrder ?? list.length + 1,
        status: pageData.status || 'draft',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: now,
        updatedAt: now,
        publishedAt: pageData.status === 'published' ? now : undefined,
        seoTitle: pageData.seoTitle,
        seoDescription: pageData.seoDescription,
        featuredImage: pageData.featuredImage
      };
      list.push(savedPage);
    }

    this.savePagesToStorage(list);
    this.pages.set(list);
    this.createRevision(savedPage, changeSummary);
    this.recordBackendLog('POST', `/api/v1/cms/docs/pages`, savedPage);
    return savedPage;
  }

  publishPage(id: string): DocPage | undefined {
    const page = this.getPageById(id);
    if (page) {
      const updated = this.savePage({
        ...page,
        status: 'published',
        publishedAt: new Date().toISOString()
      }, 'Published live page');
      this.recordBackendLog('PATCH', `/api/v1/cms/docs/${id}/publish`, { id, status: 'published' });
      return updated;
    }
    return undefined;
  }

  unpublishPage(id: string): DocPage | undefined {
    const page = this.getPageById(id);
    if (page) {
      const updated = this.savePage({
        ...page,
        status: 'draft'
      }, 'Unpublished page to draft');
      this.recordBackendLog('PATCH', `/api/v1/cms/docs/${id}/unpublish`, { id, status: 'draft' });
      return updated;
    }
    return undefined;
  }

  deletePage(id: string): void {
    const list = this.pages().filter(p => p.id !== id);
    this.savePagesToStorage(list);
    this.pages.set(list);
    this.recordBackendLog('DELETE', `/api/v1/cms/docs/pages/${id}`, { id });
  }

  duplicatePage(id: string): DocPage | undefined {
    const page = this.getPageById(id);
    if (!page) return undefined;

    const dup = this.savePage({
      title: `${page.title} (Copy)`,
      slug: `${page.slug}-copy`,
      description: page.description,
      sectionId: page.sectionId,
      parentId: page.parentId,
      content: page.content,
      status: 'draft',
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      featuredImage: page.featuredImage
    }, 'Duplicated page');

    return dup;
  }

  // ================= REVISION HISTORY =================

  getRevisions(pageId: string): DocRevision[] {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_REVISIONS);
    if (!raw) return [];
    try {
      const all: DocRevision[] = JSON.parse(raw);
      return all.filter(r => r.pageId === pageId).sort((a, b) => b.version - a.version);
    } catch {
      return [];
    }
  }

  restoreRevision(pageId: string, revisionId: string): DocPage | undefined {
    const revisions = this.getRevisions(pageId);
    const rev = revisions.find(r => r.id === revisionId);
    if (!rev) return undefined;

    const page = this.getPageById(pageId);
    if (!page) return undefined;

    const updated = this.savePage({
      ...page,
      title: rev.title,
      content: rev.content,
      status: rev.status
    }, `Restored revision Version ${rev.version}`);

    this.recordBackendLog('POST', `/api/v1/cms/docs/${pageId}/restore`, { pageId, revisionId, version: rev.version });
    return updated;
  }

  private createRevision(page: DocPage, summary: string): void {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY_REVISIONS);
    let all: DocRevision[] = [];
    if (raw) {
      try { all = JSON.parse(raw); } catch { all = []; }
    }
    const pageRevs = all.filter(r => r.pageId === page.id);
    const nextVersion = pageRevs.length + 1;

    const newRev: DocRevision = {
      id: 'rev-' + Date.now(),
      pageId: page.id,
      version: nextVersion,
      title: page.title,
      content: page.content,
      status: page.status,
      createdAt: new Date().toISOString(),
      createdBy: 'Super Admin',
      changeSummary: summary
    };

    all.push(newRev);
    localStorage.setItem(STORAGE_KEY_REVISIONS, JSON.stringify(all));
  }

  // ================= UTILITIES & BACKEND LOGGING =================

  recordBackendLog(method: string, url: string, payload: any): void {
    this.lastBackendPayload.set({
      method,
      url,
      payload,
      timestamp: new Date().toLocaleTimeString()
    });
  }

  exportAsMarkdownFile(page: DocPage): void {
    const frontmatter = `---
id: ${page.id}
title: "${page.title}"
slug: "${page.slug}"
sectionId: "${page.sectionId}"
status: "${page.status}"
order: ${page.sortOrder}
createdAt: "${page.createdAt}"
publishedAt: "${page.publishedAt || ''}"
---

`;
    const fullContent = frontmatter + page.content;
    const blob = new Blob([fullContent], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${page.slug}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private saveSectionsToStorage(sections: DocSection[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SECTIONS, JSON.stringify(sections));
    }
  }

  private savePagesToStorage(pages: DocPage[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PAGES, JSON.stringify(pages));
    }
  }

  private initSeedRevisions(pages: DocPage[]): void {
    if (typeof localStorage === 'undefined') return;
    const revisions: DocRevision[] = [];
    pages.forEach(p => {
      revisions.push({
        id: 'rev-seed-' + p.id + '-1',
        pageId: p.id,
        version: 1,
        title: p.title,
        content: p.content,
        status: p.status,
        createdAt: p.createdAt,
        createdBy: 'System Seed',
        changeSummary: 'Initial page creation'
      });
    });
    localStorage.setItem(STORAGE_KEY_REVISIONS, JSON.stringify(revisions));
  }
  private getSeedSections(): DocSection[] {
    return [
      { id: 'sec-intro', title: 'Introduction', slug: 'introduction', sortOrder: 1, showHeading: true },
      { id: 'sec-getting-started', title: 'Getting Started', slug: 'getting-started', sortOrder: 2, showHeading: true },
      { id: 'sec-canvas-workspace', title: 'Canvas Workspace & Controls', slug: 'canvas-workspace-and-controls', sortOrder: 3, showHeading: true },
      { id: 'sec-dbml-tablegroups', title: 'DBML Syntax & TableGroups', slug: 'dbml-syntax-and-tablegroups', sortOrder: 4, showHeading: true },
      { id: 'sec-datadict-export', title: 'Data Dictionary & Export', slug: 'data-dictionary-and-export', sortOrder: 5, showHeading: true },
      { id: 'sec-version-history', title: 'Version History & Releases', slug: 'version-history-and-releases', sortOrder: 6, showHeading: true },
      { id: 'sec-legal', title: 'Legal & Policy', slug: 'legal-and-policy', sortOrder: 7, showHeading: true }
    ];
  }

  private getSeedPages(): DocPage[] {
    const now = '2026-08-28T10:15:00.000Z';
    return [
      // SECTION 1: INTRODUCTION
      {
        id: '101',
        title: 'Welcome to DB Nexus',
        slug: 'welcome-to-db-nexus',
        description: 'Comprehensive introduction to DB Nexus - the modern declarative database modeling engine powered by DBML.',
        sectionId: 'sec-intro',
        content: `# Welcome to DB Nexus

DB Nexus is an enterprise-grade, web-based visual database design platform engineered around **DBML** (Database Markup Language). It bridges the gap between raw code definitions and interactive relational diagrams, enabling software architects, database administrators, and backend engineers to design, document, and collaborate on database schemas with unprecedented speed.

## Core Capabilities & Architecture

Unlike traditional drag-and-drop database GUI tools that produce opaque proprietary project files, DB Nexus uses a **code-first, declarative paradigm**. You describe your database entities using clean, readable DBML code, and DB Nexus instantaneously compiles your definitions into an interactive, high-performance ER diagram.

### Why Choose Declarative DBML Modeling?

1. **Speed & Efficiency**: Type table structures and foreign key references faster than clicking through multi-step dialog boxes.
2. **Multi-Dialect Code Generation**: Export a single DBML blueprint into production SQL DDL scripts for **PostgreSQL**, **MySQL**, **MS SQL Server**, and **SQLite**.
3. **Visual Canvas Interactivity**: Pan, zoom, drag table cards, group domains into \`TableGroup\` containers, and customize diagram line styles.
4. **Interactive Data Dictionary**: Auto-generate searchable web field tables from column descriptions and field notes.

## Platform Pillars

| Pillar | Capability | Developer Benefit |
| --- | --- | --- |
| **Declarative Code Editor** | Live DBML Code Parsing & Syntax Highlighting | Instant validation of types, constraints, and relationships as you type. |
| **Interactive Visual Canvas** | High-DPI Vector ER Diagrams | Smooth panning, zooming, color-coded domain clustering, and auto-layout. |
| **Reverse Engineering** | SQL DDL & Schema Importers | Convert existing database dumps into visual DBML diagrams in seconds. |
| **Documentation CMS** | Built-in Article & Documentation Manager | Create, edit, and publish rich markdown articles with side-by-side preview. |

> [!NOTE]
> DB Nexus adopts a **Local-First Data Architecture**. Your schema drafts are automatically saved in local browser storage and continuously synchronized with your connected workspace.

> [!TIP]
> Use the theme switcher toggle in the top header bar to switch between dark and light modes. All diagrams and interface panels automatically adapt to your preference.
`,
        sortOrder: 1,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-15T09:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      },

      // SECTION 2: GETTING STARTED
      {
        id: '103',
        title: 'Quick Start Guide',
        slug: 'quick-start-guide',
        description: 'Step-by-step tutorial to build, visualize, and export your first relational database schema in 2 minutes.',
        sectionId: 'sec-getting-started',
        content: `# Quick Start Guide

Follow this guide to create, visualize, and export your first relational database diagram in under 2 minutes.

## Step 1: Open the Workspace Canvas

Navigate to **DB Nexus Application** from the top navigation bar or select an existing project from your dashboard workspace.

## Step 2: Define Core Tables in DBML

Paste the following DBML code snippet into the left editor panel:

\`\`\`dbml
// Define Users Table
Table users  {
  id int [pk, increment]
  username varchar [not null, unique]
}

// Define Orders Table
Table orders {
  id int [pk, increment]
  user_id int [not null, ref: > users.id]
  total_amount decimal(10,2) [not null, default: 0.00]
  order_status varchar [default: 'pending']
  placed_at timestamp [default: \`now()\`]
}

// Group E-Commerce Tables
TableGroup ECommerce {
  users
  orders
}
\`\`\`

## Step 3: Inspect the Interactive Diagram

As soon as you type the code above:

- **Table Cards**: Two color-coded table cards (\`users\` and \`orders\`) appear on the central visual canvas.
- **Relationship Lines**: Connection line linking \`orders.user_id\` -> \`users.id\` renders automatically with cardinality markers (\`1\` to \`N\`).
- **Table Group Box**: An **ECommerce** container box surrounds the tables on the canvas.

## Step 4: Export Production SQL DDL

Click **Export** from the top right action bar and select **Export SQL (PostgreSQL)**. DB Nexus will instantly generate executable SQL migration code:

\`\`\`sql
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "username" VARCHAR UNIQUE NOT NULL
);

CREATE TABLE "orders" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INT NOT NULL,
  "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "order_status" VARCHAR DEFAULT 'pending',
  "placed_at" TIMESTAMP DEFAULT (now())
);

ALTER TABLE "orders" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");
\`\`\`
`,
        sortOrder: 1,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-16T11:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      },
      {
        id: '105',
        title: 'Navigating the Interface',
        slug: 'navigating-the-interface',
        description: 'Complete breakdown of the DB Nexus workspace layout, editor tools, visual canvas, and inspector panels.',
        sectionId: 'sec-getting-started',
        content: `# Navigating the Interface

The DB Nexus application interface is designed for high-efficiency database modeling. It consists of three primary interactive panels:

## 1. Left Panel: DBML Code Editor
- **Line Numbers & Code Folding**: Collapse tables, enums, and table groups for clean code navigation.
- **Real-time Syntax Validation**: Red error highlights pinpoint syntax errors or broken table references immediately.
- **Snippet Autocompletion**: Type keywords like \`Table\`, \`Ref\`, \`Enum\`, and \`TableGroup\` to generate structural blocks quickly.

## 2. Center Panel: Visual Diagram Canvas
- **Interactive SVG Nodes**: Drag table cards by their header bars to customize positioning.
- **Bezier Relationship Lines**: Visual connectors highlight foreign key relationships with active mouse hover effects.
- **Canvas Navigation Bar**: Quick controls for Zoom In (+), Zoom Out (-), Fit to Viewport (100%), Auto-Layout, and Link Style toggle (\`🔗\`).

## 3. Right Panel: Inspector & Workspace Sidebars
- **Schema Inspector**: View aggregated statistics (table count, column count, relationship count, composite indexes).
- **Data Dictionary**: Explore interactive searchable field tables and documentation notes.
- **Export Controls**: Download SQL DDL, SVG vector graphics, or PNG images.
`,
        sortOrder: 2,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-17T15:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      },
      {
        id: '105b',
        title: 'Personal & Team Workspaces Overview',
        slug: 'personal-and-team-workspaces',
        description: 'Learn how to manage private schema drafts in Personal Workspaces and collaborate with team members in Organization Workspaces.',
        sectionId: 'sec-getting-started',
        content: `# Personal & Team Workspaces Overview

DB Nexus allows developers and software engineering teams to manage database diagrams across two workspace types: **Personal Workspaces** and **Team / Organization Workspaces**.

## Personal Workspaces

Every user account comes with a dedicated **Personal Workspace** by default.

- **Private Schema Drafts**: Prototyping workspace for drafting personal database models and side projects.
- **Local-First Browser Persistence**: Your personal schema drafts are saved directly in browser local storage for instant offline availability.
- **Sample Blueprint Gallery**: Load pre-configured database blueprints (e.g. E-Commerce, User Authentication, SaaS Billing) into your personal space with a single click.

## Team / Organization Workspaces

For team projects and enterprise database architecture modeling, DB Nexus provides **Team / Organization Workspaces**.

- **Shared Repository Folders**: Organize diagrams into shared team folders accessible to invited colleagues.
- **Granular Role Access Control (RBAC)**:
  - **Owner**: Full administrative control over workspace settings, team billing, and member access.
  - **Admin**: Create and edit diagrams, manage member invitations, and configure project permissions.
  - **Member / Editor**: Create, edit, and export database diagrams within assigned team projects.
  - **Viewer**: Read-only access to inspect visual ER diagrams, field dictionaries, and export SQL DDL scripts.
- **Workspace Switcher**: Click the workspace selector in the top navigation bar or click **Workspaces** (\`📂 Workspaces\`) to switch context instantly between Personal and Organization environments.
`,
        sortOrder: 3,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-17T16:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      },

      // SECTION 3: CANVAS WORKSPACE & CONTROLS
      {
        id: '106',
        title: 'Canvas Workspace Navigation & Controls',
        slug: 'canvas-workspace-navigation',
        description: 'Master canvas navigation, pan, zoom controls, percentage indicator, link styles, and grid snapping.',
        sectionId: 'sec-canvas-workspace',
        content: `# Canvas Workspace Navigation & Controls

The DB Nexus visual workspace provides full control over diagram navigation, zooming, panning, and relationship connector styles.

## Canvas Panning Controls

| Method | Action |
| --- | --- |
| **Space + Drag** | Hold \`Spacebar\` and drag with Left Mouse Button. |
| **Middle Click Drag** | Hold Middle Mouse Button / Scroll Wheel and drag canvas. |
| **Pan Mode Toggle** | Click the Pan hand button in the canvas toolbar to toggle between selection mode and canvas panning mode. |
| **Touchpad Gestures** | Use two-finger scroll on laptop touchpads to pan smoothly across the canvas. |

## Canvas Zooming & Scale Indicator

- **Zoom Controls**: Click \`+\` (Zoom In) or \`-\` (Zoom Out) in the canvas bottom toolbar.
- **Mouse Wheel**: Hold \`Ctrl\` and scroll up to Zoom In, scroll down to Zoom Out.
- **Zoom Percentage Indicator**: Displays your exact zoom scale percentage (e.g. \`100%\`, \`75%\`, \`125%\`).
- **Fit View / Reset**: Click **Fit View** (\`100%\`) to center and frame all diagram tables inside your viewport window.

## Relationship Connector Link Styles

Click the **Link Style** button (\`🔗\`) in the canvas toolbar to switch relationship line styles:
- **Smoothstep Curved Lines**: Smooth curved Bezier connectors that loop around intermediate table cards cleanly.
- **Straight Direct Lines**: Direct point-to-point lines linking foreign key fields directly.

## Grid & Snap Alignment

Toggle grid background lines on or off from canvas view options to align table cards neatly across the workspace grid.
`,
        sortOrder: 1,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-18T10:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      },
      {
        id: '107',
        title: 'Diagram Hide, Show & Table Card Controls',
        slug: 'diagram-hide-show-and-table-cards',
        description: 'How to collapse table columns, hide/show diagram elements, highlight relationships, and run auto-layout.',
        sectionId: 'sec-canvas-workspace',
        content: `# Diagram Hide, Show & Table Card Controls

DB Nexus makes it easy to organize, collapse, hide, and inspect table cards on your visual diagram canvas.

## Table Card Manipulation

- **Moving Tables**: Click and hold any table card header to drag it across the canvas grid.
- **Collapsing / Hiding Table Columns**: Click the minimize icon (\`_\`) on a table card header to collapse its column list. This hides field rows while keeping the table header visible, keeping large 50+ table diagrams clean and uncluttered!
- **Expanding Table Columns**: Click the expand icon (\`+\`) on a collapsed table card header to restore all columns and data types.

## Highlighting Relationships & Tables

- **Hover Highlight**: Hover your mouse over any table card or column to highlight its connected foreign key relationship lines in bright cyan/blue while dimming unrelated connectors.
- **Table Selection**: Click a table card to pin its relationship connectors in highlighted state.

## Auto-Layout Engine

Click **Auto Organize** from the canvas toolbar to run the automated hierarchical layout engine. It analyzes table foreign key dependencies and positions parent entities at top levels and child entities at lower levels automatically.
`,
        sortOrder: 2,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-18T10:30:00.000Z',
        updatedAt: now,
        publishedAt: now
      },

      // SECTION 4: DBML SYNTAX & TABLEGROUPS
      {
        id: '109',
        title: 'Tables, Columns & Field Constraints',
        slug: 'tables-and-columns-syntax',
        description: 'Exhaustive reference for table declarations, column data types, field constraints, and attributes.',
        sectionId: 'sec-dbml-tablegroups',
        content: `# Tables, Columns & Field Constraints

Tables represent database entities and are defined using the \`Table\` keyword followed by a table name and column definition block.

## Enterprise Schema DBML Code Example

Below is a complete DBML schema definition:

\`\`\`dbml
// 1. Department Table
Table Department {
  DepartmentId int [pk, increment]
  DepartmentName varchar [not null]
  Location varchar
}

// 2. Employee Table
Table Employee  {
  EmployeeId int [pk, increment]
  DepartmentId int [ref: > Department.DepartmentId]
  FirstName varchar [not null]
  LastName varchar [not null]
  Email varchar [unique, not null]
  HireDate date
  Salary decimal(10,2)
  Status varchar [default: 'active']
}

// 3. Project Table
Table Project  {
  ProjectId int [pk, increment]
  ProjectName varchar [not null]
  StartDate date
  EndDate date
}
\`\`\`

## Supported Column Settings

| Attribute | Meaning | Example Syntax |
| --- | --- | --- |
| \`pk\` / \`primary key\` | Primary key designation | \`id int [pk]\` |
| \`increment\` | Auto-incrementing sequence | \`id int [pk, increment]\` |
| \`unique\` | Enforce unique constraint | \`email varchar [unique]\` |
| \`not null\` | Disallow NULL values | \`name varchar [not null]\` |
| \`null\` | Explicitly allow NULL values | \`bio text [null]\` |
| \`default: value\` | Default column value | \`status varchar [default: 'active']\` |
| \`note: 'text'\` | Inline column documentation | \`code varchar [note: 'ISO currency code']\` |
| \`ref: > target.col\` | Inline foreign key reference | \`dept_id int [ref: > departments.id]\` |
`,
        sortOrder: 1,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-19T08:30:00.000Z',
        updatedAt: now,
        publishedAt: now
      },
      {
        id: '110',
        title: 'Relationships & Foreign Keys',
        slug: 'relationships-and-foreign-keys',
        description: 'Complete guide to connecting tables, defining 1-to-1, 1-to-many, and many-to-many references, and foreign key referential actions in DBML.',
        sectionId: 'sec-dbml-tablegroups',
        content: `# Relationships & Foreign Keys

Connecting tables through foreign key references is the foundation of relational database modeling. DB Nexus supports two ways to declare relationships: **Inline Column References** and **Standalone Ref Statements**.

## Relationship Types & DBML Operators

| Relationship Type | DBML Operator | Syntax Example | Visual Connector |
| --- | --- | --- | --- |
| **Many-to-One** | \`>\` | \`orders.user_id > users.id\` | Bezier line showing \`N\` on left, \`1\` on right |
| **One-to-Many** | \`<\` | \`users.id < orders.user_id\` | Bezier line showing \`1\` on left, \`N\` on right |
| **One-to-One** | \`-\` | \`user_profiles.user_id - users.id\` | Bezier line showing \`1\` on left, \`1\` on right |
| **Many-to-Many** | \`<>\` | \`books.id <> authors.id\` | Bezier line showing \`N\` on left, \`N\` on right |

## 1. Inline Column References

Inline references are defined directly inside column attribute brackets:

\`\`\`dbml
Table orders  {
  id int [pk, increment]
  user_id int [not null, ref: > users.id]
  total decimal(10,2)
}
\`\`\`

## 2. Standalone Ref Statements

Standalone \`Ref\` statements allow you to declare relationships outside table definitions:

\`\`\`dbml
// One-to-Many Relationship
Ref: orders.user_id > users.id

// Foreign Key Cascade Actions (On Delete / On Update)
Ref: order_items.order_id > orders.id [delete: cascade, update: no action]
\`\`\`

## 3. Complete Connected Tables Code Example

Below is a complete multi-table blueprint demonstrating how tables connect together:

\`\`\`dbml
// 1. Primary Users Table
Table users  {
  id int [pk, increment]
  username varchar [not null, unique]
  email varchar [not null]
}

// 2. Orders Table Connected to Users
Table orders {
  id int [pk, increment]
  user_id int [not null, ref: > users.id]
  order_date timestamp [default: \`now()\`]
  status varchar [default: 'pending']
}

// 3. Order Items Table Connected to Orders
Table order_items {
  id int [pk, increment]
  order_id int [not null]
  product_name varchar [not null]
  quantity int [default: 1]
  unit_price decimal(10,2) [not null]
}

// Connect Order Items to Orders with Cascade Delete
Ref: order_items.order_id > orders.id [delete: cascade]
\`\`\`

## Automatic Visual Diagram Rendering

As soon as you type foreign key references:
- **Automatic Connectors**: DB Nexus draws curved orthogonal Bezier lines linking foreign key fields to target primary keys.
- **Hover Highlighting**: Moving your mouse over a table card or relationship line highlights all connected foreign key paths.
- **Cardinality Badges**: Displays \`1\` and \`N\` markers on line endpoints.
`,
        sortOrder: 2,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-19T09:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      },
      {
        id: '112b',
        title: 'TableGroups & Domain Clustering',
        slug: 'table-groups-and-clustering',
        description: 'Group related tables into visual domain clusters and boundary boxes.',
        sectionId: 'sec-dbml-tablegroups',
        content: `# TableGroups & Domain Clustering

When building large microservices or enterprise schemas with dozens of tables, **TableGroups** allow you to group related tables into visual domain boundary boxes.

## Declaring Table Groups in DBML

Use the \`TableGroup\` keyword followed by a group name and enclosed table identifiers:

\`\`\`dbml
// Group Authentication & User Tables
TableGroup AuthCluster {
  users
  user_profiles
  sessions
  auth_tokens
}
\`\`\`

## Visual Canvas Representation

On the visual diagram canvas:
- **Domain Boundary Container**: Tables inside a \`TableGroup\` are framed by a labeled colored boundary box container.
- **Simultaneous Group Dragging**: Dragging the \`TableGroup\` boundary container drags all enclosed table cards together across the canvas.
- **Visual Domain Isolation**: Keeps complex database architectures visually organized.
`,
        sortOrder: 3,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-19T10:30:00.000Z',
        updatedAt: now,
        publishedAt: now
      },

      // SECTION 5: DATA DICTIONARY & EXPORT
      {
        id: '112d',
        title: 'Data Dictionary & Schema Annotations',
        slug: 'data-dictionary-and-annotations',
        description: 'Generate searchable web data dictionaries and multi-line schema documentation notes.',
        sectionId: 'sec-datadict-export',
        content: `# Data Dictionary & Schema Annotations

DB Nexus turns your DBML code definitions into an interactive, searchable **Data Dictionary** for team documentation.

## Field Notes & Multi-line Documentation

\`\`\`dbml
Table payments {
  id uuid [pk]
  amount_cents int [not null, note: 'Payment value stored in integer USD cents']

  Note: '''
  The payments table logs all incoming Stripe transactions.
  All amounts are stored as integer cents to prevent floating-point rounding errors.
  '''
}
\`\`\`

## Interactive Data Dictionary View

Switch to the **Data Dictionary** tab in the right sidebar to browse a clean tabular overview of:
- Table descriptions and column data types.
- Primary keys, foreign key references, and default values.
- Searchable filter input to find specific fields across your entire database in milliseconds.
`,
        sortOrder: 1,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-20T08:30:00.000Z',
        updatedAt: now,
        publishedAt: now
      },
      {
        id: '115',
        title: 'Exporting SQL DDL & Images',
        slug: 'exporting-sql-ddl-and-images',
        description: 'Convert DBML visual blueprints into production-ready PostgreSQL, MySQL, SQL Server, and SQLite DDL scripts.',
        sectionId: 'sec-datadict-export',
        content: `# Exporting SQL DDL & Images

Convert your visual DBML diagram into executable SQL migration DDL scripts or high-resolution graphic assets with one click.

## Supported SQL Dialects

- **PostgreSQL DDL**: Generates \`CREATE TABLE\`, foreign key constraints, \`CREATE TYPE AS ENUM\`, and indexes.
- **MySQL / MariaDB**: Generates \`CREATE TABLE\` with inline \`ENGINE=InnoDB\`, \`AUTO_INCREMENT\`, and foreign keys.
- **Microsoft SQL Server**: Generates T-SQL DDL with \`NVARCHAR\`, \`IDENTITY(1,1)\`, and \`CONSTRAINT\` blocks.
- **SQLite**: Generates lightweight SQLite-compatible DDL scripts.

## Image Export Formats

- **SVG (Scalable Vector Graphics)**: Crisp vector format ideal for embedding in web documentation without pixelation.
- **PNG Image**: High-resolution PNG image for team presentations and architecture reports.
`,
        sortOrder: 2,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-21T08:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      },
      {
        id: '117',
        title: 'Importing & Reverse Engineering Schemas',
        slug: 'importing-existing-schemas',
        description: 'Reverse engineer existing PostgreSQL, MySQL, and SQLite DDL dumps into visual DBML diagrams.',
        sectionId: 'sec-datadict-export',
        content: `# Importing & Reverse Engineering Schemas

Have an existing database? DB Nexus can reverse engineer raw \`.sql\` dump files into interactive visual DBML diagrams in seconds.

## Reverse Engineering Workflow

1. Click **Import** from the header action bar.
2. Select your source SQL dialect (**PostgreSQL**, **MySQL**, **SQLite**, or **Rails schema.rb**).
3. Upload your \`.sql\` script file or paste SQL text into the import panel.
4. Click **Parse & Reverse Engineer**. DB Nexus automatically converts your SQL schema into clean DBML code and generates the visual canvas layout.
`,
        sortOrder: 3,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-21T09:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      },

      // SECTION 6: VERSION HISTORY & RELEASES
      {
        id: '126',
        title: 'Diagram Revisions & Version History',
        slug: 'diagram-revisions-and-version-history',
        description: 'Track schema edit history, inspect past snapshots, and restore prior diagram versions.',
        sectionId: 'sec-version-history',
        content: `# Diagram Revisions & Version History

DB Nexus automatically tracks schema modifications and maintains an immutable **Version History** log for all database diagrams and CMS documentation articles.

## Core Capabilities

- **Automatic Edit Snapshots**: Whenever a database diagram or article is modified and saved, DB Nexus records a version snapshot (\`v1\`, \`v2\`, \`v3\`, ...).
- **Revision Metadata**: Every snapshot records the exact version number, author timestamp, author user name, change summary, and full schema code.
- **Side-by-Side Version Comparison**: Inspect prior schema states to review what tables, columns, or relationships changed over time.
- **One-Click Version Restore**: Restore any previous diagram version or article snapshot with a single click.

## Accessing Version History

1. Open any diagram or article in the editor workspace.
2. Navigate to the **Versions & History** tab in the right inspector panel.
3. Browse the chronological list of historical revisions.
4. Click **Restore Version** to revert the current workspace state to that revision.
`,
        sortOrder: 1,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-08-26T10:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      }
      // SECTION: LEGAL & POLICY
      , {
        id: '113',
        title: 'Privacy Policy',
        slug: 'privacy-policy',
        description: 'DB Nexus Privacy Policy detailing information collection, usage, and protection.',
        sectionId: 'sec-legal',
        content: `# Privacy Policy

**Last Updated: September 11, 2026**

DB Nexus ("we", "us", or "our") operates the DB Nexus website, application, and related services (the "Service"), a collaborative database schema design and documentation platform built around DBML.

This Privacy Policy explains how we collect, use, store, and protect information when you use the Service, and the choices available to you regarding that information. By using DB Nexus, you agree to the collection and use of information as described in this policy. Terms not defined here have the meanings given to them in our Terms of Service.

## 1. Information We Collect

We collect different categories of information to operate, secure, and improve the Service.

### Account and Personal Data

Unless a diagram or workspace is explicitly shared privately, note that diagrams, DBML schemas, and documentation are only accessible to you and the collaborators you invite — private by default within your workspace.

When you register for DB Nexus, we may collect:

- Email address
- First and last name
- Login credentials (stored securely; passwords are never stored in plain text)
- Workspace membership and role information

### Customer Data (Schemas and Diagrams)

As part of using the Service, you create and store content such as:

- DBML schema definitions
- Imported SQL DDL and generated schema structures
- Visual diagram layouts, table groups, and color coding
- Schema documentation and descriptions
- Workspace and collaboration metadata (members, invitations, permissions)

This Customer Data is yours. We process it only as necessary to provide, secure, and improve the Service, as described in our Terms of Service.

### Usage Data

We automatically collect information about how the Service is accessed and used, which may include your IP address, browser type and version, device identifiers, pages visited, time spent on the Service, and diagnostic data.

### Cookies and Tracking Technologies

We use cookies and similar technologies to operate and improve the Service:

- **Session Cookies** — to keep you signed in and operate core functionality.
- **Preference Cookies** — to remember settings such as your active workspace or editor preferences.
- **Security Cookies** — to help detect and prevent fraudulent or unauthorized activity.

You can configure your browser to refuse cookies, though some parts of the Service may not function properly without them.

## 2. How We Use Your Information

We use collected information to:

- Provide, operate, and maintain the Service, including workspaces, diagram rendering, and SQL import/export.
- Authenticate accounts and manage workspace permissions.
- Notify you of important changes to the Service.
- Provide customer support and respond to inquiries.
- Monitor usage to improve performance, reliability, and features.
- Detect, investigate, and prevent technical issues, abuse, or security incidents.

## 3. How We Share Information

We do not sell your personal information or your database schemas.

We may share information with:

- **Service providers** who help us operate the platform (e.g. cloud hosting, authentication, analytics, and payment processing), bound by confidentiality obligations and only permitted to use the data to perform services on our behalf.
- **Collaborators** you explicitly invite into a workspace, according to the permissions you assign.
- **Legal and safety purposes**, where we believe in good faith that disclosure is necessary to comply with a legal obligation, protect the rights or property of DB Nexus, investigate potential wrongdoing, protect user or public safety, or defend against legal liability.
- **Business transfers**, in the event of a merger, acquisition, or sale of assets, subject to standard confidentiality protections.

## 4. International Data Transfers

Your information, including Customer Data, may be processed and stored on servers located outside your own country or jurisdiction, where data protection laws may differ. By using the Service, you consent to this transfer. We take reasonable steps to ensure your data continues to receive an appropriate level of protection wherever it is processed.

## 5. Data Security

We apply reasonable technical and organizational safeguards designed to protect your account and Customer Data, including authentication controls, access permissions, encryption where appropriate, and monitoring. However, no method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security.

You are responsible for safeguarding your account credentials and for not storing sensitive secrets (such as database passwords, API keys, or access tokens) inside schema definitions.

## 6. Data Retention and Deletion

We retain your account information and Customer Data for as long as your account is active or as needed to provide the Service. You may request deletion of your account or specific Customer Data at any time.

We may retain limited information after deletion where reasonably necessary for legal compliance, fraud prevention, security investigations, dispute resolution, or backup and disaster-recovery processes, until such backups are securely overwritten or deleted.

## 7. Local Storage

Certain editing features may temporarily store schema drafts or application state in your browser (local-first architecture) before syncing to DB Nexus cloud services. Local browser storage should not be relied upon as a permanent backup — we recommend exporting and backing up important schemas independently.

## 8. Third-Party Service Providers

We rely on trusted third parties to help deliver the Service, which may include:

- Cloud hosting and infrastructure providers
- Authentication providers
- Analytics services, to help us understand usage patterns
- Payment processors, to handle billing for paid subscriptions

These providers only receive the data necessary to perform their function and are contractually restricted from using it for other purposes. Their own privacy policies govern their handling of any data they process.

## 9. Links to Other Sites

The Service may contain links to third-party websites that are not operated by us. We are not responsible for the content or privacy practices of external sites, and we encourage you to review their policies before providing any information.

## 10. Children's Privacy

DB Nexus is not directed at, and is not intended for use by, individuals under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us so we can delete it.

## 11. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Material changes will be communicated through the Service, by email, or by another appropriate method, and the "Last Updated" date above will be revised accordingly. Continued use of DB Nexus after changes take effect constitutes acceptance of the revised policy.

## 12. Contact Us

If you have questions about this Privacy Policy or how your information is handled, please contact us through the support channels listed on the DB Nexus website.

**DB Nexus**
Database Schema Design & Collaboration Platform

> This Privacy Policy is a product-policy draft for DB Nexus and should be reviewed and finalized by a qualified legal professional before being published as a binding legal document.
`,
        sortOrder: 1,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-09-11T12:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      },
      {
        id: '115',
        title: 'Refund Policy',
        slug: 'refund-policy',
        description: 'DB Nexus strict Refund & Cancellation Policy detailing all final, non-refundable transactions, terms, and conditions.',
        sectionId: 'sec-legal',
        content: `# Refund & Cancellation Policy

**Last Updated: September 25, 2026**

DB Nexus ("we", "us", or "our") provides a web-based, declarative database schema design, collaboration, visual diagramming, and documentation platform built around DBML (Database Markup Language).

Please review this **Refund & Cancellation Policy** carefully prior to purchasing any subscription, plan upgrade, team seats, or digital service on DB Nexus. By purchasing a subscription, adding workspace seats, upgrading your account tier, or otherwise executing a paid transaction with DB Nexus, you expressly acknowledge, understand, and agree to be bound by the terms set forth herein.

---

### STRICT NO-REFUND AND NO-CANCELLATION POLICY

> [!IMPORTANT]
> **ALL SALES, SUBSCRIPTION TRANSACTIONS, UPGRADES, SEAT EXPANSIONS, AND RENEWALS ARE STRICTLY FINAL, NON-REFUNDABLE, AND NON-CANCELLABLE MID-TERM.**
>
> DB Nexus operates under a **strict zero-refund and no-cancellation policy**. Under no circumstances will refunds, charge reversals, payment reimbursements, or prorated credits be provided for any fees paid to DB Nexus once a transaction is successfully processed.

---

## 1. Nature of the Digital SaaS Platform

DB Nexus is a specialized Software-as-a-Service (SaaS) and digital developer platform. Upon payment confirmation:

- Your account receives **immediate, irrevocable provisioning** of cloud workspace infrastructure, real-time collaboration sockets, increased diagram quotas, and database export features.
- Dedicated cloud storage, vector ER diagram layout engines, data dictionary compilers, and AI compute capacity are reserved and instantiated for your account immediately.
- Because access to full digital capabilities, code generation engines, and proprietary software tooling occurs instantaneously upon purchase, standard statutory consumer return or cooling-off periods for physical goods do **not** apply to DB Nexus services.

## 2. No Cancellation of Active Subscription Periods

1. **Term Commitment**: When you subscribe to a DB Nexus monthly, annual, team, or enterprise tier, you commit to the entire duration of the chosen billing cycle.
2. **No Early Termination or Cancellation with Refund**: Subscriptions cannot be cancelled, truncated, or revoked midway through an active billing term for the purpose of obtaining a refund, price adjustment, or prorated credit.
3. **No Partial or Prorated Refunds**: No partial refunds, prorated credits, or fee adjustments will be issued for unused portions of an active subscription period, unutilized workspace seats, dormant diagrams, or underutilized quotas.
4. **Auto-Renewal Management**: You may disable automatic renewal for subsequent billing terms through your workspace account settings prior to your next renewal date. Disabling auto-renewal prevents future charges from occurring on the next billing date; however, your active plan will remain operational until the conclusion of the already-paid billing cycle, and no reimbursement will be issued for the remainder of that term.

## 3. Subscription Tiers, Upgrades & Seat Additions

DB Nexus offers various plans (Free, Pro, Team, Organization/Enterprise) and dynamic seat allotments:

| Transaction Type | Policy Details | Refund Status |
| :--- | :--- | :--- |
| **New Subscriptions** | Instant provisioning of advanced schema modeling, unlimited diagrams, and team collaboration. | **Strictly Non-Refundable** |
| **Subscription Renewals** | Recurring monthly or annual billing for ongoing platform continuity and cloud infrastructure. | **Strictly Non-Refundable** |
| **Tier Upgrades** | Immediate upgrade of feature entitlements, higher diagram quotas, and expanded toolsets. | **Strictly Non-Refundable** |
| **Seat Expansions** | Adding collaborator seats to a team or organization workspace. | **Strictly Non-Refundable** |
| **Seat Reductions** | Removing or deallocating members during an ongoing subscription period. | **No Prorated Refund / No Credit** |
| **AI Assistant Add-ons** | AI model queries, token generation, and computational assistance. | **Strictly Non-Refundable** |

Any changes made to decrease workspace seat counts or downgrade account tiers will only take effect at the conclusion of your current prepaid billing period. No retroactive adjustments or reimbursements are granted for removed seats.

## 4. AI Compute and Digital Consumables

DB Nexus includes artificial intelligence features (e.g., dbnexus AI, automated schema generation, and query assistance). All AI generations, API queries, compute resources, and token quotas consumed through the platform are non-recoverable computational expenditures and are strictly exempt from refunds or credits under all circumstances.

## 5. Account Suspension and Terms Violations

If your account, workspace, or access to DB Nexus is suspended, throttled, or permanently terminated due to:

- A breach of our Terms of Service or acceptable use standards;
- Fraudulent activity, reverse-engineering, security exploits, or unauthorized automated scraping;
- Abuse of team collaboration or sharing features;

you will forfeit all remaining time on your subscription, and **no refund, reimbursement, or compensation of any kind will be granted**.

## 6. Chargeback Policy and Payment Disputes

> [!WARNING]
> By purchasing a subscription with DB Nexus, you agree to resolve any billing questions directly with our support team prior to initiating any dispute with your financial institution or payment provider.

- Filing an unauthorized chargeback or payment dispute against a legitimate charge constitutes a violation of these terms.
- In the event of a chargeback or dispute, DB Nexus reserves the immediate right to suspend or terminate the associated account, revoke all workspace and schema access, and block all associated email addresses and payment methods permanently.
- DB Nexus will submit comprehensive audit logs—including login history, diagram creation records, IP logs, and cryptographic transaction confirmations—to dispute invalid chargebacks.

## 7. Plan Changes and Price Modifications

DB Nexus reserves the right to adjust plan pricing, feature packages, and billing terms at its discretion. Any pricing adjustments will not impact currently active, prepaid terms and will apply only upon future renewals following reasonable advance notification.

## 8. Exceptions

**There are no exceptions to this policy.** Sales, subscription fees, seat fees, and renewals are final across all tiers, geographies, and user types (individual, startup, team, and enterprise).

## 9. Contact Billing Support

If you have questions regarding this Refund & Cancellation Policy or wish to clarify your billing cycle details, please contact:

- **Support**: sales@dbnexus.com
- **Platform**: DB Nexus Documentation & Support Portal

---

**DB Nexus**  
*Declarative Database Modeling & Architecture Platform*
`,
        sortOrder: 2,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-09-25T12:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      },
      {
        id: '114',
        title: 'Terms of Service',
        slug: 'terms-of-service',
        description: 'DB Nexus Terms of Service outlining the rules and regulations for the use of our platform.',
        sectionId: 'sec-legal',
        content: `# Terms of Service

**Last Updated: September 11, 2026**

Welcome to **DB Nexus**. These Terms of Service ("Terms") govern your access to and use of the DB Nexus website, applications, APIs, workspaces, and related services (collectively, the **"Platform"** or **"Service"**).

By creating an account, accessing, or using DB Nexus, you acknowledge that you have read, understood, and agree to these Terms.

**Important:** If you do not agree with these Terms, please do not access or use DB Nexus.

## 1. About DB Nexus

DB Nexus is a web-based database schema design and collaboration platform built around **DBML (Database Markup Language)**.

The Platform enables developers, database administrators, software architects, and engineering teams to design, visualize, document, and collaborate on database schemas.

DB Nexus provides tools for transforming declarative database definitions into interactive visual representations and production-ready SQL scripts.

### Core Services

DB Nexus may provide the following capabilities:

1. **DBML Schema Design** — Create and edit database schemas using DBML.
2. **Visual ER Diagrams** — Visualize tables, columns, relationships, indexes, and constraints.
3. **SQL Import** — Import supported SQL DDL definitions and convert them into database schemas.
4. **SQL Generation** — Generate SQL DDL for supported database engines.
5. **Table Groups** — Organize database tables into logical domains or functional groups.
6. **Schema Documentation** — Document database structures, columns, relationships, and business definitions.
7. **Workspaces** — Organize schemas and projects within personal or collaborative workspaces.
8. **Collaboration** — Share and work on database designs with authorized team members.
9. **Export** — Export supported schemas and diagrams into available formats.

Features may vary depending on your account type, subscription, or plan.

## 2. Account Registration

Certain DB Nexus features require an account.

When creating an account, you agree to provide accurate and current information.

You are responsible for:

- Maintaining the confidentiality of your login credentials.
- Keeping your account information accurate.
- Protecting access to your account.
- All activities performed through your account.
- Notifying DB Nexus if you believe your account has been compromised.

You must not use another person's account without authorization.

**Warning:** Never store database passwords, API keys, access tokens, private keys, or other credentials inside DB Nexus schema definitions.

## 3. Workspaces and Collaboration

DB Nexus may allow users to create personal or collaborative workspaces.

Workspace owners and administrators are responsible for managing workspace access.

This may include:

- Inviting users.
- Removing users.
- Assigning permissions.
- Managing workspace members.
- Controlling access to schemas.
- Managing shared database documentation.

Users who are granted access to a workspace may be able to view, modify, or export workspace content depending on their assigned permissions.

**Note:** Sharing a workspace or schema with another user may give that user access to the information contained within the shared resource. Always verify permissions before sharing confidential database designs.

## 4. Customer Data

For purposes of these Terms, **"Customer Data"** means information submitted, created, uploaded, or stored by you through DB Nexus.

Customer Data may include:

- DBML definitions.
- SQL schema definitions.
- Table structures.
- Column definitions.
- Relationships.
- Index definitions.
- Constraints.
- Table groups.
- Diagram configurations.
- Documentation.
- Schema descriptions.
- Workspace content.

You retain ownership of your Customer Data.

DB Nexus does not claim ownership of your database schemas, diagrams, or documentation.

You grant DB Nexus a limited, non-exclusive right to host, store, process, reproduce, transmit, and display Customer Data only as reasonably necessary to provide, maintain, secure, and improve the Service.

## 5. Database Schema Information

DB Nexus is primarily designed for **database schema design and documentation**.

The Platform is not intended to act as a database hosting service.

For example, a schema may contain:

\`\`\`dbml
Table Users {
    id int [pk]
    username varchar
    email varchar
}

Table Orders {
    id int [pk]
    user_id int
}
\`\`\`

This represents database **structure**, rather than the actual records stored inside the database.

DB Nexus users are responsible for determining what information they submit to the Platform.

**Warning:** Do not intentionally upload production database records, database credentials, passwords, authentication tokens, encryption keys, or other secrets unless a specific DB Nexus feature explicitly requires and supports such information.

## 6. Acceptable Use

You agree to use DB Nexus only for lawful and authorized purposes.

You must not:

1. Attempt to gain unauthorized access to another user's account or workspace.
2. Circumvent authentication or security controls.
3. Upload malicious software or harmful code.
4. Interfere with the operation of the Platform.
5. Abuse APIs, automated systems, or infrastructure.
6. Perform unauthorized security testing against the Platform.
7. Attempt to reverse engineer security mechanisms.
8. Scrape or systematically collect Platform data without authorization.
9. Impersonate another person or organization.
10. Use DB Nexus to violate applicable laws or regulations.
11. Upload content that infringes third-party intellectual property rights.
12. Use the Platform to distribute malware, phishing content, or other harmful material.

DB Nexus may restrict, suspend, or terminate accounts that violate these requirements.

## 7. Intellectual Property

DB Nexus and its underlying technology are protected by applicable intellectual property laws.

This includes, where applicable:

- Software.
- Source code.
- User interface.
- Platform architecture.
- Visual designs.
- Branding.
- Logos.
- Documentation.
- APIs.
- Proprietary functionality.

Except for rights expressly granted under these Terms, no ownership rights are transferred to you.

Your use of DB Nexus does not grant you ownership of the DB Nexus Platform or its underlying technology.

## 8. Your Content and Rights

You are responsible for ensuring that you have the necessary rights to submit Customer Data to DB Nexus.

You represent that your Customer Data:

- Does not unlawfully infringe third-party rights.
- Does not violate applicable laws.
- Does not contain unauthorized confidential information.
- Can legally be processed by DB Nexus for the purposes described in these Terms.

DB Nexus does not claim ownership of your original database schemas or documentation.

## 9. Sharing and Public Content

DB Nexus may provide functionality for sharing schemas, diagrams, documentation, or workspaces.

If you choose to make content publicly accessible, you understand that other users or Internet users may be able to access that content depending on the sharing configuration.

You are responsible for determining whether content should be:

- Private.
- Shared with selected users.
- Shared with a workspace.
- Publicly accessible.

**Warning:** Do not publish proprietary database architecture, confidential business information, credentials, or sensitive information through public sharing features.

## 10. Third-Party Services

DB Nexus may rely on third-party services to provide certain functionality.

These services may include:

- Cloud infrastructure.
- Authentication providers.
- Database services.
- File storage.
- Email providers.
- Payment processors.
- Analytics services.
- Monitoring services.

Your use of certain third-party services may also be subject to their respective terms and privacy policies.

DB Nexus is not responsible for the independent operation of third-party services.

## 11. Platform Availability

DB Nexus is designed to provide a reliable and continuously available service.

However, we do not guarantee that the Platform will always be:

- Available.
- Error-free.
- Uninterrupted.
- Completely secure.
- Free from defects.

Service interruptions may occur because of:

- Scheduled maintenance.
- Infrastructure failures.
- Software updates.
- Network failures.
- Security incidents.
- Third-party service failures.
- Events outside our reasonable control.

## 12. Local-First and Cloud Synchronization

Certain DB Nexus functionality may use a **local-first architecture**, where schema drafts or temporary application state may be stored within your browser or local device before synchronization with a connected workspace.

Depending on the feature being used, data may subsequently be synchronized with DB Nexus cloud services.

Users are responsible for maintaining appropriate backups of important schemas and documentation.

**Note:** Local browser storage should not be considered a guaranteed backup or permanent storage mechanism.

## 13. Subscription Plans

Certain DB Nexus features may require a paid subscription.

Subscription plans may define:

| Category | Examples |
| --- | --- |
| **Users** | Number of workspace members |
| **Projects** | Number of available projects |
| **Storage** | Available cloud storage |
| **Collaboration** | Team collaboration capabilities |
| **Exports** | Supported export functionality |
| **Documentation** | Documentation capabilities |
| **API Usage** | API or integration limits |

Specific limits and features depend on the plan selected by the customer.

DB Nexus may introduce new plans or modify existing plans.

## 14. Billing and Renewal

Paid subscriptions are billed according to the billing period selected during purchase.

Depending on the applicable subscription:

- Subscriptions may automatically renew.
- Applicable taxes may be added.
- Payment information must remain valid.
- Subscription fees may be non-refundable except where required by law or explicitly stated otherwise.

You authorize DB Nexus or its payment provider to charge applicable subscription fees.

## 15. Cancellation

You may cancel a subscription using the cancellation mechanisms provided by DB Nexus.

Cancellation generally prevents future renewal but does not automatically provide a refund for a previously paid subscription period unless otherwise specified.

After cancellation or expiration:

- Paid features may become unavailable.
- Workspace limits may change.
- Export functionality may be restricted.
- Additional storage may no longer be available.

## 16. Data Export

DB Nexus may provide tools for exporting database schemas, diagrams, documentation, or other supported content.

Supported export formats may include:

- DBML.
- PostgreSQL SQL.
- MySQL SQL.
- Microsoft SQL Server SQL.
- SQLite SQL.
- SVG.
- PDF.
- Other formats introduced by the Platform.

Export availability may depend on the applicable plan.

**Tip:** We recommend maintaining independent backups of important database schemas and documentation.

## 17. Data Deletion

Users may request deletion of their account or applicable Customer Data.

When data is deleted, it may become permanently unrecoverable.

Certain information may be retained where reasonably necessary for:

- Legal compliance.
- Accounting requirements.
- Fraud prevention.
- Security investigations.
- Dispute resolution.
- Enforcement of contractual rights.
- Backup and disaster-recovery processes.

Backup copies may remain temporarily until they are overwritten or securely deleted according to applicable retention procedures.

## 18. Security

DB Nexus implements reasonable technical and organizational safeguards designed to protect Customer Data against unauthorized access, modification, disclosure, or destruction.

Security measures may include:

- Authentication controls.
- Authorization mechanisms.
- Access controls.
- Encryption where appropriate.
- Infrastructure security.
- Monitoring and logging.
- Backup and recovery procedures.

However, no Internet-based system can guarantee absolute security.

You are responsible for maintaining appropriate security practices when using the Platform.

## 19. Privacy

Your use of DB Nexus is also governed by the applicable **Privacy Policy**.

The Privacy Policy explains how DB Nexus may collect, use, store, process, and protect personal information.

Personal information may include information such as:

- Account information.
- Contact information.
- Authentication information.
- Usage information.
- Device and technical information.
- Workspace activity.

The Privacy Policy forms an important part of your relationship with DB Nexus.

## 20. Confidentiality

DB Nexus will treat Customer Data as confidential and will not intentionally disclose Customer Data except where reasonably necessary to:

- Provide the Service.
- Maintain the Platform.
- Provide customer support.
- Protect the security of the Platform.
- Prevent fraud or abuse.
- Comply with applicable law.
- Protect the rights or safety of users and third parties.

You are responsible for determining whether information is appropriate to store or share through DB Nexus.

## 21. Feedback

You may provide DB Nexus with suggestions, feature requests, ideas, or other feedback.

By submitting feedback, you grant DB Nexus the right to use that feedback to improve the Platform without compensation or obligation to you.

Feedback does not include your Customer Data.

## 22. Service Changes

DB Nexus may modify the Platform from time to time.

Changes may include:

- Adding new features.
- Improving existing features.
- Changing user interfaces.
- Removing obsolete functionality.
- Changing technical architecture.
- Introducing new subscription plans.

We may provide notice for material changes where reasonably appropriate.

## 23. Suspension and Termination

DB Nexus may suspend or terminate access to the Platform if:

- You materially violate these Terms.
- You fail to pay applicable fees.
- Your account presents a security risk.
- Your activities threaten the Platform or other users.
- You engage in fraudulent activity.
- Required by applicable law.

Where reasonably possible, DB Nexus may provide notice and an opportunity to resolve the issue before termination.

## 24. Disclaimer of Warranties

To the maximum extent permitted by applicable law, DB Nexus is provided on an **"AS IS"** and **"AS AVAILABLE"** basis.

DB Nexus does not guarantee that:

- The Platform will satisfy every business requirement.
- The Platform will always be available.
- The Platform will be completely error-free.
- All schemas will parse successfully.
- Generated SQL will be suitable for every production environment.
- Imported schemas will always exactly reproduce the original database.
- Data will never be lost.

You are responsible for reviewing generated SQL and validating database changes before applying them to production systems.

**Warning:** SQL generated by DB Nexus should always be reviewed and tested before being executed against a production database.

## 25. Limitation of Liability

To the maximum extent permitted by applicable law, DB Nexus will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages.

This may include damages resulting from:

- Loss of profits.
- Loss of revenue.
- Loss of business opportunities.
- Loss of data.
- Business interruption.
- Service interruption.
- Unauthorized access.
- Reliance on generated database scripts.

To the maximum extent permitted by law, DB Nexus's total liability arising from or relating to the Service will be limited to the amount paid by you for the Service during the applicable period preceding the event giving rise to the claim.

Nothing in these Terms excludes liability that cannot legally be excluded or limited.

## 26. Indemnification

You agree to defend, indemnify, and hold harmless DB Nexus and its operators, affiliates, employees, contractors, and service providers from claims, damages, liabilities, costs, and expenses arising from:

1. Your violation of these Terms.
2. Your misuse of the Platform.
3. Your Customer Data.
4. Your violation of applicable law.
5. Your infringement of third-party rights.
6. Unauthorized use of your account.

## 27. Changes to These Terms

DB Nexus may update these Terms from time to time.

When material changes are made, DB Nexus may provide reasonable notice through:

- The Platform.
- Website notifications.
- Email.
- Other appropriate communication methods.

Your continued use of DB Nexus after the updated Terms become effective constitutes acceptance of the revised Terms to the extent permitted by applicable law.

## 28. Governing Law

These Terms are governed by the laws applicable to the legal entity operating DB Nexus, unless otherwise required by applicable law.

Any dispute relating to DB Nexus will be handled by the courts or dispute-resolution mechanism having appropriate jurisdiction.

The applicable governing law and dispute-resolution provisions may be specified further in an enterprise agreement or other written agreement with DB Nexus.

## 29. Contact

If you have questions regarding these Terms, DB Nexus, your account, or Customer Data, please contact the DB Nexus support team through the contact information provided on the Platform.

**DB Nexus**
Database Schema Design & Collaboration Platform

**Important:** This Terms of Service document is intended as a product-policy draft for DB Nexus. It should be reviewed and finalized by a qualified legal professional before being published as the binding legal agreement for your company.
`,
        sortOrder: 3,
        status: 'published',
        createdBy: 'Super Admin',
        updatedBy: 'Super Admin',
        createdAt: '2026-09-11T12:00:00.000Z',
        updatedAt: now,
        publishedAt: now
      }
    ];
  }
}
