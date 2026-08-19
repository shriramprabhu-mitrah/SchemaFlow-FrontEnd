const fs = require('fs');
let html = fs.readFileSync('feature-management/feature-management.html', 'utf8');
if (!html.includes('activateFeature')) {
    html = html.replace(
        '<button class="btn-danger btn-sm" (click)="deleteFeature(f.feature_id)" *ngIf="f.is_active">Deactivate</button>',
        '<button class="btn-danger btn-sm" (click)="deleteFeature(f.feature_id)" *ngIf="f.is_active">Deactivate</button>\n              <button class="btn-primary btn-sm" (click)="activateFeature(f.feature_id)" *ngIf="!f.is_active">Activate</button>'
    );
    fs.writeFileSync('feature-management/feature-management.html', html);
}
let ts = fs.readFileSync('feature-management/feature-management.ts', 'utf8');
if (!ts.includes('activateFeature')) {
    ts = ts.replace(
        'deleteFeature(id: number): void {\r\n    if (!confirm(\'Deactivate this feature?\')) return;\r\n    this.admin.deleteFeature(id).subscribe({ next: () => this.load() });\r\n  }',
        'deleteFeature(id: number): void {\r\n    if (!confirm(\'Deactivate this feature?\')) return;\r\n    this.admin.deleteFeature(id).subscribe({ next: () => this.load() });\r\n  }\r\n\r\n  activateFeature(id: number): void {\r\n    if (!confirm(\'Activate this feature?\')) return;\r\n    this.admin.updateFeature(id, { is_active: true }).subscribe({ next: () => this.load() });\r\n  }'
    );
    // fallback for linux line endings
    ts = ts.replace(
        'deleteFeature(id: number): void {\n    if (!confirm(\'Deactivate this feature?\')) return;\n    this.admin.deleteFeature(id).subscribe({ next: () => this.load() });\n  }',
        'deleteFeature(id: number): void {\n    if (!confirm(\'Deactivate this feature?\')) return;\n    this.admin.deleteFeature(id).subscribe({ next: () => this.load() });\n  }\n\n  activateFeature(id: number): void {\n    if (!confirm(\'Activate this feature?\')) return;\n    this.admin.updateFeature(id, { is_active: true }).subscribe({ next: () => this.load() });\n  }'
    );
    fs.writeFileSync('feature-management/feature-management.ts', ts);
}
