import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Icons } from '../../../core/component/icons/icons';
import { CommonModule } from '@angular/common';
import { ContactSalesModalComponent } from '../modals/contact-sales-modal/contact-sales-modal';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, Icons, ContactSalesModalComponent],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
  host: {
    'style': 'display: block; width: 100%; margin: 0; padding: 0;'
  }
})
export class Footer implements OnInit {
  isLoggedIn = false;
  isContactModalOpen = false;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.isLoggedIn = this.auth.isLoggedIn();
    }
  }

  onCreateDiagram(): void {
    if (this.isLoggedIn) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/dashboard'], { queryParams: { sample: 'true' } });
    }
  }

  openContactModal(event: Event): void {
    event.preventDefault();
    this.isContactModalOpen = true;
  }

  closeContactModal(): void {
    this.isContactModalOpen = false;
  }
}
