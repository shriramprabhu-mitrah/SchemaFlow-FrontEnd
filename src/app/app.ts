import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from './shared/toaster/toast/toast';
import { SignOutModalComponent } from './shared/components/modals/sign-out-modal/sign-out-modal';
import { GoogleAnalyticsService } from './core/services/google-analytics.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Toast, SignOutModalComponent],
  template: '<router-outlet></router-outlet><app-toast></app-toast><app-sign-out-modal></app-sign-out-modal>',
})
export class App implements OnInit {
  constructor(private googleAnalyticsService: GoogleAnalyticsService) {}

  ngOnInit() {
    this.googleAnalyticsService.initializeGtagJs();
  }
}
