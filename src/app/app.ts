import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from './shared/toaster/toast/toast';
import { ChatbotComponent } from './shared/components/chatbot/chatbot';
import { GoogleAnalyticsService } from './core/services/google-analytics.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Toast, ChatbotComponent],
  template: '<router-outlet></router-outlet><app-toast></app-toast><app-chatbot></app-chatbot>',
})
export class App implements OnInit {
  constructor(private googleAnalyticsService: GoogleAnalyticsService) {}

  ngOnInit() {
    this.googleAnalyticsService.initializeGtagJs();
  }
}
