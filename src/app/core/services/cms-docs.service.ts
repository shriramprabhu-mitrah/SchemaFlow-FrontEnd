import { Injectable, signal } from '@angular/core';
import { DocPage, DocRevision, DocSection, DocStatus } from '../models/cms-docs.model';

const STORAGE_KEY_SECTIONS = 'dbnexus_cms_v38_sections';
const STORAGE_KEY_PAGES = 'dbnexus_cms_v38_pages';
const STORAGE_KEY_REVISIONS = 'dbnexus_cms_v38_revisions';

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
    const legacyKeys: string[] = [];
    for (let i = 1; i <= 37; i++) {
      legacyKeys.push(`dbnexus_cms_v${i}_sections`, `dbnexus_cms_v${i}_pages`, `dbnexus_cms_v${i}_revisions`);
      legacyKeys.push(`dbnexus_cms_sections_v${i}`, `dbnexus_cms_pages_v${i}`, `dbnexus_cms_revisions_v${i}`);
    }
    legacyKeys.push('msdb_cms_sections_v1', 'msdb_cms_pages_v1', 'msdb_cms_revisions_v1');
    legacyKeys.forEach(key => localStorage.removeItem(key));

    const storedSections = localStorage.getItem(STORAGE_KEY_SECTIONS);
    const storedPages = localStorage.getItem(STORAGE_KEY_PAGES);

    let needsReseed = !storedSections || !storedPages;
    if (storedSections && storedPages) {
      try {
        const parsedSec = JSON.parse(storedSections);
        const parsedPg = JSON.parse(storedPages);
        if (parsedSec.length < 5 || parsedPg.some((p: any) => p.slug === 'cms-documentation-management' || p.id === '124' || p.id === '102' || p.id === '125' || p.id === '127' || p.slug === 'release-notes-and-changelog')) {
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
      { id: 'sec-version-history', title: 'Version History & Releases', slug: 'version-history-and-releases', sortOrder: 6, showHeading: true }
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
Table users [headercolor: #3b82f6] {
  id int [pk, increment]
  username varchar [not null, unique]
}

// Define Orders Table
Table orders [headercolor: #10b981] {
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
Table Department [headercolor: #317ec2] {
  DepartmentId int [pk, increment]
  DepartmentName varchar [not null]
  Location varchar
}

// 2. Employee Table
Table Employee [headercolor: #317ec2] {
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
Table Project [headercolor: #10b981] {
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
Table orders [headercolor: #10b981] {
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
Table users [headercolor: #3b82f6] {
  id int [pk, increment]
  username varchar [not null, unique]
  email varchar [not null]
}

// 2. Orders Table Connected to Users
Table orders [headercolor: #10b981] {
  id int [pk, increment]
  user_id int [not null, ref: > users.id]
  order_date timestamp [default: \`now()\`]
  status varchar [default: 'pending']
}

// 3. Order Items Table Connected to Orders
Table order_items [headercolor: #8b5cf6] {
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
    ];
  }
}
