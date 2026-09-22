import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from './shared/toaster/toast/toast';
import { GoogleAnalyticsService } from './core/services/google-analytics.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet,Toast],
  template: '<router-outlet></router-outlet><app-toast></app-toast>',
})
export class App implements OnInit {
  constructor(private googleAnalyticsService: GoogleAnalyticsService) {}

  ngOnInit() {
    this.googleAnalyticsService.initializeGtagJs();
  }
}
