import { Component, HostListener, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignOutService } from '../../../../core/services/sign-out.service';

@Component({
  selector: 'app-sign-out-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sign-out-modal.html',
  styleUrls: ['./sign-out-modal.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SignOutModalComponent {
  constructor(public signOutService: SignOutService) {}

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.signOutService.isOpen()) {
      this.signOutService.cancel();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.signOutService.cancel();
    }
  }
}

