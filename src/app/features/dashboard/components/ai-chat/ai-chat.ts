// import { Component, EventEmitter, Output, inject, signal, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { DashboardService } from '../../../../core/services/dashboard.service';

// export interface ChatMessage {
//   id: string;
//   sender: 'user' | 'assistant';
//   text: string;
//   timestamp: Date;
//   codeSnippet?: string;
//   applied?: boolean;
//   modelName?: string;
// }

// export interface AiModel {
//   id: string;
//   name: string;
//   tag?: string;
//   desc?: string;
// }

// export interface PromptCard {
//   id: string;
//   title: string;
//   desc: string;
//   icon: 'table_groups' | 'timestamp' | 'relationships' | 'indexes' | 'learn' | 'remap';
//   hasChevron?: boolean;
//   prompt: string;
// }

// @Component({
//   selector: 'app-ai-chat',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './ai-chat.html'
// })
// export class AiChatComponent implements AfterViewChecked {
//   @Output() close = new EventEmitter<void>();
//   @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

//   public svc = inject(DashboardService);

//   readonly availableModels: AiModel[] = [
//     {
//       id: 'default',
//       name: 'Default',
//       tag: 'Recommended',
//       desc: 'Optimized for schema generation & DBML'
//     },
//     {
//       id: 'gpt-4o',
//       name: 'GPT-4o',
//       tag: 'Fast & Smart',
//       desc: 'High precision multimodal assistant'
//     },
//     {
//       id: 'claude-3-5-sonnet',
//       name: 'Claude 3.5 Sonnet',
//       tag: 'Best for Code',
//       desc: 'Complex architectural relational reasoning'
//     },
//     {
//       id: 'gemini-1-5-pro',
//       name: 'Gemini 1.5 Pro',
//       tag: 'Long Context',
//       desc: 'Massive context schema analysis'
//     },
//     {
//       id: 'deepseek-v3',
//       name: 'DeepSeek-V3',
//       tag: 'Reasoning',
//       desc: 'Relational schema normalization specialist'
//     }
//   ];

//   selectedModel = signal<AiModel>(this.availableModels[0]);
//   isModelDropdownOpen = signal<boolean>(false);

//   sessionTitle = signal<string>(this.formatSessionTitle());
//   promptText = signal<string>('');
//   isThinking = signal<boolean>(false);
//   messages = signal<ChatMessage[]>([]);
//   copiedSnippetId = signal<string | null>(null);

//   readonly promptCards: PromptCard[] = [
//     {
//       id: 'table_groups',
//       title: 'Create Table Groups',
//       desc: 'Organize your tables into logical groups by domain and functionality with distinct colors',
//       icon: 'table_groups',
//       prompt: 'Create logical TableGroups for my current database schema with distinct domain colors.'
//     },
//     {
//       id: 'timestamp',
//       title: 'Add Timestamp Columns',
//       desc: 'Add created_at and updated_at columns to tables that need audit tracking',
//       icon: 'timestamp',
//       prompt: 'Add created_at and updated_at timestamp audit columns to all tables in my diagram.'
//     },
//     {
//       id: 'relationships',
//       title: 'Add Relationships',
//       desc: 'Automatically detect and add foreign key relationships based on naming conventions',
//       icon: 'relationships',
//       prompt: 'Analyze my tables and generate foreign key references based on column naming conventions.'
//     },
//     {
//       id: 'indexes',
//       title: 'Add Indexes',
//       desc: 'Add index blocks for foreign keys and commonly queried columns',
//       icon: 'indexes',
//       prompt: 'Suggest optimal indexes for primary keys, foreign keys, and frequently filtered fields in my schema.'
//     },
//     {
//       id: 'learn',
//       title: 'Learn Database Design',
//       desc: 'Learn about database design',
//       icon: 'learn',
//       prompt: 'What are the key database normalization rules and best practices for relational design?'
//     },
//     {
//       id: 'remap',
//       title: 'Remap Data Types',
//       desc: 'Convert data types to match your target database system',
//       icon: 'remap',
//       hasChevron: true,
//       prompt: 'Remap my DBML column data types to match PostgreSQL standard conventions.'
//     }
//   ];

//   private shouldScrollToBottom = false;

//   ngAfterViewChecked(): void {
//     if (this.shouldScrollToBottom) {
//       this.scrollToBottom();
//       this.shouldScrollToBottom = false;
//     }
//   }

//   formatSessionTitle(): string {
//     const now = new Date();
//     const dateStr = now.toLocaleDateString('en-US');
//     const timeStr = now.toLocaleTimeString('en-US');
//     return `Chat ${dateStr}, ${timeStr}`;
//   }

//   selectCard(card: PromptCard): void {
//     this.promptText.set(card.prompt);
//     this.sendMessage();
//   }

//   onKeyDown(event: KeyboardEvent): void {
//     if (event.key === 'Enter' && !event.shiftKey) {
//       event.preventDefault();
//       this.sendMessage();
//     }
//   }

//   sendMessage(): void {
//     const text = this.promptText().trim();
//     if (!text || this.isThinking()) return;

//     const userMsg: ChatMessage = {
//       id: 'msg-' + Date.now(),
//       sender: 'user',
//       text,
//       timestamp: new Date()
//     };

//     this.messages.update(prev => [...prev, userMsg]);
//     this.promptText.set('');
//     this.isThinking.set(true);
//     this.shouldScrollToBottom = true;

//     // Simulate AI response stream
//     setTimeout(() => {
//       const response = this.generateResponse(text);
//       this.messages.update(prev => [...prev, response]);
//       this.isThinking.set(false);
//       this.shouldScrollToBottom = true;
//     }, 600);
//   }

