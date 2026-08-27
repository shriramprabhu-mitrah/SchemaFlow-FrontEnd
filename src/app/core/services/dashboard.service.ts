import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable, Subject, catchError, debounceTime, finalize, map, switchMap, tap, throwError, of } from 'rxjs';
import { AuthService } from './auth.service';
import { AppConfigService } from './app-config.service';
import { EntitlementService } from './entitlement.service';
import { SocketService } from './socket.service';

export interface Column {
  name: string;
  type: string;
  pk: boolean;
  notNull: boolean;
  unique: boolean;
  increment: boolean;
  fk: boolean;
  originalName?: string;
  default: boolean;
  defaultVal?: string;
  check: boolean;
  checkVal?: string;
  fkTable?: string;
  fkCol?: string;
}

export interface TableDef {
  id?: string;
  name: string;
  columns: Column[];
  x: number;
  y: number;
  width: number;
  height: number;
  colY: Record<string, number>;
  color?: string;
}

export interface PathPoint {
  x: number;
  y: number;
}

export interface RefDef {
  fromTable: string;
  fromCol: string;
  toTable: string;
  toCol: string;
  waypoints?: PathPoint[];
  color?: string;
  lineNumber?: number;
}

export interface DiagramNote {
  id: number;
  name: string;
  text: string;
  posx: number;
  posy: number;
  width: number;
  height: number;
  color?: string;
  textColor?: string;
  isNew?: boolean;
}

export interface DiagramSummary {
  id: number;
  name: string;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
}

export interface WorkspaceItem {
  id: number;
  name: string;
  type?: string;
  permission?: string;
  status?: string;
  created_at?: string | Date | null;
  user_email?: string;
  profile_pic?: string;
  owneremail?: string;
  ownerprofilepicture?: string;
  workspacename?: string;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  workspaceId?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type Tool = 'select' | 'pan';
export type ContextMenuTarget = '' | 'column' | 'table' | 'connection' | 'empty' | 'tableHeader' | 'groupHeader';
export type SqlDialect = 'postgres' | 'mysql' | 'mssql';


export const SAMPLE = `Table Department {
  DepartmentId int [pk]
  DepartmentName varchar
  Location varchar
}
 
Table Role {
  RoleId int [pk]
  RoleName varchar
}
 
Table Employee {
  EmployeeId int [pk]
  DepartmentId int
  RoleId int
  ManagerId int
  FirstName varchar
  LastName varchar
  Email varchar
  Phone varchar
  HireDate date
  Salary decimal
  Status varchar
}
 
Table Client {
  ClientId int [pk]
  CompanyName varchar
  ContactPerson varchar
  Email varchar
  Phone varchar
}
 
Table Project {
  ProjectId int [pk]
  ClientId int
  ProjectManagerId int
  ProjectName varchar
  StartDate date
  EndDate date
  Status varchar
}
 
Table EmployeeProject {
  EmployeeProjectId int [pk]
  EmployeeId int
  ProjectId int
  AssignedDate date
  AllocationPercentage int
}
 
Table Attendance {
  AttendanceId int [pk]
  EmployeeId int
  AttendanceDate date
  CheckIn time
  CheckOut time
  Status varchar
}
 
Table LeaveRequest {
  LeaveRequestId int [pk]
  EmployeeId int
  LeaveType varchar
  FromDate date
  ToDate date
  Reason varchar
  ApprovalStatus varchar
}
 
Table Timesheet {
  TimesheetId int [pk]
  EmployeeId int
  ProjectId int
  WorkDate date
  HoursWorked decimal
}
 
Table Invoice {
  InvoiceId int [pk]
  ClientId int
  ProjectId int
  InvoiceDate date
  DueDate date
  TotalAmount decimal
  Status varchar
}
 
Table InvoiceItem {
  InvoiceItemId int [pk]
  InvoiceId int
  Description varchar
  Quantity int
  UnitPrice decimal
  Amount decimal
}
 
Table Payment {
  PaymentId int [pk]
  InvoiceId int
  PaymentDate date
  Amount decimal
  PaymentMethod varchar
}
 
Ref: Employee.DepartmentId > Department.DepartmentId
Ref: Employee.RoleId > Role.RoleId
Ref: Employee.ManagerId > Employee.EmployeeId
 
Ref: Project.ClientId > Client.ClientId
Ref: Project.ProjectManagerId > Employee.EmployeeId
 
Ref: EmployeeProject.EmployeeId > Employee.EmployeeId
Ref: EmployeeProject.ProjectId > Project.ProjectId
 
Ref: Attendance.EmployeeId > Employee.EmployeeId
 
Ref: LeaveRequest.EmployeeId > Employee.EmployeeId
 
Ref: Timesheet.EmployeeId > Employee.EmployeeId
Ref: Timesheet.ProjectId > Project.ProjectId
 
Ref: Invoice.ClientId > Client.ClientId
Ref: Invoice.ProjectId > Project.ProjectId
 
Ref: InvoiceItem.InvoiceId > Invoice.InvoiceId
 
Ref: Payment.InvoiceId > Invoice.InvoiceId
`;

export const GROUP_SAMPLE = `TableGroup Organization {
  Department
  Role
  Employee
}
 
TableGroup Client_Projects {
  Client
  Project
  EmployeeProject
}
 
TableGroup HRManagement {
  Attendance
  LeaveRequest
  Timesheet
}
 
TableGroup Finance {
  Invoice
  InvoiceItem
  Payment
}
 
Table Department {
  DepartmentId int [pk]
  DepartmentName varchar
  Location varchar
}
 
Table Role {
  RoleId int [pk]
  RoleName varchar
}
 
Table Employee {
  EmployeeId int [pk]
  DepartmentId int
  RoleId int
  ManagerId int
  FirstName varchar
  LastName varchar
  Email varchar
  Phone varchar
  HireDate date
  Salary decimal
  Status varchar
}
 
Table Client {
  ClientId int [pk]
  CompanyName varchar
  ContactPerson varchar
  Email varchar
  Phone varchar
}
 
Table Project {
  ProjectId int [pk]
  ClientId int
  ProjectManagerId int
  ProjectName varchar
  StartDate date
  EndDate date
  Status varchar
}
 
Table EmployeeProject {
  EmployeeProjectId int [pk]
  EmployeeId int
  ProjectId int
  AssignedDate date
  AllocationPercentage int
}
 
Table Attendance {
  AttendanceId int [pk]
  EmployeeId int
  AttendanceDate date
  CheckIn time
  CheckOut time
  Status varchar
}
 
Table LeaveRequest {
  LeaveRequestId int [pk]
  EmployeeId int
  LeaveType varchar
  FromDate date
  ToDate date
  Reason varchar
  ApprovalStatus varchar
}
 
Table Timesheet {
  TimesheetId int [pk]
  EmployeeId int
  ProjectId int
  WorkDate date
  HoursWorked decimal
}
 
Table Invoice {
  InvoiceId int [pk]
  ClientId int
  ProjectId int
  InvoiceDate date
  DueDate date
  TotalAmount decimal
  Status varchar
}
 
Table InvoiceItem {
  InvoiceItemId int [pk]
  InvoiceId int
  Description varchar
  Quantity int
  UnitPrice decimal
  Amount decimal
}
 
Table Payment {
  PaymentId int [pk]
  InvoiceId int
  PaymentDate date
  Amount decimal
  PaymentMethod varchar
}
 
Ref: Employee.DepartmentId > Department.DepartmentId
Ref: Employee.RoleId > Role.RoleId
Ref: Employee.ManagerId > Employee.EmployeeId
 
Ref: Project.ClientId > Client.ClientId
Ref: Project.ProjectManagerId > Employee.EmployeeId
 
Ref: EmployeeProject.EmployeeId > Employee.EmployeeId
Ref: EmployeeProject.ProjectId > Project.ProjectId
 
Ref: Attendance.EmployeeId > Employee.EmployeeId
 
Ref: LeaveRequest.EmployeeId > Employee.EmployeeId
 
Ref: Timesheet.EmployeeId > Employee.EmployeeId
Ref: Timesheet.ProjectId > Project.ProjectId
 
Ref: Invoice.ClientId > Client.ClientId
Ref: Invoice.ProjectId > Project.ProjectId
 
Ref: InvoiceItem.InvoiceId > Invoice.InvoiceId
 
Ref: Payment.InvoiceId > Invoice.InvoiceId
`;

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  readonly ROW_H = 30;
  readonly HEADER_H = 34;
  readonly CARD_W = 220;
  readonly GRID_SPACING = 22;
  readonly SAMPLE = SAMPLE;
  readonly GROUP_SAMPLE = GROUP_SAMPLE;

  getSampleCode(type: 'normal' | 'group' | boolean = 'normal'): string {
    return type === 'group' ? this.GROUP_SAMPLE : this.SAMPLE;
  }

  getTableHeight(columns: Column[]): number {
    let visibleCount = columns.length;
    if (this.isKeyOnly) {
      visibleCount = columns.filter(c => c.pk || c.fk).length;
    } else if (this.isColumnNameOnly) {
      visibleCount = 0;
    }
    const rowCount = visibleCount + (visibleCount < columns.length ? 1 : 0);
    return this.HEADER_H + rowCount * this.ROW_H;
  }

  private _code = '';
  readonly code$ = new BehaviorSubject<string>(this._code);
  private readonly dbmlChanges$ = new Subject<string>();

  dbmlValidation: any = null;
  dbmlValidationError: any = null;
  isValidatingDbml = false;

  get code(): string {
    return this._code;
  }

