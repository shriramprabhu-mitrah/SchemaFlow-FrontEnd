import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from './shared/toaster/toast/toast';
import { SignOutModalComponent } from './shared/components/modals/sign-out-modal/sign-out-modal';
import { GoogleAnalyticsService } from './core/services/google-analytics.service';
import { ChatbotComponent } from './shared/components/chatbot/chatbot';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Toast, SignOutModalComponent,ChatbotComponent],
  template: '<router-outlet></router-outlet><app-toast></app-toast><app-sign-out-modal></app-sign-out-modal><app-chatbot></app-chatbot>',
})
export class App implements OnInit {
  constructor(private googleAnalyticsService: GoogleAnalyticsService) {}

  ngOnInit() {
    this.googleAnalyticsService.initializeGtagJs();
  }
}
