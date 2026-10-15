import { Component, HostListener, inject, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Icons } from '../../../core/component/icons/icons';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, Icons],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
  host: {
    'style': 'display: block; width: 100%; margin: 0; padding: 0;'
  }
})
export class Footer {
  private cdr = inject(ChangeDetectorRef);

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  @HostListener('window:userLogout')
  onUserLogout(): void {
    this.cdr.detectChanges();
  }

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  onCreateDiagram(): void {
    if (this.isLoggedIn) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/dashboard'], { queryParams: { sample: 'true' } });
    }
  }

  onContactClick(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  onFaqClick(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  onAiGeneratorClick(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  onStudentPlanClick(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