//   toggleModelDropdown(event?: Event): void {
//     if (event) event.stopPropagation();
//     this.isModelDropdownOpen.set(!this.isModelDropdownOpen());
//   }

//   selectModel(model: AiModel, event?: Event): void {
//     if (event) event.stopPropagation();
//     this.selectedModel.set(model);
//     this.isModelDropdownOpen.set(false);
//   }

//   closeModelDropdown(): void {
//     this.isModelDropdownOpen.set(false);
//   }

//   @HostListener('document:click', ['$event'])
//   onDocumentClick(event: MouseEvent): void {
//     const target = event.target as HTMLElement | null;
//     if (!target?.closest('.model-dropdown-container')) {
//       this.isModelDropdownOpen.set(false);
//     }
//   }

//   startNewChat(): void {
//     this.messages.set([]);
//     this.sessionTitle.set(this.formatSessionTitle());
//     this.isThinking.set(false);
//     this.promptText.set('');
//     this.isModelDropdownOpen.set(false);
//   }

//   onClose(): void {
//     this.close.emit();
//     // this.svc.closeAiChat();
//   }

//   copySnippet(snippet: string, msgId: string): void {
//     if (!snippet) return;
//     navigator.clipboard.writeText(snippet).then(() => {
//       this.copiedSnippetId.set(msgId);
//       setTimeout(() => {
//         if (this.copiedSnippetId() === msgId) {
//           this.copiedSnippetId.set(null);
//         }
//       }, 2000);
//     });
//   }

//   applySnippet(msg: ChatMessage): void {
//     if (!msg.codeSnippet) return;
//     const currentCode = this.svc.code || '';
//     // Append or apply
//     this.svc.code = currentCode ? `${currentCode.trim()}\n\n${msg.codeSnippet.trim()}\n` : `${msg.codeSnippet.trim()}\n`;
//     msg.applied = true;
//     this.svc.showToast('AI suggestions applied to DBML editor!', 3000, 'success');
//   }

//   private scrollToBottom(): void {
//     if (this.messagesContainer?.nativeElement) {
//       const el = this.messagesContainer.nativeElement;
//       el.scrollTop = el.scrollHeight;
//     }
//   }

//   private generateResponse(query: string): ChatMessage {
//     const q = query.toLowerCase();
//     let text = '';
//     let codeSnippet = '';

//     if (q.includes('group') || q.includes('tablegroup')) {
//       text = "I've structured your database schema into logical domain groups with cohesive colors:";
//       codeSnippet = `TableGroup Core_User_Domain [color: #0284c7] {
//   users
//   profiles
//   accounts
// }

// TableGroup Interaction_Domain [color: #10b981] {
//   posts
//   follows
//   comments
// }`;
//     } else if (q.includes('timestamp') || q.includes('audit')) {
//       text = "Here are the recommended standard audit timestamp fields for tracking record lifecycles:";
//       codeSnippet = `// Add to your table definitions:
//   created_at timestamp [default: \`now()\`, note: 'Record creation timestamp']
//   updated_at timestamp [note: 'Record last updated timestamp']`;
//     } else if (q.includes('relationship') || q.includes('foreign key') || q.includes('ref')) {
//       text = "Detected table references based on column naming conventions (`user_id`, `post_id`):";
//       codeSnippet = `Ref: posts.user_id > users.id
// Ref: follows.following_user_id > users.id
// Ref: follows.followed_user_id > users.id`;
//     } else if (q.includes('index') || q.includes('indexes')) {
//       text = "Suggested high-performance index blocks for frequent joins and filtering:";
//       codeSnippet = `Table posts {
//   id integer [pk]
//   user_id integer
//   status varchar
//   created_at timestamp

//   indexes {
//     user_id [name: 'idx_posts_user_id']
//     (status, created_at) [name: 'idx_posts_status_created']
//   }
// }`;
//     } else if (q.includes('remap') || q.includes('postgres') || q.includes('data type')) {
//       text = "Here are standard PostgreSQL-compatible type mappings for clean SQL export:";
//       codeSnippet = `Table users {
//   id serial [pk]
//   username varchar(50) [not null, unique]
//   role varchar(20) [default: 'member']
//   is_active boolean [default: true]
//   created_at timestamptz [default: \`now()\`]
// }`;
//     } else if (q.includes('learn') || q.includes('design') || q.includes('normalization')) {
//       text = `Here are the foundational principles of effective relational database modeling:
// 1. **Third Normal Form (3NF)**: Every non-key attribute must depend on the primary key, the whole key, and nothing but the key.
// 2. **Predictable Foreign Keys**: Name FK columns after the target table and its primary key (e.g. \`user_id\` -> \`users.id\`).
// 3. **Audit Trails**: Include \`created_at\` and \`updated_at\` on all mutable business entities.
// 4. **Index Selectivity**: Add indexes to columns with high cardinality that appear in \`JOIN\` and \`WHERE\` clauses.`;
//     } else {
//       text = `I've analyzed your request regarding "${query}". Here is the recommended DBML structure:`;
//       codeSnippet = `Table custom_entity {
//   id integer [pk, increment]
//   name varchar [not null]
//   status varchar [default: 'active']
//   created_at timestamp [default: \`now()\`]
// }

// Ref: custom_entity.id < posts.user_id`;
//     }

//     return {
//       id: 'msg-' + Date.now(),
//       sender: 'assistant',
//       text,
//       codeSnippet,
//       modelName: this.selectedModel().name,
//       timestamp: new Date()
//     };
//   }
// }