  set code(value: string) {
    const normalizedValue = value ? value.replace(/\r\n|\r/g, '\n') : '';
    if (normalizedValue === this._code) return;
    this._code = normalizedValue;
    this.code$.next(normalizedValue);
    
    // INSTANT REAL-TIME COLLAB: Bypass RxJS completely to guarantee emission
    if (this.diagramWorkspaceType() === 'Team' && this.socketService.isConnected) {
      if (this.hasUnsavedChanges()) {
        this.emitCollabChange();
      }
    }
    
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('active_diagram_code', normalizedValue);
    }
    this.queueDbmlValidation();
    // Persist every code change so canvas and editor stay in sync after page reload
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('dbml_code', value);
    }
  }

  /**
   * Force-sets the DBML code even if it equals the current value.
   * Used after programmatic changes like SQL import where the setter's
   * equality guard might silently swallow the update.
   */
  forceSetCode(value: string): void {
    this._code = value;
    this.code$.next(value);
    this.updateGutter();
    this.parseAndLayout();
    this.queueDbmlValidation();
    // Persist imported DBML so it survives page reload
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('dbml_code', value);
    }
  }
  queueDbmlValidation(): void {
    this.dbmlChanges$.next(this.code);
  }
  lineNumbers: number[] = [1];
  gutterTransform = 'translateY(0px)';

  tables: TableDef[] = [];
  refs: RefDef[] = [];
  groups: { id?: number | string; name: string; color: string; tables: string[] }[] = [];
  /** Maps group name → backend id; survives DBML re-parses */
  groupIds: Record<string, number | string> = {};
  noteIds: Record<string, number | string> = {};
  collapsedGroups = new Set<string>();
  groupPositions: Record<string, { x: number; y: number }> = {};

  saveCollapsedGroups(): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('collapsed_groups', JSON.stringify(Array.from(this.collapsedGroups)));
    }
  }

  saveGroupPositions(): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('group_positions', JSON.stringify(this.groupPositions));
    }
  }

  showDocs = false;
  isReadOnly = false;
  publicToken: string = '';
  isDiagramPublic: boolean = true;
  isPublicViewer: boolean = false;
  diagramPassword: string = '';
  readonly diagramNameSignal = signal<string>('');

  get diagramName(): string {
    return this.diagramNameSignal();
  }

  set diagramName(value: string) {
    this.diagramNameSignal.set(value);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('active_diagram_name', value);
    }
  }

  // --- Signals: these three are read directly by templates (header.html),
  // so they need to notify Angular regardless of zone/OnPush/zoneless setup. ---
  diagramId: any = signal<number | null>(null);
  showVersionHistory = signal<boolean>(false);
  selectedVersion = signal<any>(null);
  revertRequested$ = new Subject<void>();
  closeVersionHistory$ = new Subject<void>();

  showUpgradeModal$ = new Subject<string>();

  showUpgradeModal(featureKey: string = ''): void {
    this.showUpgradeModal$.next(featureKey);
  }

  formatVersionDate(dateStr: string | Date): string {
    if (!dateStr) return 'Unknown Date';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const timeStr = date.toLocaleTimeString(undefined, timeOptions);

    if (isToday) {
      return `Today at ${timeStr}`;
    } else if (isYesterday) {
      return `Yesterday at ${timeStr}`;
    } else {
      const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      const dateValStr = date.toLocaleDateString(undefined, dateOptions);
      return `${dateValStr} at ${timeStr}`;
    }
  }

  readonly isDiagramLoading = signal(false);
  readonly isSaving = signal(false);
  readonly diagramWorkspaceType = signal<string>('Personal');
  readonly diagrams = signal<DiagramSummary[]>([]);
  readonly isLoadingDiagrams = signal(false);
  readonly workspaces = signal<WorkspaceItem[]>([]);
  readonly isLoadingWorkspaces = signal(false);
  readonly activeWorkspaceId = signal<number | null>(null);
  readonly _activeWorkspaceName = signal<string>('Personal');
  readonly paneMode = signal<'split' | 'editor' | 'canvas'>('split');
  workspacesFetched = false;

  get activeWorkspaceName(): string {
    return this._activeWorkspaceName();
  }

  /**
   * Sets which workspace is "active" (drives the header label / checkmarks).
   * - id === null  -> Personal workspace
   * - name provided -> use it directly (fastest path, avoids an extra API call)
   * - otherwise try the already-loaded workspaces() list
   * - otherwise fetch the workspace by id from the backend
   */
  setActiveWorkspace(id: number | null, name?: string): void {
    this.activeWorkspaceId.set(id);
    if (id === null) {
      this._activeWorkspaceName.set('Personal');
      return;
    }

    if (name) {
      this._activeWorkspaceName.set(name);
      return;
    }

    // Try to find in loaded workspaces first
    const found = this.workspaces().find(w => w.id === id);
    if (found) {
      this._activeWorkspaceName.set(found.name);
      return;
    }

    this._activeWorkspaceName.set('Workspace');
  }

  // Simple in-service toast, since a validation failure needs to surface to the
  // user immediately rather than fail silently in the auto-save pipeline.
  readonly toastMessage = signal<string | null>(null);
  readonly toastType = signal<'success' | 'error'>('success');
  private toastTimeout: ReturnType<typeof setTimeout> | undefined;
  private invalidRefDeletionTimeout: any = null;

  showDbdocsInstructions = false;
  showCanvasPlaceholder = true;

  exportRequested$ = new Subject<'png' | 'pdf' | 'svg'>();

  triggerExport(format: 'png' | 'pdf' | 'svg'): void {
    this.exportRequested$.next(format);
  }

  hoveredConnectionIndex = -1;
  selectedConnectionIndex = -1;
  showAllConnections = false;
  hoveredTableName: string | null = null;

  view = { x: 40, y: 40, scale: 1 };
  tool: Tool = 'select';
  gridOn = false;
  hasLoadedScale = false;

  readonly editorWidthPct = signal<number>(28);

  tablePositions: Record<string, { x: number; y: number }> = {};
  refColors: Record<string, string> = {};
  groupColors: Record<string, string> = {};
  tableColorsMap: Record<string, string> = {};

  isAllFields = true;
  isKeyOnly = false;
  isColumnNameOnly = false;
  isStraightLine = false;
  isSmoothLine = true;
  isEnabled = false;

  notes: DiagramNote[] = [];

  private originalIsAllFields = true;
  private originalIsKeyOnly = false;
  private originalIsColumnNameOnly = false;
  private originalIsStraightLine = false;
  private originalIsSmoothLine = true;
  private originalIsEnabled = false;
  private originalNotes = '[]';
  
  private originalZoomPercent: number | null = null;
  private originalGridOn: boolean = true;
  private originalShowAllConnections: boolean = false;

  private originalCode = '';
  private originalName = '';
  private originalTablePositions = '{}';
  private originalRefColors = '{}';
  private originalGroupColors = '{}';
  private originalTableColorsMap = '{}';

  readonly unsavedModalVisible = signal(false);
  readonly authModalVisible = signal(false);
  readonly showDiscardButton = signal(true);
  private pendingAction: (() => void) | null = null;
  private pendingCancel: (() => void) | null = null;

  // Observable for redrawing the canvas
  redraw$ = new Subject<void>();
  forceRedraw$ = new Subject<void>();
  readonly splitViewRequested$ = new Subject<void>();
  readonly canvasFitRequested$ = new Subject<void>();

  // Collaboration State
  readonly activeRoomUsers = signal<any[]>([]);
  readonly remoteCursors = signal<Record<number, {line: number, col: number, x?: number, y?: number, username: string, color: string}>>({});

  showDiagramViews = false;
  focusDiagramViewsSearch = false
  readonly _hiddenTables = new Set<string>();
  /** Signal wrapper so Angular effects can track changes */
  readonly hiddenTables = signal<Set<string>>(this._hiddenTables);

  toggleDiagramViews(focusSearch: boolean = false): void {
    this.showDiagramViews = !this.showDiagramViews;
    this.focusDiagramViewsSearch = this.showDiagramViews && focusSearch;
  }

  toggleTableVisibility(tableName: string): void {
    const isHidden = this.isTableHidden(tableName);
    // If table is currently hidden (isHidden=true), set visible=true to show it.
    // If table is currently visible (isHidden=false), set visible=false to hide it.
    this.setTableVisibility(tableName, isHidden);
  }

  setTableVisibility(tableName: string, visible: boolean): void {
    const targets = this.tables.filter(t => {
      if (t.id && t.id === tableName) return true;
      if (t.name === tableName) return true;
      const baseName = t.name.includes('.') ? t.name.split('.')[1] : t.name;
      const paramBase = tableName.includes('.') ? tableName.split('.')[1] : tableName;
      return baseName === paramBase;
    });

    if (visible) {
      this._hiddenTables.delete(tableName);
      if (targets.length > 0) {
        targets.forEach(t => {
          if (t.id) this._hiddenTables.delete(t.id);
          this._hiddenTables.delete(t.name);
        });
      }
    } else {
      this._hiddenTables.add(tableName);
      if (targets.length > 0) {
        targets.forEach(t => {
          if (t.id) this._hiddenTables.add(t.id);
          this._hiddenTables.add(t.name);
        });
      }
    }
    this.hiddenTables.set(new Set(this._hiddenTables));
    this.forceRedraw$.next();
  }

  isTableHidden(name: string): boolean {
    if (!name) return false;
    if (this._hiddenTables.has(name)) return true;

    const parts = name.split('.');
    const baseName = parts.length > 1 ? parts[1] : name;

    for (const h of this._hiddenTables) {
      if (h === name) return true;
      const hParts = h.split('.');
      const hBase = hParts.length > 1 ? hParts[1] : h;
      if (hBase === baseName) {
        if (hParts.length === 1 || parts.length === 1 || h === name) {
          return true;
        }
      }
    }

    return false;
  }



  readonly theme = signal<'dark' | 'light'>('dark');

  toggleTheme(): void {
    const newTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(newTheme);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', newTheme);
      this.applyTheme(newTheme);
    }
  }

  applyTheme(theme: 'dark' | 'light'): void {
    if (typeof document === 'undefined') return;
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly appConfig: AppConfigService,
    private entitlementService: EntitlementService,
    public socketService: SocketService
  ) {
    if (typeof window !== 'undefined') {
      (window as any)._dashboardService = this;
    }
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as 'dark' | 'light';
      if (savedTheme) {
        this.theme.set(savedTheme);
        this.applyTheme(savedTheme);
      }
    }
    this.updateGutter();
    this.loadPersistedState();
    this.updateOriginalState();
    
    // Subscribe to local code changes for instant real-time collab emission
    this.code$.pipe(debounceTime(300)).subscribe(() => {
      console.log('[Collab] code$ emitted. Workspace:', this.diagramWorkspaceType(), 'isConnected:', this.socketService.isConnected);
      if (this.diagramWorkspaceType() === 'Team' && this.socketService.isConnected) {
        console.log('[Collab] Checking unsaved changes. hasUnsaved:', this.hasUnsavedChanges());
        if (this.hasUnsavedChanges()) { // Bypassed canSaveDiagram()
          console.log('[Collab] Emitting collab change!');
          this.emitCollabChange();
        }
      }
    });

    this.dbmlChanges$.pipe(
      debounceTime(500),
      tap(() => {
        this.isValidatingDbml = true;
        this.dbmlValidationError = null;
      }),
      switchMap((dbml) => this.validateDbml(dbml).pipe(
        catchError((error) => {
          this.dbmlValidationError = error;
          this.dbmlValidation = null;
          this.isValidatingDbml = false;
          this.scheduleDraw();
          const errMsg = error?.error?.message || error?.message || 'DBML Validation Failed';
          this.showToast(errMsg, 4000, 'error');

          return EMPTY;
        })
      ))
    ).subscribe((response) => {
      this.dbmlValidation = response;
      this.isValidatingDbml = false;
      this.scheduleDraw();

      const errors = response?.data?.errors ?? response?.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const firstErrMessage = typeof errors[0] === 'string' ? errors[0] : errors[0]?.message;
        if (firstErrMessage) {
          this.showToast(firstErrMessage, 5000, 'error');
        }

        const invalidRefs = this.refs.filter(ref => this.isRefInvalid(ref));
        if (invalidRefs.length > 0) {
          if (this.invalidRefDeletionTimeout) {
            clearTimeout(this.invalidRefDeletionTimeout);
          }
          this.invalidRefDeletionTimeout = setTimeout(() => {
            const currentInvalidRefs = this.refs.filter(ref => this.isRefInvalid(ref));
            if (currentInvalidRefs.length > 0) {
              currentInvalidRefs.forEach((ref) => {
                this.deleteConnectionInCode(ref);
              });
              this.updateGutter();
              this.parseAndLayout();
              this.showToast('Invalid relationship connection removed automatically after 5s.', 4000, 'error');
            }
          }, 5000);
        }
      } else {
        if (this.invalidRefDeletionTimeout) {
          clearTimeout(this.invalidRefDeletionTimeout);
          this.invalidRefDeletionTimeout = null;
        }
        const currentMsg = this.toastMessage();
        if (currentMsg && this.toastType() === 'error' && (currentMsg.startsWith('(') || currentMsg.includes('Foreign key reference'))) {
          this.toastMessage.set(null);
        }
      }
    });

    if (typeof window !== 'undefined') {
      setInterval(() => {
        if (
          this.auth.isLoggedIn() &&
          this.hasUnsavedChanges() &&
          this.canSaveDiagram() &&
          this.validateDiagramName()
        ) {
          // If connected to a Team diagram socket, use socket emit
          if (this.diagramWorkspaceType() === 'Team' && this.socketService.isConnected) {
            this.emitCollabChange();
          } else {
            this.saveDiagram().subscribe();
          }
        }
      }, 5000);
    }
  }

  emitCollabChange(): void {
    const id = this.diagramId();
    if (id) {
      this.socketService.sendChange(id, this.code, this.diagramName, this.buildLayoutPayload());
      this.updateOriginalState();
    }
  }

  loadPersistedState(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      // Running on the server (SSR) — no browser storage available, bail out safely.
      this._code = '';
      return;
    }

    if (localStorage.getItem('drag position')) {
      this.tablePositions = JSON.parse(localStorage.getItem('drag position') || '{}');
    }
    if (localStorage.getItem('ref colors')) {
      this.refColors = JSON.parse(localStorage.getItem('ref colors') || '{}');
    }
    if (localStorage.getItem('group_colors')) {
      this.groupColors = JSON.parse(localStorage.getItem('group_colors') || '{}');
    }
    if (localStorage.getItem('table_colors_map')) {
      this.tableColorsMap = JSON.parse(localStorage.getItem('table_colors_map') || '{}');
    }
    if (localStorage.getItem('collapsed_groups')) {
      try {
        const arr = JSON.parse(localStorage.getItem('collapsed_groups') || '[]');
        this.collapsedGroups = new Set<string>(arr);
      } catch (e) { }
    }
    if (localStorage.getItem('group_positions')) {
      try {
        this.groupPositions = JSON.parse(localStorage.getItem('group_positions') || '{}');
      } catch (e) { }
    }
    const savedCode = localStorage.getItem('dbml_code');
    this._code = savedCode ? savedCode.replace(/(TableGroup\s+["']?[^"'\r\n]+["']?\s*)\[color:\s*[^\]]+\]\s*(\{)/gi, '$1$2') : '';
    this.code$.next(this._code);

    this.paneMode.set('split');
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('dashboard_pane_mode', 'split');
    }

    const draftCode = localStorage.getItem('active_diagram_code');
    const draftName = localStorage.getItem('active_diagram_name');
    const draftIdStr = localStorage.getItem('active_diagram_id');

    if (draftCode !== null) {
      let cleanCode = draftCode.replace(/(TableGroup\s+["']?[^"'\r\n]+["']?\s*)\[color:\s*[^\]]+\]\s*(\{)/gi, '$1$2');
      if (!this.auth.isLoggedIn()) {
        cleanCode = cleanCode.replace(/^\/\/ Note: Without signing in, you cannot save or edit diagrams\r?\n\r?\n/, '');
      }
      this._code = cleanCode;
      this.code$.next(cleanCode);
      this.showCanvasPlaceholder = !cleanCode.trim();
      this.updateGutter();
      this.parseAndLayout();
    }
    if (draftName !== null) {
      this.diagramName = draftName;
    }
    if (draftIdStr !== null && draftIdStr !== 'null') {
      this.diagramId.set(Number(draftIdStr));
    }
  }

  scheduleDraw(): void {
    this.redraw$.next();
  }

  requestSplitView(): void {
    this.splitViewRequested$.next();
  }

  requestCanvasFit(): void {
    this.canvasFitRequested$.next();
  }

  showToast(message: string, duration = 4000, type: 'success' | 'error' = 'success'): void {
    this.toastType.set(type);
    this.toastMessage.set(message);
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = setTimeout(() => this.toastMessage.set(null), duration);
  }

  setPaneMode(val: 'split' | 'editor' | 'canvas'): void {
    this.paneMode.set(val);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('dashboard_pane_mode', val);
    }
  }

  getValidationErrors(): any[] {
    const errors = this.dbmlValidation?.data?.errors ?? this.dbmlValidation?.errors;
    return Array.isArray(errors) ? errors : [];
  }

  getValidationError(): string | null {
    const errors = this.getValidationErrors();
    if (Array.isArray(errors) && errors.length > 0) {
      const errMsg = errors[0]?.message || 'Invalid DBML syntax.';
      const line = errors[0]?.line;
      const col = errors[0]?.column;
      const locationStr = line != null ? `(${line}:${col}) ` : '';
      return `${locationStr}${errMsg}`;
    }
    return null;
  }

  areTypesCompatible(type1: string | undefined, type2: string | undefined): boolean {
    if (!type1 || !type2) return true;
    const norm1 = type1.toLowerCase().replace(/\(.*\)/, '').trim();
    const norm2 = type2.toLowerCase().replace(/\(.*\)/, '').trim();
    if (norm1 === norm2) return true;

    const intTypes = ['int', 'integer', 'bigint', 'smallint', 'tinyint'];
    if (intTypes.includes(norm1) && intTypes.includes(norm2)) return true;

    const stringTypes = ['varchar', 'char', 'text', 'nvarchar', 'varchar2', 'string'];
    if (stringTypes.includes(norm1) && stringTypes.includes(norm2)) return true;

    const decimalTypes = ['decimal', 'numeric', 'float', 'double', 'real'];
    if (decimalTypes.includes(norm1) && decimalTypes.includes(norm2)) return true;

    return false;
  }

  isRefInvalid(ref: RefDef): boolean {
    const fromTab = this.tables.find((t) => t.name === ref.fromTable);
    const toTab = this.tables.find((t) => t.name === ref.toTable);
    if (!fromTab || !toTab) return true;

    const fromColObj = fromTab.columns.find((c) => c.name === ref.fromCol);
    const toColObj = toTab.columns.find((c) => c.name === ref.toCol);
    if (!fromColObj || !toColObj) return true;

    const fromEligible = fromColObj.pk || fromColObj.unique;
    const toEligible = toColObj.pk || toColObj.unique;

    // Local check 1: FK reference MUST point to a primary key or unique column on at least one side
    if (!fromEligible && !toEligible) {
      return true;
    }

    // Local check 2: Data types of connected columns must be compatible (e.g. varchar vs int is invalid)
    if (!this.areTypesCompatible(fromColObj.type, toColObj.type)) {
      return true;
    }

    const backendErrors = this.getValidationErrors();
    if (this.dbmlValidationError) {
      const errObj = this.dbmlValidationError?.error || this.dbmlValidationError;
      const errMsg = typeof errObj === 'string' ? errObj : errObj?.message || '';
      if (errMsg && !backendErrors.includes(errMsg)) {
        backendErrors.push(errMsg);
      }
    }

    for (const err of backendErrors) {
      const msg = typeof err === 'string' ? err : err?.message ?? '';

      // Match Type mismatch error message:
      // "Type mismatch in foreign key reference: 'Categories.CategoryName' is 'varchar' but 'Warehouses.WarehouseId' is 'int'."
      const typeMismatchMatches = [...msg.matchAll(/['"]([^'"]+)\.([^'"]+)['"]/g)];
      if (typeMismatchMatches.length >= 2) {
        const t1Table = typeMismatchMatches[0][1];
        const t1Col = typeMismatchMatches[0][2];
        const t2Table = typeMismatchMatches[1][1];
        const t2Col = typeMismatchMatches[1][2];

        const matchDirect = (ref.fromTable === t1Table && ref.fromCol === t1Col && ref.toTable === t2Table && ref.toCol === t2Col);
        const matchReverse = (ref.fromTable === t2Table && ref.fromCol === t2Col && ref.toTable === t1Table && ref.toCol === t1Col);
        if (matchDirect || matchReverse) {
          return true;
        }
      }

      // Match Field in table error message
      const fieldMatch = msg.match(/Field ['"]([^'"]+)['"] in table ['"]([^'"]+)['"]/i);
      if (fieldMatch) {
        const errCol = fieldMatch[1];
        const errTable = fieldMatch[2];

        const isFromMatch = ref.fromTable === errTable && ref.fromCol === errCol;
        const isToMatch = ref.toTable === errTable && ref.toCol === errCol;
        if (isFromMatch || isToMatch) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Only allow a save when the last DBML validation came back with an empty
   * errors array. If validation hasn't run yet (dbmlValidation is null),
   * saving is still permitted so a brand-new diagram isn't blocked forever.
   */
  canSaveDiagram(): boolean {
    if (this.isReadOnly) {
      return false;
    }

    const errors = this.getValidationErrors();
    if (errors.length > 0) {
      const firstMessage =
        typeof errors[0] === 'string' ? errors[0] : errors[0]?.message ?? 'Invalid DBML syntax.';
      const suffix = errors.length > 1 ? ` (+${errors.length - 1} more)` : '';
      this.showToast(`Cannot save: ${firstMessage}${suffix}`, 4000, 'error');
      return false;
    }
    return true;
  }

  /**
   * Blocks saving with the untouched placeholder name, and blocks saving with
   * a name that collides with another diagram already owned by the user
   * (the diagram currently open is excluded from that check).
   */
  validateDiagramName(): boolean {
    const name = (this.diagramName || '').trim();

    if (!name) {
      this.showToast('Please give your diagram a title before saving.', 4000, 'error');
      return false;
    }



    const currentId = this.diagramId();
    const duplicate = this.diagrams().some(
      (d) => d.id !== currentId && d.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      this.showToast(`A diagram named "${name}" already exists. Please choose a different title.`, 4000, 'error');
      return false;
    }

    return true;
  }

  get zoomPercent(): number {
    return Math.round(this.view.scale * 100);
  }

  get hasTables(): boolean {
    return this.tables.length > 0;
  }

  updateGutter(): void {
    const lines = this.code.split(/\r\n|\r|\n/).length;
    this.lineNumbers = Array.from({ length: lines }, (_, i) => i + 1);
  }

  startAdding(): void {
    // The starter schema must not inherit coordinates from a previously edited diagram.
    this.tablePositions = {};
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.removeItem('drag position');
    }
    this.code = `Table Untitled {
  id int [pk]
}`;
    this.showCanvasPlaceholder = true;
    this.updateGutter();
    this.parseAndLayout();
    this.requestCanvasFit();
    this.updateOriginalState();
  }

  /* ============ DBML PARSER ============ */

  parseDBML(text: string): { tables: { name: string; columns: Column[] }[]; refs: RefDef[]; groups?: any[]; notes?: { name: string; text: string }[] } {
    const tables: { name: string; columns: Column[] }[] = [];
    const refs: RefDef[] = [];
    const groups: { name: string; color: string; tables: string[] }[] = [];

    const tableRe = /Table\s+([A-Za-z0-9_.]+)\s*\{([\s\S]*?)\}/g;
    let m: RegExpExecArray | null;
    while ((m = tableRe.exec(text)) !== null) {
      const name = m[1];
      const body = m[2];
      const cols: Column[] = [];
      body.split('\n').forEach((line) => {
        line = line.trim();
        if (!line || line.indexOf('//') === 0) return;
        const cm = line.match(/^([A-Za-z0-9_]+)\s+([A-Za-z0-9_()]+)\s*(\[(.*)\])?/);
        if (cm) {
          const rawAttrs = cm[4] || '';
          const attrsLower = rawAttrs.toLowerCase();

          const defaultMatch = rawAttrs.match(/default:\s*('[^']*'|"[^"]*"|`[^`]*`|[^,\]]+)/i);
          let defaultVal: string | undefined = undefined;
          let hasDefault = false;
          if (defaultMatch) {
            hasDefault = true;
            let val = defaultMatch[1].trim();
            if ((val.startsWith("'") && val.endsWith("'")) ||
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith('`') && val.endsWith('`'))) {
              val = val.slice(1, -1);
            }
            defaultVal = val;
          }

          const checkMatch = rawAttrs.match(/check:\s*('[^']*'|"[^"]*"|`[^`]*`|[^,\]]+)/i);
          let checkVal: string | undefined = undefined;
          let hasCheck = false;
          if (checkMatch) {
            hasCheck = true;
            let val = checkMatch[1].trim();
            if ((val.startsWith("'") && val.endsWith("'")) ||
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith('`') && val.endsWith('`'))) {
              val = val.slice(1, -1);
            }
            checkVal = val;
          }

          cols.push({
            name: cm[1],
            type: cm[2],
            pk: attrsLower.includes('pk') || attrsLower.includes('primary key'),
            notNull: attrsLower.includes('not null'),
            unique: attrsLower.includes('unique'),
            increment: attrsLower.includes('increment'),
            fk: false,
            default: hasDefault,
            defaultVal,
            check: hasCheck,
            checkVal
          });
        }
      });
      tables.push({ name, columns: cols });
    }

    const refRe = /Ref(?:\s+[A-Za-z0-9_]+)?\s*:\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*(<->|<>|>|<|-)\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g;
    while ((m = refRe.exec(text)) !== null) {
      const matchIndex = m.index;
      const lineNumber = text.substring(0, matchIndex).split('\n').length;
      let fromTable = m[1];
      let fromCol = m[2];
      const relType = m[3];
      let toTable = m[4];
      let toCol = m[5];

      if (relType === '<') {
        const tempTable = fromTable;
        const tempCol = fromCol;
        fromTable = toTable;
        fromCol = toCol;
        toTable = tempTable;
        toCol = tempCol;
      }

      refs.push({
        fromTable,
        fromCol,
        toTable,
        toCol,
        lineNumber: lineNumber
      });
    }

    const groupRe = /TableGroup\s+(?:["']?([A-Za-z0-9_]+)["']?)\s*(?:\[color:\s*([^\]]+)\])?\s*\{([\s\S]*?)\}/gi;
    let gm: RegExpExecArray | null;
    while ((gm = groupRe.exec(text)) !== null) {
      const name = gm[1];
      let color = gm[2] || '';
      if (color.startsWith('color:')) {
        color = color.replace('color:', '').trim();
      }
      const body = gm[3];
      const tableNames = body.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'));
      groups.push({ name, color, tables: tableNames });
    }

    // Parse Note blocks: Note noteName { 'content' }
    const noteRe = /^\s*Note\s+(\w+)\s*\{\s*'([^']*)'\s*\}/gm;
    const parsedNotes: { name: string; text: string }[] = [];
    let nm: RegExpExecArray | null;
    while ((nm = noteRe.exec(text)) !== null) {
      parsedNotes.push({ name: nm[1], text: nm[2] });
    }

    return { tables, refs, groups, notes: parsedNotes };
  }

  ensurePosition(name: string, index: number): { x: number; y: number } {
    if (this.tablePositions[name]) return this.tablePositions[name];
    const perRow = 4;
    const col = index % perRow;
    const row = Math.floor(index / perRow);
    const pos = { x: 60 + col * (this.CARD_W + 150), y: 60 + row * 300 };
    this.tablePositions[name] = pos;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('drag position', this.deterministicStringify(this.tablePositions));
    }
    return pos;
  }

  parseAndLayout(): void {
    const parsed = this.parseDBML(this.code);

    // --- Sync Note blocks from DBML into svc.notes (editor → canvas) ---
    if (!this._syncingNotesToCode) {
      const parsedNotes = parsed.notes ?? [];
      const parsedNames = new Set(parsedNotes.map((n: { name: string }) => n.name));

      const prevCount = this.notes.length;

      // Remove notes deleted from DBML
      this.notes = this.notes.filter(n => parsedNames.has(n.name));

      // Update text of existing notes / add new ones from editor
      parsedNotes.forEach((pn: { name: string; text: string }) => {
        const existing = this.notes.find(n => n.name === pn.name);
        if (existing) {
          if (existing.text !== pn.text) {
            this.notes = this.notes.map(n => n.name === pn.name ? { ...n, text: pn.text } : n);
          }
        } else {
          const id = Date.now() + Math.random();
          const existingCount = this.notes.length;
          this.notes = [...this.notes, {
            id,
            name: pn.name,
            text: pn.text,
            posx: 60 + (existingCount % 3) * 220,
            posy: 400 + Math.floor(existingCount / 3) * 220,
            width: 180,
            height: 180,
            color: '#FFE28B',
            textColor: '#000000'
          }];
        }
      });

      // If notes changed, force Angular change detection so the overlay re-renders
      if (prevCount !== this.notes.length) {
        setTimeout(() => this.forceRedraw$.next(), 0);
      }
    }

    const activeNames = new Set(parsed.tables.map(t => t.name));
    Object.keys(this.tablePositions).forEach((name) => {
      if (!activeNames.has(name)) {
        delete this.tablePositions[name];
      }
    });

    const groups = parsed.groups || [];

    // Automatically position newly added/chosen tables inside the group's existing visual bounds
    groups.forEach((g) => {
      const prevGroup = this.groups.find(pg => pg.name === g.name);
      const hasNewTables = prevGroup
        ? g.tables.some((tName: string) => !prevGroup.tables.includes(tName))
        : g.tables.length > 0;

      if (hasNewTables) {
        let minX = Infinity;
        let maxY = -Infinity;
        if (prevGroup) {
          g.tables.forEach((tName: string) => {
            if (prevGroup.tables.includes(tName)) {
              const pos = this.tablePositions[tName];
              const tDef = parsed.tables.find(t => t.name === tName);
              const tHeight = tDef ? this.getTableHeight(tDef.columns) : 100;
              if (pos) {
                if (pos.x < minX) minX = pos.x;
                if (pos.y + tHeight > maxY) maxY = pos.y + tHeight;
              }
            }
          });
        }

        if (minX !== Infinity && maxY !== -Infinity) {
          const horizGap = 150;
          const vertGap = 60;
          const newTables = g.tables.filter((tName: string) => !prevGroup?.tables.includes(tName));
          const localColHeights = [maxY + vertGap, maxY + vertGap];
          newTables.forEach((tName: string, index: number) => {
            const tDef = parsed.tables.find(t => t.name === tName);
            const tHeight = tDef ? this.getTableHeight(tDef.columns) : 100;
            const col = index % 2;
            const x = minX + col * (this.CARD_W + horizGap);
            const y = localColHeights[col];
            this.tablePositions[tName] = { x, y };
            localColHeights[col] += tHeight + vertGap;
          });
        }
      }
    });

    const groupColors = ['#4f8ff0', '#34a853', '#fbbc05', '#a855f7', '#ec4899', '#14b8a6'];
    const tableToGroupColOffset = new Map<string, number>();
    const tableColors = new Map<string, string>();
    this.groups = groups.map((g, gi) => {
      const defaultColor = groupColors[gi % groupColors.length];
      const color = g.color || this.groupColors[g.name] || defaultColor;
      g.tables.forEach((tableName: string, index: number) => {
        // Lay out tables within the group in a 2-column local grid
        const localCol = index % 2;
        const globalCol = gi * 2 + localCol;
        tableToGroupColOffset.set(tableName, globalCol);
        tableColors.set(tableName, color);
      });
      return {
        ...g,
        id: this.groupIds[g.name],
        color
      };
    });

    const totalTables = parsed.tables.length;
    const numGroupCols = groups.length * 2;
    let perRow = 3;
    if (totalTables > 12) {
      perRow = 5;
    } else if (totalTables > 5) {
      perRow = 4;
    }

    if (groups.length > 0) {
      perRow = Math.max(perRow, numGroupCols + 2);
    }

    const colHeights = Array.from({ length: perRow }, () => 60);
    const horizGap = 150;
    const vertGap = 100;

    parsed.tables.forEach((t) => {
      const height = this.getTableHeight(t.columns);
      if (!this.tablePositions[t.name]) {
        let col = 0;
        if (tableToGroupColOffset.has(t.name)) {
          col = tableToGroupColOffset.get(t.name)!;
        } else {
          let minCol = numGroupCols;
          for (let c = numGroupCols; c < perRow; c++) {
            if (colHeights[c] < colHeights[minCol]) {
              minCol = c;
            }
          }
          col = minCol;
        }
        const x = 60 + col * (this.CARD_W + horizGap);
        const y = colHeights[col];
        this.tablePositions[t.name] = { x, y };
        colHeights[col] += height + vertGap;
      } else {
        const pos = this.tablePositions[t.name];
        const col = Math.min(perRow - 1, Math.max(0, Math.round((pos.x - 60) / (this.CARD_W + horizGap))));
        colHeights[col] = Math.max(colHeights[col], pos.y + height + vertGap);
      }
    });

    // Calculate visual bounding boxes for ALL groups
    const groupBoxes: { left: number; right: number; top: number; bottom: number }[] = [];
    let maxGroupRight = 60;
    let maxGroupBottom = 60;

    groups.forEach((g) => {
      const groupTableNames = new Set(g.tables);
      const memberTables = parsed.tables.filter(t => groupTableNames.has(t.name));
      if (memberTables.length === 0) return;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      memberTables.forEach(t => {
        const pos = this.tablePositions[t.name];
        if (pos) {
          const h = this.getTableHeight(t.columns);
          const w = this.CARD_W;
          if (pos.x < minX) minX = pos.x;
          if (pos.y < minY) minY = pos.y;
          if (pos.x + w > maxX) maxX = pos.x + w;
          if (pos.y + h > maxY) maxY = pos.y + h;
        }
      });

      if (minX !== Infinity && minY !== Infinity) {
        const paddingX = 35;
        const paddingY = 35;
        const box = {
          left: minX - paddingX,
          right: maxX + paddingX,
          top: minY - 50,
          bottom: maxY + paddingY
        };
        groupBoxes.push(box);
        if (box.right > maxGroupRight) maxGroupRight = box.right;
        if (box.bottom > maxGroupBottom) maxGroupBottom = box.bottom;
      }
    });

    // Check all non-group tables against ALL group bounding boxes
    const allGroupTableNames = new Set(groups.flatMap(g => g.tables));
    let nextStandaloneX = 60;
    let nextStandaloneY = maxGroupBottom + 60;

    parsed.tables.forEach(t => {
      if (allGroupTableNames.has(t.name)) return;

      const pos = this.tablePositions[t.name];
      if (!pos) return;

      const tW = this.CARD_W;
      const tH = this.getTableHeight(t.columns);

      const tLeft = pos.x;
      const tRight = pos.x + tW;
      const tTop = pos.y;
      const tBottom = pos.y + tH;

      const overlapsAnyGroup = groupBoxes.some(b =>
        tLeft < b.right && tRight > b.left && tTop < b.bottom && tBottom > b.top
      );

      if (overlapsAnyGroup) {
        if (nextStandaloneX + tW > maxGroupRight + 300) {
          nextStandaloneX = 60;
          nextStandaloneY += 200;
        }
        this.tablePositions[t.name] = { x: nextStandaloneX, y: nextStandaloneY };
        nextStandaloneX += tW + 80;
      }
    });

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('drag position', this.deterministicStringify(this.tablePositions));
    }

    const prevNames = this.tables.map(t => t.name).sort().join(',');
    const newNames = parsed.tables.map(t => t.name).sort().join(',');
    const tablesChanged = prevNames !== newNames;

    this.tables = parsed.tables.map((t) => {
      const pos = this.tablePositions[t.name];
      const height = this.getTableHeight(t.columns);
      const colY: Record<string, number> = {};

      let visibleColumns: Column[] = [];
      if (this.isAllFields) {
        visibleColumns = t.columns;
      } else if (this.isKeyOnly) {
        visibleColumns = t.columns.filter(c => c.pk || c.fk);
      } else if (this.isColumnNameOnly) {
        visibleColumns = [];
      }

      t.columns.forEach((c) => {
        const visibleIndex = visibleColumns.findIndex(vc => vc.name === c.name);
        if (visibleIndex !== -1) {
          colY[c.name] = this.HEADER_H + visibleIndex * this.ROW_H + this.ROW_H / 2;
        } else {
          // Hidden fields point to the center of the "+ N hidden fields" footer
          colY[c.name] = this.HEADER_H + visibleColumns.length * this.ROW_H + this.ROW_H / 2;
        }
      });
      return {
        name: t.name,
        columns: t.columns,
        x: pos.x,
        y: pos.y,
        width: this.CARD_W,
        height,
        colY,
        color: tableColors.get(t.name) || this.tableColorsMap[t.name]
      };
    });

    const prevByKey = new Map(
      this.refs.map((r) => [
        `${r.fromTable}.${r.fromCol}>${r.toTable}.${r.toCol}`,
        { waypoints: r.waypoints, color: r.color }
      ])
    );
    const fkMap = new Map<string, RefDef>();
    parsed.refs.forEach((r) => {
      fkMap.set(`${r.fromTable}.${r.fromCol}`, r);
    });
    this.tables.forEach((t) => {
      t.columns.forEach((c) => {
        const ref = fkMap.get(`${t.name}.${c.name}`);
        c.fk = !!ref;
        c.fkTable = ref ? ref.toTable : undefined;
        c.fkCol = ref ? ref.toCol : undefined;
      });
    });
    this.refs = parsed.refs.map((r) => {
      const key = `${r.fromTable}.${r.fromCol}>${r.toTable}.${r.toCol}`;
      const prev = prevByKey.get(key);
      const persistedColor = this.refColors[key];
      return {
        ...r,
        waypoints: prev?.waypoints,
        color: prev?.color ?? persistedColor
      };
    });

    this.hoveredConnectionIndex = -1;
    this.selectedConnectionIndex = -1;

    this.scheduleDraw();

    if (tablesChanged) {
      this.requestCanvasFit();
    }
  }

  /* ============ ACTIONS ============ */

  addColumnInCode(tableName: string): void {
    const escName = tableName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const re = new RegExp(`(Table\\s+${escName}\\s*\\{[\\s\\S]*?)(\\r?\\n?\\s*\\})`, 'i');
    if (!re.test(this.code)) return;

    // Generate a unique column name
    const tableDef = this.tables.find(t => t.name === tableName);
    let newColName = 'new_column';
    if (tableDef) {
      const existingNames = new Set(tableDef.columns.map(c => c.name));
      let counter = 1;
      while (existingNames.has(newColName)) {
        newColName = `new_column_${counter}`;
        counter++;
      }
    }

    this.code = this.code.replace(re, `$1\n  ${newColName} varchar\n}`);
  }

  renameColumnInCode(tableName: string, oldColName: string, newColName: string): void {
    const escName = tableName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const tableRe = new RegExp(`(Table\\s+${escName}\\s*\\{[\\s\\S]*?\\r?\\n?\\s*\\})`, 'i');
    const match = this.code.match(tableRe);
    if (!match) return;

    const lineRe = new RegExp(`(^|\\r?\\n)(\\s*)${oldColName}(\\s+)`);
    const newBody = match[0].replace(lineRe, `$1$2${newColName}$3`);
    this.code = this.code.replace(tableRe, newBody);
  }

  deleteColumnInCode(tableName: string, colName: string): void {
    const escName = tableName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const tableRe = new RegExp(`(Table\\s+${escName}\\s*\\{[\\s\\S]*?\\r?\\n?\\s*\\})`, 'i');
    const match = this.code.match(tableRe);
    if (!match) return;

    // Get only the inner block contents of the Table block
    const bodyRe = new RegExp(`^Table\\s+${escName}\\s*\\{([\\s\\S]*?)\\}\\s*$`, 'i');
    const bodyMatch = match[0].match(bodyRe);
    if (!bodyMatch) return;

    const newBody = bodyMatch[1]
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return true;
        const colMatch = trimmed.match(/^([A-Za-z0-9_]+)\s+/);
        return !(colMatch && colMatch[1] === colName);
      })
      .join('\n');

    const replacement = `Table ${tableName} {\n${newBody.trim()}\n}`;
    this.code = this.code.replace(tableRe, replacement);

    // Also remove any Ref lines that reference this column (either as source or target),
    // so dangling connections don't snap to the top of the table.
    // Use line-by-line filter: drop any Ref line where tableName.colName appears as either endpoint.
    const columnKey = `${tableName}.${colName}`;
    this.code = this.code
      .split(/\r?\n/)
      .filter((line) => {
        if (!/^\s*Ref/.test(line)) return true;
        // Keep only if neither endpoint matches the deleted column
        const m = line.match(
          /Ref(?:\s+[A-Za-z0-9_]+)?\s*:\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*(?:>|<|-)\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/
        );
        if (!m) return true;
        const from = `${m[1]}.${m[2]}`;
        const to = `${m[3]}.${m[4]}`;
        return from !== columnKey && to !== columnKey;
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');

    // Clean up persisted ref colors for any ref involving this column
    const keyPrefix = `${tableName}.${colName}>`;
    const keySuffix = `>${tableName}.${colName}`;
    Object.keys(this.refColors).forEach((key) => {
      if (key.startsWith(keyPrefix) || key.endsWith(keySuffix)) {
        delete this.refColors[key];
      }
    });
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('ref colors', this.deterministicStringify(this.refColors));
    }
  }

  renameTableInCode(oldName: string, newName: string): void {
    const headerRe = new RegExp(`(Table\\s+)${oldName}(\\s*\\{)`);
    this.code = this.code.replace(headerRe, `$1${newName}$2`);

    const refWordRe = new RegExp(`\\b${oldName}\\b`, 'g');
    this.code = this.code
      .split('\n')
      .map((line) => (/^\s*Ref/.test(line) ? line.replace(refWordRe, newName) : line))
      .join('\n');

    if (this.tablePositions[oldName]) {
      this.tablePositions[newName] = this.tablePositions[oldName];
      delete this.tablePositions[oldName];
    }
  }

  deleteTableInCode(tableName: string): void {
    const tableRe = new RegExp(`Table\\s+${tableName}\\s*\\{[\\s\\S]*?\\n\\}\\n?`);
    this.code = this.code.replace(tableRe, '');

    this.code = this.code
      .split('\n')
      .filter((line) => {
        if (!/^\s*Ref/.test(line)) return true;
        return !new RegExp(`\\b${tableName}\\.`).test(line);
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');

    delete this.tablePositions[tableName];
  }
  updateTableInCode(oldName: string, newName: string, columns: Column[]): void {
    const tableRe = new RegExp(`Table\\s+${oldName}\\s*\\{[\\s\\S]*?\\n\\}`);
    if (!tableRe.test(this.code)) return;

    // Parse existing references BEFORE changing code
    const parsed = this.parseDBML(this.code);

    // Set up column name mappings to identify renamed columns
    const colMap = new Map<string, Column>();
    columns.forEach(c => {
      if (c.originalName) {
        colMap.set(c.originalName, c);
      } else {
        colMap.set(c.name, c);
      }
    });

    const newRefs: RefDef[] = [];
    parsed.refs.forEach((r) => {
      if (r.fromTable === oldName) {
        const col = colMap.get(r.fromCol);
        if (col && col.fk && col.fkTable && col.fkCol) {
          newRefs.push({
            fromTable: newName,
            fromCol: col.name,
            toTable: col.fkTable,
            toCol: col.fkCol,
            waypoints: r.waypoints,
            color: r.color
          });
        }
      } else if (r.toTable === oldName) {
        const col = colMap.get(r.toCol);
        if (col) {
          newRefs.push({
            ...r,
            toTable: newName,
            toCol: col.name
          });
        }
      } else {
        newRefs.push(r);
      }
    });

    // Add any newly checked foreign keys
    columns.forEach((col) => {
      if (col.fk && col.fkTable && col.fkCol) {
        const exists = newRefs.some(
          (ref) => ref.fromTable === newName && ref.fromCol === col.name
        );
        if (!exists) {
          newRefs.push({
            fromTable: newName,
            fromCol: col.name,
            toTable: col.fkTable,
            toCol: col.fkCol
          });
        }
      }
    });

    const attributes = (column: Column): string => {
      const values: string[] = [];
      if (column.pk) values.push('pk');
      if (column.increment) values.push('increment');
      if (column.notNull) values.push('not null');
      if (column.unique) values.push('unique');
      if (column.default && column.defaultVal !== undefined) {
        const val = column.defaultVal.trim();
        const needsQuotes = !(/^-?\d+(\.\d+)?$/i.test(val) || /^(true|false|null|now\(\)|current_timestamp)$/i.test(val) || (val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"')));
        values.push(`default: ${needsQuotes ? `'${val}'` : val}`);
      }
      if (column.check && column.checkVal !== undefined) {
        const val = column.checkVal.trim();
        const needsQuotes = !((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"')));
        values.push(`check: ${needsQuotes ? `'${val}'` : val}`);
      }
      return values.length ? ` [${values.join(', ')}]` : '';
    };

    const tableBlock = `Table ${newName} {\n${columns
      .map((column) => `  ${column.name} ${column.type}${attributes(column)}`)
      .join('\n')}\n}`;

    // Replace the table block
    this.code = this.code.replace(tableRe, tableBlock);

    // Remove all existing Ref lines
    this.code = this.code
      .split(/\r?\n/)
      .filter((line) => !/^\s*Ref\b/i.test(line))
      .join('\n');

    // Append the updated list of references
    if (newRefs.length > 0) {
      const refLines = newRefs
        .map((ref) => `Ref: ${ref.fromTable}.${ref.fromCol} > ${ref.toTable}.${ref.toCol}`)
        .join('\n');
      this.code = this.code.trimEnd() ? `${this.code.trimEnd()}\n\n${refLines}` : refLines;
    }

    if (oldName !== newName && this.tablePositions[oldName]) {
      this.tablePositions[newName] = this.tablePositions[oldName];
      delete this.tablePositions[oldName];
    }
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('drag position', this.deterministicStringify(this.tablePositions));
    }
    this.updateGutter();
    this.parseAndLayout();
  }

  deleteConnectionInCode(ref: RefDef): void {
    const esc = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const fTab = esc(ref.fromTable);
    const fCol = esc(ref.fromCol);
    const tTab = esc(ref.toTable);
    const tCol = esc(ref.toCol);

    const pattern1 = new RegExp(
      `^[ \\t]*Ref(?:\\s+[A-Za-z0-9_]+)?\\s*:\\s*"?${fTab}"?\\."?${fCol}"?\\s*(?:<->|<>|>|<|-)\\s*"?${tTab}"?\\."?${tCol}"?.*$\\r?\\n?`,
      'igm'
    );
    const pattern2 = new RegExp(
      `^[ \\t]*Ref(?:\\s+[A-Za-z0-9_]+)?\\s*:\\s*"?${tTab}"?\\."?${tCol}"?\\s*(?:<->|<>|>|<|-)\\s*"?${fTab}"?\\."?${fCol}"?.*$\\r?\\n?`,
      'igm'
    );

    let newCode = this.code.replace(pattern1, '');
    newCode = newCode.replace(pattern2, '');

    const inlinePattern1 = new RegExp(
      `(,\\s*|\\s*)ref:\\s*(?:<->|<>|>|<|-)\\s*"?${tTab}"?\\."?${tCol}"?`,
      'ig'
    );
    const inlinePattern2 = new RegExp(
      `(,\\s*|\\s*)ref:\\s*(?:<->|<>|>|<|-)\\s*"?${fTab}"?\\."?${fCol}"?`,
      'ig'
    );

    newCode = newCode.replace(inlinePattern1, '');
    newCode = newCode.replace(inlinePattern2, '');
    newCode = newCode.replace(/\[\s*\]/g, '');

    if (newCode === this.code && ref.lineNumber && ref.lineNumber > 0) {
      const lines = this.code.split('\n');
      if (lines[ref.lineNumber - 1] && /Ref/i.test(lines[ref.lineNumber - 1])) {
        lines.splice(ref.lineNumber - 1, 1);
        newCode = lines.join('\n');
      }
    }

    this.code = newCode;

    const key = `${ref.fromTable}.${ref.fromCol}>${ref.toTable}.${ref.toCol}`;
    delete this.refColors[key];
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('ref colors', this.deterministicStringify(this.refColors));
    }
  }

  updateRelationInCode(ref: RefDef, newFromTable: string, newFromCol: string, newToTable: string, newToCol: string): void {
    this.deleteConnectionInCode(ref);
    this.addRelation(newFromTable, newFromCol, newToTable, newToCol);
  }

  removeTableFromGroupsInCode(tableName: string): void {
    const groupRe = /TableGroup\s+(?:["']?([A-Za-z0-9_]+)["']?)\s*(?:\[color:\s*([^\]]+)\])?\s*\{([\s\S]*?)\}/gi;
    let match: RegExpExecArray | null;
    let newCode = this.code;

    while ((match = groupRe.exec(this.code)) !== null) {
      const fullMatch = match[0];
      const groupName = match[1];
      const colorPart = match[2] || '';
      const body = match[3];

      const lines = body.split('\n');
      let found = false;
      const filteredLines = lines.filter(line => {
        const firstWord = line.trim().split(/\s+/)[0];
        if (firstWord === tableName) {
          found = true;
          return false;
        }
        return true;
      });

      if (found) {
        const hasTables = filteredLines.some(line => {
          const l = line.trim();
          return l && !l.startsWith('//');
        });
        if (!hasTables) {
          newCode = newCode.replace(fullMatch, '');
        } else {
          let newFullMatch = `TableGroup ${groupName} `;
          if (colorPart) {
            newFullMatch += `[color: ${colorPart}] `;
          }
          newFullMatch += `{\n${filteredLines.join('\n')}\n}`;
          newCode = newCode.replace(fullMatch, newFullMatch);
        }
      }
    }
    this.code = newCode;
  }

  addTableToGroupInCode(tableName: string, groupName: string): void {
    this.removeTableFromGroupsInCode(tableName);

    const escapedGroupName = groupName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const groupRe = new RegExp(`TableGroup\\s+["']?(${escapedGroupName})["']?\\s*(?:\\[color:\\s*([^\\]]+)\\])?\\s*\\{([\\s\\S]*?)\\}`, 'i');
    const match = groupRe.exec(this.code);

    if (match) {
      const fullMatch = match[0];
      const parsedGroupName = match[1];
      const colorPart = match[2] || '';
      const body = match[3];

      const lines = body.split('\n');
      const exists = lines.some(line => {
        const firstWord = line.trim().split(/\s+/)[0];
        return firstWord === tableName;
      });

      if (!exists) {
        const cleanBody = body.trimEnd();
        const separator = cleanBody.endsWith('\n') ? '  ' : '\n  ';
        const newBody = `${cleanBody}${separator}${tableName}`;

        let newFullMatch = `TableGroup ${parsedGroupName} `;
        if (colorPart) {
          newFullMatch += `[color: ${colorPart}] `;
        }
        newFullMatch += `{\n${newBody}\n}`;
        this.code = this.code.replace(fullMatch, newFullMatch);
      }
    } else {
      this.code = this.code.trimEnd() + `\n\nTableGroup ${groupName} {\n  ${tableName}\n}\n`;
    }

    this.updateGutter();
    this.parseAndLayout();
  }

  updateTableGroupInCode(oldName: string, newName: string, tableNames: string[]): void {
    const escapedGroupName = oldName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const groupRe = new RegExp(`TableGroup\\s+["']?(${escapedGroupName})["']?\\s*(?:\\[color:\\s*([^\\]]+)\\])?\\s*\\{([\\s\\S]*?)\\}`, 'i');
    let match = groupRe.exec(this.code);

    if (match) {
      const fullMatch = match[0];
      const body = match[3];
      const currentTables = body.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'));

      // Remove added tables from other groups first to prevent duplicate grouping
      tableNames.forEach(tName => {
        if (!currentTables.includes(tName)) {
          this.removeTableFromGroupsInCode(tName);
        }
      });

      // Re-read match as this.code might have changed slightly
      match = groupRe.exec(this.code);
      if (match) {
        const currentFullMatch = match[0];
        if (tableNames.length === 0) {
          this.code = this.code.replace(currentFullMatch, '').replace(/\n{3,}/g, '\n\n');
        } else {
          const colorPart = match[2] || '';
          let newFullMatch = `TableGroup ${newName} `;
          if (colorPart) {
            newFullMatch += `[color: ${colorPart}] `;
          }
          newFullMatch += `{\n  ${tableNames.join('\n  ')}\n}`;
          this.code = this.code.replace(currentFullMatch, newFullMatch);
        }
      }
    } else if (tableNames.length > 0) {
      // If the group doesn't exist, remove the tables from other groups first
      tableNames.forEach(tName => {
        this.removeTableFromGroupsInCode(tName);
      });
      this.code = this.code.trimEnd() + `\n\nTableGroup ${newName} {\n  ${tableNames.join('\n  ')}\n}\n`;
    }

    // Migrate the stored backend id to the new group name
    if (oldName !== newName && this.groupIds[oldName] != null) {
      this.groupIds[newName] = this.groupIds[oldName];
      delete this.groupIds[oldName];
    }

    this.updateGutter();
    this.parseAndLayout();
  }

  deleteTableGroupInCode(groupName: string): void {
    const escapedGroupName = groupName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const groupRe = new RegExp(`TableGroup\\s+["']?(${escapedGroupName})["']?\\s*(?:\\[color:\\s*([^\\]]+)\\])?\\s*\\{([\\s\\S]*?)\\}`, 'i');
    const match = groupRe.exec(this.code);
    if (match) {
      this.code = this.code.replace(match[0], '').replace(/\n{3,}/g, '\n\n');
    }

    delete this.groupIds[groupName];
    delete this.groupColors[groupName];

    this.updateGutter();
    this.parseAndLayout();
  }

  setTableColor(tableName: string, color: string): void {
    this.tableColorsMap[tableName] = color;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('table_colors_map', this.deterministicStringify(this.tableColorsMap));
    }
    const t = this.tables.find(tbl => tbl.name === tableName);
    if (t) {
      t.color = color;
    }
    this.scheduleDraw();
  }

  setGroupColor(groupName: string, color: string): void {
    this.groupColors[groupName] = color;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('group_colors', this.deterministicStringify(this.groupColors));
    }

    this.parseAndLayout();
    this.scheduleDraw();
  }

  addTableAt(x: number, y: number): void {
    const tableNo = this.tables.length + 1;
    const tableName = `table_${tableNo}`;

    const newTable: TableDef = {
      name: tableName,
      x,
      y,
      width: this.CARD_W,
      height: this.HEADER_H + this.ROW_H,
      columns: [
        { name: 'id', type: 'int', pk: true, notNull: false, unique: false, increment: false, fk: false, default: false, check: false }
      ],
      colY: {}
    };

    newTable.columns.forEach((col, index) => {
      newTable.colY[col.name] = this.HEADER_H + index * this.ROW_H + this.ROW_H / 2;
    });

    this.tables.push(newTable);
    this.tablePositions[tableName] = { x, y };
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('drag position', this.deterministicStringify(this.tablePositions));
    }

    const tableBlock =
      `\nTable ${tableName} {\n` +
      `  id int [pk]\n` +
      `}\n`;
    this.code = this.code.trimEnd() + '\n' + tableBlock;
    this.updateGutter();
    this.scheduleDraw();
  }

  addTable(): void {
    const tableNo = this.tables.length + 1;
    this.addTableAt(100 + tableNo * 30, 100 + tableNo * 30);
  }

  addRelation(fromTable: string, fromCol: string, toTable: string, toCol: string): boolean {
    const fromTab = this.tables.find((t) => t.name === fromTable);
    const toTab = this.tables.find((t) => t.name === toTable);
    const fromColObj = fromTab?.columns.find((c) => c.name === fromCol);
    const toColObj = toTab?.columns.find((c) => c.name === toCol);

    const fromEligible = fromColObj ? (fromColObj.pk || fromColObj.unique) : false;
    const toEligible = toColObj ? (toColObj.pk || toColObj.unique) : false;

    let actualFromTable = fromTable;
    let actualFromCol = fromCol;
    let actualToTable = toTable;
    let actualToCol = toCol;

    if (fromEligible && !toEligible) {
      actualFromTable = toTable;
      actualFromCol = toCol;
      actualToTable = fromTable;
      actualToCol = fromCol;
    }

    const exists = this.parseDBML(this.code).refs.some(
      (ref) =>
        (ref.fromTable === actualFromTable &&
          ref.fromCol === actualFromCol &&
          ref.toTable === actualToTable &&
          ref.toCol === actualToCol) ||
        (ref.fromTable === actualToTable &&
          ref.fromCol === actualToCol &&
          ref.toTable === actualFromTable &&
          ref.toCol === actualFromCol)
    );

    if (exists || (actualFromTable === actualToTable && actualFromCol === actualToCol)) {
      return false;
    }

    const refLine = `Ref: ${actualFromTable}.${actualFromCol} > ${actualToTable}.${actualToCol}`;
    this.code = this.code.trimEnd()
      ? `${this.code.trimEnd()}\n${refLine}`
      : refLine;
    this.updateGutter();
    this.parseAndLayout();
    return true;
  }

  resetConnectionPath(refIndex: number): void {
    const ref = this.refs[refIndex];
    if (!ref) return;
    delete ref.waypoints;
    this.scheduleDraw();
  }

  setConnectionColor(refIndex: number, hex: string): void {
    const ref = this.refs[refIndex];
    if (!ref) return;

    ref.color = hex;

    const key = `${ref.fromTable}.${ref.fromCol}>${ref.toTable}.${ref.toCol}`;
    this.refColors[key] = hex;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('ref colors', this.deterministicStringify(this.refColors));
    }

    this.scheduleDraw();
  }

  /* ============ ZOOM ============ */

  zoomIn(): void {
    this.zoomBy(1.2);
  }

  zoomOut(): void {
    this.zoomBy(1 / 1.2);
  }

  zoomFit(): void {
    this.view = { x: 40, y: 40, scale: 1 };
    this.scheduleDraw();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private extractDiagramId(response: any): number | null {
    if (!response || typeof response !== 'object') return null;

    const paths = [
      response?.data?.diagramid,   // ← actual API shape (lowercase)
      response?.data?.diagramId,
      response?.data?.id,
      response?.diagramid,
      response?.diagramId,
      response?.id,
      response?.data?.diagram?.id,
      response?.result?.diagramId,
      response?.result?.id,
      response?.payload?.diagramId,
      response?.payload?.id,
    ];
    for (const v of paths) {
      if (v != null && !isNaN(Number(v)) && Number(v) > 0) return Number(v);
    }

    const deepFind = (obj: any, depth = 0): number | null => {
      if (depth > 5 || !obj || typeof obj !== 'object') return null;
      for (const key of Object.keys(obj)) {
        if (key.toLowerCase() === 'diagramid' && obj[key] != null && !isNaN(Number(obj[key])) && Number(obj[key]) > 0) {
          return Number(obj[key]);
        }
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          const found = deepFind(obj[key], depth + 1);
          if (found != null) return found;
        }
      }
      return null;
    };

    return deepFind(response);
  }

  fetchDiagrams(queryParams?: QueryParams, useListAll: boolean = false): Observable<PaginatedResult<DiagramSummary>> {
    const headers = this.getAuthHeaders();
    this.isLoadingDiagrams.set(true);

    let params: any = {};
    if (queryParams) {
      if (queryParams.workspaceId != null) params.workspaceId = queryParams.workspaceId;
      if (queryParams.page != null) params.page = queryParams.page;
      if (queryParams.limit != null) params.limit = queryParams.limit;
      if (queryParams.search != null && queryParams.search.trim()) params.search = queryParams.search.trim();
      if (queryParams.sortBy != null) params.sortBy = queryParams.sortBy;
      if (queryParams.sortOrder != null) params.sortOrder = queryParams.sortOrder;
    }

    const primaryUrl = useListAll ? (this.appConfig.environment?.diagramApiUrls?.diagramsListAll ?? "") : (this.appConfig.environment?.diagramApiUrls?.diagrams ?? "");
    const fallbackUrl = useListAll ? (this.appConfig.environment?.diagramApiUrls?.diagrams ?? "") : (this.appConfig.environment?.diagramApiUrls?.diagramsListAll ?? "");

    return this.http.get<any>(primaryUrl, { headers, params }).pipe(
      catchError(() => this.http.get<any>(fallbackUrl, { headers, params })),
      map((response) => {
        let rawList: any[] = [];
        let total = 0;

        if (Array.isArray(response)) {
          rawList = response;
          total = response.length;
        } else if (response && typeof response === 'object') {
          rawList = response.data ?? response.diagrams ?? response.result ?? response.diagram ?? [];
          total = Number(response.meta?.total ?? response.total ?? response.totalItems ?? response.count ?? response.total_count ?? (Array.isArray(rawList) ? rawList.length : 0));
        }

        if (!Array.isArray(rawList)) rawList = [];

        const parsedDiagrams: DiagramSummary[] = rawList
          .filter((diagram: any) => {
            const id = diagram?.id ?? diagram?.diagramId ?? diagram?.diagramid ?? diagram?.diagram_id;
            return id != null && !isNaN(Number(id));
          })
          .map((diagram: any) => {
            const id = Number(diagram?.id ?? diagram?.diagramId ?? diagram?.diagramid ?? diagram?.diagram_id);
            const created_at = diagram?.createdat ?? diagram?.created_at ?? diagram?.createdAt ?? diagram?.created ?? null;
            const updated_at = diagram?.updatedat ?? diagram?.updated_at ?? diagram?.updatedAt ?? diagram?.updated ?? null;
            return {
              id,
              name: diagram?.name || diagram?.diagramname || '',
              created_at,
              updated_at
            };
          });

        const page = queryParams?.page || 1;
        const limit = queryParams?.limit || 10;
        const totalPages = Math.max(1, Math.ceil(total / limit));

        return {
          data: parsedDiagrams,
          total: total || parsedDiagrams.length,
          page,
          limit,
          totalPages
        };
      }),
      tap((res) => {
        this.diagrams.set(res.data);
      }),
      catchError((error) => {
        return throwError(() => error);
      }),
      finalize(() => {
        this.isLoadingDiagrams.set(false);
      })
    );
  }

  deleteDiagram(id: number): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = this.appConfig.environment?.diagramApiUrls?.diagramById?.replace('{id}', id.toString()) ?? "";
    return this.http.delete<any>(url, { headers }).pipe(
      tap(() => {
        const currentList = this.diagrams().filter((d) => d.id !== id);
        this.diagrams.set(currentList);
      })
    );
  }

  createWorkspace(payload: { workspaceName: string; members: { email: string; permission: string }[] }): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = this.appConfig.environment?.workspaceApiUrls?.workspaces ?? "";
    return this.http.post<any>(url, payload, { headers });
  }

  updateWorkspace(id: number, payload: { workspaceName: string; members: { email: string; permission: string }[] }): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = this.appConfig.environment?.workspaceApiUrls?.workspaceById?.replace('{id}', id.toString()) ?? "";
    return this.http.put<any>(url, payload, { headers });
  }

  fetchWorkspaceMembers(workspaceId: number, queryParams?: QueryParams): Observable<PaginatedResult<any>> {
    const headers = this.getAuthHeaders();
    let params: any = {};
    if (queryParams) {
      if (queryParams.page != null) params.page = queryParams.page;
      if (queryParams.limit != null) params.limit = queryParams.limit;
      if (queryParams.search != null && queryParams.search.trim()) params.search = queryParams.search.trim();
      if (queryParams.sortBy != null) params.sortBy = queryParams.sortBy;
      if (queryParams.sortOrder != null) params.sortOrder = queryParams.sortOrder;
    }

    const url = this.appConfig.environment?.workspaceApiUrls?.workspaceMembers?.replace('{workspaceId}', workspaceId.toString()) ?? "";
    return this.http.get<any>(url, { headers, params }).pipe(
      map((response) => {
        let rawList: any[] = [];
        let total = 0;

        if (Array.isArray(response)) {
          rawList = response;
          total = response.length;
        } else if (response && typeof response === 'object') {
          rawList = response.data ?? response.members ?? response.result ?? [];
          total = Number(response.meta?.total ?? response.total ?? response.totalItems ?? response.count ?? response.total_count ?? (Array.isArray(rawList) ? rawList.length : 0));
        }

        if (!Array.isArray(rawList)) rawList = [];

        const page = queryParams?.page || 1;
        const limit = queryParams?.limit || 10;
        const totalPages = Math.max(1, Math.ceil(total / limit));

        return {
          data: rawList,
          total: total || rawList.length,
          page,
          limit,
          totalPages
        };
      })
    );
  }

  deleteWorkspace(id: number): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = this.appConfig.environment?.workspaceApiUrls?.workspaceById?.replace('{id}', id.toString()) ?? "";
    return this.http.delete<any>(url, { headers }).pipe(
      tap(() => {
        const currentList = this.workspaces().filter(w => w.id !== id);
        this.workspaces.set(currentList);
      })
    );
  }

  deleteWorkspaceMember(workspaceId: number, memberId: number): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = `${this.appConfig.environment?.workspaceApiUrls?.workspaceMembers?.replace('{workspaceId}', workspaceId.toString())}/${memberId}`;
    return this.http.delete<any>(url, { headers });
  }

  fetchWorkspaces(queryParams?: QueryParams): Observable<PaginatedResult<WorkspaceItem>> {
    const headers = this.getAuthHeaders();
    this.isLoadingWorkspaces.set(true);

    let params: any = {};
    if (queryParams) {
      if (queryParams.page != null) params.page = queryParams.page;
      if (queryParams.limit != null) params.limit = queryParams.limit;
      if (queryParams.search != null && queryParams.search.trim()) params.search = queryParams.search.trim();
      if (queryParams.sortBy != null) params.sortBy = queryParams.sortBy;
      if (queryParams.sortOrder != null) params.sortOrder = queryParams.sortOrder;
    }

    const url = this.appConfig.environment?.workspaceApiUrls?.workspaces ?? "";
    return this.http.get<any>(url, { headers, params }).pipe(
      map((response) => {
        let rawList: any[] = [];
        let total = 0;

        if (Array.isArray(response)) {
          rawList = response;
          total = response.length;
        } else if (response && typeof response === 'object') {
          rawList = response.data ?? response.workspaces ?? response.result ?? [];
          total = Number(response.meta?.total ?? response.total ?? response.totalItems ?? response.count ?? response.total_count ?? (Array.isArray(rawList) ? rawList.length : 0));
        }

        if (!Array.isArray(rawList)) rawList = [];

        const parsedWorkspaces: WorkspaceItem[] = rawList
          .map((w: any) => ({
            id: Number(w?.workspaceid ?? w?.id ?? w?.workspace_id ?? 0),
            name: w?.workspacename ?? w?.name ?? w?.workspace_name ?? 'Workspace',
            type: w?.workspacetype ?? w?.type ?? 'Personal',
            permission: w?.permission ?? 'Owner',
            status: w?.status ?? 'Active',
            created_at: w?.createddate ?? w?.created_at ?? w?.createdat ?? null,
            user_email: w?.owneremail ?? w?.user_email ?? w?.userEmail ?? w?.email ?? w?.owner_email ?? w?.ownerEmail ?? w?.creator_email ?? w?.creatorEmail ?? w?.created_by_email ?? w?.createdbyemail ?? w?.owner ?? w?.creator ?? null,
            profile_pic: w?.ownerprofilepicture ?? w?.profile_pic ?? w?.profileUrl ?? w?.profile_url ?? w?.profile_image ?? w?.profile ?? null
          }))
          .filter((w: WorkspaceItem) => w.id > 0);

        const page = queryParams?.page || 1;
        const limit = queryParams?.limit || 10;
        const totalPages = Math.max(1, Math.ceil(total / limit));

        return {
          data: parsedWorkspaces,
          total: total || parsedWorkspaces.length,
          page,
          limit,
          totalPages
        };
      }),
      tap((res) => {
        this.workspaces.set(res.data);
        this.workspacesFetched = true;
        // Re-resolve active workspace name if it was set to fallback
        const currentId = this.activeWorkspaceId();
        if (currentId !== null && this._activeWorkspaceName() === 'Workspace') {
          const found = res.data.find((w: any) => w.id === currentId);
          if (found) {
            this._activeWorkspaceName.set(found.name);
          }
        }
      }),
      catchError((error) => throwError(() => error)),
      finalize(() => this.isLoadingWorkspaces.set(false))
    );
  }

  fetchDiagramsByWorkspace(workspaceId: number): Observable<DiagramSummary[]> {
    const headers = this.getAuthHeaders();
    this.isLoadingDiagrams.set(true);
    const baseUrl = this.appConfig.environment?.workspaceApiUrls?.workspaceDiagrams?.replace('{workspaceId}', workspaceId.toString()) ?? "";
    return this.http.get<any>(`${baseUrl}?ts=${Date.now()}`, { headers }).pipe(
      map((response) => {
        const list = Array.isArray(response)
          ? response
          : response?.data ?? response?.diagrams ?? response?.result ?? [];
        if (!Array.isArray(list)) return [];
        const result: DiagramSummary[] = [];
        for (const diagram of list) {
          const rawId = diagram?.diagramid ?? diagram?.id ?? diagram?.diagramId ?? diagram?.diagram_id;
          if (rawId != null) {
            const numId = Number(rawId);
            if (!isNaN(numId)) {
              result.push({
                id: numId,
                name: diagram?.name || 'Untitled Diagram',
                created_at: diagram?.createdat ?? diagram?.created_at ?? diagram?.createdAt ?? null,
                updated_at: diagram?.updatedat ?? diagram?.updated_at ?? diagram?.updatedAt ?? null
              });
            }
          }
        }
        return result;
      }),
      tap((diagrams) => this.diagrams.set(diagrams)),
      catchError((error) => throwError(() => error)),
      finalize(() => this.isLoadingDiagrams.set(false))
    );
  }

  checkOrgInvitation(token: string | null, orgId: string): Observable<any> {
    let url = `${this.appConfig.environment?.apiConfig?.baseUrl}/api/organizations/invite-check?orgId=${orgId}`;
    if (token) {
      url += `&token=${token}`;
    }
    // Omit auth headers intentionally to just check the invitation
    return this.http.get(url);
  }

  acceptOrgInvitation(payload: {token: string | null, orgId: string}): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = `${this.appConfig.environment?.apiConfig?.baseUrl}/api/organizations/invite-accept`;
    return this.http.post(url, payload, { headers });
  }

  acceptInvitation(id: string): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = this.appConfig.environment?.workspaceApiUrls?.inviteAccept?.replace('{id}', id.toString()) ?? "";
    return this.http.post<any>(url, {}, { headers }).pipe(
      catchError((err) => {
        if (err.status === 404) {
          const url = this.appConfig.environment?.workspaceApiUrls?.accept?.replace('{id}', id.toString()) ?? "";
          return this.http.post<any>(url, {}, { headers });
        }
        return throwError(() => err);
      })
    );
  }

  loadDiagram(id: number, fallbackWorkspace?: { id: number; name?: string } | null): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = this.appConfig.environment?.diagramApiUrls?.diagramById?.replace('{id}', id.toString()) ?? "";
    this.isDiagramLoading.set(true);
    return this.http.get<any>(url, { headers }).pipe(
      tap((response) => this.applyLoadedDiagram(response, id, fallbackWorkspace)),
      finalize(() => {
        this.isDiagramLoading.set(false);
      })
    );
  }

  /**
   * Recursively scans the entire API response for any key that looks like a
   * workspace id (case-insensitive: workspaceid / workspace_id), no matter
   * how deeply it's nested. Used as a fallback when the known top-level
   * field names (diagram.workspaceid, diagram.workspace.id, etc.) don't
   * match what the backend actually sent back for this endpoint.
   */
  private extractWorkspaceId(response: any): number | null {
    if (!response || typeof response !== 'object') return null;

    const deepFind = (obj: any, depth = 0): number | null => {
      if (depth > 6 || !obj || typeof obj !== 'object') return null;
      for (const key of Object.keys(obj)) {
        const lower = key.toLowerCase();
        if ((lower === 'workspaceid' || lower === 'workspace_id') && obj[key] != null && !isNaN(Number(obj[key])) && Number(obj[key]) > 0) {
          return Number(obj[key]);
        }
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (Array.isArray(obj[key])) {
            for (const item of obj[key]) {
              const found = deepFind(item, depth + 1);
              if (found != null) return found;
            }
          } else {
            const found = deepFind(obj[key], depth + 1);
            if (found != null) return found;
          }
        }
      }
      return null;
    };

    return deepFind(response);
  }

  private extractWorkspaceType(response: any): string | null {
    if (!response || typeof response !== 'object') return null;

    const deepFind = (obj: any, depth = 0): string | null => {
      if (depth > 6 || !obj || typeof obj !== 'object') return null;
      for (const key of Object.keys(obj)) {
        const lower = key.toLowerCase();
        if ((lower === 'workspacetype' || lower === 'workspace_type') && obj[key] != null && typeof obj[key] === 'string' && obj[key].trim() !== '') {
          return obj[key].trim();
        }
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (Array.isArray(obj[key])) {
            for (const item of obj[key]) {
              const found = deepFind(item, depth + 1);
              if (found != null) return found;
            }
          } else {
            const found = deepFind(obj[key], depth + 1);
            if (found != null) return found;
          }
        }
      }
      return null;
    };

    return deepFind(response);
  }
  private applyParsedLayout(layout: any, diagram: any = null): void {
    if (!layout) return;

    this.tablePositions = {};
    this.refColors = {};
    this.groupColors = {};
    this.tableColorsMap = {};

    layout?.tables?.forEach((table: any) => {
      if (!table?.name) return;
      this.tablePositions[table.name] = {
        x: Number(table.posx ?? table.x ?? 0),
        y: Number(table.posy ?? table.y ?? 0)
      };
      if (table.color && table.color !== '#3ec5c1') {
        this.tableColorsMap[table.name] = table.color;
      }
    });
    layout?.relations?.forEach((relation: any) => {
      if (relation?.from && relation?.to && relation?.color && relation.color !== '#3ec5c1') {
        this.refColors[`${relation.from}>${relation.to}`] = relation.color;
      }
    });
    layout?.tableGroup?.forEach((group: any) => {
      if (group?.name && group?.color) {
        this.groupColors[group.name] = group.color;
      }
      // Persist the backend group id so it can be round-tripped on save
      if (group?.name != null && group?.id != null) {
        this.groupIds[group.name] = group.id;
      }
    });

    const diagProps = Array.isArray(layout?.diagramProperties)
      ? layout?.diagramProperties[0]
      : layout?.diagramProperties;
    if (diagProps) {
      if (diagProps.zoomLevel != null) {
        this.view.scale = Number(diagProps.zoomLevel) / 100;
        this.hasLoadedScale = true;
      }
      if (diagProps.isGridView != null) {
        this.gridOn = !!diagProps.isGridView;
      }
      this.isAllFields = diagProps.isAllFields !== undefined ? !!diagProps.isAllFields : (diagram?.isAllFields !== undefined ? !!diagram.isAllFields : true);
      this.isKeyOnly = diagProps.isKeyOnly !== undefined ? !!diagProps.isKeyOnly : (diagram?.isKeyOnly !== undefined ? !!diagram.isKeyOnly : false);
      this.isColumnNameOnly = diagProps.isColumnNameOnly !== undefined ? !!diagProps.isColumnNameOnly : (diagram?.isColumnNameOnly !== undefined ? !!diagram.isColumnNameOnly : false);
      this.isStraightLine = diagProps.isStraightLine !== undefined ? !!diagProps.isStraightLine : (diagram?.isStraightLine !== undefined ? !!diagram.isStraightLine : false);
      this.isSmoothLine = diagProps.isSmoothLine !== undefined ? !!diagProps.isSmoothLine : (diagram?.isSmoothLine !== undefined ? !!diagram.isSmoothLine : true);
      if (diagProps.showAllConnections != null) {
        this.showAllConnections = !!diagProps.showAllConnections;
      }
    } else if (diagram) {
      this.isAllFields = diagram?.isAllFields !== undefined ? !!diagram.isAllFields : true;
      this.isKeyOnly = diagram?.isKeyOnly !== undefined ? !!diagram.isKeyOnly : false;
      this.isColumnNameOnly = diagram?.isColumnNameOnly !== undefined ? !!diagram.isColumnNameOnly : false;
      this.isStraightLine = diagram?.isStraightLine !== undefined ? !!diagram.isStraightLine : false;
      this.isSmoothLine = diagram?.isSmoothLine !== undefined ? !!diagram.isSmoothLine : true;
    }

    // Load sticky notes
    const rawNotes = layout?.diagramNotes;
    if (Array.isArray(rawNotes)) {
      this.notes = rawNotes.map((n: any, i: number) => ({
        id: n.id ?? Date.now() + i,
        name: n.name ?? n.Notes_name ?? `note_${i + 1}`,
        text: n.text ?? '',
        posx: Number(n.posx ?? 0),
        posy: Number(n.posy ?? 0),
        width: Number(n.width ?? 180),
        height: Number(n.height ?? 180),
        color: n.color ?? '#FFE28B',
        textColor: n.textColor ?? '#000000',
        isNew: n.id == null
      }));
    } else {
      this.notes = [];
    }
  }

  private applyLoadedDiagram(response: any, id: number, fallbackWorkspace?: { id: number; name?: string } | null): void {
    const diagram = response?.data?.diagram ?? response?.data ?? response?.diagram ?? response;
    const rawWsId = diagram?.workspaceid ?? diagram?.workspaceId ?? diagram?.workspace_id ?? diagram?.workspaceID
      ?? diagram?.workspace?.id ?? diagram?.workspace?.workspaceid
      ?? response?.data?.workspaceid ?? response?.data?.workspaceId
      ?? response?.workspaceid ?? response?.workspaceId
      ?? this.extractWorkspaceId(response)
      ?? fallbackWorkspace?.id       // ← fall back to what we already know
      ?? null;
    this.setActiveWorkspace(rawWsId ? Number(rawWsId) : null, fallbackWorkspace?.name);

    const wsType = diagram?.workspacetype ?? diagram?.workspaceType ?? diagram?.workspace_type ?? diagram?.workspace?.workspacetype
      ?? this.extractWorkspaceType(response)
      ?? 'Personal';
    this.diagramWorkspaceType.set(wsType);
    
    const permission = diagram?.permission ?? diagram?.workspace?.permission ?? diagram?.shared_permission ?? response?.data?.permission ?? 'Editor';
    if (wsType === 'Team' && permission === 'Viewer') {
      this.isReadOnly = true;
    } else {
      this.isReadOnly = false;
    }

    let layout = diagram?.layout;
    if (typeof layout === 'string') {
      try {
        layout = JSON.parse(layout);
      } catch {
        layout = undefined;
      }
    }

    this.diagramId.set(Number(diagram?.id ?? id));
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('active_diagram_id', String(diagram?.id ?? id));
    }

    const rawWsName = diagram?.workspace?.workspacename ?? diagram?.workspace?.name ?? diagram?.workspace?.workspace_name
      ?? response?.data?.workspace?.workspacename ?? response?.data?.workspace?.name ?? response?.data?.workspace?.workspace_name
      ?? fallbackWorkspace?.name ?? undefined;

    this.setActiveWorkspace(rawWsId ? Number(rawWsId) : null, rawWsName);
    this.diagramName = diagram?.name || 'Untitled Diagram';
    this.isEnabled = diagram?.isEnabled !== undefined ? !!diagram.isEnabled : false;
    this.publicToken = diagram?.publictoken || diagram?.publicToken || diagram?.public_token || '';
    this.isDiagramPublic = diagram?.ispublic !== false; // defaults to true unless explicitly false
    this.diagramPassword = diagram?.protectedpassword || diagram?.protectedPassword || '';
    this.showDocs = false;

    this.applyParsedLayout(layout, diagram);

    const rawCode =
      diagram?.diagramDbml ??
      diagram?.diagram_dbml ??
      diagram?.diagramdbml ??
      diagram?.dbml ??
      diagram?.code ??
      '';
    this.code = rawCode.replace(/(TableGroup\s+["']?[^"'\r\n]+["']?\s*)\[color:\s*[^\]]+\]\s*(\{)/gi, '$1$2');
    this.showCanvasPlaceholder = !this.code.trim();
    this.updateGutter();
    this.parseAndLayout();
    this.requestCanvasFit();
    this.updateOriginalState();
    
    // Join socket room if Team workspace
    if (this.diagramWorkspaceType() === 'Team') {
      const dId = this.diagramId();
      if (dId) {
        this.socketService.connect();
        this.socketService.joinDiagram(dId);
        
        // Setup once listener for this diagram
        this.setupSocketListeners();
      }
    }
  }
  
  private socketListenersSetup = false;
  private readonly collabColors = [
    '#EF4444', // Red 500
    '#F97316', // Orange 500
    '#F59E0B', // Amber 500
    '#84CC16', // Lime 500
    '#22C55E', // Green 500
    '#10B981', // Emerald 500
    '#14B8A6', // Teal 500
    '#06B6D4', // Cyan 500
    '#0EA5E9', // Sky 500
    '#3B82F6', // Blue 500
    '#6366F1', // Indigo 500
    '#8B5CF6', // Violet 500
    '#A855F7', // Purple 500
    '#D946EF', // Fuchsia 500
    '#EC4899', // Pink 500
    '#F43F5E'  // Rose 500
  ];
  
  private setupSocketListeners(): void {
    if (this.socketListenersSetup) return;
    this.socketListenersSetup = true;
    
    this.socketService.onUpdate().subscribe((data) => {
      if (data && data.dbml !== undefined) {
        this._code = data.dbml;
        this.code$.next(this._code);
        
        if (data.name) {
          this.diagramNameSignal.set(data.name);
        }

        if (data.layout) {
          // Parse layout from other users to sync positions and all customizations instantly
          let layoutObj = data.layout;
          if (typeof layoutObj === 'string') {
            try { layoutObj = JSON.parse(layoutObj); } catch { layoutObj = undefined; }
          }
          if (layoutObj) {
            this.applyParsedLayout(layoutObj);
          }
        }
        
        this.parseAndLayout();
        
        // Prevent echoing back the change by marking it as the new original state
        // MUST BE CALLED AFTER parseAndLayout() SO THE NEW COORDINATES ARE SAVED AS ORIGINAL!
        this.updateOriginalState();
      }
    });

    this.socketService.onRoomState().subscribe((data) => {
      if (data && data.users) {
        // Filter out current user based on userId matching auth
        const payload = this.auth.getTokenPayload();
        const currentUserId = payload?.userId || payload?.id;
        const others = data.users.filter((u: any) => u.userId !== currentUserId);
        
        // Assign colors
        others.forEach((u: any, i: number) => {
          u.color = this.collabColors[i % this.collabColors.length];
        });
        
        this.activeRoomUsers.set(others);
      }
    });

    this.socketService.onUserJoined().subscribe((data) => {
      const payload = this.auth.getTokenPayload();
      const currentUserId = payload?.userId || payload?.id;
      if (data && data.userId !== currentUserId) {
        const users = [...this.activeRoomUsers()];
        if (!users.find(u => u.userId === data.userId)) {
          data.color = this.collabColors[users.length % this.collabColors.length];
          users.push(data);
          this.activeRoomUsers.set(users);
        }
      }
    });

    this.socketService.onUserLeft().subscribe((data) => {
      if (data && data.userId) {
        const users = this.activeRoomUsers().filter(u => u.userId !== data.userId);
        this.activeRoomUsers.set(users);
        
        // Also clean up their cursor
        const cursors = { ...this.remoteCursors() };
        if (cursors[data.userId]) {
          delete cursors[data.userId];
          this.remoteCursors.set(cursors);
        }
      }
    });

    this.socketService.onCursorUpdate().subscribe((data) => {
      const payload = this.auth.getTokenPayload();
      const currentUserId = payload?.userId || payload?.id;
      if (data && data.userId && data.userId !== currentUserId) {
        const cursors = { ...this.remoteCursors() };
        const user = this.activeRoomUsers().find(u => u.userId === data.userId);
        cursors[data.userId] = {
          line: data.line,
          col: data.col,
          x: data.x,
          y: data.y,
          username: data.username || user?.username || user?.email || 'Unknown',
          color: user?.color || '#3ec5c1'
        };
        this.remoteCursors.set(cursors);
      }
    });
  }

  private buildLayoutPayload(): {
    tables: { name: string; posx: string; posy: string; color: string }[];
    relations: { from: string; to: string; color: string }[];
    tableGroup?: { id?: number | string; name: string; color: string; posx: number; posy: number; tables: string[] }[];
    diagramProperties: { zoomLevel: number; isGridView: boolean; isAllFields: boolean; isKeyOnly: boolean; isColumnNameOnly: boolean; isStraightLine: boolean; isSmoothLine: boolean; showAllConnections: boolean }[];
    diagramNotes: DiagramNote[];
  } {
    const tableGroup = (this.groups || []).map((group) => {
      const groupTables = this.tables.filter((t) => group.tables.includes(t.name));
      let minX = 0;
      let minY = 0;
      if (groupTables.length > 0) {
        minX = Math.min(...groupTables.map((t) => t.x));
        minY = Math.min(...groupTables.map((t) => t.y));
      }
      return {
        id: group.id,
        name: group.name || '',
        color: group.color || '',
        posx: minX,
        posy: minY,
        tables: group.tables || []
      };
    });

    return {
      tables: this.tables.map((table) => ({
        name: table.name,
        posx: String(table.x),
        posy: String(table.y),
        color: table.color || ''
      })),
      relations: this.refs.map((ref) => ({
        from: `${ref.fromTable}.${ref.fromCol}`,
        to: `${ref.toTable}.${ref.toCol}`,
        color: ref.color || ''
      })),
      tableGroup,
      diagramProperties: [
        {
          zoomLevel: this.zoomPercent,
          isGridView: this.gridOn,
          isAllFields: this.isAllFields,
          isKeyOnly: this.isKeyOnly,
          isColumnNameOnly: this.isColumnNameOnly,
          isStraightLine: this.isStraightLine,
          isSmoothLine: this.isSmoothLine,
          showAllConnections: this.showAllConnections
        }
      ],
      diagramNotes: this.notes.map(n => {
        const payloadNote: any = { ...n };
        payloadNote.Notes_name = payloadNote.name;
        delete payloadNote.name;

        if (payloadNote.isNew) {
          delete payloadNote.id;
        }
        delete payloadNote.isNew;
        return payloadNote;
      })
    };
  }

  createDiagram(name = ''): Observable<any> {
    const headers = this.getAuthHeaders();
    const payload = { name: name || 'Untitled Diagram' };
    const url = this.appConfig.environment?.diagramApiUrls?.diagrams ?? "";
    return this.http.post<any>(url, payload, { headers }).pipe(
      tap((res) => {
        const id = res?.data?.diagramid ?? res?.data?.diagramId ?? res?.data?.id
          ?? res?.diagramid ?? res?.diagramId ?? res?.id ?? null;
        this.setActiveWorkspace(null);
        if (id != null) {
          this.diagramId.set(id);
          if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.setItem('active_diagram_id', String(id));
          }
        }
      })
    );
  }

  createWorkspaceDiagram(workspaceId: number, name = 'Untitled Diagram', workspaceName?: string): Observable<any> {
    const headers = this.getAuthHeaders();
    const payload = {
      name: name || 'Untitled Diagram',
      workspaceId: workspaceId
    };
    const url = this.appConfig.environment?.diagramApiUrls?.diagrams ?? "";
    return this.http.post<any>(url, payload, { headers }).pipe(
      tap((res) => {
        const id = this.extractDiagramId(res) ?? res?.data?.diagramid ?? res?.data?.diagramId ?? res?.data?.id
          ?? res?.diagramid ?? res?.diagramId ?? res?.id ?? null;
        this.setActiveWorkspace(Number(workspaceId), workspaceName);
        if (id != null) {
          this.diagramId.set(Number(id));
          if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.setItem('active_diagram_id', String(id));
          }
        }
      })
    );
  }

  createDiagramDraft(): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = this.appConfig.environment?.diagramApiUrls?.draft ?? "";
    return this.http.post<any>(url, null, { headers }).pipe(
      tap((res) => {
        const id = res?.data?.diagramid ?? res?.data?.diagramId ?? res?.data?.id
          ?? res?.diagramid ?? res?.diagramId ?? res?.id ?? null;
        this.setActiveWorkspace(null);
        if (id != null) {
          this.diagramId.set(id);
          if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.setItem('active_diagram_id', String(id));
          }
        }
      })
    );
  }

  private buildUpdatePayload(): any {
    return {
      name: this.diagramName,
      diagramDbml: this.code,
      layout: this.buildLayoutPayload()
    };
  }

  saveDiagram(): Observable<any> {
    const headers = this.getAuthHeaders();
    const currentId = this.diagramId();

    this.isSaving.set(true);

    if (currentId != null) {
      const payload = this.buildUpdatePayload();
      const url = this.appConfig.environment?.diagramApiUrls?.diagramById?.replace('{id}', currentId.toString()) ?? "";
      return this.http.put<any>(url, payload, { headers }).pipe(
        tap((res) => {
          this.extractIdsFromResponse(res);
          this.updateOriginalState();
        }),
        finalize(() => this.isSaving.set(false))
      );
    }

    const payload = {
      name: this.diagramName,
      diagramDbml: this.code,
      layout: this.buildLayoutPayload()
    };
    const url = this.appConfig.environment?.diagramApiUrls?.diagrams ?? "";
    return this.http.post<any>(url, payload, { headers }).pipe(
      tap((res) => {
        const ids = this.extractDiagramId(res);
        if (ids != null) {
          this.diagramId.set(ids);
          if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.setItem('active_diagram_id', String(ids));
          }
        } else {
        }
        this.updateOriginalState();
        this.extractIdsFromResponse(res);
      }),
      finalize(() => this.isSaving.set(false))
    );
  }

  private extractIdsFromResponse(res: any): void {
    const layout = typeof res?.layout === 'string' ? JSON.parse(res.layout) :
      (res?.layout || (typeof res?.data?.layout === 'string' ? JSON.parse(res.data.layout) : res?.data?.layout) || {});

    const rawNotes = layout?.diagramNotes;
    if (Array.isArray(rawNotes)) {
      this.notes = this.notes.map(note => {
        const matched = rawNotes.find((rn: any) => (rn.name || rn.Notes_name) === note.name);
        if (matched && matched.id != null) {
          return { ...note, id: matched.id, isNew: false };
        }
        return note;
      });
    }

    const rawGroups = layout?.tableGroup;
    if (Array.isArray(rawGroups)) {
      rawGroups.forEach((group: any) => {
        if (group?.name != null && group?.id != null) {
          this.groupIds[group.name] = group.id;
        }
      });

      this.groups = this.groups.map(g => ({
        ...g,
        id: this.groupIds[g.name]
      }));
    }
  }

  getDiagramHistory(diagramId: number): Observable<any> {
    const headers = this.getAuthHeaders();
    const urlPattern = this.appConfig.environment?.diagramApiUrls?.history;
    const url = urlPattern
      ? urlPattern.replace('{id}', diagramId.toString())
      : `${this.appConfig.environment?.apiConfig?.baseUrl}/api/diagrams/${diagramId}/history`;
    return this.http.get<any>(url, { headers });
  }

  revertDiagram(diagramId: number, versionId: number): Observable<any> {
    const headers = this.getAuthHeaders();
    const urlPattern = this.appConfig.environment?.diagramApiUrls?.revert;
    const url = urlPattern
      ? urlPattern.replace('{id}', diagramId.toString()).replace('{versionId}', versionId.toString())
      : `${this.appConfig.environment?.apiConfig?.baseUrl}/api/diagrams/${diagramId}/revert/${versionId}`;
    return this.http.post<any>(url, {}, { headers });
  }

  toggleDiagramSharingStatus(diagramId: number, isPublic: boolean, password?: string): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = this.appConfig.environment?.diagramApiUrls?.diagramPublic?.replace('{id}', diagramId.toString()) ?? "";
    const payload = { isPublic, password };
    return this.http.put<any>(url, payload, { headers }).pipe(
      tap(res => {
        const diag = res?.data ?? res;
        if (diag && (diag.publictoken || diag.publicToken || diag.public_token)) {
          this.publicToken = diag.publictoken || diag.publicToken || diag.public_token;
        }
      })
    );
  }

  shareDiagramViaEmail(diagramId: number, emails: string[], permission: string): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = this.appConfig.environment?.diagramApiUrls?.diagramShareEmail?.replace('{id}', diagramId.toString()) ?? "";
    return this.http.post<any>(url, { emails, permission }, { headers });
  }

  getSharedDiagrams(params?: any): Observable<any> {
    const headers = this.getAuthHeaders();
    let queryParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
          queryParams = queryParams.set(key, params[key]);
        }
      });
    }
    const url = `${this.appConfig.environment?.apiConfig?.baseUrl}/api/shared-diagrams`;
    return this.http.get<any>(url, { headers, params: queryParams });
  }

  deleteSharedDiagram(diagramId: number): Observable<any> {
    const headers = this.getAuthHeaders();
    const url = `${this.appConfig.environment?.apiConfig?.baseUrl}/api/shared-diagrams/${diagramId}`;
    return this.http.delete<any>(url, { headers });
  }

  getPublicDiagram(token: string): Observable<any> {
    const pattern = this.appConfig.environment?.diagramApiUrls?.publicDiagram;
    if (!pattern) {
      console.error('publicDiagram URL pattern is missing in configuration');
      return throwError(() => new Error('Configuration error: publicDiagram URL is missing'));
    }
    const url = pattern.replace('{token}', token);
    return this.http.get<any>(url);
  }

  unlockProtectedDiagram(token: string, password: string): Observable<any> {
    const pattern = this.appConfig.environment?.diagramApiUrls?.publicDiagram;
    if (!pattern) {
      console.error('publicDiagram URL pattern is missing in configuration');
      return throwError(() => new Error('Configuration error: publicDiagram URL is missing'));
    }
    const url = pattern.replace('{token}', token);
    return this.http.post<any>(url, { password });
  }

  validateDbml(dbml = this.code): Observable<any> {
    if (!this.auth.isLoggedIn()) {
      return of({ data: { errors: [] } });
    }
    const cleanDbml = dbml.trim();
    if (!cleanDbml || cleanDbml === this.SAMPLE.trim() || cleanDbml === this.getSampleCode(false).trim()) {
      return of({ data: { errors: [] } });
    }
    const headers = this.getAuthHeaders();
    const url = this.appConfig.environment?.diagramApiUrls?.validateDbml ?? "";
    return this.http.post<any>(url, { dbml }, { headers });
  }

  clearDiagram(preserveDiagramId = false): void {
    this.socketService.disconnect();
    this.activeRoomUsers.set([]);
    this.remoteCursors.set({});
    this.code = '';
    this.tables = [];
    this.refs = [];
    this.tablePositions = {};
    this.refColors = {};
    this.groupColors = {};
    this.groupIds = {};
    this.noteIds = {};
    this.tableColorsMap = {};
    this.diagramWorkspaceType.set('Personal');
    this.diagramName = '';
    this.showDocs = false;
    this.showCanvasPlaceholder = false;
    this.isAllFields = true;
    this.isKeyOnly = false;
    this.isColumnNameOnly = false;
    this.isStraightLine = false;
    this.isSmoothLine = true;
    if (!preserveDiagramId) {
      this.setActiveWorkspace(null);
      this.diagramId.set(null);
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem('active_diagram_id');
      }
    } else {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('active_diagram_id', String(this.diagramId()));
      }
    }
    this.hoveredConnectionIndex = -1;
    this.selectedConnectionIndex = -1;
    this.view = { x: 40, y: 40, scale: 1 };
    this.updateGutter();
    this.scheduleDraw();
    this.updateOriginalState();
  }

  private zoomBy(factor: number): void {
    this.view.scale = Math.min(3, Math.max(0.15, this.view.scale * factor));
    this.scheduleDraw();
  }

  /* ============ DOCUMENTATION / EXPORT ============ */

  getTableRelationships(tableName: string): RefDef[] {
    return this.refs.filter(
      (r) => r.fromTable === tableName || r.toTable === tableName
    );
  }

  private keyLabel(c: Column): string {
    const parts: string[] = [];
    if (c.pk) parts.push('PK');
    if (c.fk) {
      if (c.fkTable && c.fkCol) {
        parts.push(`FK (${c.fkTable}.${c.fkCol})`);
      } else {
        parts.push('FK');
      }
    }
    if (c.increment) parts.push('AUTO');
    if (c.unique) parts.push('UNIQUE');
    if (c.notNull) parts.push('NOT NULL');
    if (c.default) {
      parts.push(c.defaultVal ? `DEFAULT: ${c.defaultVal}` : 'DEFAULT');
    }
    if (c.check) {
      parts.push(c.checkVal ? `CHECK: ${c.checkVal}` : 'CHECK');
    }
    return parts.join(', ');
  }

  downloadDocs(): void {
    if (typeof window === 'undefined') return;

    let md = `# Database Schema Documentation: ${this.diagramName}\n\n`;

    if (this.tables.length === 0) {
      md += `*No tables defined.*\n`;
    } else {
      this.tables.forEach((t) => {
        md += `## Table: ${t.name}\n\n`;
        md += `| Column | Type | Key |\n`;
        md += `| :--- | :--- | :--- |\n`;
        t.columns.forEach((c) => {
          md += `| \`${c.name}\` | \`${c.type}\` | ${this.keyLabel(c)} |\n`;
        });
        md += `\n`;

        const rels = this.getTableRelationships(t.name);
        if (rels.length > 0) {
          md += `### Relationships\n\n`;
          rels.forEach((r) => {
            md += `- \`${r.fromTable}.${r.fromCol}\` ➔ \`${r.toTable}.${r.toCol}\`\n`;
          });
          md += `\n`;
        }
        md += `\n---\n\n`;
      });
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.diagramName.toLowerCase().replace(/\s+/g, '_')}_docs.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportDBML(): void {
    if (!this.code || typeof window === 'undefined') return;
    const blob = new Blob([this.code], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.dbml';
    a.click();
    URL.revokeObjectURL(url);

    this.showDbdocsInstructions = true;
  }

  isPrimaryKey(tableName: string, colName: string): boolean {
    const table = this.tables.find((t) => t.name === tableName);
    if (!table) return false;
    const col = table.columns.find((c) => c.name === colName);
    return col ? !!col.pk : false;
  }

  shouldReverseFlow(ref: RefDef): boolean {
    const fromPk = this.isPrimaryKey(ref.fromTable, ref.fromCol);
    const toPk = this.isPrimaryKey(ref.toTable, ref.toCol);

    if (fromPk && !toPk) {
      return true;
    }
    if (!fromPk && toPk) {
      return false;
    }
    return true;
  }

  anchorOffset(table: string, col: string, refIndex: number, usage: Record<string, number[]>): number {
    return 0;
  }
  /* ============ SQL EXPORT ============ */

  private readonly typeMap: Record<SqlDialect, Record<string, string>> = {
    postgres: {
      int: 'INTEGER',
      varchar: 'VARCHAR(255)',
      text: 'TEXT',
      datetime: 'TIMESTAMP',
      boolean: 'BOOLEAN',
      bool: 'BOOLEAN',
      float: 'REAL',
      decimal: 'DECIMAL(10,2)',
      date: 'DATE'
    },
    mysql: {
      int: 'INT',
      varchar: 'VARCHAR(255)',
      text: 'TEXT',
      datetime: 'DATETIME',
      boolean: 'TINYINT(1)',
      bool: 'TINYINT(1)',
      float: 'FLOAT',
      decimal: 'DECIMAL(10,2)',
      date: 'DATE'
    },
    mssql: {
      int: 'INT',
      varchar: 'VARCHAR(255)',
      text: 'NVARCHAR(MAX)',
      datetime: 'DATETIME2',
      boolean: 'BIT',
      bool: 'BIT',
      float: 'FLOAT',
      decimal: 'DECIMAL(10,2)',
      date: 'DATE'
    }
  };

  private mapType(dialect: SqlDialect, rawType: string): string {
    const clean = rawType.toLowerCase().replace(/\(.*\)/, '').trim();
    const sizeMatch = rawType.match(/\(([^)]+)\)/);
    const mapped = this.typeMap[dialect][clean];

    if (mapped) {
      if (sizeMatch && (clean === 'varchar' || clean === 'decimal')) {
        const base = mapped.replace(/\(.*\)/, '');
        return `${base}(${sizeMatch[1]})`;
      }
      return mapped;
    }
    return rawType.toUpperCase();
  }

  private quoteIdent(dialect: SqlDialect, name: string): string {
    if (dialect === 'mysql') return `\`${name}\``;
    if (dialect === 'mssql') return `[${name}]`;
    return `"${name}"`;
  }

  generateSQL(dialect: SqlDialect): string {
    const parsed = this.parseDBML(this.code);
    let sql = '';

    parsed.tables.forEach((t) => {
      sql += `CREATE TABLE ${this.quoteIdent(dialect, t.name)} (\n`;
      const lines: string[] = [];

      t.columns.forEach((c) => {
        let line = `  ${this.quoteIdent(dialect, c.name)} ${this.mapType(dialect, c.type)}`;

        if (c.pk && c.increment) {
          if (dialect === 'postgres') {
            line = `  ${this.quoteIdent(dialect, c.name)} SERIAL`;
          } else if (dialect === 'mysql') {
            line += ' AUTO_INCREMENT';
          } else if (dialect === 'mssql') {
            line += ' IDENTITY(1,1)';
          }
        }

        if (c.pk) {
          line += ' PRIMARY KEY';
        } else {
          if (c.notNull) line += ' NOT NULL';
          if (c.unique) line += ' UNIQUE';
        }

        lines.push(line);
      });

      sql += lines.join(',\n');
      sql += '\n);\n\n';
    });

    parsed.refs.forEach((r) => {
      const constraintName = `fk_${r.fromTable}_${r.fromCol}`;
      sql += `ALTER TABLE ${this.quoteIdent(dialect, r.fromTable)} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${this.quoteIdent(dialect, r.fromCol)}) REFERENCES ${this.quoteIdent(dialect, r.toTable)}(${this.quoteIdent(dialect, r.toCol)});\n`;
    });

    return sql;
  }

  exportAsSQL(dialect: SqlDialect): void {
    if (typeof window === 'undefined') return;
    const sql = this.generateSQL(dialect);
    if (!sql.trim()) return;

    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema_${dialect}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  }

  updateOriginalState(): void {
    this.originalCode = this.code;
    this.originalName = this.diagramName;
    this.originalTablePositions = this.deterministicStringify(this.tablePositions);
    this.originalRefColors = this.deterministicStringify(this.refColors);
    this.originalGroupColors = this.deterministicStringify(this.groupColors);
    this.originalTableColorsMap = this.deterministicStringify(this.tableColorsMap);
    this.originalIsAllFields = this.isAllFields;
    this.originalIsKeyOnly = this.isKeyOnly;
    this.originalIsColumnNameOnly = this.isColumnNameOnly;
    this.originalIsStraightLine = this.isStraightLine;
    this.originalIsSmoothLine = this.isSmoothLine;
    this.originalIsEnabled = this.isEnabled;
    this.originalNotes = this.deterministicStringify(this.notes);
    this.originalZoomPercent = this.zoomPercent;
    this.originalGridOn = this.gridOn;
    this.originalShowAllConnections = this.showAllConnections;
  }

  
  private deterministicStringify(obj: any): string {
    if (obj === null || obj === undefined) return 'null';
    if (Array.isArray(obj)) return '[' + obj.map(v => this.deterministicStringify(v)).join(',') + ']';
    if (typeof obj === 'object') {
      const keys = Object.keys(obj).sort();
      return '{' + keys.map(k => '"' + k + '":' + this.deterministicStringify(obj[k])).join(',') + '}';
    }
    return JSON.stringify(obj);
  }

  hasUnsavedChanges(): boolean {
    const isNewAndEmpty = !this.diagramId() && !this.code.trim() && !this.diagramName;
    if (isNewAndEmpty) {
      return false;
    }

    if (!this.diagramId() && this.diagramName === 'Sample Diagram') {
      return false;
    }

    const currentNormalized = (this.code || '').replace(/\r\n/g, '\n');
    const originalNormalized = (this.originalCode || '').replace(/\r\n/g, '\n');

    const codeChanged = currentNormalized !== originalNormalized;
    const nameChanged = this.diagramName !== this.originalName;
    const positionsChanged = this.deterministicStringify(this.tablePositions) !== this.originalTablePositions;
    const colorsChanged = this.deterministicStringify(this.refColors) !== this.originalRefColors;
    const groupColorsChanged = this.deterministicStringify(this.groupColors) !== this.originalGroupColors;
    const tableColorsChanged = this.deterministicStringify(this.tableColorsMap) !== this.originalTableColorsMap;

    const settingsChanged =
      this.isAllFields !== this.originalIsAllFields ||
      this.isKeyOnly !== this.originalIsKeyOnly ||
      this.isColumnNameOnly !== this.originalIsColumnNameOnly ||
      this.isStraightLine !== this.originalIsStraightLine ||
      this.isSmoothLine !== this.originalIsSmoothLine ||
      this.isEnabled !== this.originalIsEnabled;

    const viewChanged =
      (this.originalZoomPercent !== null && this.zoomPercent !== this.originalZoomPercent) ||
      this.gridOn !== this.originalGridOn ||
      this.showAllConnections !== this.originalShowAllConnections;

    const notesChanged = this.deterministicStringify(this.notes) !== this.originalNotes;

    const hasChanges = codeChanged || nameChanged || positionsChanged || colorsChanged || groupColorsChanged || tableColorsChanged || settingsChanged || notesChanged || viewChanged;
    
    if (hasChanges) {
      console.log('[Collab Debug] hasUnsavedChanges is TRUE because:', {
        codeChanged, nameChanged, positionsChanged, colorsChanged, groupColorsChanged, tableColorsChanged, settingsChanged, viewChanged, notesChanged
      });
      if (viewChanged) {
        console.log('[Collab Debug] viewChanged details:', {
          originalZoom: this.originalZoomPercent, zoom: this.zoomPercent,
          originalGrid: this.originalGridOn, grid: this.gridOn,
          originalShowAll: this.originalShowAllConnections, showAll: this.showAllConnections
        });
      }
    }

    if (hasChanges && (typeof window !== 'undefined')) {
      (window as any)._lastUnsavedReason = { codeChanged, nameChanged, positionsChanged, colorsChanged, groupColorsChanged, tableColorsChanged, settingsChanged, notesChanged, viewChanged };
      if (positionsChanged) {
        console.log('[Collab Debug] positionsChanged is TRUE!');
        console.log('Original Table Positions:', this.originalTablePositions);
        console.log('Current Table Positions:', this.deterministicStringify(this.tablePositions));
        (window as any)._positionsDiff = {
          original: this.originalTablePositions,
          current: this.deterministicStringify(this.tablePositions)
        };
      }
    }

    return hasChanges;
  }

  askForConfirmation(onProceed: () => void, onCancel?: () => void): void {
    if (this.hasUnsavedChanges()) {
      this.showDiscardButton.set(true);
      this.forceUnsavedChangesCheck(onProceed, onCancel);
    } else {
      onProceed();
    }
  }

  forceUnsavedChangesCheck(onProceed: () => void, onCancel?: () => void): void {
    this.pendingAction = onProceed;
    this.pendingCancel = onCancel || null;
    this.unsavedModalVisible.set(true);
  }

  confirmSave(): void {
    if (this.canSaveDiagram() && this.validateDiagramName()) {
      this.saveDiagram().subscribe({
        next: () => {
          this.showToast('Diagram saved.', 2000);
          this.unsavedModalVisible.set(false);
          if (this.pendingAction) {
            const action = this.pendingAction;
            this.pendingAction = null;
            this.pendingCancel = null;
            action();
          }
        },
        error: (err) => {
          this.showToast('Failed to save diagram.', 4000, 'error');
        }
      });
    }
  }

  confirmDiscard(): void {
    this.unsavedModalVisible.set(false);
    this.updateOriginalState();
    if (this.pendingAction) {
      const action = this.pendingAction;
      this.pendingAction = null;
      this.pendingCancel = null;
      action();
    }
  }

  confirmCancel(): void {
    this.unsavedModalVisible.set(false);
    if (this.pendingCancel) {
      this.pendingCancel();
    }
    this.pendingAction = null;
    this.pendingCancel = null;
  }

  /** Flag to prevent re-entrant DBML sync loops */
  private _syncingNotesToCode = false;

  /** Auto-generate next note name: note_1, note_2, … */
  private nextNoteName(): string {
    const nums = this.notes
      .map(n => { const m = n.name?.match(/^note_(\d+)$/); return m ? +m[1] : 0; })
      .filter(n => n > 0);
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `note_${max + 1}`;
  }

  /** Add a new sticky note at the given canvas position */
  addNote(posx = 100, posy = 100): DiagramNote {
    const id = Date.now();
    const name = this.nextNoteName();
    const note: DiagramNote = {
      id,
      name,
      text: '',
      posx,
      posy,
      width: 180,
      height: 180,
      color: '#FFE28B',
      textColor: '#000000',
      isNew: true
    };
    this.notes = [...this.notes, note];
    this.syncNotesToCode();
    return note;
  }

  /** Update an existing note by id (partial update) */
  updateNote(id: number, changes: Partial<DiagramNote>): void {
    this.notes = this.notes.map(n => n.id === id ? { ...n, ...changes } : n);
    // Sync text/name changes back to DBML
    if (changes.text !== undefined || changes.name !== undefined) {
      this.syncNotesToCode();
    }
  }

  /** Remove a note by id */
  deleteNote(id: number): void {
    this.notes = this.notes.filter(n => n.id !== id);
    this.syncNotesToCode();
  }

  /**
   * Rebuilds the Note blocks section in svc.code.
   * Strips existing Note blocks, then appends fresh ones from svc.notes.
   */
  syncNotesToCode(): void {
    if (this._syncingNotesToCode) return;
    this._syncingNotesToCode = true;
    try {
      // Strip existing Note blocks from code
      let stripped = this._code.replace(/^\s*Note\s+\w+\s*\{\s*'[^']*'\s*\}\s*/gm, '').trimEnd();
      // Append fresh Note blocks for each note that has content or a name
      const noteBlocks = this.notes
        .map(n => `\nNote ${n.name} {\n  '${(n.text || '').replace(/'/g, "''")}' \n}`)
        .join('\n');
      const newCode = stripped + (noteBlocks ? '\n' + noteBlocks : '');
      // Use forceSetCode to bypass the equality guard — but skip parseAndLayout re-entry
      this._code = newCode.replace(/\r\n|\r/g, '\n');
      this.code$.next(this._code);
      this.updateGutter();
    } finally {
      this._syncingNotesToCode = false;
    }
  }
}