import { ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild, OnInit, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DashboardService, TableDef, Column, RefDef, PathPoint, Tool, ContextMenuTarget, DiagramNote } from '../../../../core/services/dashboard.service';
import { ButtonComponent } from '../../../../shared/button/button';
import { Icons } from '../../../../core/component/icons/icons';
import { DiagramViews } from '../diagram-views/diagram-views';
import { VersionHistoryComponent } from '../version-history/version-history';
import { EntitlementService } from '../../../../core/services/entitlement.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, Icons, DiagramViews, VersionHistoryComponent],
  templateUrl: './canvas.html',
})
export class CanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasWrap', { static: true }) canvasWrapRef!: ElementRef<HTMLDivElement>;
  @ViewChild('canvasPane', { static: true }) canvasPaneRef!: ElementRef<HTMLDivElement>;

  private ctx!: CanvasRenderingContext2D;
  private dpr = 1;
  private resizeObserver?: ResizeObserver;
  private readonly subscriptions = new Subscription();
  private fitTimer?: ReturnType<typeof setTimeout>;
  private hasFitted = false;
  private rafPending = false;
  private contextMenuWorldPoint: { x: number; y: number } = { x: 0, y: 0 };
  private animationFrameId: number | null = null;
  private animationTime = 0;
  private hoveredIcon: { refIndex: number; type: 'color' | 'reset' | 'delete' } | null = null;
  showLayoutMenu = false;
  showDetailLevelMenu = false;
  get linkStyle(): 'smooth' | 'straight' {
    return this.svc.isStraightLine ? 'straight' : 'smooth';
  }
  set linkStyle(style: 'smooth' | 'straight') {
    if (style === 'straight') {
      this.svc.isStraightLine = true;
      this.svc.isSmoothLine = false;
    } else {
      this.svc.isStraightLine = false;
      this.svc.isSmoothLine = true;
    }
    this.scheduleDraw();
  }
  selectedConnectionPoint: PathPoint | null = null;

  isPanning = false;
  private panStart = { x: 0, y: 0 };

  draggingTable: string | null = null;
  private dragTableStartPos: { x: number; y: number } | null = null;
  private dragOffset = { x: 0, y: 0 };
  draggingGroup: string | null = null;
  private dragGroupStartMouse = { x: 0, y: 0 };
  private dragGroupStartPoints: Record<string, { x: number; y: number }> = {};
  private dragGroupStartGroupPos: { x: number; y: number } | null = null;
  private connectionDraft: { fromTable: string; fromColumn: string; currentX: number; currentY: number } | null = null;
  private reconnectDraft: {
    refIndex: number;
    isSource: boolean;
    anchorTable: string;
    anchorColumn: string;
    currentX: number;
    currentY: number;
  } | null = null;

  private isDraggingWaypoint = false;
  private dragConnectionIndex = -1;
  private dragWaypointIndex = -1;
  private readonly cornerHitRadius = 8;
  private readonly midpointHitRadius = 7;

  private connectionIcons: { refIndex: number; type: 'color' | 'reset' | 'delete'; x: number; y: number }[] = [];
  private tableHeaderIcons: { tableName: string; type: 'edit' | 'delete' | 'color' | 'settings'; x: number; y: number }[] = [];
  private readonly iconRadius = 9;
  private readonly iconHitPadding = 3;
  hoveredTableHeaderIcon: { tableName: string; type: 'edit' | 'delete' | 'color' | 'settings' } | null = null;
  hoveredGroupColorIcon: string | null = null;
  hoveredGroupName: string | null = null;
  private groupColorIcons: { groupName: string; x: number; y: number }[] = [];
  activeTooltip: { x: number; y: number; label: string } | null = null;
  hoveredColumn: { tableName: string; columnName: string } | null = null;
  isMouseOverCanvas = false;
  private drawingClean = false;
  private forceHighlightConnections = false;

  private wheelListener!: (e: WheelEvent) => void;

  // ---- Sticky note drag/resize state ----
  private draggingNote: DiagramNote | null = null;
  private noteMouseStart = { x: 0, y: 0 };
  private noteWorldStart = { x: 0, y: 0 };
  private resizingNote: DiagramNote | null = null;
  private resizeMouseStart = { x: 0, y: 0 };
  private resizeWorldStart = { w: 0, h: 0 };
  private noteBoundMouseMove: ((e: MouseEvent) => void) | null = null;
  private noteBoundMouseUp: ((e: MouseEvent) => void) | null = null;

  // ---- Sticky note menu/edit state ----
  activeNoteMenuId: number | null = null;
  editingNoteId: number | null = null;
  selectedNoteId: number | null = null;
  editingNoteBodyId: number | null = null;
  editNoteNameValue = '';
  readonly noteColorSwatches = [
    '#FFE28B', '#FFD6A5', '#CAFFBF', '#A0E7FF', '#E9C4FF',
    '#FFB3BA', '#BDE0FE', '#FFF3B0', '#D4F1C0', '#FFDDD2'
  ];

  tableModal = {
    visible: false,
    isNew: false,
    originalName: '',
    name: '',
    columns: [] as Column[],
    error: '',
    isGroup: false,
    groupName: '',
    selectedExistingGroup: ''
  };
  groupModal = {
    visible: false,
    name: '',
    originalName: '',
    tables: [] as string[],
    error: '',
    isAddDropdownOpen: false,
    showAddTableField: false,
    tableSearchQuery: ''
  };
  deleteConfirm = {
    visible: false,
    tableName: ''
  };
  deleteGroupConfirm = {
    visible: false,
    groupName: ''
  };
  layoutConfirm = {
    visible: false,
    direction: 'horizontal' as 'vertical' | 'horizontal'
  };
  deleteConnectionConfirm = {
    visible: false,
    refIndex: -1,
    fromTable: '',
    fromCol: '',
    toTable: '',
    toCol: '',
    ref: null as any
  };
  deleteNoteConfirm = {
    visible: false,
    noteId: null as number | null,
    noteName: ''
  };
  constraintDropdownIndex: number | null = null;
  typeDropdownIndex: number | null = null;
  fkTableDropdownOpen: boolean = false;
  fkColDropdownOpen: boolean = false;
  groupDropdownVisible = false;
  readonly datatypeOptions: string[] = ['int', 'integer', 'bigint', 'varchar', 'text', 'boolean', 'timestamp', 'datetime', 'date', 'decimal'];
  exporting = false;

  colorPicker: {
    visible: boolean;
    x: number;
    y: number;
    hex: string;
    type: 'connection' | 'table' | 'group' | 'note' | 'noteText' | null;
    refIndex: number;
    targetName: string;
    noteId: number | null;
  } = {
      visible: false,
      x: 0,
      y: 0,
      hex: '#70c8c3',
      type: null,
      refIndex: -1,
      targetName: '',
      noteId: null
    };

  readonly colorSwatches: string[] = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6',
    '#34495e', '#e67e22', '#95a5a6', '#d35400', '#c0392b', '#16a085',
    '#1e293b', '#f1c40f', '#27ae60', '#8e44ad', '#2980b9', '#e91e63'
  ];

  inlineEdit: {
    visible: boolean;
    x: number; y: number; width: number; height: number;
    value: string;
    kind: 'column' | 'table';
    tableName: string;
    originalColumnName?: string;
  } = { visible: false, x: 0, y: 0, width: 160, height: 30, value: '', kind: 'column', tableName: '' };

  private readonly dashSpeed = 30;
  private readonly dashPattern = [8, 6];
  private readonly dashCycleLength = this.dashPattern.reduce((a, b) => a + b, 0);
  private readonly markerSpacing = 30;
  private lastFrameTime = 0;
  private flowOffset = 0;

  readonly menuWidth = 190;
  readonly menuItemHeight = 34;

  contextMenu: {
    visible: boolean;
    x: number;
    y: number;
    targetType: ContextMenuTarget;
    table: TableDef | null;
    column: Column | null;
    connectionIndex: number;
    groupName: string | null;
  } = {
      visible: false,
      x: 0,
      y: 0,
      targetType: '',
      table: null,
      column: null,
      connectionIndex: -1,
      groupName: null
    };

  constructor(
    public svc: DashboardService,
    private cdr: ChangeDetectorRef,
    public entitlementService: EntitlementService,
    public auth: AuthService
  ) {
    effect(() => {
      this.svc.theme();
      this.svc.hiddenTables(); // Track hiddenTables signal so canvas redraws on visibility changes
      if (typeof window !== 'undefined') {
        this.scheduleDraw();
      }
    });
  }


  private getDiagramBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // 1. Include all visible tables
    this.svc.tables.forEach((t) => {
      if (this.svc.isTableHidden(t.name)) return;
      if (t.x < minX) minX = t.x;
      if (t.y < minY) minY = t.y;
      if (t.x + t.width > maxX) maxX = t.x + t.width;
      if (t.y + t.height > maxY) maxY = t.y + t.height;
    });

    const geometry: Record<string, TableDef> = {};
    this.svc.tables.forEach((t) => (geometry[t.name] = t));

    // 2. Include all group bounds
    if (this.svc.groups) {
      this.svc.groups.forEach((g) => {
        const bounds = this.getGroupBounds(g, geometry);
        if (bounds) {
          if (bounds.x < minX) minX = bounds.x;
          if (bounds.y < minY) minY = bounds.y;
          if (bounds.x + bounds.w > maxX) maxX = bounds.x + bounds.w;
          if (bounds.y + bounds.h > maxY) maxY = bounds.y + bounds.h;
        }
      });
    }

    // 3. Include all custom and dynamically generated connection waypoints/paths
    const anchorUsage = this.buildAnchorUsage();
    this.svc.refs.forEach((ref, i) => {
      if (this.svc.isTableHidden(ref.fromTable) || this.svc.isTableHidden(ref.toTable)) return;
      const path = this.getConnectionPath(ref, geometry, undefined, i, anchorUsage);
      if (path) {
        path.forEach((pt) => {
          if (pt.x < minX) minX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y > maxY) maxY = pt.y;
        });
      }
    });

    // 4. Include all visible sticky notes
    if (this.svc.notes) {
      this.svc.notes.forEach((n) => {
        if (n.posx < minX) minX = n.posx;
        if (n.posy < minY) minY = n.posy;
        if (n.posx + n.width > maxX) maxX = n.posx + n.width;
        if (n.posy + n.height > maxY) maxY = n.posy + n.height;
      });
    }

    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 800;
      maxY = 600;
    } else {
      // Add a safe padding margin
      minX -= 50;
      minY -= 50;
      maxX += 50;
      maxY += 50;
    }

    return { minX, minY, maxX, maxY };
  }

  exportAsPng(): void {
    if (typeof window === 'undefined') return;

    this.exporting = true;
    this.drawingClean = true;

    try {
      const geometry: Record<string, TableDef> = {};
      this.svc.tables.forEach((t) => (geometry[t.name] = t));

      const { minX, minY, maxX, maxY } = this.getDiagramBounds();
      const width = maxX - minX;
      const height = maxY - minY;

      // Save current states
      const oldW = this.canvasRef.nativeElement.width;
      const oldH = this.canvasRef.nativeElement.height;
      const oldStyleW = this.canvasRef.nativeElement.style.width;
      const oldStyleH = this.canvasRef.nativeElement.style.height;
      const oldX = this.svc.view.x;
      const oldY = this.svc.view.y;
      const oldScale = this.svc.view.scale;

      // Resize canvas for full resolution
      const canvas = this.canvasRef.nativeElement;
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx = ctx;

      // Position view so diagram starts at (0, 0)
      this.svc.view.x = -minX;
      this.svc.view.y = -minY;
      this.svc.view.scale = 1;

      // Draw
      this.draw();

      // Get Data URL
      const dataUrl = canvas.toDataURL('image/png');

      // Download
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'diagram.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Restore original size and view
      canvas.width = oldW;
      canvas.height = oldH;
      canvas.style.width = oldStyleW;
      canvas.style.height = oldStyleH;
      this.svc.view.x = oldX;
      this.svc.view.y = oldY;
      this.svc.view.scale = oldScale;

      // Reinitialize context transforms
      this.resizeCanvasToDisplaySize();
      this.scheduleDraw();
    } finally {
      this.exporting = false;
      this.drawingClean = false;
    }
  }

  private create2PagePdfFromJpegs(
    width: number,
    height: number,
    jpeg1Bytes: Uint8Array,
    jpeg2Bytes: Uint8Array
  ): Blob {
    const header = `%PDF-1.4\n`;
    const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
    const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>\nendobj\n`;

    // Page 1
    const content1 = `q ${width} 0 0 ${height} 0 0 cm /Im1 Do Q`;
    const obj4 = `4 0 obj\n<< /Length ${content1.length} >>\nstream\n${content1}\nendstream\nendobj\n`;
    const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`;

    // Page 2
    const content2 = `q ${width} 0 0 ${height} 0 0 cm /Im2 Do Q`;
    const obj7 = `7 0 obj\n<< /Length ${content2.length} >>\nstream\n${content2}\nendstream\nendobj\n`;
    const obj6 = `6 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im2 8 0 R >> >> /Contents 7 0 R >>\nendobj\n`;

    // Object 5: Image 1
    const obj5Header = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg1Bytes.length} >>\nstream\n`;
    const obj5Footer = `\nendstream\nendobj\n`;

    // Object 8: Image 2
    const obj8Header = `8 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg2Bytes.length} >>\nstream\n`;
    const obj8Footer = `\nendstream\nendobj\n`;

    const encoder = new TextEncoder();
    const partHeader = encoder.encode(header);
    const partObj1 = encoder.encode(obj1);
    const partObj2 = encoder.encode(obj2);
    const partObj3 = encoder.encode(obj3);
    const partObj4 = encoder.encode(obj4);
    const partObj5Header = encoder.encode(obj5Header);
    const partObj5Footer = encoder.encode(obj5Footer);
    const partObj6 = encoder.encode(obj6);
    const partObj7 = encoder.encode(obj7);
    const partObj8Header = encoder.encode(obj8Header);
    const partObj8Footer = encoder.encode(obj8Footer);

    // Calculate exact byte offsets for all 8 objects
    const offset1 = partHeader.length;
    const offset2 = offset1 + partObj1.length;
    const offset3 = offset2 + partObj2.length;
    const offset4 = offset3 + partObj3.length;
    const offset5 = offset4 + partObj4.length;
    const offset6 = offset5 + partObj5Header.length + jpeg1Bytes.length + partObj5Footer.length;
    const offset7 = offset6 + partObj6.length;
    const offset8 = offset7 + partObj7.length;
    const offsetEnd = offset8 + partObj8Header.length + jpeg2Bytes.length + partObj8Footer.length;

    const xref = `xref\n0 9\n` +
      `0000000000 65535 f \n` +
      `${offset1.toString().padStart(10, '0')} 00000 n \n` +
      `${offset2.toString().padStart(10, '0')} 00000 n \n` +
      `${offset3.toString().padStart(10, '0')} 00000 n \n` +
      `${offset4.toString().padStart(10, '0')} 00000 n \n` +
      `${offset5.toString().padStart(10, '0')} 00000 n \n` +
      `${offset6.toString().padStart(10, '0')} 00000 n \n` +
      `${offset7.toString().padStart(10, '0')} 00000 n \n` +
      `${offset8.toString().padStart(10, '0')} 00000 n \n`;

    const trailer = `trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${offsetEnd}\n%%EOF\n`;
    const partXref = encoder.encode(xref);
    const partTrailer = encoder.encode(trailer);

    return new Blob([
      partHeader as any,
      partObj1 as any,
      partObj2 as any,
      partObj3 as any,
      partObj4 as any,
      partObj5Header as any,
      jpeg1Bytes as any,
      partObj5Footer as any,
      partObj6 as any,
      partObj7 as any,
      partObj8Header as any,
      jpeg2Bytes as any,
      partObj8Footer as any,
      partXref as any,
      partTrailer as any
    ], { type: 'application/pdf' });
  }

  exportAsPdf(): void {
    if (typeof window === 'undefined') return;

    this.exporting = true;
    this.drawingClean = true;

    try {
      const geometry: Record<string, TableDef> = {};
      this.svc.tables.forEach((t) => (geometry[t.name] = t));

      const { minX, minY, maxX, maxY } = this.getDiagramBounds();
      const width = maxX - minX;
      const height = maxY - minY;

      // Save states
      const oldW = this.canvasRef.nativeElement.width;
      const oldH = this.canvasRef.nativeElement.height;
      const oldStyleW = this.canvasRef.nativeElement.style.width;
      const oldStyleH = this.canvasRef.nativeElement.style.height;
      const oldX = this.svc.view.x;
      const oldY = this.svc.view.y;
      const oldScale = this.svc.view.scale;

      // Resize canvas
      const canvas = this.canvasRef.nativeElement;
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx = ctx;

      this.svc.view.x = -minX;
      this.svc.view.y = -minY;
      this.svc.view.scale = 1;

      // Draw Page 1 (Clean regular diagram)
      this.draw();

      // Get JPEG 1
      const jpeg1DataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const base64Data1 = jpeg1DataUrl.split(',')[1];
      const binaryString1 = window.atob(base64Data1);
      const jpeg1Bytes = new Uint8Array(binaryString1.length);
      for (let i = 0; i < binaryString1.length; i++) {
        jpeg1Bytes[i] = binaryString1.charCodeAt(i);
      }

      // Draw Page 2 (Highlighted active diagram)
      this.drawingClean = true;
      this.forceHighlightConnections = true;
      this.draw();

      // Get JPEG 2
      const jpeg2DataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const base64Data2 = jpeg2DataUrl.split(',')[1];
      const binaryString2 = window.atob(base64Data2);
      const jpeg2Bytes = new Uint8Array(binaryString2.length);
      for (let i = 0; i < binaryString2.length; i++) {
        jpeg2Bytes[i] = binaryString2.charCodeAt(i);
      }

      // Generate 2-page PDF
      const pdfBlob = this.create2PagePdfFromJpegs(width, height, jpeg1Bytes, jpeg2Bytes);

      // Restore
      canvas.width = oldW;
      canvas.height = oldH;
      canvas.style.width = oldStyleW;
      canvas.style.height = oldStyleH;
      this.svc.view.x = oldX;
      this.svc.view.y = oldY;
      this.svc.view.scale = oldScale;

      this.resizeCanvasToDisplaySize();
      this.scheduleDraw();

      // Download PDF automatically
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diagram.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      this.exporting = false;
      this.drawingClean = false;
      this.forceHighlightConnections = false;
    }
  }

  exportAsSvg(): void {
    if (typeof window === 'undefined') return;

    const geometry: Record<string, TableDef> = {};
    this.svc.tables.forEach((t) => (geometry[t.name] = t));

    const { minX, minY, maxX, maxY } = this.getDiagramBounds();
    const width = maxX - minX;
    const height = maxY - minY;

    const isLight = this.svc.theme() === 'light';
    const bgColor = isLight ? '#f8fafc' : '#08101f';

    const connectedColumns = new Set<string>();
    this.svc.refs.forEach((ref) => {
      if (!this.svc.isTableHidden(ref.fromTable) && !this.svc.isTableHidden(ref.toTable)) {
        connectedColumns.add(`${ref.fromTable}.${ref.fromCol}`);
        connectedColumns.add(`${ref.toTable}.${ref.toCol}`);
      }
    });

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="100%" height="100%" style="background-color: ${bgColor};">`;
    svgContent += `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${bgColor}"/>`; // background

    // 1. Draw Groups
    if (this.svc.groups) {
      this.svc.groups.forEach((g) => {
        const bounds = this.getGroupBounds(g, geometry);
        if (!bounds) return;
        const fillOpacity = isLight ? 0.04 : 0.06;
        svgContent += `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" rx="8" ry="8" fill="${g.color}" fill-opacity="${fillOpacity}" stroke="${g.color}" stroke-opacity="0.45" stroke-width="1.5"/>`;
        svgContent += `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="26" rx="8" ry="8" fill="${g.color}"/>`;
        svgContent += `<text x="${bounds.x + 12}" y="${bounds.y + 13}" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="12" font-weight="700" dominant-baseline="middle">${g.name}</text>`;
      });
    }

    // 2. Draw Connection Lines (Refs)
    const anchorUsage = this.buildAnchorUsage();
    const trunkXByAnchor: Record<string, number> = {};
    this.svc.refs.forEach((ref, i) => {
      if (this.svc.isTableHidden(ref.fromTable) || this.svc.isTableHidden(ref.toTable)) return;
      const path = this.getConnectionPath(ref, geometry, trunkXByAnchor, i, anchorUsage);
      if (!path) return;

      const ortho = this.makeOrthogonal(path);
      const color = ref.color || (isLight ? '#94a3b8' : '#70c8c3');

      let pathD = `M ${ortho[0].x} ${ortho[0].y}`;
      ortho.slice(1).forEach(pt => {
        pathD += ` L ${pt.x} ${pt.y}`;
      });

      // Base connection line (stroke-width="1.8")
      svgContent += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;

      // Draw endpoints markers
      const isStartPk = this.svc.isPrimaryKey(ref.fromTable, ref.fromCol);
      const isEndPk = this.svc.isPrimaryKey(ref.toTable, ref.toCol);

      const drawStartCircle = isStartPk;
      const drawEndCircle = isEndPk;
      const drawStartChevron = !isStartPk;
      const drawEndChevron = !isEndPk;

      const drawCircle = (pt: PathPoint) => {
        svgContent += `<circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="${isLight ? '#ffffff' : '#161f33'}" stroke="${color}" stroke-width="1.8"/>`;
      };

      const drawChevron = (pt: PathPoint, prev: PathPoint) => {
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const angle = Math.atan2(dy, dx);
        const arrowLength = 9;
        const arrowSpread = Math.PI / 5;
        const x1 = pt.x - arrowLength * Math.cos(angle - arrowSpread);
        const y1 = pt.y - arrowLength * Math.sin(angle - arrowSpread);
        const x2 = pt.x - arrowLength * Math.cos(angle + arrowSpread);
        const y2 = pt.y - arrowLength * Math.sin(angle + arrowSpread);
        svgContent += `<path d="M ${x1} ${y1} L ${pt.x} ${pt.y} L ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
      };

      const drawLabel = (pt: PathPoint, adjacent: PathPoint, text: string) => {
        const isStar = text === '*';
        const fontSize = isStar ? 20 : 14;
        const fill = isLight ? '#475569' : '#a0aec0';
        const isHeadingRight = adjacent.x > pt.x;
        const textAnchor = isHeadingRight ? 'start' : 'end';
        const offsetX = isHeadingRight ? 8 : -8;
        const dy = isStar ? 5 : -4;
        svgContent += `<text x="${pt.x + offsetX}" y="${pt.y + dy}" fill="${fill}" font-family="-apple-system, sans-serif" font-size="${fontSize}" font-weight="bold" text-anchor="${textAnchor}" dominant-baseline="auto">${text}</text>`;
      };

      if (drawStartCircle) {
        drawCircle(ortho[0]);
      }
      if (drawEndCircle) {
        drawCircle(ortho[ortho.length - 1]);
      }
      if (drawStartChevron && ortho.length >= 2) {
        drawChevron(ortho[0], ortho[1]);
      }
      if (drawEndChevron && ortho.length >= 2) {
        drawChevron(ortho[ortho.length - 1], ortho[ortho.length - 2]);
      }
      if (ortho.length >= 2 && !this.svc.isColumnNameOnly) {
        drawLabel(ortho[0], ortho[1], isStartPk ? '1' : '*');
        drawLabel(ortho[ortho.length - 1], ortho[ortho.length - 2], isEndPk ? '1' : '*');
      }
    });

    // 3. Draw Tables
    this.svc.tables.forEach((t) => {
      if (this.svc.isTableHidden(t.name)) return;

      const headerColor = t.color || (isLight ? '#337ab7' : '#3ec5c1');
      const clipId = `clip-${t.name.replace(/\./g, '_')}`;
      svgContent += `<g transform="translate(${t.x}, ${t.y})">`;
      // Define a clip path for rounded corners of the table card
      svgContent += `<defs><clipPath id="${clipId}"><rect x="0" y="0" width="${t.width}" height="${t.height}" rx="6" ry="6"/></clipPath></defs>`;
      svgContent += `<g clip-path="url(#${clipId})">`;

      // Table Card background
      svgContent += `<rect x="0" y="0" width="${t.width}" height="${t.height}" fill="${isLight ? '#ffffff' : '#161f33'}"/>`;

      // Header background
      svgContent += `<path d="M 0 6 A 6 6 0 0 1 6 0 L ${t.width - 6} 0 A 6 6 0 0 1 ${t.width} 6 L ${t.width} 34 L 0 34 Z" fill="${headerColor}"/>`;

      // Header text
      svgContent += `<text x="12" y="17" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" dominant-baseline="middle">\u25A6  ${t.name}</text>`;

      // Columns
      let visibleColumns: Column[] = [];
      if (this.svc.isAllFields) {
        visibleColumns = t.columns;
      } else if (this.svc.isKeyOnly) {
        visibleColumns = t.columns.filter(c => c.pk || c.fk);
      } else if (this.svc.isColumnNameOnly) {
        visibleColumns = [];
      }

      visibleColumns.forEach((col, idx) => {
        const rowY = 34 + idx * 30;

        let rowBgColor: string;
        if (isLight) {
          rowBgColor = '#f2f4f8';
        } else {
          rowBgColor = idx % 2 === 1 ? '#18213a' : '#141d31';
        }

        // Row background rect
        svgContent += `<rect x="0" y="${rowY}" width="${t.width}" height="30" fill="${rowBgColor}"/>`;
        // Row border line
        svgContent += `<line x1="0" y1="${rowY}" x2="${t.width}" y2="${rowY}" stroke="${isLight ? '#cbd5e1' : '#2c3f5a'}" stroke-width="1"/>`;

        const colY = rowY + 15;
        // Text color
        const textColor = isLight ? '#1a202c' : '#e6eef9';
        const typeColor = isLight ? '#718096' : '#98a7c4';

        // Column Name (with key symbols if any)
        let prefix = '';
        if (col.pk) prefix += '\u{1F511} ';
        if (col.fk) prefix += '\u{1F517} ';
        if (col.unique && !col.pk) prefix += '\u{1F4A0} ';
        const label = prefix + col.name;

        svgContent += `<text x="12" y="${colY}" fill="${textColor}" font-family="-apple-system, sans-serif" font-size="12" dominant-baseline="middle">${label}</text>`;
        // Column Type
        svgContent += `<text x="${t.width - 12}" y="${colY}" fill="${typeColor}" font-family="-apple-system, sans-serif" font-size="11" text-anchor="end" dominant-baseline="middle">${col.type}</text>`;
      });

      const hiddenCount = t.columns.length - visibleColumns.length;
      if (hiddenCount > 0) {
        const idx = visibleColumns.length;
        const rowY = 34 + idx * 30;

        let rowBgColor: string;
        if (isLight) {
          rowBgColor = '#f2f4f8';
        } else {
          rowBgColor = idx % 2 === 1 ? '#18213a' : '#141d31';
        }

        svgContent += `<rect x="0" y="${rowY}" width="${t.width}" height="30" fill="${rowBgColor}"/>`;
        svgContent += `<line x1="0" y1="${rowY}" x2="${t.width}" y2="${rowY}" stroke="${isLight ? '#cbd5e1' : '#2c3f5a'}" stroke-width="1"/>`;

        const colY = rowY + 15;
        const hiddenColor = isLight ? '#718096' : '#98a7c4';
        const hiddenLabel = `+ ${hiddenCount} hidden field${hiddenCount > 1 ? 's' : ''}`;
        svgContent += `<text x="12" y="${colY}" fill="${hiddenColor}" font-family="-apple-system, sans-serif" font-size="12" font-style="italic" dominant-baseline="middle">${hiddenLabel}</text>`;
      }

      svgContent += `</g>`; // close clip group

      // Draw border stroke on top to ensure crisp borders
      svgContent += `<rect x="0" y="0" width="${t.width}" height="${t.height}" rx="6" ry="6" fill="none" stroke="${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.08)'}" stroke-width="1"/>`;
      svgContent += `</g>`; // close translate group
    });

    // 4. Draw Sticky Notes
    if (this.svc.notes) {
      this.svc.notes.forEach((note) => {
        const noteColor = note.color || '#FFE28B';
        svgContent += `<g transform="translate(${note.posx}, ${note.posy})">`;
        // Main card body
        svgContent += `<rect x="0" y="0" width="${note.width}" height="${note.height}" rx="6" ry="6" fill="${noteColor}" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`;
        // Header background (top rounded corners)
        svgContent += `<path d="M 0 6 A 6 6 0 0 1 6 0 L ${note.width - 6} 0 A 6 6 0 0 1 ${note.width} 6 L ${note.width} 26 L 0 26 Z" fill="rgba(0, 0, 0, 0.09)"/>`;
        // Drag dots (6 dots)
        svgContent += `<circle cx="6" cy="9" r="1" fill="rgba(0,0,0,0.35)"/>`;
        svgContent += `<circle cx="10" cy="9" r="1" fill="rgba(0,0,0,0.35)"/>`;
        svgContent += `<circle cx="6" cy="13" r="1" fill="rgba(0,0,0,0.35)"/>`;
        svgContent += `<circle cx="10" cy="13" r="1" fill="rgba(0,0,0,0.35)"/>`;
        svgContent += `<circle cx="6" cy="17" r="1" fill="rgba(0,0,0,0.35)"/>`;
        svgContent += `<circle cx="10" cy="17" r="1" fill="rgba(0,0,0,0.35)"/>`;
        // Note name
        const escapedName = this.escapeHtml(note.name || '');
        const txtColor = note.textColor || '#000000';
        svgContent += `<text x="18" y="13" fill="${txtColor}" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" dominant-baseline="middle">${escapedName}</text>`;
        // Note text content (using foreignObject for native wrapping)
        const escapedText = this.escapeHtml(note.text || '');
        svgContent += `<foreignObject x="8" y="32" width="${note.width - 16}" height="${note.height - 40}">`;
        svgContent += `<div xmlns="http://www.w3.org/1999/xhtml" style="font-family: -apple-system, sans-serif; font-size: 12px; color: ${txtColor}; line-height: 1.5; white-space: pre-wrap; word-break: break-word; margin: 0; padding: 0;">${escapedText}</div>`;
        svgContent += `</foreignObject>`;
        svgContent += `</g>`;
      });
    }

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  ngOnInit(): void {
    this.subscriptions.add(this.entitlementService.entitlements$.subscribe(() => {
      this.cdr.detectChanges();
    }));

    this.subscriptions.add(this.svc.exportRequested$.subscribe((format) => {
      if (format === 'png') this.exportAsPng();
      else if (format === 'pdf') this.exportAsPdf();
      else if (format === 'svg') this.exportAsSvg();
    }));

    // Redraw subscription from service
    this.subscriptions.add(this.svc.redraw$.subscribe(() => {
      if (typeof window !== 'undefined') {
        this.scheduleDraw();
      }
    }));
    // Force redraw for immediate visibility changes (bypasses rafPending guard)
    this.subscriptions.add(this.svc.forceRedraw$.subscribe(() => {
      if (typeof window !== 'undefined' && this.ctx) {
        this.draw();
      }
      this.cdr.detectChanges();
    }));
    this.subscriptions.add(this.svc.canvasFitRequested$.subscribe(() => {
      this.hasFitted = false;
      this.fitCanvasAfterLayout();
    }));
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    this.wheelListener = (e: WheelEvent) => {
      if (this.colorPicker.visible) {
        this.colorPicker.visible = false;
        this.cdr.detectChanges();
      }
      if (this.activeNoteMenuId !== null) {
        this.activeNoteMenuId = null;
        this.cdr.detectChanges();
      }
      if (this.isMouseOverCanvas && !this.svc.showDocs) {
        this.onCanvasWheel(e);
      }
    };
    window.addEventListener('wheel', this.wheelListener, { passive: false });

    this.resizeCanvasToDisplaySize();
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvasToDisplaySize();
      if (!this.hasFitted && this.canvasWrapRef.nativeElement.clientWidth > 50) {
        this.zoomFit();
      }
      this.scheduleDraw();
    });
    this.resizeObserver.observe(this.canvasWrapRef.nativeElement);

    this.startAnimationLoop();
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined' && this.wheelListener) {
      window.removeEventListener('wheel', this.wheelListener);
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.resizeObserver?.disconnect();
    this.subscriptions.unsubscribe();
    if (this.fitTimer) clearTimeout(this.fitTimer);
  }

  private resizeCanvasToDisplaySize(): void {
    if (!this.canvasRef || !this.canvasWrapRef) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = this.canvasWrapRef.nativeElement.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;

    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));

    const targetWidth = Math.round(w * this.dpr);
    const targetHeight = Math.round(h * this.dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight ||
      canvas.style.width !== w + 'px' || canvas.style.height !== h + 'px') {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.ctx = ctx;
      }
      this.draw();
    }
  }

  private startAnimationLoop(): void {
    if (this.animationFrameId !== null) return;

    const tick = (time: number) => {
      if (!this.lastFrameTime) this.lastFrameTime = time;
      const deltaSeconds = (time - this.lastFrameTime) / 1000;
      this.lastFrameTime = time;

      this.animationTime = time;
      this.flowOffset = (this.flowOffset - this.dashSpeed * deltaSeconds) % this.markerSpacing;

      this.draw();
      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  private scheduleDraw(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.draw();
      this.cdr.detectChanges();
    });
  }

  /* ============ MAIN DRAW LOOP ============ */

  private draw(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const canvas = this.canvasRef.nativeElement;
    const w = this.exporting ? canvas.width : canvas.clientWidth;
    const h = this.exporting ? canvas.height : canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);
    const isLight = this.svc.theme() === 'light';
    ctx.fillStyle = isLight ? '#f8fafc' : '#08101f';
    ctx.fillRect(0, 0, w, h);

    if (this.svc.gridOn) this.drawGrid(ctx, w, h);

    this.activeTooltip = null;

    ctx.save();
    ctx.translate(this.svc.view.x, this.svc.view.y);
    ctx.scale(this.svc.view.scale, this.svc.view.scale);

    const geometry: Record<string, TableDef> = {};
    this.svc.tables.forEach((t) => (geometry[t.name] = t));

    const toolbarsToDraw: { ref: RefDef; index: number; anchor: PathPoint }[] = [];
    this.drawTableGroups(ctx, geometry);
    this.tableHeaderIcons = [];

    const highlightedColumns = this.getHighlightedColumns();

    this.drawRefs(ctx, geometry, toolbarsToDraw);
    this.drawConnectionPreview(ctx, geometry);

    this.svc.tables.forEach((t) => {
      if (!this.svc.isTableHidden(t.name) && !this.isTableGroupCollapsed(t.name)) {
        this.drawTable(ctx, t, highlightedColumns);
      }
    });

    if (!this.drawingClean) {
      toolbarsToDraw.forEach((tb) => {
        this.drawConnectionToolbar(ctx, tb.ref, tb.index, tb.anchor);
      });

      // Render active tooltip at the absolute top layer
      const tooltip = this.activeTooltip as { x: number; y: number; label: string } | null;
      if (tooltip) {
        this.drawIconTooltip(ctx, tooltip.x, tooltip.y, tooltip.label);
      }
    }

    if (this.exporting) {
      this.drawStickyNotes(ctx);
    }

    if (this.svc.diagramWorkspaceType() === 'Team' && !this.drawingClean) {
      this.drawRemoteCursors(ctx);
    }

    ctx.restore();

    if (this.contextMenu.visible && !this.drawingClean) {
      this.drawContextMenu(ctx);
    }
  }

  private drawRemoteCursors(ctx: CanvasRenderingContext2D): void {
    const cursors = this.svc.remoteCursors();
    for (const userId of Object.keys(cursors)) {
      const c = cursors[Number(userId)];
      if (c && c.line === -1 && c.col === -1 && c.x !== undefined && c.y !== undefined) {
        ctx.save();
        
        // Draw the cursor arrow (classic mouse pointer shape)
        ctx.fillStyle = c.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);           // Tip
        ctx.lineTo(c.x, c.y + 16);      // Down left edge
        ctx.lineTo(c.x + 4.5, c.y + 11.5); // Inner corner
        ctx.lineTo(c.x + 11, c.y + 11.5);  // Right edge
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();

        // Draw the username badge
        ctx.font = '500 11px system-ui, sans-serif';
        const metrics = ctx.measureText(c.username);
        const textWidth = metrics.width;
        
        ctx.fillStyle = c.color;
        // Position below and to the right of the cursor
        ctx.beginPath();
        ctx.roundRect(c.x + 8, c.y + 16, textWidth + 12, 18, 4);
        ctx.fill();
        ctx.stroke(); // Add white stroke to badge too
        
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.username, c.x + 14, c.y + 25);
        
        ctx.restore();
      }
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const spacing = this.svc.GRID_SPACING * this.svc.view.scale;
    if (spacing < 4) return;

    const startX = (((this.svc.view.x % spacing) + spacing) % spacing);
    const startY = (((this.svc.view.y % spacing) + spacing) % spacing);

    const isLight = this.svc.theme() === 'light';
    ctx.fillStyle = isLight ? 'rgba(15, 23, 42, 0.24)' : 'rgba(255, 255, 255, 0.24)';

    for (let x = startX; x < w; x += spacing) {
      for (let y = startY; y < h; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, beginPath = true): void {
    if (beginPath) ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  isTableGroupCollapsed(tableName: string): boolean {
    const baseName = tableName.includes('.') ? tableName.split('.')[1] : tableName;
    const group = this.svc.groups.find(
      (g) => g.tables.includes(tableName) || g.tables.includes(baseName)
    );
    if (!group) return false;
    return this.svc.collapsedGroups.has(group.name);
  }

  private getOpenGroupBounds(g: any, geometry: Record<string, TableDef>): { x: number, y: number, w: number, h: number } | null {
    const groupTables = this.svc.tables.filter((t) => {
      const baseName = t.name.includes('.') ? t.name.split('.')[1] : t.name;
      return (g.tables.includes(t.name) || g.tables.includes(baseName)) && !this.svc.isTableHidden(t.name);
    });
    if (groupTables.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    groupTables.forEach((t) => {
      if (t.x < minX) minX = t.x;
      if (t.y < minY) minY = t.y;
      if (t.x + t.width > maxX) maxX = t.x + t.width;
      if (t.y + t.height > maxY) maxY = t.y + t.height;
    });

    const paddingX = 24;
    const paddingY = 20;
    const headerH = 26;

    return {
      x: minX - paddingX,
      y: minY - headerH - paddingY,
      w: (maxX - minX) + paddingX * 2,
      h: (maxY - minY) + headerH + paddingY * 2
    };
  }

  private getGroupBounds(g: any, geometry: Record<string, TableDef>): { x: number, y: number, w: number, h: number } | null {
    if (this.svc.collapsedGroups.has(g.name)) {
      let pos = this.svc.groupPositions[g.name];
      if (!pos) {
        const openBounds = this.getOpenGroupBounds(g, geometry);
        if (openBounds) {
          pos = { x: openBounds.x, y: openBounds.y };
          this.svc.groupPositions[g.name] = pos;
          this.svc.saveGroupPositions();
        }
      }
      if (pos) {
        const collapsedWidth = Math.max(140, g.name.length * 7.5 + 60);
        return { x: pos.x, y: pos.y, w: collapsedWidth, h: 26 };
      }
      return null;
    }

    const openBounds = this.getOpenGroupBounds(g, geometry);
    if (openBounds) {
      this.svc.groupPositions[g.name] = { x: openBounds.x, y: openBounds.y };
      this.svc.saveGroupPositions();
    }
    return openBounds;
  }

  private drawTableGroups(ctx: CanvasRenderingContext2D, geometry: Record<string, TableDef>): void {
    this.groupColorIcons = [];
    if (!this.svc.groups || this.svc.groups.length === 0) return;

    const isLight = this.svc.theme() === 'light';

    this.svc.groups.forEach((g) => {
      const bounds = this.getGroupBounds(g, geometry);
      if (!bounds) return;

      const { x, y, w, h } = bounds;
      const headerH = 26;

      ctx.save();
      this.roundRectPath(ctx, x, y, w, h, 8);

      // Fill group container background to hide grid dots and underlying items
      ctx.fillStyle = isLight ? '#f8fafc' : '#08101f';
      ctx.fill();

      ctx.fillStyle = isLight ? this.hexToRgba(g.color, 0.04) : this.hexToRgba(g.color, 0.06);
      ctx.fill();

      ctx.clip();
      ctx.fillStyle = g.color;
      ctx.fillRect(x, y, w, headerH);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const isCollapsed = this.svc.collapsedGroups.has(g.name);
      const arrowSymbol = isCollapsed ? '▶  ' : '▼  ';
      ctx.fillText(arrowSymbol + g.name, x + 12, y + headerH / 2);
      ctx.restore();

      // Draw Group Settings Icon
      const gColorX = x + w - 18;
      const gColorY = y + headerH / 2;
      const isGroupColorHovered = this.hoveredGroupColorIcon === g.name;

      if (!this.svc.isReadOnly) {
        this.drawSettingIcon(ctx, gColorX, gColorY, isGroupColorHovered);
        if (isGroupColorHovered) {
          this.activeTooltip = { x: gColorX, y: gColorY, label: 'Settings' };
        }
      }

      this.groupColorIcons.push({ groupName: g.name, x: gColorX, y: gColorY });

      ctx.save();
      this.roundRectPath(ctx, x, y, w, h, 8);
      ctx.strokeStyle = this.hexToRgba(g.color, 0.45);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    });
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private drawColorPickerIcon(ctx: CanvasRenderingContext2D, x: number, y: number, isHovered: boolean): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.15)';
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Kidney-shaped palette outline
    ctx.beginPath();
    ctx.moveTo(x - 4.5, y - 4);
    ctx.quadraticCurveTo(x, y - 6, x + 4, y - 4.5);
    ctx.quadraticCurveTo(x + 6, y, x + 3.5, y + 4.5);
    ctx.quadraticCurveTo(x, y + 6, x - 3.5, y + 4);
    ctx.quadraticCurveTo(x - 5.5, y, x - 4.5, y - 4);
    ctx.closePath();
    ctx.stroke();

    // Thumb hole
    ctx.beginPath();
    ctx.arc(x - 2, y + 1.5, 0.9, 0, Math.PI * 2);
    ctx.stroke();

    // Paint blobs (4 vibrant primary colors)
    // Red blob
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(x - 1, y - 3, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Yellow blob
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(x + 2.5, y - 2, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Green blob
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(x + 2.5, y + 1.5, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Blue blob
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(x, y + 3.5, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawSettingIcon(ctx: CanvasRenderingContext2D, x: number, y: number, isHovered: boolean): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = isHovered ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.15)';
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer gear circle
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.stroke();

    // Inner center dot
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 8 gear teeth
    const teethCount = 8;
    ctx.beginPath();
    for (let i = 0; i < teethCount; i++) {
      const angle = (i * Math.PI * 2) / teethCount;
      const xStart = x + Math.cos(angle) * 5;
      const yStart = y + Math.sin(angle) * 5;
      const xEnd = x + Math.cos(angle) * 7.5;
      const yEnd = y + Math.sin(angle) * 7.5;
      ctx.moveTo(xStart, yStart);
      ctx.lineTo(xEnd, yEnd);
    }
    ctx.stroke();
    ctx.restore();
  }

  private getHighlightedColumns(): Set<string> {
    const highlighted = new Set<string>();

    if (this.connectionDraft) {
      highlighted.add(`${this.connectionDraft.fromTable}.${this.connectionDraft.fromColumn}`);
      if (this.hoveredColumn) {
        highlighted.add(`${this.hoveredColumn.tableName}.${this.hoveredColumn.columnName}`);
      }
      return highlighted;
    }
    if (this.reconnectDraft) {
      highlighted.add(`${this.reconnectDraft.anchorTable}.${this.reconnectDraft.anchorColumn}`);
      if (this.hoveredColumn) {
        highlighted.add(`${this.hoveredColumn.tableName}.${this.hoveredColumn.columnName}`);
      }
      return highlighted;
    }

    if (this.svc.showAllConnections) {
      this.svc.refs.forEach(ref => {
        highlighted.add(`${ref.fromTable}.${ref.fromCol}`);
        highlighted.add(`${ref.toTable}.${ref.toCol}`);
      });
    }
    if (this.exporting) {
      this.svc.refs.forEach((ref) => {
        if (!this.svc.isTableHidden(ref.fromTable) && !this.svc.isTableHidden(ref.toTable)) {
          highlighted.add(`${ref.fromTable}.${ref.fromCol}`);
          highlighted.add(`${ref.toTable}.${ref.toCol}`);
        }
      });
      return highlighted;
    }

    if (this.svc.hoveredConnectionIndex !== null && this.svc.hoveredConnectionIndex !== undefined && this.svc.hoveredConnectionIndex >= 0) {
      const ref = this.svc.refs[this.svc.hoveredConnectionIndex];
      if (ref && !this.svc.isTableHidden(ref.fromTable) && !this.svc.isTableHidden(ref.toTable)) {
        highlighted.add(`${ref.fromTable}.${ref.fromCol}`);
        highlighted.add(`${ref.toTable}.${ref.toCol}`);
      }
    } else if (this.svc.hoveredTableName) {
      this.svc.refs.forEach(ref => {
        if (ref.fromTable === this.svc.hoveredTableName || ref.toTable === this.svc.hoveredTableName) {
          highlighted.add(`${ref.fromTable}.${ref.fromCol}`);
          highlighted.add(`${ref.toTable}.${ref.toCol}`);
        }
      });
      if (this.hoveredColumn) {
        highlighted.add(`${this.hoveredColumn.tableName}.${this.hoveredColumn.columnName}`);
      }
    } else if (this.hoveredGroupName) {
      const group = this.svc.groups.find(g => g.name === this.hoveredGroupName);
      if (group) {
        this.svc.refs.forEach(ref => {
          if (group.tables.includes(ref.fromTable) || group.tables.includes(ref.toTable)) {
            highlighted.add(`${ref.fromTable}.${ref.fromCol}`);
            highlighted.add(`${ref.toTable}.${ref.toCol}`);
          }
        });
      }
    }

    return highlighted;
  }

  private drawTable(ctx: CanvasRenderingContext2D, t: TableDef, highlightedColumns: Set<string>): void {
    const radius = 1;
    const isLight = this.svc.theme() === 'light';

    ctx.save();
    ctx.shadowColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.24)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    this.roundRectPath(ctx, t.x, t.y, t.width, t.height, radius);
    ctx.fillStyle = isLight ? '#ffffff' : '#161f33';
    ctx.fill();
    ctx.restore();

    ctx.save();
    this.roundRectPath(ctx, t.x, t.y, t.width, t.height, radius);
    ctx.clip();

    ctx.fillStyle = t.color || (isLight ? '#337ab7' : '#3ec5c1');
    ctx.fillRect(t.x, t.y, t.width, this.svc.HEADER_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('\u25A6  ' + t.name, t.x + 12, t.y + this.svc.HEADER_H / 2 + 1);

    const settingX = t.x + t.width - 18;
    const editY = t.y + this.svc.HEADER_H / 2;

    const isSettingsHovered = this.hoveredTableHeaderIcon?.tableName === t.name && this.hoveredTableHeaderIcon.type === 'settings';

    if (!this.svc.isReadOnly) {
      // Draw Settings Icon
      this.drawSettingIcon(ctx, settingX, editY, isSettingsHovered);

      this.tableHeaderIcons.push(
        { tableName: t.name, type: 'settings', x: settingX, y: editY }
      );

      if (isSettingsHovered) {
        this.activeTooltip = {
          x: settingX,
          y: editY,
          label: 'Settings'
        };
      }
    }

    let visibleColumns: Column[] = [];
    if (this.svc.isAllFields) {
      visibleColumns = t.columns;
    } else if (this.svc.isKeyOnly) {
      visibleColumns = t.columns.filter(c => c.pk || c.fk);
    } else if (this.svc.isColumnNameOnly) {
      visibleColumns = [];
    }

    visibleColumns.forEach((c, ci) => {
      const rowY = t.y + this.svc.HEADER_H + ci * this.svc.ROW_H;
      const isHighlighted = highlightedColumns.has(`${t.name}.${c.name}`);

      let rowBgColor: string;
      if (isLight) {
        rowBgColor = isHighlighted ? '#d7e9fcff' : '#f2f4f8';
      } else {
        rowBgColor = isHighlighted ? 'rgba(76, 199, 195, 0.15)' : (ci % 2 === 1 ? '#18213a' : '#141d31');
      }

      ctx.fillStyle = rowBgColor;
      ctx.fillRect(t.x, rowY, t.width, this.svc.ROW_H);
      ctx.strokeStyle = isLight ? '#e2e8f0' : '#2c3f5a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(t.x, rowY);
      ctx.lineTo(t.x + t.width, rowY);
      ctx.stroke();

      const textY = rowY + this.svc.ROW_H / 2 + 1;
      ctx.font = '500 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = isLight ? '#1a202c' : '#e6eef9';
      ctx.textAlign = 'left';
      let prefix = '';
      if (c.pk) prefix += '\u{1F511} ';
      if (c.fk) prefix += '\u{1F517} ';
      if (c.unique && !c.pk) prefix += '\u{1F4A0} ';
      const label = prefix + c.name;
      ctx.fillText(label, t.x + 12, textY);

      ctx.font = '400 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = isLight ? '#718096' : '#98a7c4';
      ctx.textAlign = 'right';
      ctx.fillText(c.type, t.x + t.width - 12, textY);
    });

    const hiddenCount = t.columns.length - visibleColumns.length;
    if (hiddenCount > 0) {
      const ci = visibleColumns.length;
      const rowY = t.y + this.svc.HEADER_H + ci * this.svc.ROW_H;

      let rowBgColor: string;
      if (isLight) {
        rowBgColor = '#f2f4f8';
      } else {
        rowBgColor = ci % 2 === 1 ? '#18213a' : '#141d31';
      }

      ctx.fillStyle = rowBgColor;
      ctx.fillRect(t.x, rowY, t.width, this.svc.ROW_H);
      ctx.strokeStyle = isLight ? '#e2e8f0' : '#2c3f5a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(t.x, rowY);
      ctx.lineTo(t.x + t.width, rowY);
      ctx.stroke();

      const textY = rowY + this.svc.ROW_H / 2 + 1;
      ctx.font = 'italic 400 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = isLight ? '#718096' : '#98a7c4';
      ctx.textAlign = 'left';
      const hiddenLabel = `+ ${hiddenCount} hidden field${hiddenCount > 1 ? 's' : ''}`;
      ctx.fillText(hiddenLabel, t.x + 12, textY);
    }

    ctx.restore();

    this.roundRectPath(ctx, t.x, t.y, t.width, t.height, radius);
    ctx.strokeStyle = isLight ? '#cbd5e1' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  isRefInvalid(ref: any): boolean {
    return this.svc.isRefInvalid(ref);
  }

  private drawRefs(ctx: CanvasRenderingContext2D, geometry: Record<string, TableDef>, toolbarsToDraw: { ref: RefDef; index: number; anchor: PathPoint }[]): void {
    this.connectionIcons = [];

    const trunkXByAnchor: Record<string, number> = {};
    const anchorUsage = this.buildAnchorUsage();

    // 1. Gather all path information in the original iteration order to preserve correct waypoint anchoring calculation
    const computedRefs = this.svc.refs.map((ref, i) => {
      if (this.svc.isTableHidden(ref.fromTable) || this.svc.isTableHidden(ref.toTable)) {
        return null;
      }
      const path = this.getConnectionPath(ref, geometry, trunkXByAnchor, i, anchorUsage);
      if (!path) return null;

      const isDraggingCurrent =
        this.isDraggingWaypoint &&
        i === this.dragConnectionIndex;

      let isHoveredRef = false;
      if (this.svc.hoveredTableName) {
        isHoveredRef =
          ref.fromTable === this.svc.hoveredTableName ||
          ref.toTable === this.svc.hoveredTableName;
      } else if (this.hoveredGroupName) {
        const group = this.svc.groups.find(g => g.name === this.hoveredGroupName);
        if (group) {
          isHoveredRef =
            group.tables.includes(ref.fromTable) ||
            group.tables.includes(ref.toTable);
        }
      }

      const isActive =
        this.forceHighlightConnections ||
        (!this.drawingClean && (
          this.svc.showAllConnections ||
          i === this.svc.hoveredConnectionIndex ||
          i === this.svc.selectedConnectionIndex ||
          isDraggingCurrent || isHoveredRef
        ));

      const isSelected = i === this.svc.selectedConnectionIndex;
      const isHovered = i === this.svc.hoveredConnectionIndex;

      // Determine priority: selected/dragging gets highest priority (3), hovered gets (2), active gets (1), normal gets (0)
      let priority = 0;
      if (isSelected || isDraggingCurrent) {
        priority = 3;
      } else if (isHovered) {
        priority = 2;
      } else if (isActive) {
        priority = 1;
      }

      return {
        ref,
        i,
        path,
        isDraggingCurrent,
        isHoveredTableRef: isHoveredRef,
        isActive,
        isSelected,
        priority
      };
    });

    // 2. Filter out null paths and sort by priority ascending
    const validRefs = computedRefs.filter((c): c is NonNullable<typeof c> => c !== null);
    validRefs.sort((a, b) => a.priority - b.priority);

    // 3. Draw them in order of priority (normal -> active -> hovered -> selected)
    validRefs.forEach(({ ref, i, path, isDraggingCurrent, isHoveredTableRef, isActive, isSelected }) => {
      if (this.reconnectDraft && this.reconnectDraft.refIndex === i) {
        return;
      }
      ctx.save();

      // CLIP: Exclude any groups that this connection does NOT belong to
      if (this.svc.groups && this.svc.groups.length > 0) {
        ctx.beginPath();
        const limit = 100000;
        ctx.rect(-limit, -limit, limit * 2, limit * 2);

        const lineGroups = new Set<string>();
        const fromBase = ref.fromTable.includes('.') ? ref.fromTable.split('.')[1] : ref.fromTable;
        const toBase = ref.toTable.includes('.') ? ref.toTable.split('.')[1] : ref.toTable;
        this.svc.groups.forEach(g => {
          if (g.tables.includes(ref.fromTable) || g.tables.includes(fromBase) ||
            g.tables.includes(ref.toTable) || g.tables.includes(toBase)) {
            lineGroups.add(g.name);
          }
        });

        this.svc.groups.forEach(g => {
          if (!lineGroups.has(g.name)) {
            const bounds = this.getGroupBounds(g, geometry);
            if (bounds) {
              this.roundRectPath(ctx, bounds.x, bounds.y, bounds.w, bounds.h, 8, false);
            }
          }
        });
        ctx.clip('evenodd');
      }

      const isInvalid = this.isRefInvalid(ref);
      const isLight = this.svc.theme() === 'light';
      const defaultLineColor = isLight ? '#94a3b8' : '#70c8c3';
      const baseColor = isInvalid ? '#ef4444' : (ref.color || defaultLineColor);
      const activeColor = isInvalid ? '#f87171' : (ref.color || (isLight ? '#3b82f6' : '#70c8c3'));
      ctx.strokeStyle = isActive ? activeColor : baseColor;
      ctx.lineWidth = this.exporting ? (isActive ? 2.2 : 1.5) : (isActive ? 2.4 : 1.8);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (isInvalid) {
        ctx.setLineDash([6, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.lineDashOffset = isActive ? (isInvalid ? -this.flowOffset * 1.5 : this.flowOffset) : 0;

      const ortho = this.makeOrthogonal(path);
      if (this.linkStyle === 'straight') {
        ctx.beginPath();
        ctx.moveTo(ortho[0].x, ortho[0].y);
        ortho.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      } else {
        this.roundedPolylinePath(ctx, ortho);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isActive ? activeColor : baseColor;

      const isStartPk = this.svc.isPrimaryKey(ref.fromTable, ref.fromCol);
      const isEndPk = this.svc.isPrimaryKey(ref.toTable, ref.toCol);

      // Determine drawing configuration:
      // - One-to-One (both PK): circles on both ends
      // - Many-to-Many (neither PK): chevrons on both ends
      // - One-to-Many/Many-to-One: circle on PK end, chevron on non-PK end
      const drawStartCircle = isStartPk;
      const drawEndCircle = isEndPk;
      const drawStartChevron = !isStartPk;
      const drawEndChevron = !isEndPk;

      const drawCircle = (pt: PathPoint) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#ffffff' : '#161f33';
        ctx.fill();
        ctx.strokeStyle = isActive ? activeColor : baseColor;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      };

      const drawChevron = (pt: PathPoint, prev: PathPoint) => {
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const angle = Math.atan2(dy, dx);

        const arrowLength = 9;
        const arrowSpread = Math.PI / 5; // ~36 degrees
        const x1 = pt.x - arrowLength * Math.cos(angle - arrowSpread);
        const y1 = pt.y - arrowLength * Math.sin(angle - arrowSpread);
        const x2 = pt.x - arrowLength * Math.cos(angle + arrowSpread);
        const y2 = pt.y - arrowLength * Math.sin(angle + arrowSpread);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(pt.x, pt.y);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isActive ? activeColor : baseColor;
        ctx.lineWidth = isActive ? 2.5 : 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      };

      if (drawStartCircle) {
        drawCircle(ortho[0]);
      }
      if (drawEndCircle) {
        drawCircle(ortho[ortho.length - 1]);
      }

      if (drawStartChevron && ortho.length >= 2) {
        drawChevron(ortho[0], ortho[1]);
      }
      if (drawEndChevron && ortho.length >= 2) {
        drawChevron(ortho[ortho.length - 1], ortho[ortho.length - 2]);
      }

      const drawLabel = (pt: PathPoint, adjacent: PathPoint, text: string) => {
        ctx.save();
        const isStar = text === '*';
        const fontSize = isStar ? '20px' : '14px';
        ctx.font = `bold ${fontSize} -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = isLight ? '#475569' : '#a0aec0';
        ctx.textBaseline = 'bottom';
        const isHeadingRight = adjacent.x > pt.x;
        ctx.textAlign = isHeadingRight ? 'left' : 'right';
        const offsetX = isHeadingRight ? 8 : -8;
        // Adjust vertical offset slightly so the larger star remains aligned with the '1' label
        const offsetY = isStar ? 2 : -4;
        ctx.fillText(text, pt.x + offsetX, pt.y + offsetY);
        ctx.restore();
      };

      if (ortho.length >= 2 && !this.svc.isColumnNameOnly) {
        drawLabel(ortho[0], ortho[1], isStartPk ? '1' : '*');
        drawLabel(ortho[ortho.length - 1], ortho[ortho.length - 2], isEndPk ? '1' : '*');
      }

      if (isInvalid && ortho.length >= 2) {
        // Place badge at the non-PK endpoint (usually toCol endpoint)
        const fromTab = this.svc.tables.find(t => t.name === ref.fromTable);
        const fromColObj = fromTab?.columns.find(c => c.name === ref.fromCol);
        const isFromEligible = !!(fromColObj?.pk || fromColObj?.unique);
        const badgePt = !isFromEligible ? ortho[0] : ortho[ortho.length - 1];
        ctx.save();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(badgePt.x, badgePt.y, 8.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', badgePt.x, badgePt.y);
        ctx.restore();
      }

      if (isActive) {
        if (!this.exporting) {
          if (isSelected) {
            // Draw handles for corner waypoints
            const waypoints = ref.waypoints || [];
            waypoints.forEach((wp) => {
              this.drawHandle(ctx, wp.x, wp.y, activeColor);
            });

            // Draw handles for start and end endpoints
            if (ortho.length >= 2) {
              this.drawHandle(ctx, ortho[0].x, ortho[0].y, activeColor);
              this.drawHandle(ctx, ortho[ortho.length - 1].x, ortho[ortho.length - 1].y, activeColor);
            }
          }

          const showMidpoints = i === this.svc.selectedConnectionIndex || isDraggingCurrent;
          if (showMidpoints) {
            for (let s = 0; s < ortho.length - 1; s++) {
              const midX = (ortho[s].x + ortho[s + 1].x) / 2;
              const midY = (ortho[s].y + ortho[s + 1].y) / 2;
              this.drawHandle(ctx, midX, midY, activeColor, true);
            }
          }
        }

        const flowPath = this.svc.shouldReverseFlow(ref) ? [...ortho].reverse() : ortho;
        const finalFlowPath = this.linkStyle === 'smooth' ? this.getRoundedPolylinePoints(flowPath, 10) : flowPath;
        this.drawFlowingDots(ctx, finalFlowPath, isInvalid ? '#ef4444' : (ctx.strokeStyle as string));
      }

      if (isInvalid) {
        // Draw a warning badge at the middle segment
        const midIndex = Math.floor(ortho.length / 2);
        const pt = ortho[midIndex];
        ctx.save();
        ctx.shadowColor = 'rgba(239, 68, 68, 0.45)';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', pt.x, pt.y);
        ctx.restore();
      }

      const showToolbar = i === this.svc.selectedConnectionIndex || isDraggingCurrent;
      if (showToolbar) {
        const anchor = this.selectedConnectionPoint || ortho[Math.floor(ortho.length / 2)];
        toolbarsToDraw.push({ ref, index: i, anchor });
      }
      ctx.restore();
    });
  }

  private drawConnectionToolbar(ctx: CanvasRenderingContext2D, ref: RefDef, refIndex: number, anchor: PathPoint): void {
    if (this.svc.isReadOnly) return;
    const spacing = 26;
    const r = this.iconRadius;
    const baseY = anchor.y - 28;
    const colorPos = { x: anchor.x - spacing, y: baseY };
    const resetPos = { x: anchor.x, y: baseY };
    const deletePos = { x: anchor.x + spacing, y: baseY };

    const isLight = this.svc.theme() === 'light';
    const hasCustomPath = !!ref.waypoints;

    ctx.save();
    const pillW = spacing * 2 + r * 2 + 12;
    this.roundRectPath(ctx, colorPos.x - r - 6, baseY - r - 5, pillW, r * 2 + 10, 12);
    ctx.fillStyle = isLight ? 'rgba(255,255,255,0.96)' : 'rgba(20,29,49,0.94)';
    ctx.fill();
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(colorPos.x, colorPos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = ref.color || (isLight ? '#3b82f6' : '#70c8c3');
    ctx.fill();
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw paint palette/color picker icon overlay
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(colorPos.x, colorPos.y, 6.2, 0, Math.PI * 2);
    ctx.stroke();

    // Draw swatches
    ctx.beginPath();
    ctx.arc(colorPos.x - 2.5, colorPos.y - 1.6, 1.2, 0, Math.PI * 2);
    ctx.arc(colorPos.x + 2.5, colorPos.y - 1.6, 1.2, 0, Math.PI * 2);
    ctx.arc(colorPos.x, colorPos.y + 2.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = hasCustomPath ? 1 : 0.45;
    ctx.beginPath();
    ctx.arc(resetPos.x, resetPos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? '#eff6ff' : '#1f2b3a';
    ctx.fill();
    ctx.strokeStyle = isLight ? '#2563eb' : '#5fb8f5';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = isLight ? '#2563eb' : '#5fb8f5';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(resetPos.x, resetPos.y, 4, -Math.PI * 0.85, Math.PI * 0.65);
    ctx.stroke();
    const headAngle = Math.PI * 0.65;
    const headX = resetPos.x + Math.cos(headAngle) * 4;
    const headY = resetPos.y + Math.sin(headAngle) * 4;
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    ctx.lineTo(headX - 3.2, headY - 1.2);
    ctx.moveTo(headX, headY);
    ctx.lineTo(headX - 1.6, headY - 3.4);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(deletePos.x, deletePos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? '#fef2f2' : '#3a1f1f';
    ctx.fill();
    ctx.strokeStyle = isLight ? '#ef4444' : '#f27272';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = isLight ? '#ef4444' : '#f27272';
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(deletePos.x - 3.5, deletePos.y - 3);
    ctx.lineTo(deletePos.x + 3.5, deletePos.y - 3);
    ctx.moveTo(deletePos.x - 2.5, deletePos.y - 3);
    ctx.lineTo(deletePos.x - 2, deletePos.y + 3.5);
    ctx.moveTo(deletePos.x + 2.5, deletePos.y - 3);
    ctx.lineTo(deletePos.x + 2, deletePos.y + 3.5);
    ctx.moveTo(deletePos.x - 3, deletePos.y + 3.5);
    ctx.lineTo(deletePos.x + 3, deletePos.y + 3.5);
    ctx.stroke();

    this.connectionIcons.push(
      { refIndex, type: 'color', x: colorPos.x, y: colorPos.y },
      { refIndex, type: 'reset', x: resetPos.x, y: resetPos.y },
      { refIndex, type: 'delete', x: deletePos.x, y: deletePos.y }
    );
    if (this.hoveredIcon && this.hoveredIcon.refIndex === refIndex) {
      const labelMap = { color: 'Change color', reset: 'Reset path', delete: 'Delete connection' } as const;
      const posMap = { color: colorPos, reset: resetPos, delete: deletePos } as const;
      this.activeTooltip = {
        x: posMap[this.hoveredIcon.type].x,
        y: posMap[this.hoveredIcon.type].y,
        label: labelMap[this.hoveredIcon.type]
      };
    }
  }

  private findConnectionIconAt(wx: number, wy: number): { refIndex: number; type: any } | null {
    const tolerance = (this.iconRadius + this.iconHitPadding) / this.svc.view.scale;
    for (let i = this.connectionIcons.length - 1; i >= 0; i--) {
      const icon = this.connectionIcons[i];
      if (Math.hypot(wx - icon.x, wy - icon.y) <= tolerance) {
        return { refIndex: icon.refIndex, type: icon.type };
      }
    }
    return null;
  }

  private findTableHeaderIconAt(wx: number, wy: number): { tableName: string; type: 'edit' | 'delete' | 'color' | 'settings'; x: number; y: number } | null {
    const tolerance = (11 + this.iconHitPadding) / this.svc.view.scale;
    const icon = this.tableHeaderIcons.find((item) => Math.hypot(wx - item.x, wy - item.y) <= tolerance);
    return icon ? { tableName: icon.tableName, type: icon.type, x: icon.x, y: icon.y } : null;
  }

  private findGroupColorIconAt(wx: number, wy: number): { groupName: string; x: number; y: number } | null {
    const tolerance = 11 / this.svc.view.scale;
    const icon = this.groupColorIcons.find((item) => Math.hypot(wx - item.x, wy - item.y) <= tolerance);
    return icon ? { groupName: icon.groupName, x: icon.x, y: icon.y } : null;
  }

  private makeOrthogonal(points: PathPoint[]): PathPoint[] {
    if (points.length < 2) return points;

    const result: PathPoint[] = [];
    result.push(points[0]);

    for (let i = 1; i < points.length; i++) {
      const prev = result[result.length - 1];
      const curr = points[i];

      if (prev.x !== curr.x && prev.y !== curr.y) {
        result.push({ x: curr.x, y: prev.y });
      }
      result.push(curr);
    }

    return result;
  }

  private makeOrthogonalIndexed(points: PathPoint[]): { pts: PathPoint[]; rawSegOf: number[] } {
    const pts: PathPoint[] = [points[0]];
    const rawSegOf: number[] = [];

    for (let i = 1; i < points.length; i++) {
      const prev = pts[pts.length - 1];
      const curr = points[i];

      if (prev.x !== curr.x && prev.y !== curr.y) {
        pts.push({ x: curr.x, y: prev.y });
        rawSegOf.push(i - 1);
      }

      pts.push(curr);
      rawSegOf.push(i - 1);
    }

    return { pts, rawSegOf };
  }

  private drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, faint = false): void {
    const isLight = this.svc.theme() === 'light';
    ctx.beginPath();
    ctx.arc(x, y, faint ? 3 : 4, 0, Math.PI * 2);
    ctx.fillStyle = faint
      ? (isLight ? 'rgba(255,255,255,0.9)' : 'rgba(20,29,49,0.9)')
      : (isLight ? '#ffffff' : '#141d31');
    ctx.fill();
    ctx.lineWidth = faint ? 2 : 1.5;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  private drawFlowingDots(ctx: CanvasRenderingContext2D, path: PathPoint[], color: string = '#f59e0b'): void {
    const segments: { x1: number; y1: number; x2: number; y2: number; length: number }[] = [];
    let totalLength = 0;

    for (let i = 0; i < path.length - 1; i++) {
      const x1 = path[i].x, y1 = path[i].y;
      const x2 = path[i + 1].x, y2 = path[i + 1].y;
      const length = Math.hypot(x2 - x1, y2 - y1);
      segments.push({ x1, y1, x2, y2, length });
      totalLength += length;
    }
    if (totalLength === 0) return;

    const offset = ((this.flowOffset % this.markerSpacing) + this.markerSpacing) % this.markerSpacing;
    const dotRadius = this.exporting ? 2.0 : 2.8;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = this.exporting ? 0 : 5;
    ctx.fillStyle = color;
    for (let d = offset; d < totalLength; d += this.markerSpacing) {
      let remaining = d;
      for (const seg of segments) {
        if (remaining <= seg.length) {
          const t = seg.length === 0 ? 0 : remaining / seg.length;
          const x = seg.x1 + (seg.x2 - seg.x1) * t;
          const y = seg.y1 + (seg.y2 - seg.y1) * t;
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        remaining -= seg.length;
      }
    }
    ctx.restore();
  }

  private isPointInsideTable(wx: number, wy: number, geometry: Record<string, TableDef>): boolean {
    return Object.values(geometry).some((table) => {
      return wx >= table.x && wx <= table.x + table.width && wy >= table.y && wy <= table.y + table.height;
    });
  }

  private findHoveredConnectionIndex(wx: number, wy: number, geometry: Record<string, TableDef>): number {
    if (this.isPointInsideTable(wx, wy, geometry)) return -1;

    const tolerance = Math.max(4, 8 / this.svc.view.scale);
    const anchorUsage = this.buildAnchorUsage();

    for (let i = 0; i < this.svc.refs.length; i++) {
      const path = this.getConnectionPath(this.svc.refs[i], geometry, undefined, i, anchorUsage);
      if (!path) continue;

      const ortho = this.makeOrthogonal(path);

      for (let p = 0; p < ortho.length - 1; p++) {
        if (this.distanceToSegment(wx, wy, ortho[p].x, ortho[p].y, ortho[p + 1].x, ortho[p + 1].y) <= tolerance) {
          return i;
        }
      }
    }
    return -1;
  }

  private buildAnchorUsage(): Record<string, number[]> {
    const usage: Record<string, number[]> = {};
    this.svc.refs.forEach((ref, i) => {
      const fromKey = `${ref.fromTable}.${ref.fromCol}`;
      const toKey = `${ref.toTable}.${ref.toCol}`;
      (usage[fromKey] ||= []).push(i);
      (usage[toKey] ||= []).push(i);
    });
    return usage;
  }

  private getConnectionPath(
    ref: RefDef,
    geometry: Record<string, TableDef>,
    trunkXByAnchor?: Record<string, number>,
    refIndex?: number,
    anchorUsage?: Record<string, number[]>
  ): PathPoint[] | null {
    let a = geometry[ref.fromTable];
    let b = geometry[ref.toTable];
    if (!a || !b) return null;

    // Check if both tables belong to the same collapsed table group
    const fromBase = ref.fromTable.includes('.') ? ref.fromTable.split('.')[1] : ref.fromTable;
    const toBase = ref.toTable.includes('.') ? ref.toTable.split('.')[1] : ref.toTable;
    const fromGroup = this.svc.groups.find(
      (g) => g.tables.includes(ref.fromTable) || g.tables.includes(fromBase)
    );
    const toGroup = this.svc.groups.find(
      (g) => g.tables.includes(ref.toTable) || g.tables.includes(toBase)
    );

    if (
      fromGroup &&
      toGroup &&
      fromGroup.name === toGroup.name &&
      this.svc.collapsedGroups.has(fromGroup.name)
    ) {
      return null;
    }

    let aGeom = { ...a };
    let bGeom = { ...b };

    if (fromGroup && this.svc.collapsedGroups.has(fromGroup.name)) {
      const bounds = this.getGroupBounds(fromGroup, geometry);
      if (bounds) {
        aGeom = {
          ...aGeom,
          x: bounds.x,
          y: bounds.y,
          width: bounds.w,
          height: bounds.h,
          colY: { [ref.fromCol]: 13 }
        };
      }
    }

    if (toGroup && this.svc.collapsedGroups.has(toGroup.name)) {
      const bounds = this.getGroupBounds(toGroup, geometry);
      if (bounds) {
        bGeom = {
          ...bGeom,
          x: bounds.x,
          y: bounds.y,
          width: bounds.w,
          height: bounds.h,
          colY: { [ref.toCol]: 13 }
        };
      }
    }

    a = aGeom;
    b = bGeom;

    let ay = a.y + (a.colY[ref.fromCol] ?? this.svc.HEADER_H / 2);
    let by = b.y + (b.colY[ref.toCol] ?? this.svc.HEADER_H / 2);

    if (refIndex !== undefined && anchorUsage) {
      ay += this.svc.anchorOffset(ref.fromTable, ref.fromCol, refIndex, anchorUsage);
      by += this.svc.anchorOffset(ref.toTable, ref.toCol, refIndex, anchorUsage);
    }
    const fromRight = a.x < b.x;
    const ax = fromRight ? a.x + a.width : a.x;
    const bx = fromRight ? b.x : b.x + b.width;

    let waypoints = ref.waypoints;
    if (!waypoints) {
      const anchorKey = ref.fromTable + '.' + ref.fromCol + '|' + (fromRight ? 'R' : 'L');
      let midX: number;
      if (trunkXByAnchor && trunkXByAnchor[anchorKey] !== undefined) {
        midX = trunkXByAnchor[anchorKey];
      } else {
        const dx = Math.max(30, Math.min(90, Math.abs(bx - ax) * 0.4));
        midX = ax + (fromRight ? dx : -dx);
        if (trunkXByAnchor) trunkXByAnchor[anchorKey] = midX;
      }
      waypoints = [{ x: midX, y: ay }, { x: midX, y: by }];
    }

    return [{ x: ax, y: ay }, ...waypoints, { x: bx, y: by }];
  }

  private materializeWaypoints(ref: RefDef, geometry: Record<string, TableDef>, refIndex?: number, anchorUsage?: Record<string, number[]>): PathPoint[] {
    if (!ref.waypoints) {
      const path = this.getConnectionPath(ref, geometry, undefined, refIndex, anchorUsage);
      ref.waypoints = path ? path.slice(1, path.length - 1).map((p) => ({ ...p })) : [];
    }
    return ref.waypoints;
  }

  private distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return Math.hypot(px - x1, py - y1);

    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    return Math.hypot(px - closestX, py - closestY);
  }

  private findCornerAt(wx: number, wy: number, geometry: Record<string, TableDef>): { refIndex: number; waypointIndex: number } | null {
    const tolerance = Math.max(this.cornerHitRadius, this.cornerHitRadius / this.svc.view.scale);
    const anchorUsage = this.buildAnchorUsage();
    for (let i = 0; i < this.svc.refs.length; i++) {
      const path = this.getConnectionPath(this.svc.refs[i], geometry, undefined, i, anchorUsage);
      if (!path) continue;
      for (let p = 1; p < path.length - 1; p++) {
        if (Math.hypot(wx - path[p].x, wy - path[p].y) <= tolerance) {
          return { refIndex: i, waypointIndex: p - 1 };
        }
      }
    }
    return null;
  }

  private findEndpointAt(wx: number, wy: number, geometry: Record<string, TableDef>): { refIndex: number; isSource: boolean } | null {
    const tolerance = Math.max(this.cornerHitRadius, this.cornerHitRadius / this.svc.view.scale);
    const anchorUsage = this.buildAnchorUsage();
    for (let i = 0; i < this.svc.refs.length; i++) {
      const path = this.getConnectionPath(this.svc.refs[i], geometry, undefined, i, anchorUsage);
      if (!path) continue;

      // Check start endpoint
      if (Math.hypot(wx - path[0].x, wy - path[0].y) <= tolerance) {
        return { refIndex: i, isSource: true };
      }

      // Check end endpoint
      if (Math.hypot(wx - path[path.length - 1].x, wy - path[path.length - 1].y) <= tolerance) {
        return { refIndex: i, isSource: false };
      }
    }
    return null;
  }

  private findMidpointAt(wx: number, wy: number, geometry: Record<string, TableDef>): { refIndex: number; insertAt: number } | null {
    if (this.svc.selectedConnectionIndex === -1) return null;

    const tolerance = Math.max(this.midpointHitRadius, this.midpointHitRadius / this.svc.view.scale);
    const anchorUsage = this.buildAnchorUsage();
    const i = this.svc.selectedConnectionIndex;

    const path = this.getConnectionPath(this.svc.refs[i], geometry, undefined, i, anchorUsage);
    if (!path) return null;
    const { pts, rawSegOf } = this.makeOrthogonalIndexed(path);
    for (let s = 0; s < pts.length - 1; s++) {
      const midX = (pts[s].x + pts[s + 1].x) / 2;
      const midY = (pts[s].y + pts[s + 1].y) / 2;
      if (Math.hypot(wx - midX, wy - midY) <= tolerance) {
        return { refIndex: i, insertAt: rawSegOf[s] };
      }
    }
    return null;
  }

  private roundedPolylinePath(ctx: CanvasRenderingContext2D, pts: PathPoint[], radius = 10): void {
    if (pts.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const next = pts[i + 1];

      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;

      const len1 = Math.hypot(dx1, dy1);
      const len2 = Math.hypot(dx2, dy2);

      const r = Math.min(radius, len1 / 2, len2 / 2);

      const p1 = { x: curr.x - (dx1 / len1) * r, y: curr.y - (dy1 / len1) * r };
      const p2 = { x: curr.x + (dx2 / len2) * r, y: curr.y + (dy2 / len2) * r };

      ctx.lineTo(p1.x, p1.y);
      ctx.quadraticCurveTo(curr.x, curr.y, p2.x, p2.y);
    }

    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }

  private getRoundedPolylinePoints(pts: PathPoint[], radius = 10): PathPoint[] {
    if (pts.length < 2) return pts;
    const result: PathPoint[] = [];
    result.push({ x: pts[0].x, y: pts[0].y });

    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const next = pts[i + 1];

      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;

      const len1 = Math.hypot(dx1, dy1);
      const len2 = Math.hypot(dx2, dy2);

      const r = Math.min(radius, len1 / 2, len2 / 2);

      if (r > 0) {
        const p1 = { x: curr.x - (dx1 / len1) * r, y: curr.y - (dy1 / len1) * r };
        const p2 = { x: curr.x + (dx2 / len2) * r, y: curr.y + (dy2 / len2) * r };

        // Add line to p1
        result.push(p1);

        // Interpolate the quadratic curve between p1, curr, p2
        const steps = 8;
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const mt = 1 - t;
          const x = mt * mt * p1.x + 2 * mt * t * curr.x + t * t * p2.x;
          const y = mt * mt * p1.y + 2 * mt * t * curr.y + t * t * p2.y;
          result.push({ x, y });
        }
        result.push(p2);
      } else {
        result.push({ x: curr.x, y: curr.y });
      }
    }
    result.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    return result;
  }

  private drawConnectionPreview(ctx: CanvasRenderingContext2D, geometry: Record<string, TableDef>): void {
    if (this.connectionDraft) {
      const source = geometry[this.connectionDraft.fromTable];
      if (!source) return;

      const fromRight = this.connectionDraft.currentX > source.x + source.width / 2;
      const fromX = fromRight ? source.x + source.width : source.x;
      const fromY = source.y + (source.colY[this.connectionDraft.fromColumn] ?? this.svc.HEADER_H / 2);
      const toX = this.connectionDraft.currentX;
      const toY = this.connectionDraft.currentY;

      const dx = Math.max(30, Math.min(90, Math.abs(toX - fromX) * 0.4));
      const midX = fromX + (fromRight ? dx : -dx);
      const pts: PathPoint[] = [
        { x: fromX, y: fromY },
        { x: midX, y: fromY },
        { x: midX, y: toY },
        { x: toX, y: toY }
      ];

      ctx.save();
      const isLight = this.svc.theme() === 'light';
      ctx.strokeStyle = isLight ? '#7c3aed' : '#03fff7';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = this.flowOffset;
      ctx.beginPath();
      this.roundedPolylinePath(ctx, pts, 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else if (this.reconnectDraft) {
      const ref = this.svc.refs[this.reconnectDraft.refIndex];
      if (!ref) return;

      const anchorTable = this.reconnectDraft.anchorTable;
      const anchorColumn = this.reconnectDraft.anchorColumn;
      const currentX = this.reconnectDraft.currentX;
      const currentY = this.reconnectDraft.currentY;

      const source = geometry[anchorTable];
      if (!source) return;

      const fromRight = currentX > source.x + source.width / 2;
      const fromX = fromRight ? source.x + source.width : source.x;
      const fromY = source.y + (source.colY[anchorColumn] ?? this.svc.HEADER_H / 2);
      const toX = currentX;
      const toY = currentY;

      const dx = Math.max(30, Math.min(90, Math.abs(toX - fromX) * 0.4));
      const midX = fromX + (fromRight ? dx : -dx);
      const pts: PathPoint[] = [
        { x: fromX, y: fromY },
        { x: midX, y: fromY },
        { x: midX, y: toY },
        { x: toX, y: toY }
      ];

      ctx.save();
      const isLight = this.svc.theme() === 'light';
      const defaultLineColor = isLight ? '#94a3b8' : '#70c8c3';
      const color = ref.color || defaultLineColor;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4; // active thickness
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (this.linkStyle === 'straight') {
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      } else {
        this.roundedPolylinePath(ctx, pts, 8);
      }
      ctx.stroke();

      // Draw anchor endpoint marker
      const isAnchorPk = this.svc.isPrimaryKey(anchorTable, anchorColumn);
      if (isAnchorPk) {
        ctx.beginPath();
        ctx.arc(fromX, fromY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#ffffff' : '#161f33';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else {
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        const angle = Math.atan2(dy, dx);
        const arrowLength = 9;
        const arrowSpread = Math.PI / 5;
        const x1 = fromX - arrowLength * Math.cos(angle - arrowSpread);
        const y1 = fromY - arrowLength * Math.sin(angle - arrowSpread);
        const x2 = fromX - arrowLength * Math.cos(angle + arrowSpread);
        const y2 = fromY - arrowLength * Math.sin(angle + arrowSpread);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(fromX, fromY);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawIconTooltip(ctx: CanvasRenderingContext2D, x: number, y: number, label: string): void {
    ctx.save();
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const textWidth = ctx.measureText(label).width;
    const boxW = textWidth + 16;
    const boxH = 22;
    const boxX = x - boxW / 2;
    const boxY = y - boxH - 8;

    // Draw the bubble background path
    ctx.beginPath();
    this.roundRectPath(ctx, boxX, boxY, boxW, boxH, 5);
    ctx.fillStyle = '#0b0f19';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw bordered arrow triangle pointing down
    ctx.beginPath();
    ctx.moveTo(x - 4, boxY + boxH);
    ctx.lineTo(x, boxY + boxH + 4);
    ctx.lineTo(x + 4, boxY + boxH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Clean up overlapping bubble borders above the arrow
    ctx.beginPath();
    ctx.moveTo(x - 4.5, boxY + boxH - 0.8);
    ctx.lineTo(x + 4.5, boxY + boxH - 0.8);
    ctx.lineTo(x, boxY + boxH + 3.5);
    ctx.closePath();
    ctx.fillStyle = '#0b0f19';
    ctx.fill();

    // Draw white text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, boxY + boxH / 2 + 0.5);
    ctx.restore();
  }

  /* ============ MOUSE HANDLERS ============ */

  onCanvasMouseDown(e: MouseEvent): void {
    if (e.button === 2) return;
    if (this.inlineEdit.visible) {
      this.commitInlineEdit();
    }


    if (this.handleContextMenuMouseDown(e)) return;

    if (this.colorPicker.visible) {
      this.colorPicker.visible = false;
    }

    // Close sticky note menu on canvas click
    if (this.activeNoteMenuId !== null) {
      this.activeNoteMenuId = null;
    }
    if (this.selectedNoteId !== null) {
      this.selectedNoteId = null;
    }
    if (this.editingNoteBodyId !== null) {
      this.editingNoteBodyId = null;
    }
    if (this.editingNoteId !== null) {
      this.commitEditNoteName();
    }

    if (e.button === 1) {
      e.preventDefault();
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.svc.view.x, y: e.clientY - this.svc.view.y };
      return;
    }

    if (this.svc.tool === 'pan') {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.svc.view.x, y: e.clientY - this.svc.view.y };
      return;
    }

    const wp = this.worldPointFromEvent(e);

    const groupColorIcon = this.findGroupColorIconAt(wp.x, wp.y);
    if (groupColorIcon) {
      const sx = groupColorIcon.x * this.svc.view.scale + this.svc.view.x;
      const sy = groupColorIcon.y * this.svc.view.scale + this.svc.view.y;
      this.openContextMenu(sx, sy, 'groupHeader', null, null, -1, groupColorIcon.groupName);
      return;
    }

    // TableGroup header hit test for dragging or toggling collapse state
    if (this.svc.groups && this.svc.groups.length > 0) {
      let groupHitName: string | null = null;
      const geometry: Record<string, TableDef> = {};
      this.svc.tables.forEach((t) => (geometry[t.name] = t));

      for (const g of this.svc.groups) {
        const bounds = this.getGroupBounds(g, geometry);
        if (!bounds) continue;

        const { x, y, w } = bounds;
        const headerH = 26;

        if (wp.x >= x && wp.x <= x + w && wp.y >= y && wp.y <= y + headerH) {
          // Check if user clicked the toggle arrow at the leftmost 30px
          if (wp.x >= x && wp.x <= x + 30) {
            if (this.svc.collapsedGroups.has(g.name)) {
              this.svc.collapsedGroups.delete(g.name);
            } else {
              this.svc.collapsedGroups.add(g.name);
            }
            this.svc.saveCollapsedGroups();
            this.scheduleDraw();
            return;
          }

          groupHitName = g.name;
          this.draggingGroup = g.name;
          this.dragGroupStartMouse = { x: wp.x, y: wp.y };
          this.dragGroupStartPoints = {};

          const cachedPos = this.svc.groupPositions[g.name];
          if (cachedPos) {
            this.dragGroupStartGroupPos = { x: cachedPos.x, y: cachedPos.y };
          } else {
            this.dragGroupStartGroupPos = { x: bounds.x, y: bounds.y };
          }

          const baseNameFilter = (tableName: string) => {
            const baseName = tableName.includes('.') ? tableName.split('.')[1] : tableName;
            return g.tables.includes(tableName) || g.tables.includes(baseName);
          };
          const groupTables = this.svc.tables.filter((t) => baseNameFilter(t.name) && !this.svc.isTableHidden(t.name));
          groupTables.forEach((t) => {
            this.dragGroupStartPoints[t.name] = { x: t.x, y: t.y };
          });
          break;
        }
      }
      if (groupHitName) {
        this.svc.selectedConnectionIndex = -1;
        this.scheduleDraw();
        return;
      }
    }

    const tableHeaderIcon = this.findTableHeaderIconAt(wp.x, wp.y);
    if (tableHeaderIcon) {
      const table = this.svc.tables.find((item) => item.name === tableHeaderIcon.tableName);
      if (tableHeaderIcon.type === 'settings' && table) {
        const sx = tableHeaderIcon.x * this.svc.view.scale + this.svc.view.x;
        const sy = tableHeaderIcon.y * this.svc.view.scale + this.svc.view.y;
        this.openContextMenu(sx, sy, 'tableHeader', table, null, -1);
      }
      return;
    }



    const iconHit = this.findConnectionIconAt(wp.x, wp.y);
    if (iconHit && !this.svc.isReadOnly) {
      const ref = this.svc.refs[iconHit.refIndex];
      if (!ref) return;

      if (iconHit.type === 'delete') {
        this.deleteConnectionConfirm = {
          visible: true,
          refIndex: iconHit.refIndex,
          fromTable: ref.fromTable,
          fromCol: ref.fromCol,
          toTable: ref.toTable,
          toCol: ref.toCol,
          ref: ref
        };
      } else if (iconHit.type === 'reset') {
        this.svc.resetConnectionPath(iconHit.refIndex);
        this.svc.selectedConnectionIndex = iconHit.refIndex;
      } else {
        this.svc.selectedConnectionIndex = iconHit.refIndex;
        this.openColorPickerForConnection(iconHit.refIndex, e);
        this.scheduleDraw();
      }
      return;
    }

    const geometry: Record<string, TableDef> = {};
    this.svc.tables.forEach((t) => (geometry[t.name] = t));
    const anchorUsage = this.buildAnchorUsage();

    const endpointHit = this.findEndpointAt(wp.x, wp.y, geometry);
    if (endpointHit && !this.svc.isReadOnly) {
      const ref = this.svc.refs[endpointHit.refIndex];
      this.reconnectDraft = {
        refIndex: endpointHit.refIndex,
        isSource: endpointHit.isSource,
        anchorTable: endpointHit.isSource ? ref.toTable : ref.fromTable,
        anchorColumn: endpointHit.isSource ? ref.toCol : ref.fromCol,
        currentX: wp.x,
        currentY: wp.y
      };
      this.svc.selectedConnectionIndex = -1;
      this.scheduleDraw();
      return;
    }

    const cornerHit = this.findCornerAt(wp.x, wp.y, geometry);
    if (cornerHit && !this.svc.isReadOnly) {
      this.materializeWaypoints(this.svc.refs[cornerHit.refIndex], geometry, cornerHit.refIndex, anchorUsage);
      this.isDraggingWaypoint = true;
      this.dragConnectionIndex = cornerHit.refIndex;
      this.dragWaypointIndex = cornerHit.waypointIndex;
      this.svc.selectedConnectionIndex = cornerHit.refIndex;
      this.scheduleDraw();
      return;
    }

    const midpointHit = this.findMidpointAt(wp.x, wp.y, geometry);
    if (midpointHit && !this.svc.isReadOnly) {
      const ref = this.svc.refs[midpointHit.refIndex];
      const waypoints = this.materializeWaypoints(ref, geometry, midpointHit.refIndex, anchorUsage);
      waypoints.splice(midpointHit.insertAt, 0, { x: wp.x, y: wp.y });
      this.isDraggingWaypoint = true;
      this.dragConnectionIndex = midpointHit.refIndex;
      this.dragWaypointIndex = midpointHit.insertAt;
      this.svc.selectedConnectionIndex = midpointHit.refIndex;
      this.scheduleDraw();
      return;
    }

    const columnHit = this.findColumnAt(wp.x, wp.y);
    if (columnHit && !this.svc.isReadOnly) {
      this.connectionDraft = {
        fromTable: columnHit.table.name,
        fromColumn: columnHit.column.name,
        currentX: wp.x,
        currentY: wp.y
      };
      this.svc.selectedConnectionIndex = -1;
      this.scheduleDraw();
      return;
    }

    const hit = this.findTableAt(wp.x, wp.y);
    if (hit) {
      this.draggingTable = hit.name;
      this.dragTableStartPos = { x: hit.x, y: hit.y };
      this.dragOffset = { x: wp.x - hit.x, y: wp.y - hit.y };
      this.svc.tables = this.svc.tables.filter((t) => t.name !== hit.name).concat(hit);
      this.svc.selectedConnectionIndex = -1;
      this.scheduleDraw();
      return;
    }

    const lineHit = this.findHoveredConnectionIndex(wp.x, wp.y, geometry);
    this.svc.selectedConnectionIndex = lineHit;
    if (lineHit !== -1) {
      this.selectedConnectionPoint = wp;
    } else {
      this.selectedConnectionPoint = null;
    }
    // A drag on any non-table/non-column area pans the infinite workspace only if using Middle Click or the Hand Tool.
    if (e.button === 1 || (this.svc.tool as string) === 'pan') {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.svc.view.x, y: e.clientY - this.svc.view.y };
    }
    this.scheduleDraw();
  }

  private handleAutoScroll(e: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const threshold = 40;
    const speed = 10;

    let dx = 0;
    let dy = 0;

    if (x < threshold) {
      dx = speed;
    } else if (x > rect.width - threshold) {
      dx = -speed;
    }

    if (y < threshold) {
      dy = speed;
    } else if (y > rect.height - threshold) {
      dy = -speed;
    }

    if (dx !== 0 || dy !== 0) {
      this.svc.view.x += dx;
      this.svc.view.y += dy;

      // Update drag positions dynamically as the view shifts
      if (this.draggingTable) {
        const wp = this.worldPointFromEvent(e);
        const nx = Math.round(wp.x - this.dragOffset.x);
        const ny = Math.round(wp.y - this.dragOffset.y);
        this.svc.tablePositions[this.draggingTable] = { x: nx, y: ny };
        const t = this.svc.tables.find((tt) => tt.name === this.draggingTable);
        if (t) {
          t.x = nx;
          t.y = ny;
        }
      }
    }
  }

  private lastCursorEmit = 0;

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(e: MouseEvent): void {
    const wp = this.worldPointFromEvent(e);

    // Sync cursor for real-time collaboration
    if (this.svc.diagramWorkspaceType() === 'Team') {
      const now = performance.now();
      if (now - this.lastCursorEmit > 50) {
        this.lastCursorEmit = now;
        const id = this.svc.diagramId();
        if (id) {
          // Pass -1 for line/col since this is a canvas cursor, pass x/y coords
          this.svc.socketService.sendCursor(id, -1, -1, Math.round(wp.x), Math.round(wp.y));
        }
      }
    }

    // Update hovered table and column under cursor so they are always current (even during drags)
    const tableUnderCursor = this.findTableAt(wp.x, wp.y);
    this.svc.hoveredTableName = tableUnderCursor ? tableUnderCursor.name : null;
    const colHit = this.findColumnAt(wp.x, wp.y);
    this.hoveredColumn = colHit ? { tableName: colHit.table.name, columnName: colHit.column.name } : null;

    if (this.draggingTable || this.draggingGroup || this.isDraggingWaypoint || this.isPanning) {
      this.svc.selectedConnectionIndex = -1;
    }

    if (this.draggingGroup) {
      const dx = wp.x - this.dragGroupStartMouse.x;
      const dy = wp.y - this.dragGroupStartMouse.y;

      const g = this.svc.groups.find(group => group.name === this.draggingGroup);
      if (g) {
        g.tables.forEach((tableName) => {
          const startPos = this.dragGroupStartPoints[tableName];
          if (startPos) {
            const nx = Math.round(startPos.x + dx);
            const ny = Math.round(startPos.y + dy);
            this.svc.tablePositions[tableName] = { x: nx, y: ny };
            const t = this.svc.tables.find((tt) => tt.name === tableName);
            if (t) {
              t.x = nx;
              t.y = ny;
            }
          }
        });
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem('drag position', JSON.stringify(this.svc.tablePositions));
        }
        if (this.dragGroupStartGroupPos) {
          this.svc.groupPositions[g.name] = {
            x: this.dragGroupStartGroupPos.x + dx,
            y: this.dragGroupStartGroupPos.y + dy
          };
          this.svc.saveGroupPositions();
        }
      }
      this.handleAutoScroll(e);
      this.scheduleDraw();
      return;
    }

    if (this.isDraggingWaypoint) {
      const ref = this.svc.refs[this.dragConnectionIndex];

      if (ref?.waypoints && ref.waypoints[this.dragWaypointIndex]) {
        ref.waypoints[this.dragWaypointIndex].x = wp.x;
        ref.waypoints[this.dragWaypointIndex].y = wp.y;
      }
      this.handleAutoScroll(e);
      this.scheduleDraw();
      return;
    }

    if (this.connectionDraft) {
      this.connectionDraft.currentX = wp.x;
      this.connectionDraft.currentY = wp.y;
      this.handleAutoScroll(e);
      this.scheduleDraw();
      return;
    }

    if (this.reconnectDraft) {
      this.reconnectDraft.currentX = wp.x;
      this.reconnectDraft.currentY = wp.y;
      this.handleAutoScroll(e);
      this.scheduleDraw();
      return;
    }

    const geometry: Record<string, TableDef> = {};
    this.svc.tables.forEach((t) => (geometry[t.name] = t));

    this.hoveredIcon = this.findConnectionIconAt(wp.x, wp.y) as typeof this.hoveredIcon;
    this.hoveredTableHeaderIcon = this.findTableHeaderIconAt(wp.x, wp.y);
    const groupIconHit = this.findGroupColorIconAt(wp.x, wp.y);
    this.hoveredGroupColorIcon = groupIconHit ? groupIconHit.groupName : null;

    let groupUnderCursor: string | null = null;
    if (this.svc.groups && this.svc.groups.length > 0) {
      for (const g of this.svc.groups) {
        const groupTables = this.svc.tables.filter((t) => g.tables.includes(t.name) && !this.svc.isTableHidden(t.name));
        if (groupTables.length === 0) continue;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        groupTables.forEach((t) => {
          if (t.x < minX) minX = t.x;
          if (t.y < minY) minY = t.y;
          if (t.x + t.width > maxX) maxX = t.x + t.width;
          if (t.y + t.height > maxY) maxY = t.y + t.height;
        });

        const paddingX = 24;
        const paddingY = 20;
        const headerH = 26;

        const x = minX - paddingX;
        const y = minY - headerH - paddingY;
        const w = (maxX - minX) + paddingX * 2;
        const h = (maxY - minY) + headerH + paddingY * 2;

        if (wp.x >= x && wp.x <= x + w && wp.y >= y && wp.y <= y + headerH) {
          groupUnderCursor = g.name;
          break;
        }
      }
    }
    this.hoveredGroupName = groupUnderCursor;

    this.svc.hoveredConnectionIndex = this.findHoveredConnectionIndex(wp.x, wp.y, geometry);

    this.updateCursor(wp, geometry, e);

    if (this.draggingTable) {
      if (this.inlineEdit.visible) {
        this.commitInlineEdit();
      }
      // Tables may occupy any world coordinate in the infinite workspace.
      const nx = Math.round(wp.x - this.dragOffset.x);
      const ny = Math.round(wp.y - this.dragOffset.y);
      this.svc.tablePositions[this.draggingTable] = { x: nx, y: ny };
      const t = this.svc.tables.find((tt) => tt.name === this.draggingTable);
      if (t) {
        t.x = nx;
        t.y = ny;
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem('drag position', JSON.stringify(this.svc.tablePositions));
        }
      }
      this.handleAutoScroll(e);
      this.scheduleDraw();
      return;
    }

    if (this.isPanning) {
      if (this.inlineEdit.visible) {
        this.commitInlineEdit();
      }
      this.svc.view.x = e.clientX - this.panStart.x;
      this.svc.view.y = e.clientY - this.panStart.y;
      this.scheduleDraw();
      return;
    }
  }

  private updateCursor(wp: PathPoint, geometry: Record<string, TableDef>, e: MouseEvent): void {
    const canvas = this.canvasRef.nativeElement;

    if (this.contextMenu.visible) {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const items = this.getContextMenuItems();
      const menuHeight = items.length * this.menuItemHeight;
      const insideMenu =
        sx >= this.contextMenu.x &&
        sx <= this.contextMenu.x + this.menuWidth &&
        sy >= this.contextMenu.y &&
        sy <= this.contextMenu.y + menuHeight;

      if (insideMenu) {
        const index = Math.floor((sy - this.contextMenu.y) / this.menuItemHeight);
        const label = items[index];
        const table = this.contextMenu.table;
        const isTableInGroup = (this.contextMenu.targetType === 'tableHeader' && table)
          ? this.svc.groups.some(g => g.tables.includes(table.name))
          : false;
        const column = this.contextMenu.column;
        const isDisabled = (label === 'Change Color' && isTableInGroup) ||
          (label === 'Edit Column' && column && (column.pk || column.fk));

        if (isDisabled) {
          canvas.style.cursor = 'not-allowed';
        } else {
          canvas.style.cursor = 'pointer';
        }
        return;
      }
    }

    if (this.isPanning) {
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (this.svc.tool === 'pan') {
      canvas.style.cursor = 'grab';
      return;
    }
    if (this.draggingTable) {
      canvas.style.cursor = 'move';
      return;
    }
    if (this.draggingGroup) {
      canvas.style.cursor = 'move';
      return;
    }
    if (this.isDraggingWaypoint) {
      canvas.style.cursor = 'move';
      return;
    }
    if (this.connectionDraft) {
      canvas.style.cursor = 'cell';
      return;
    }

    if (this.reconnectDraft) {
      canvas.style.cursor = 'cell';
      return;
    }

    // 1.5 Hovering endpoints of connection line
    const endpointHit = this.findEndpointAt(wp.x, wp.y, geometry);
    if (endpointHit) {
      canvas.style.cursor = 'cell';
      return;
    }

    // 1. Hovering toolbar icons or table header icons
    if (this.hoveredIcon || this.hoveredTableHeaderIcon || this.hoveredGroupColorIcon) {
      canvas.style.cursor = 'pointer';
      return;
    }

    // 2. Hovering waypoint handles
    const cornerHit = this.findCornerAt(wp.x, wp.y, geometry);
    if (cornerHit) {
      canvas.style.cursor = 'move';
      return;
    }

    // 3. Hovering midpoints
    const midpointHit = this.findMidpointAt(wp.x, wp.y, geometry);
    if (midpointHit) {
      canvas.style.cursor = 'pointer';
      return;
    }

    // 4. Hovering connection line
    if (this.svc.hoveredConnectionIndex !== -1) {
      canvas.style.cursor = 'pointer';
      return;
    }

    // 5. Hovering table
    const table = this.findTableAt(wp.x, wp.y);
    if (table) {
      // Check if hovering table header draggable area
      const inHeader = wp.y >= table.y && wp.y <= table.y + this.svc.HEADER_H;
      if (inHeader) {
        canvas.style.cursor = 'move';
      } else {
        // Check if hovering column ports or links
        const colHit = this.findColumnAt(wp.x, wp.y);
        if (colHit) {
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = 'pointer';
        }
      }
      return;
    }

    // Hovering over group header
    if (this.svc.groups && this.svc.groups.length > 0) {
      for (const g of this.svc.groups) {
        const bounds = this.getGroupBounds(g, geometry);
        if (!bounds) continue;

        const { x, y, w } = bounds;
        const headerH = 26;

        if (wp.x >= x && wp.x <= x + w && wp.y >= y && wp.y <= y + headerH) {
          if (wp.x >= x && wp.x <= x + 30) {
            canvas.style.cursor = 'pointer';
          } else {
            canvas.style.cursor = 'move';
          }
          return;
        }
      }
    }



    canvas.style.cursor = 'default';
  }

  @HostListener('window:mouseup', ['$event'])
  onWindowMouseUp(e?: MouseEvent): void {
    if (this.draggingGroup) {
      this.draggingGroup = null;
      this.dragGroupStartPoints = {};
      this.dragGroupStartGroupPos = null;
      if (this.svc.diagramWorkspaceType() === 'Team' && this.svc.socketService.isConnected) {
        if (this.svc.hasUnsavedChanges()) {
          this.svc.emitCollabChange();
        }
      }
      this.scheduleDraw();
      return;
    }

    if (this.isDraggingWaypoint) {
      this.isDraggingWaypoint = false;
      this.dragConnectionIndex = -1;
      this.dragWaypointIndex = -1;
      this.scheduleDraw();
      return;
    }

    if (this.connectionDraft && e) {
      const wp = this.worldPointFromEvent(e);
      const columnHit = this.findColumnAt(wp.x, wp.y);
      if (columnHit) {
        this.svc.addRelation(
          this.connectionDraft.fromTable,
          this.connectionDraft.fromColumn,
          columnHit.table.name,
          columnHit.column.name
        );
      }
    }

    if (this.reconnectDraft && e) {
      const wp = this.worldPointFromEvent(e);
      const columnHit = this.findColumnAt(wp.x, wp.y);
      if (columnHit) {
        const ref = this.svc.refs[this.reconnectDraft.refIndex];
        const newFromTable = this.reconnectDraft.isSource ? columnHit.table.name : ref.fromTable;
        const newFromCol = this.reconnectDraft.isSource ? columnHit.column.name : ref.fromCol;
        const newToTable = this.reconnectDraft.isSource ? ref.toTable : columnHit.table.name;
        const newToCol = this.reconnectDraft.isSource ? ref.toCol : columnHit.column.name;

        this.svc.updateRelationInCode(ref, newFromTable, newFromCol, newToTable, newToCol);
      }
    }

    this.connectionDraft = null;
    this.reconnectDraft = null;
    if (this.draggingTable) {
      const droppedTableName = this.draggingTable;
      this.draggingTable = null;

      // Check if dropped overlapping a group
      const t = this.svc.tables.find(tbl => tbl.name === droppedTableName);
      if (t) {
        const tLeft = t.x;
        const tRight = t.x + t.width;
        const tTop = t.y;
        const tBottom = t.y + t.height;
        const geometry: Record<string, TableDef> = {};
        this.svc.tables.forEach(tbl => (geometry[tbl.name] = tbl));

        let overlapsGroup = false;
        for (const g of this.svc.groups) {
          if (g.tables.includes(droppedTableName)) continue;
          const bounds = this.getGroupBounds(g, geometry);
          if (bounds) {
            if (tLeft < bounds.x + bounds.w && tRight > bounds.x && tTop < bounds.y + bounds.h && tBottom > bounds.y) {
              overlapsGroup = true;
              break;
            }
          }
        }

        if (overlapsGroup && this.dragTableStartPos) {
          t.x = this.dragTableStartPos.x;
          t.y = this.dragTableStartPos.y;
          this.svc.tablePositions[droppedTableName] = { x: t.x, y: t.y };
          this.svc.showToast(`Cannot drop table over a group. Use the group's gear icon to add it.`, 3000, 'error');
        }
      }

      this.dragTableStartPos = null;

      if (this.svc.diagramWorkspaceType() === 'Team' && this.svc.socketService.isConnected) {
        if (this.svc.hasUnsavedChanges()) {
          this.svc.emitCollabChange();
        }
      }
    }
    this.isPanning = false;
    this.scheduleDraw();
  }

  onCanvasMouseLeave(): void {
    this.svc.hoveredTableName = null;
    this.svc.hoveredConnectionIndex = -1;
    this.hoveredIcon = null;
    this.hoveredTableHeaderIcon = null;
    this.scheduleDraw();
  }

  private zoomAroundPoint(factor: number, clientX: number, clientY: number): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    const worldX = (sx - this.svc.view.x) / this.svc.view.scale;
    const worldY = (sy - this.svc.view.y) / this.svc.view.scale;

    this.svc.view.scale = Math.min(3, Math.max(0.15, this.svc.view.scale * factor));
    this.svc.view.x = sx - worldX * this.svc.view.scale;
    this.svc.view.y = sy - worldY * this.svc.view.scale;
    this.scheduleDraw();
  }

  onCanvasWheel(e: WheelEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (this.inlineEdit.visible) {
      this.commitInlineEdit();
    }

    if (this.contextMenu.visible) {
      this.contextMenu.visible = false;
    }

    this.svc.selectedConnectionIndex = -1;

    if (e.ctrlKey) {
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      this.zoomAroundPoint(factor, e.clientX, e.clientY);
      return;
    }

    const multiplier = e.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 18
      : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? this.canvasRef.nativeElement.clientHeight
        : 1;
    const horizontalDelta = (e.shiftKey ? e.deltaY : e.deltaX) * multiplier;
    const verticalDelta = e.deltaY * multiplier;

    this.svc.view.x -= horizontalDelta;
    this.svc.view.y -= e.shiftKey ? 0 : verticalDelta;
    this.scheduleDraw();
  }

  onCanvasContextMenu(e: MouseEvent): void {
    if (this.svc.isReadOnly) {
      e.preventDefault();
      return;
    }
    e.preventDefault();

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wp = this.worldPointFromEvent(e);

    const columnHit = this.findColumnAt(wp.x, wp.y);
    if (columnHit) {
      this.openContextMenu(sx, sy, 'column', columnHit.table, columnHit.column, -1);
      return;
    }

    const geometry: Record<string, TableDef> = {};
    this.svc.tables.forEach((t) => (geometry[t.name] = t));
    const connectionHit = this.findHoveredConnectionIndex(wp.x, wp.y, geometry);
    if (connectionHit !== -1) {
      this.svc.selectedConnectionIndex = connectionHit;
      this.contextMenu.visible = false;
      this.scheduleDraw();
      return;
    }

    const tableHit = this.findTableAt(wp.x, wp.y);
    if (tableHit) {
      this.openContextMenu(sx, sy, 'table', tableHit, null, -1);
      return;
    }

    this.contextMenuWorldPoint = wp;
    this.openContextMenu(sx, sy, 'empty', null, null, -1);
  }

  /* ============ COORDINATE HELPERS ============ */

  private worldPointFromEvent(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return {
      x: (sx - this.svc.view.x) / this.svc.view.scale,
      y: (sy - this.svc.view.y) / this.svc.view.scale
    };
  }

  private findTableAt(wx: number, wy: number): TableDef | null {
    for (let i = this.svc.tables.length - 1; i >= 0; i--) {
      const t = this.svc.tables[i];
      if (this.svc.isTableHidden(t.name) || this.isTableGroupCollapsed(t.name)) continue;
      if (wx >= t.x && wx <= t.x + t.width && wy >= t.y && wy <= t.y + t.height) {
        return t;
      }
    }
    return null;
  }

  private findColumnAt(wx: number, wy: number): { table: TableDef; column: Column; x: number; y: number } | null {
    for (let i = this.svc.tables.length - 1; i >= 0; i--) {
      const table = this.svc.tables[i];
      if (this.svc.isTableHidden(table.name) || this.isTableGroupCollapsed(table.name)) continue;
      if (wx < table.x || wx > table.x + table.width || wy < table.y || wy > table.y + table.height) {
        continue;
      }

      if (wy <= table.y + this.svc.HEADER_H) {
        return null;
      }

      let visibleColumns: Column[] = [];
      if (this.svc.isAllFields) {
        visibleColumns = table.columns;
      } else if (this.svc.isKeyOnly) {
        visibleColumns = table.columns.filter(c => c.pk || c.fk);
      } else if (this.svc.isColumnNameOnly) {
        visibleColumns = [];
      }

      const rowIndex = Math.floor((wy - (table.y + this.svc.HEADER_H)) / this.svc.ROW_H);
      if (rowIndex >= 0 && rowIndex < visibleColumns.length) {
        return {
          table,
          column: visibleColumns[rowIndex],
          x: table.x + table.width,
          y: table.y + this.svc.HEADER_H + rowIndex * this.svc.ROW_H + this.svc.ROW_H / 2
        };
      }
    }
    return null;
  }

  /* ============ ZOOM CONTROLS ============ */

  zoomIn(): void {
    this.zoomBy(1.2);
  }

  zoomOut(): void {
    this.zoomBy(1 / 1.2);
  }

  zoomFit(): void {
    const tables = this.svc.tables;
    if (!tables.length) {
      this.svc.zoomFit();
      return;
    }

    const wrap = this.canvasWrapRef.nativeElement;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w < 50 || h < 50) {
      return; // Skip fit if the container is hidden or not yet laid out
    }

    const padding = 24;
    const minX = Math.min(...tables.map((table) => table.x));
    const minY = Math.min(...tables.map((table) => table.y));
    const maxX = Math.max(...tables.map((table) => table.x + table.width));
    const maxY = Math.max(...tables.map((table) => table.y + table.height));
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const availableWidth = Math.max(1, w - padding * 2);
    const availableHeight = Math.max(1, h - padding * 2);

    // Compute exact scale to fill full screen container bounds tightly
    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    const fitScale = Math.min(scaleX, scaleY);

    let scale = Math.max(0.15, Math.min(1.0, fitScale));

    // If a scale was explicitly loaded from the database layout, use that for the initial fit instead
    if (this.svc.hasLoadedScale) {
      scale = this.svc.view.scale;
    }

    this.svc.view.scale = scale;
    this.svc.view.x = w / 2 - ((minX + maxX) / 2) * scale;
    this.svc.view.y = h / 2 - ((minY + maxY) / 2) * scale;
    this.hasFitted = true;
    this.scheduleDraw();
  }

  private zoomBy(factor: number): void {
    const canvas = this.canvasRef.nativeElement;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const worldX = (cx - this.svc.view.x) / this.svc.view.scale;
    const worldY = (cy - this.svc.view.y) / this.svc.view.scale;

    this.svc.view.scale = Math.min(3, Math.max(0.15, this.svc.view.scale * factor));
    this.svc.view.x = cx - worldX * this.svc.view.scale;
    this.svc.view.y = cy - worldY * this.svc.view.scale;
    this.scheduleDraw();
  }

  isEditingZoom = false;
  zoomInputValue = 100;

  editZoom(): void {
    this.zoomInputValue = this.svc.zoomPercent;
    this.isEditingZoom = true;
  }

  setZoomFromEvent(event: any): void {
    let val = parseInt(event.target.value, 10);
    if (isNaN(val)) {
      this.isEditingZoom = false;
      return;
    }

    // Clamp to 15% to 300% to match view.scale bounds
    val = Math.max(15, Math.min(300, val));

    const scale = val / 100;

    const canvas = this.canvasRef.nativeElement;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const worldX = (cx - this.svc.view.x) / this.svc.view.scale;
    const worldY = (cy - this.svc.view.y) / this.svc.view.scale;

    this.svc.view.scale = scale;
    this.svc.view.x = cx - worldX * this.svc.view.scale;
    this.svc.view.y = cy - worldY * this.svc.view.scale;
    this.scheduleDraw();

    this.isEditingZoom = false;
  }

  /* ============ TOOL ACTIONS ============ */

  setTool(t: Tool): void {
    this.svc.tool = t;
    this.scheduleDraw();
  }

  toggleLayoutMenu(): void {
    this.showLayoutMenu = !this.showLayoutMenu;
    if (this.showLayoutMenu) {
      this.contextMenu.visible = false;
      this.activeNoteMenuId = null;
      this.colorPicker.visible = false;
    }
  }

  triggerLayoutConfirm(direction: 'vertical' | 'horizontal'): void {
    this.applyLayout(direction);
  }

  closeLayoutConfirm(): void {
    this.layoutConfirm.visible = false;
  }

  confirmLayout(): void {
    if (this.layoutConfirm.visible) {
      this.applyLayout(this.layoutConfirm.direction);
      this.layoutConfirm.visible = false;
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeyDown(event: KeyboardEvent): void {
    if (this.layoutConfirm.visible) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeLayoutConfirm();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        this.confirmLayout();
      }
    }
  }

  private previousTablePositions: Record<string, { x: number; y: number }> | null = null;

  applyLayout(direction: 'vertical' | 'horizontal'): void {
    // Save current positions snapshot before auto-arranging so user can revert/undo
    this.previousTablePositions = JSON.parse(JSON.stringify(this.svc.tablePositions));

    let offset = 80;
    this.svc.tables.forEach((table) => {
      const tableHeight = table.height || (this.svc.HEADER_H + table.columns.length * this.svc.ROW_H);
      const tableWidth = table.width || 220;

      if (direction === 'vertical') {
        table.x = 100;
        table.y = offset;
        offset += tableHeight + 70;
      } else {
        table.x = offset;
        table.y = 100;
        offset += tableWidth + 110;
      }
      this.svc.tablePositions[table.name] = { x: table.x, y: table.y };
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('drag position', JSON.stringify(this.svc.tablePositions));
    }
    this.showLayoutMenu = false;
    this.svc.parseAndLayout();
    this.zoomFit();
    this.scheduleDraw();
    this.svc.showToast(`Arranged tables in ${direction} layout.`, 2500, 'success');
  }

  revertAutoLayout(): void {
    this.previousTablePositions = null;
    this.svc.tablePositions = {};
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('drag position');
    }
    this.svc.parseAndLayout();
    this.zoomFit();
    this.scheduleDraw();
    this.svc.showToast('Reset table positions to normal grid layout.', 3000, 'success');
  }

  setLinkStyle(style: 'smooth' | 'straight'): void {
    this.linkStyle = style;
    this.scheduleDraw();
  }

  toggleDetailLevelMenu(event: MouseEvent): void {
    if (!this.entitlementService.canUseFeature('diagram_detailing')) {
      if (!this.entitlementService.orgHasFeature('diagram_detailing')) {
        this.svc.showUpgradeModal();
      }
      return;
    }
    console.log('toggleDetailLevelMenu called! Current state:', this.showDetailLevelMenu);
    event.stopPropagation();
    this.showDetailLevelMenu = !this.showDetailLevelMenu;
    console.log('New state:', this.showDetailLevelMenu);
  }

  getCurrentDetailLevelIcon(): string {
    if (this.svc.isAllFields) return 'detail-fields';
    if (this.svc.isKeyOnly) return 'detail-key';
    if (this.svc.isColumnNameOnly) return 'detail-table';
    return 'detail-fields';
  }

  getCurrentDetailLevelText(): string {
    if (this.svc.isAllFields) return 'All fields';
    if (this.svc.isKeyOnly) return 'Keys only';
    if (this.svc.isColumnNameOnly) return 'Table names';
    return 'All fields';
  }

  setDetailLevel(level: 'all' | 'key' | 'table'): void {
    console.log('setDetailLevel called with level:', level);
    if (level === 'all') {
      this.svc.isAllFields = true;
      this.svc.isKeyOnly = false;
      this.svc.isColumnNameOnly = false;
    } else if (level === 'key') {
      this.svc.isAllFields = false;
      this.svc.isKeyOnly = true;
      this.svc.isColumnNameOnly = false;
    } else if (level === 'table') {
      this.svc.isAllFields = false;
      this.svc.isKeyOnly = false;
      this.svc.isColumnNameOnly = true;
    }
    this.svc.parseAndLayout();
    this.scheduleDraw();
    this.showDetailLevelMenu = false;
    console.log('setDetailLevel completed! isAllFields:', this.svc.isAllFields, 'isKeyOnly:', this.svc.isKeyOnly, 'isColumnNameOnly:', this.svc.isColumnNameOnly);
  }

  toggleGrid(): void {
    this.svc.gridOn = !this.svc.gridOn;
    this.scheduleDraw();
  }

  toggleHighlightConnections(): void {
    this.svc.showAllConnections = !this.svc.showAllConnections;
    this.scheduleDraw();
  }

  startAdding(): void {
    this.svc.startAdding();
    this.applyLayout('horizontal');
    this.svc.requestSplitView();
    this.fitCanvasAfterLayout();
    this.svc.updateOriginalState();
  }

  private fitCanvasAfterLayout(): void {
    // The split pane changes width after Angular applies the click/load update.
    // Run one frame-based fit and one delayed final fit after the pane has settled.
    const fit = () => {
      this.resizeCanvasToDisplaySize();
      this.zoomFit();
    };
    requestAnimationFrame(() => requestAnimationFrame(fit));
    if (this.fitTimer) clearTimeout(this.fitTimer);
    this.fitTimer = setTimeout(() => {
      fit();
      this.svc.hasLoadedScale = false;
      this.cdr.detectChanges();
    }, 180);
  }

  createTable(): void {
    const rect = this.canvasWrapRef.nativeElement.getBoundingClientRect();
    const x = (rect.width / 2 - this.svc.view.x) / this.svc.view.scale - this.svc.CARD_W / 2;
    const y = (rect.height / 2 - this.svc.view.y) / this.svc.view.scale - 70;
    this.svc.addTableAt(x, y);
    const table = this.svc.tables[this.svc.tables.length - 1];
    if (table) this.openTableModal(table, true);
  }

  openTableModal(table: TableDef, isNew = false): void {
    this.constraintDropdownIndex = null;
    this.typeDropdownIndex = null;
    this.groupDropdownVisible = false;
    const currentGroup = this.svc.groups.find(g => g.tables.includes(table.name));
    this.tableModal = {
      visible: true,
      isNew,
      originalName: table.name,
      name: table.name,
      columns: table.columns.map((column) => ({ ...column, originalName: column.name })),
      error: '',
      isGroup: !!currentGroup,
      groupName: currentGroup ? currentGroup.name : '',
      selectedExistingGroup: currentGroup ? currentGroup.name : ''
    };
  }

  openGroupDropdown(event?: any): void {
    if (event) event.stopPropagation();
    this.groupDropdownVisible = true;
    this.typeDropdownIndex = null;
    this.constraintDropdownIndex = null;
  }

  toggleGroupDropdown(event?: any): void {
    if (event) event.stopPropagation();
    this.groupDropdownVisible = !this.groupDropdownVisible;
    if (this.groupDropdownVisible) {
      this.typeDropdownIndex = null;
      this.constraintDropdownIndex = null;
    }
  }

  selectGroup(name: string): void {
    this.tableModal.groupName = name;
    this.tableModal.error = '';
    this.groupDropdownVisible = false;
  }

  closeTableModal(discardNew = true): void {
    if (discardNew && this.tableModal.isNew) {
      this.svc.deleteTableInCode(this.tableModal.originalName);
      this.svc.updateGutter();
      this.svc.parseAndLayout();
    }
    this.tableModal.visible = false;
    this.constraintDropdownIndex = null;
    this.typeDropdownIndex = null;
  }

  addModalColumn(): void {
    this.tableModal.columns.push({
      name: `column_${this.tableModal.columns.length + 1}`,
      type: 'varchar',
      pk: false,
      notNull: false,
      unique: false,
      increment: false,
      fk: false,
      default: false,
      defaultVal: '',
      check: false,
      checkVal: '',
      fkTable: undefined,
      fkCol: undefined
    });
  }

  removeModalColumn(index: number): void {
    this.tableModal.columns.splice(index, 1);
    this.constraintDropdownIndex = null;
    this.typeDropdownIndex = null;
  }

  toggleConstraintDropdown(index: number, event?: any): void {
    if (event) event.stopPropagation();
    this.constraintDropdownIndex = this.constraintDropdownIndex === index ? null : index;
    this.typeDropdownIndex = null;
    this.fkTableDropdownOpen = false;
    this.fkColDropdownOpen = false;
  }

  toggleTypeDropdown(index: number, event?: any): void {
    if (event) event.stopPropagation();
    this.typeDropdownIndex = this.typeDropdownIndex === index ? null : index;
    this.constraintDropdownIndex = null;
    this.fkTableDropdownOpen = false;
    this.fkColDropdownOpen = false;
  }

  openTypeDropdown(index: number, event?: any): void {
    if (event) event.stopPropagation();
    this.typeDropdownIndex = index;
    this.constraintDropdownIndex = null;
    this.fkTableDropdownOpen = false;
    this.fkColDropdownOpen = false;
  }

  selectDataType(column: any, type: string): void {
    column.type = type;
    this.typeDropdownIndex = null;
  }

  toggleFkTableDropdown(event?: any): void {
    if (event) event.stopPropagation();
    this.fkTableDropdownOpen = !this.fkTableDropdownOpen;
    this.fkColDropdownOpen = false;
  }

  selectFkTable(column: any, tableName: string, event?: any): void {
    if (event) event.stopPropagation();
    column.fkTable = tableName;
    this.fkTableDropdownOpen = false;
    this.onFkTableChange(column);
  }

  toggleFkColDropdown(event?: any): void {
    if (event) event.stopPropagation();
    this.fkColDropdownOpen = !this.fkColDropdownOpen;
    this.fkTableDropdownOpen = false;
  }

  selectFkCol(column: any, colName: string, event?: any): void {
    if (event) event.stopPropagation();
    column.fkCol = colName;
    this.fkColDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.typeDropdownIndex = null;
    this.constraintDropdownIndex = null;
    this.groupDropdownVisible = false;
    this.fkTableDropdownOpen = false;
    this.fkColDropdownOpen = false;
    this.groupModal.isAddDropdownOpen = false;
    this.showDetailLevelMenu = false;

    const target = event.target as HTMLElement;
    const isInsideLayoutControl = target.closest('#layout-control');
    if (!isInsideLayoutControl) {
      this.showLayoutMenu = false;
    }
  }

  closeAllDropdowns(event?: Event): void {
    if (event) event.stopPropagation();
    this.typeDropdownIndex = null;
    this.constraintDropdownIndex = null;
    this.groupDropdownVisible = false;
    this.fkTableDropdownOpen = false;
    this.fkColDropdownOpen = false;
    this.groupModal.isAddDropdownOpen = false;
    this.showDetailLevelMenu = false;
  }

  toggleGroupOption(isGroup: boolean): void {
    if (isGroup && !this.entitlementService.canUseFeature('table_group')) {
      this.svc.showUpgradeModal();
      return;
    }
    this.tableModal.isGroup = isGroup;
  }

  openGroupModal(groupName: string): void {
    if (!this.entitlementService.canUseFeature('table_group')) {
      if (!this.entitlementService.orgHasFeature('table_group')) {
        this.svc.showUpgradeModal();
      }
      return;
    }
    const group = this.svc.groups.find(g => g.name === groupName);
    this.groupModal = {
      visible: true,
      name: groupName,
      originalName: groupName,
      tables: group ? [...group.tables] : [],
      error: '',
      isAddDropdownOpen: false,
      showAddTableField: false,
      tableSearchQuery: ''
    };
  }

  closeGroupModal(): void {
    this.groupModal.visible = false;
    this.groupModal.isAddDropdownOpen = false;
    this.groupModal.showAddTableField = false;
    this.groupModal.tableSearchQuery = '';
  }

  removeTableFromGroupList(index: number): void {
    this.groupModal.tables.splice(index, 1);
  }

  toggleAddTableDropdown(forceVal?: boolean, event?: any): void {
    if (event) event.stopPropagation();
    if (forceVal !== undefined) {
      this.groupModal.isAddDropdownOpen = forceVal;
    } else {
      this.groupModal.isAddDropdownOpen = !this.groupModal.isAddDropdownOpen;
    }
  }

  toggleAddTableField(event?: any): void {
    if (event) event.stopPropagation();
    this.groupModal.showAddTableField = !this.groupModal.showAddTableField;
    this.groupModal.isAddDropdownOpen = false;
    this.groupModal.tableSearchQuery = '';
  }

  hideAddTableField(): void {
    this.groupModal.showAddTableField = false;
    this.groupModal.isAddDropdownOpen = false;
    this.groupModal.tableSearchQuery = '';
  }

  getAvailableTablesForGroup(): string[] {
    // Tables already in this modal's list
    const inCurrentGroup = new Set(this.groupModal.tables);
    // Tables in any OTHER group (excluding the group being edited)
    const inOtherGroups = new Set(
      this.svc.groups
        .filter(g => g.name !== this.groupModal.originalName)
        .flatMap(g => g.tables)
    );
    return this.svc.tables
      .map(t => t.name)
      .filter(name => !inCurrentGroup.has(name) && !inOtherGroups.has(name));
  }

  getFilteredAvailableTablesForGroup(): string[] {
    const query = this.groupModal.tableSearchQuery.trim().toLowerCase();
    const available = this.getAvailableTablesForGroup();
    if (!query) return available;
    return available.filter(name => name.toLowerCase().includes(query));
  }

  addTableToGroup(tableName: string): void {
    if (!this.groupModal.tables.includes(tableName)) {
      this.groupModal.tables.push(tableName);
    }
    this.groupModal.isAddDropdownOpen = false;
    this.groupModal.tableSearchQuery = '';
  }

  saveGroupModal(): void {
    const name = this.groupModal.name.trim();
    const validName = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!validName.test(name)) {
      this.groupModal.error = 'Use letters, numbers, and underscores for the group name.';
      return;
    }
    const duplicate = this.svc.groups.some(g => g.name === name && g.name !== this.groupModal.originalName);
    if (duplicate) {
      this.groupModal.error = 'A group with this name already exists.';
      return;
    }

    this.svc.updateTableGroupInCode(this.groupModal.originalName, name, this.groupModal.tables);
    this.closeGroupModal();
    this.svc.showToast(`Group "${name}" updated successfully.`, 2500, 'success');
  }

  getFkTableOptions(): TableDef[] {
    return this.svc.tables;
  }

  getFkColOptions(tableName?: string): string[] {
    if (!tableName) return [];
    if (tableName === this.tableModal.name || tableName === this.tableModal.originalName) {
      return this.tableModal.columns.map((c) => c.name);
    }
    const table = this.svc.tables.find((t) => t.name === tableName);
    return table ? table.columns.map((c) => c.name) : [];
  }

  onFkTableChange(column: any): void {
    const cols = this.getFkColOptions(column.fkTable);
    if (cols.length > 0) {
      column.fkCol = cols[0];
    } else {
      column.fkCol = undefined;
    }
  }

  constraintSummary(column: Column): string {
    const values: string[] = [];
    if (column.pk) values.push('PK');
    if (column.fk) {
      if (column.fkTable && column.fkCol) {
        values.push(`FK (${column.fkTable}.${column.fkCol})`);
      } else {
        values.push('FK');
      }
    }
    if (column.notNull) values.push('Not null');
    if (column.unique) values.push('Unique');
    if (column.default) {
      values.push(column.defaultVal ? `Default: ${column.defaultVal}` : 'Default');
    }
    if (column.check) {
      values.push(column.checkVal ? `Check: ${column.checkVal}` : 'Check');
    }
    return values.length ? values.join(', ') : 'None';
  }

  saveTableModal(): void {
    const name = this.tableModal.name.trim();
    const validName = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!validName.test(name)) {
      this.tableModal.error = 'Use letters, numbers, and underscores for the table name.';
      return;
    }
    if (!this.tableModal.columns.length) {
      this.tableModal.error = 'A table needs at least one column.';
      return;
    }
    const names = this.tableModal.columns.map((column) => column.name.trim());
    if (names.some((columnName) => !validName.test(columnName)) || new Set(names).size !== names.length) {
      this.tableModal.error = 'Column names must be unique and use only letters, numbers, and underscores.';
      return;
    }
    const duplicate = this.svc.tables.some((table) => table.name === name && table.name !== this.tableModal.originalName);
    if (duplicate) {
      this.tableModal.error = 'A table with this name already exists.';
      return;
    }

    if (this.tableModal.isGroup) {
      const gName = this.tableModal.groupName.trim();
      if (!gName) {
        this.tableModal.error = 'Group name is required when Group option is selected.';
        return;
      }
      if (!validName.test(gName)) {
        this.tableModal.error = 'Use letters, numbers, and underscores for the group name.';
        return;
      }
    }

    const columns = this.tableModal.columns.map((column, index) => ({
      ...column,
      name: names[index],
      type: column.type.trim() || 'varchar'
    }));
    const isNew = this.tableModal.isNew;
    const oldName = this.tableModal.originalName;

    // Clean up old name from groups first
    this.svc.removeTableFromGroupsInCode(oldName);

    // Save table definition changes
    this.svc.updateTableInCode(oldName, name, columns);

    // Add to group if checked
    if (this.tableModal.isGroup) {
      const gName = this.tableModal.groupName.trim();
      this.svc.addTableToGroupInCode(name, gName);
    }

    this.closeTableModal(false);
    this.svc.showToast(isNew ? `Table "${name}" created successfully.` : `Table "${name}" updated successfully.`, 2500, 'success');
  }

  /* ============ COLOR PICKER ============ */

  openColorPickerForConnection(refIndex: number, e: MouseEvent): void {
    if (!this.entitlementService.canUseFeature('table_color_and_connection_color')) {
      if (!this.entitlementService.orgHasFeature('table_color_and_connection_color')) {
        this.svc.showUpgradeModal();
      }
      return;
    }
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const pickerWidth = 200;
    const pickerHeight = 220;
    const maxX = Math.max(6, rect.width - pickerWidth - 6);
    const maxY = Math.max(6, rect.height - pickerHeight - 6);
    const px = Math.max(6, Math.min(e.clientX - rect.left, maxX));
    const py = Math.max(6, Math.min(e.clientY - rect.top, maxY));

    // Close other overlapping widgets
    this.contextMenu.visible = false;
    this.activeNoteMenuId = null;
    this.showLayoutMenu = false;

    const isLight = this.svc.theme() === 'light';
    this.colorPicker = {
      visible: true,
      x: px,
      y: py,
      hex: this.svc.refs[refIndex]?.color || (isLight ? '#94a3b8' : '#70c8c3'),
      type: 'connection',
      refIndex: refIndex,
      targetName: '',
      noteId: null
    };
  }

  openColorPickerForTable(tableName: string, e: MouseEvent): void {
    if (!this.entitlementService.canUseFeature('table_color_and_connection_color')) {
      if (!this.entitlementService.orgHasFeature('table_color_and_connection_color')) {
        this.svc.showUpgradeModal();
      }
      return;
    }
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const table = this.svc.tables.find(t => t.name === tableName);
    const pickerWidth = 200;
    const pickerHeight = 220;
    const maxX = Math.max(6, rect.width - pickerWidth - 6);
    const maxY = Math.max(6, rect.height - pickerHeight - 6);
    const px = Math.max(6, Math.min(e.clientX - rect.left, maxX));
    const py = Math.max(6, Math.min(e.clientY - rect.top, maxY));

    // Close other overlapping widgets
    this.contextMenu.visible = false;
    this.activeNoteMenuId = null;
    this.showLayoutMenu = false;

    const isLight = this.svc.theme() === 'light';
    this.colorPicker = {
      visible: true,
      x: px,
      y: py,
      hex: table?.color || (isLight ? '#337ab7' : '#3ec5c1'),
      type: 'table',
      refIndex: -1,
      targetName: tableName,
      noteId: null
    };
  }

  openColorPickerForGroup(groupName: string, e: MouseEvent): void {
    if (!this.entitlementService.canUseFeature('table_color_and_connection_color')) {
      if (!this.entitlementService.orgHasFeature('table_color_and_connection_color')) {
        this.svc.showUpgradeModal();
      }
      return;
    }
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const group = this.svc.groups.find(g => g.name === groupName);
    const pickerWidth = 200;
    const pickerHeight = 220;
    const maxX = Math.max(6, rect.width - pickerWidth - 6);
    const maxY = Math.max(6, rect.height - pickerHeight - 6);
    const px = Math.max(6, Math.min(e.clientX - rect.left, maxX));
    const py = Math.max(6, Math.min(e.clientY - rect.top, maxY));

    // Close other overlapping widgets
    this.contextMenu.visible = false;
    this.activeNoteMenuId = null;
    this.showLayoutMenu = false;

    this.colorPicker = {
      visible: true,
      x: px,
      y: py,
      hex: group?.color || '#3b82f6',
      type: 'group',
      refIndex: -1,
      targetName: groupName,
      noteId: null
    };
  }

  setColor(hex: string): void {
    this.colorPicker.hex = hex;
    if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(hex)) {
      if (this.colorPicker.type === 'connection') {
        this.svc.setConnectionColor(this.colorPicker.refIndex, hex);
      } else if (this.colorPicker.type === 'table') {
        this.svc.setTableColor(this.colorPicker.targetName, hex);
      } else if (this.colorPicker.type === 'group') {
        this.svc.setGroupColor(this.colorPicker.targetName, hex);
      } else if (this.colorPicker.type === 'note' && this.colorPicker.noteId !== null) {
        this.svc.updateNote(this.colorPicker.noteId, { color: hex });
      } else if (this.colorPicker.type === 'noteText' && this.colorPicker.noteId !== null) {
        this.svc.updateNote(this.colorPicker.noteId, { textColor: hex });
      }
    }
  }

  /** Open the existing color-picker popup for a sticky note */
  openNoteColorPicker(event: MouseEvent, note: DiagramNote): void {
    event.stopPropagation();
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const pane = (this.canvasRef?.nativeElement?.closest('#canvas-pane') as HTMLElement)?.getBoundingClientRect()
      ?? { left: 0, top: 0 };

    // Close other overlapping widgets
    this.contextMenu.visible = false;
    this.showLayoutMenu = false;

    this.colorPicker = {
      visible: true,
      x: rect.left - pane.left,
      y: rect.bottom - pane.top + 4,
      hex: note.color ?? '#FFE28B',
      type: 'note',
      refIndex: -1,
      targetName: '',
      noteId: note.id
    };
    this.activeNoteMenuId = null;
    this.cdr.detectChanges();
  }

  /** Open the existing color-picker popup for a sticky note's text color */
  openNoteTextColorPicker(event: MouseEvent, note: DiagramNote): void {
    event.stopPropagation();
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const pane = (this.canvasRef?.nativeElement?.closest('#canvas-pane') as HTMLElement)?.getBoundingClientRect()
      ?? { left: 0, top: 0 };

    // Close other overlapping widgets
    this.contextMenu.visible = false;
    this.showLayoutMenu = false;

    this.colorPicker = {
      visible: true,
      x: rect.left - pane.left,
      y: rect.bottom - pane.top + 4,
      hex: note.textColor ?? '#000000',
      type: 'noteText',
      refIndex: -1,
      targetName: '',
      noteId: note.id
    };
    this.activeNoteMenuId = null;
    this.cdr.detectChanges();
  }

  onHexInputChange(event: any): void {
    const value = event.target.value;
    this.setColor(value);
  }

  /* ============ CONTEXT MENU ============ */

  private getContextMenuItems(): string[] {
    switch (this.contextMenu.targetType) {
      case 'column':
        return ['Add Column', 'Edit Column', 'Delete Column'];
      case 'table':
        return ['Add Column', 'Rename Table', 'Delete Table'];
      case 'tableHeader':
        return ['Edit Table', 'Delete Table', 'Change Color'];
      case 'groupHeader':
        return ['Edit Group', 'Delete Group', 'Change Color'];
      case 'connection':
        return [];
      case 'empty':
        return ['Add Table'];
      default:
        return [];
    }
  }

  private openContextMenu(
    sx: number,
    sy: number,
    targetType: ContextMenuTarget,
    table: any | null,
    column: any | null,
    connectionIndex: number,
    groupName: string | null = null
  ): void {
    if (this.svc.isReadOnly) return;
    this.contextMenu.visible = true;
    this.contextMenu.targetType = targetType;
    this.contextMenu.table = table;
    this.contextMenu.column = column;
    this.contextMenu.connectionIndex = connectionIndex;
    this.contextMenu.groupName = groupName;

    // Close other overlapping widgets
    this.activeNoteMenuId = null;
    this.colorPicker.visible = false;
    this.showLayoutMenu = false;

    const items = this.getContextMenuItems();
    if (!items.length) {
      this.contextMenu.visible = false;
      return;
    }

    const menuHeight = items.length * this.menuItemHeight;
    const canvas = this.canvasRef.nativeElement;
    const maxX = Math.max(6, canvas.clientWidth - this.menuWidth - 6);
    const maxY = Math.max(6, canvas.clientHeight - menuHeight - 6);

    this.contextMenu.x = Math.max(6, Math.min(sx, maxX));
    this.contextMenu.y = Math.max(6, Math.min(sy, maxY));
    this.contextMenu.visible = true;

    this.scheduleDraw();
  }

  private drawContextMenu(ctx: CanvasRenderingContext2D): void {
    const items = this.getContextMenuItems();
    if (!items.length) return;

    const x = this.contextMenu.x;
    const y = this.contextMenu.y;
    const w = this.menuWidth;
    const h = items.length * this.menuItemHeight;
    const radius = 10;

    const isLight = this.svc.theme() === 'light';

    ctx.save();
    ctx.shadowColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 6;
    this.roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = isLight ? '#ffffff' : '#141d31';
    ctx.fill();
    ctx.restore();

    ctx.save();
    this.roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();

    ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    items.forEach((label, i) => {
      const itemY = y + i * this.menuItemHeight;
      const isDanger = label.toLowerCase().startsWith('delete');
      const table = this.contextMenu.table;
      const isTableInGroup = (this.contextMenu.targetType === 'tableHeader' && table)
        ? this.svc.groups.some(g => g.tables.includes(table.name))
        : false;
      const column = this.contextMenu.column;
      const isDisabled = (label === 'Change Color' && isTableInGroup) ||
        (label === 'Edit Column' && column && (column.pk || column.fk));

      if (isDisabled) {
        ctx.fillStyle = isLight ? '#9ca3af' : '#4b5563';
      } else if (isDanger) {
        ctx.fillStyle = '#ef4444';
      } else {
        ctx.fillStyle = isLight ? '#1f2937' : '#e6eef9';
      }
      ctx.fillText(label, x + 14, itemY + this.menuItemHeight / 2 + 1);

      if (i > 0) {
        ctx.beginPath();
        ctx.moveTo(x, itemY);
        ctx.lineTo(x + w, itemY);
        ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    ctx.restore();

    this.roundRectPath(ctx, x, y, w, h, radius);
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private drawStickyNotes(ctx: CanvasRenderingContext2D): void {
    if (!this.svc.notes || this.svc.notes.length === 0) return;

    this.svc.notes.forEach((note) => {
      const { posx, posy, width, height, color, name, text } = note;
      const noteColor = color || '#FFE28B';

      // 1. Shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;

      // 2. Main card body
      ctx.fillStyle = noteColor;
      this.roundRectPath(ctx, posx, posy, width, height, 6);
      ctx.fill();
      ctx.restore();

      // 3. Header background (clipped to top rounded corners of card)
      ctx.save();
      ctx.beginPath();
      this.roundRectPath(ctx, posx, posy, width, height, 6);
      ctx.clip();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.09)';
      ctx.fillRect(posx, posy, width, 26);
      ctx.restore();

      // 4. Drag dots (6 dots)
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      const dotX1 = posx + 6;
      const dotX2 = posx + 10;
      const dotY1 = posy + 8;
      const dotY2 = posy + 13;
      const dotY3 = posy + 18;
      ctx.fillRect(dotX1, dotY1, 2, 2);
      ctx.fillRect(dotX2, dotY1, 2, 2);
      ctx.fillRect(dotX1, dotY2, 2, 2);
      ctx.fillRect(dotX2, dotY2, 2, 2);
      ctx.fillRect(dotX1, dotY3, 2, 2);
      ctx.fillRect(dotX2, dotY3, 2, 2);

      // Name text
      ctx.fillStyle = note.textColor || '#000000';
      ctx.font = "bold 11px 'Segoe UI', -apple-system, sans-serif";
      ctx.textBaseline = 'middle';
      ctx.fillText(name || '', posx + 18, posy + 13);
      ctx.restore();

      // 5. Body text wrapping
      ctx.save();
      ctx.fillStyle = note.textColor || '#000000';
      ctx.font = "12px 'Segoe UI', -apple-system, sans-serif";
      ctx.textBaseline = 'top';

      const paddingLeft = 8;
      const paddingTop = 32;
      const maxTextWidth = width - 16;
      const lineHeight = 18;

      // Handle split by lines first so explicit carriage returns work
      const lines = (text || '').split(/\r?\n/);
      let currentY = posy + paddingTop;

      for (const line of lines) {
        const words = line.split(/(\s+)/);
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine + word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxTextWidth && currentLine !== '') {
            ctx.fillText(currentLine, posx + paddingLeft, currentY);
            currentLine = word.trim() ? word : '';
            currentY += lineHeight;
            if (currentY + lineHeight > posy + height - 8) break;
          } else {
            currentLine = testLine;
          }
        }

        if (currentY + lineHeight > posy + height - 8) break;

        if (currentLine !== '') {
          ctx.fillText(currentLine, posx + paddingLeft, currentY);
          currentY += lineHeight;
        } else {
          currentY += lineHeight; // Empty line
        }
      }
      ctx.restore();
    });
  }

  private handleContextMenuMouseDown(e: MouseEvent): boolean {
    if (!this.contextMenu.visible) return false;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const items = this.getContextMenuItems();
    const menuHeight = items.length * this.menuItemHeight;

    const insideMenu =
      sx >= this.contextMenu.x &&
      sx <= this.contextMenu.x + this.menuWidth &&
      sy >= this.contextMenu.y &&
      sy <= this.contextMenu.y + menuHeight;

    if (insideMenu) {
      const index = Math.floor((sy - this.contextMenu.y) / this.menuItemHeight);
      const label = items[index];
      const table = this.contextMenu.table;
      const isTableInGroup = (this.contextMenu.targetType === 'tableHeader' && table)
        ? this.svc.groups.some(g => g.tables.includes(table.name))
        : false;
      const column = this.contextMenu.column;
      const isDisabled = (label === 'Change Color' && isTableInGroup) ||
        (label === 'Edit Column' && column && (column.pk || column.fk));

      if (!isDisabled) {
        this.handleContextMenuClick(label);
      }
      this.contextMenu.visible = false;
      this.scheduleDraw();
      return true;
    }

    this.contextMenu.visible = false;
    this.scheduleDraw();
    return false;
  }

  private handleContextMenuClick(label: string | undefined): void {
    if (!label) return;

    switch (this.contextMenu.targetType) {
      case 'column':
        this.handleColumnMenuAction(label);
        break;
      case 'table':
        this.handleTableMenuAction(label);
        break;
      case 'tableHeader':
        this.handleTableHeaderMenuAction(label);
        break;
      case 'groupHeader':
        this.handleGroupHeaderMenuAction(label);
        break;
      case 'empty':
        this.handleEmptyMenuAction(label);
        break;
    }
  }

  private handleEmptyMenuAction(label: string): void {
    if (label === 'Add Table') {
      this.svc.addTableAt(this.contextMenuWorldPoint.x, this.contextMenuWorldPoint.y);
    }
  }

  private deleteTable(tableName: string): void {
    this.deleteConfirm = {
      visible: true,
      tableName: tableName
    };
  }

  confirmDeleteTable(): void {
    if (this.deleteConfirm.tableName) {
      this.svc.deleteTableInCode(this.deleteConfirm.tableName);
      this.svc.updateGutter();
      this.svc.parseAndLayout();
      this.svc.showToast(`Table "${this.deleteConfirm.tableName}" deleted successfully.`, 2500, 'success');
    }
    this.closeDeleteConfirm();
  }

  closeDeleteConfirm(): void {
    this.deleteConfirm = {
      visible: false,
      tableName: ''
    };
  }

  private deleteGroup(groupName: string): void {
    this.deleteGroupConfirm = {
      visible: true,
      groupName: groupName
    };
  }

  confirmDeleteGroup(): void {
    if (this.deleteGroupConfirm.groupName) {
      this.svc.deleteTableGroupInCode(this.deleteGroupConfirm.groupName);
      this.svc.showToast(`Group "${this.deleteGroupConfirm.groupName}" deleted successfully.`, 2500, 'success');
    }
    this.closeDeleteGroupConfirm();
  }

  closeDeleteGroupConfirm(): void {
    this.deleteGroupConfirm = {
      visible: false,
      groupName: ''
    };
  }

  confirmDeleteConnection(): void {
    const ref = this.deleteConnectionConfirm.ref;
    if (ref) {
      this.svc.deleteConnectionInCode(ref);
      this.svc.selectedConnectionIndex = -1;
      this.svc.hoveredConnectionIndex = -1;
      this.svc.updateGutter();
      this.svc.parseAndLayout();
      this.svc.showToast('Connection deleted successfully.', 2500, 'success');
    }
    this.closeDeleteConnectionConfirm();
  }

  closeDeleteConnectionConfirm(): void {
    this.deleteConnectionConfirm = {
      visible: false,
      refIndex: -1,
      fromTable: '',
      fromCol: '',
      toTable: '',
      toCol: '',
      ref: null as any
    };
  }

  private handleColumnMenuAction(label: string): void {
    const table = this.contextMenu.table;
    const column = this.contextMenu.column;
    if (!table || !column) return;

    if (label === 'Add Column') {
      this.svc.addColumnInCode(table.name);
      this.svc.showToast('Column added successfully.', 2500, 'success');
    } else if (label === 'Edit Column') {
      this.openInlineEditForColumn(table, column);
      return;
    } else if (label === 'Delete Column') {
      this.svc.deleteColumnInCode(table.name, column.name);
      this.svc.showToast(`Column "${column.name}" deleted successfully.`, 2500, 'success');
    }

    this.svc.updateGutter();
    this.svc.parseAndLayout();
  }

  private handleTableMenuAction(label: string): void {
    const table = this.contextMenu.table;
    if (!table) return;

    if (label === 'Add Column') {
      this.svc.addColumnInCode(table.name);
      this.svc.showToast('Column added successfully.', 2500, 'success');
    } else if (label === 'Rename Table') {
      this.openInlineEditForTable(table);
      return;
    } else if (label === 'Delete Table') {
      this.deleteTable(table.name);
      return;
    }

    this.svc.updateGutter();
    this.svc.parseAndLayout();
  }

  private handleTableHeaderMenuAction(label: string): void {
    const table = this.contextMenu.table;
    if (!table) return;

    if (label === 'Edit Table') {
      this.openTableModal(table);
    } else if (label === 'Delete Table') {
      this.deleteTable(table.name);
    } else if (label === 'Change Color') {
      if (!this.entitlementService.canUseFeature('table_color_and_connection_color')) {
      if (!this.entitlementService.orgHasFeature('table_color_and_connection_color')) {
        this.svc.showUpgradeModal();
      }
      return;
    }
      const isLight = this.svc.theme() === 'light';
      this.colorPicker = {
        visible: true,
        x: this.contextMenu.x,
        y: this.contextMenu.y,
        hex: table.color || (isLight ? '#337ab7' : '#3ec5c1'),
        type: 'table',
        refIndex: -1,
        targetName: table.name,
        noteId: null
      };
    }
  }

  private handleGroupHeaderMenuAction(label: string): void {
    const groupName = this.contextMenu.groupName;
    if (!groupName) return;

    if (label === 'Edit Group') {
      this.openGroupModal(groupName);
    } else if (label === 'Delete Group') {
      this.deleteGroup(groupName);
    } else if (label === 'Change Color') {
      if (!this.entitlementService.canUseFeature('table_color_and_connection_color')) {
      if (!this.entitlementService.orgHasFeature('table_color_and_connection_color')) {
        this.svc.showUpgradeModal();
      }
      return;
    }
      const group = this.svc.groups.find(g => g.name === groupName);
      this.colorPicker = {
        visible: true,
        x: this.contextMenu.x,
        y: this.contextMenu.y,
        hex: group?.color || '#3b82f6',
        type: 'group',
        refIndex: -1,
        targetName: groupName,
        noteId: null
      };
    }
  }

  /* ============ INLINE EDITS ============ */

  private openInlineEditForColumn(table: TableDef, column: Column): void {
    const rowIndex = table.columns.findIndex((c) => c.name === column.name);
    if (rowIndex === -1) return;
    const rowY = table.y + this.svc.HEADER_H + rowIndex * this.svc.ROW_H;

    this.inlineEdit = {
      visible: true,
      x: table.x * this.svc.view.scale + this.svc.view.x,
      y: rowY * this.svc.view.scale + this.svc.view.y,
      width: table.width * this.svc.view.scale,
      height: this.svc.ROW_H * this.svc.view.scale,
      value: column.name,
      kind: 'column',
      tableName: table.name,
      originalColumnName: column.name
    };
  }

  private openInlineEditForTable(table: TableDef): void {
    this.inlineEdit = {
      visible: true,
      x: table.x * this.svc.view.scale + this.svc.view.x,
      y: table.y * this.svc.view.scale + this.svc.view.y,
      width: table.width * this.svc.view.scale,
      height: this.svc.HEADER_H * this.svc.view.scale,
      value: table.name,
      kind: 'table',
      tableName: table.name,
      originalColumnName: undefined
    };
  }

  commitInlineEdit(): void {
    if (!this.inlineEdit.visible) return;
    const val = this.inlineEdit.value.trim();

    if (val) {
      if (this.inlineEdit.kind === 'column' && this.inlineEdit.originalColumnName) {
        if (val !== this.inlineEdit.originalColumnName) {
          this.svc.renameColumnInCode(this.inlineEdit.tableName, this.inlineEdit.originalColumnName, val);
          this.svc.showToast(`Column renamed to "${val}" successfully.`, 2500, 'success');
        }
      } else if (this.inlineEdit.kind === 'table' && val !== this.inlineEdit.tableName) {
        this.svc.renameTableInCode(this.inlineEdit.tableName, val);
        this.svc.showToast(`Table renamed to "${val}" successfully.`, 2500, 'success');
      }
      this.svc.updateGutter();
      this.svc.parseAndLayout();
    }

    this.inlineEdit.visible = false;
  }

  cancelInlineEdit(): void {
    this.inlineEdit.visible = false;
  }

  /* ============ ESCAPE KEY ============ */

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_')) {
      if (this.isMouseOverCanvas) {
        e.preventDefault();
        if (e.key === '+' || e.key === '=') {
          this.zoomIn();
        } else {
          this.zoomOut();
        }
        return;
      }
    }

    if (e.key === 'Escape') {
      if (this.contextMenu.visible) {
        this.contextMenu.visible = false;
        this.scheduleDraw();
      }
      if (this.colorPicker.visible) {
        this.colorPicker.visible = false;
      }
      return;
    }

    const activeEl = document.activeElement;
    const isTyping = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.getAttribute('contenteditable') === 'true'
    );

    if (!isTyping) {
      if (e.key === 'h' || e.key === 'H') {
        this.setTool('pan');
      } else if (e.key === 'v' || e.key === 'V') {
        this.setTool('select');
      }
    }
  }

  /* ============ STICKY NOTE INTERACTIONS ============ */

  /** Add a new note at the center of the current canvas viewport */
  addNoteAtCenter(): void {
    if (!this.entitlementService.canUseFeature('diagram_notes')) {
      if (!this.entitlementService.orgHasFeature('diagram_notes')) {
        this.svc.showUpgradeModal();
      }
      return;
    }
    const canvas = this.canvasRef?.nativeElement;
    const w = canvas ? canvas.clientWidth : 800;
    const h = canvas ? canvas.clientHeight : 600;
    // Convert screen center to world coordinates
    const worldX = Math.round((w / 2 - this.svc.view.x) / this.svc.view.scale - 100);
    const worldY = Math.round((h / 2 - this.svc.view.y) / this.svc.view.scale - 75);
    this.svc.addNote(worldX, worldY);
    this.cdr.detectChanges();
  }

  startNoteDrag(event: MouseEvent | TouchEvent, note: DiagramNote): void {
    if (this.editingNoteId !== null) {
      this.commitEditNoteName();
    }
    this.selectNote(event, note.id);
    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

    this.draggingNote = note;
    this.noteMouseStart = { x: clientX, y: clientY };
    this.noteWorldStart = { x: note.posx, y: note.posy };

    const onMove = (e: MouseEvent) => {
      if (!this.draggingNote) return;
      const dx = (e.clientX - this.noteMouseStart.x) / this.svc.view.scale;
      const dy = (e.clientY - this.noteMouseStart.y) / this.svc.view.scale;
      this.svc.updateNote(this.draggingNote.id, {
        posx: Math.round(this.noteWorldStart.x + dx),
        posy: Math.round(this.noteWorldStart.y + dy)
      });
      this.cdr.detectChanges();
    };

    const onUp = () => {
      this.draggingNote = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    this.noteBoundMouseMove = onMove;
    this.noteBoundMouseUp = onUp;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  startNoteResize(event: MouseEvent | TouchEvent, note: DiagramNote, dir: string = 'se'): void {
    event.stopPropagation();
    event.preventDefault();
    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

    this.resizingNote = note;
    this.resizeMouseStart = { x: clientX, y: clientY };
    this.resizeWorldStart = { w: note.width, h: note.height, x: note.posx, y: note.posy } as any;

    const onMove = (e: MouseEvent) => {
      if (!this.resizingNote) return;
      const dx = (e.clientX - this.resizeMouseStart.x) / this.svc.view.scale;
      const dy = (e.clientY - this.resizeMouseStart.y) / this.svc.view.scale;

      let newW = (this.resizeWorldStart as any).w;
      let newH = (this.resizeWorldStart as any).h;
      let newX = (this.resizeWorldStart as any).x;
      let newY = (this.resizeWorldStart as any).y;

      if (dir.includes('e')) newW = (this.resizeWorldStart as any).w + dx;
      if (dir.includes('s')) newH = (this.resizeWorldStart as any).h + dy;
      if (dir.includes('w')) {
        const diff = Math.min((this.resizeWorldStart as any).w - 120, dx);
        newW = (this.resizeWorldStart as any).w - diff;
        newX = (this.resizeWorldStart as any).x + diff;
      }
      if (dir.includes('n')) {
        const diff = Math.min((this.resizeWorldStart as any).h - 80, dy);
        newH = (this.resizeWorldStart as any).h - diff;
        newY = (this.resizeWorldStart as any).y + diff;
      }

      this.svc.updateNote(this.resizingNote.id, {
        width: Math.max(120, Math.round(newW)),
        height: Math.max(80, Math.round(newH)),
        posx: Math.round(newX),
        posy: Math.round(newY)
      });
      this.cdr.detectChanges();
    };

    const onUp = () => {
      this.resizingNote = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  trackByNoteId(index: number, note: DiagramNote): number {
    return note.id;
  }

  onNoteTextChange(note: DiagramNote): void {
    // ngModel already updated note.text; sync to DBML code
    this.svc.updateNote(note.id, { text: note.text });
    this.cdr.detectChanges();
  }

  noteMenuX = 0;
  noteMenuY = 0;

  get activeNote(): DiagramNote | undefined {
    return this.svc.notes.find(n => n.id === this.activeNoteMenuId);
  }

  toggleNoteMenu(event: MouseEvent, noteId: number): void {
    event.stopPropagation();
    this.activeNoteMenuId = this.activeNoteMenuId === noteId ? null : noteId;
    if (this.activeNoteMenuId !== null) {
      const rect = this.canvasWrapRef.nativeElement.getBoundingClientRect();
      this.noteMenuX = event.clientX - rect.left;
      this.noteMenuY = event.clientY - rect.top;
    }
    // Close any open rename input
    if (this.activeNoteMenuId !== noteId) {
      this.editingNoteId = null;
    }
    if (this.activeNoteMenuId !== null) {
      this.contextMenu.visible = false;
      this.colorPicker.visible = false;
      this.showLayoutMenu = false;
    }
    this.cdr.detectChanges();
  }

  startEditNoteName(note: DiagramNote): void {
    this.editingNoteId = note.id;
    this.editNoteNameValue = note.name;
    this.activeNoteMenuId = null;
    this.cdr.detectChanges();
  }

  commitEditNoteName(): void {
    if (this.editingNoteId !== null && this.editNoteNameValue.trim()) {
      this.svc.updateNote(this.editingNoteId, { name: this.editNoteNameValue.trim() });
    }
    this.editingNoteId = null;
    this.cdr.detectChanges();
  }

  cancelEditNoteName(): void {
    this.editingNoteId = null;
    this.cdr.detectChanges();
  }

  setNoteColor(note: DiagramNote, color: string): void {
    this.svc.updateNote(note.id, { color });
    this.activeNoteMenuId = null;
    this.cdr.detectChanges();
  }

  selectNote(event: MouseEvent | TouchEvent, noteId: number): void {
    event.stopPropagation();
    this.selectedNoteId = noteId;
    if (this.editingNoteBodyId !== noteId) {
      this.editingNoteBodyId = null;
    }
    if (this.activeNoteMenuId !== null && this.activeNoteMenuId !== noteId) {
      this.activeNoteMenuId = null;
    }
    this.cdr.detectChanges();
  }

  onNoteBodyMouseDown(event: MouseEvent | TouchEvent, note: DiagramNote): void {
    // If not in edit mode, pass to startNoteDrag to allow dragging/selecting
    if (this.editingNoteBodyId !== note.id) {
      this.startNoteDrag(event, note);
    } else {
      event.stopPropagation(); // Allow normal textarea click behavior if editing
    }
  }

  editNoteBody(event: MouseEvent | TouchEvent, noteId: number): void {
    event.stopPropagation();
    this.selectedNoteId = noteId;
    this.editingNoteBodyId = noteId;
    this.cdr.detectChanges();

    // Force focus and move cursor to the beginning
    const target = event.target as HTMLTextAreaElement;
    if (target && target.tagName === 'TEXTAREA') {
      target.focus();
      if (!target.value) {
        target.setSelectionRange(0, 0);
      }
    }
  }

  openDeleteNoteConfirm(note: DiagramNote): void {
    this.deleteNoteConfirm = {
      visible: true,
      noteId: note.id,
      noteName: note.name || ''
    };
    this.activeNoteMenuId = null;
    this.cdr.detectChanges();
  }

  closeDeleteNoteConfirm(): void {
    this.deleteNoteConfirm.visible = false;
    this.cdr.detectChanges();
  }

  confirmDeleteNote(): void {
    if (this.deleteNoteConfirm.noteId !== null) {
      this.svc.deleteNote(this.deleteNoteConfirm.noteId);
      this.svc.showToast(`Note "${this.deleteNoteConfirm.noteName}" deleted successfully.`, 2500, 'success');
    }
    this.deleteNoteConfirm.visible = false;
    this.cdr.detectChanges();
  }
}
