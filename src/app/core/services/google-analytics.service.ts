import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environment/environment';

declare var gtag: any;

@Injectable({
  providedIn: 'root'
})
export class GoogleAnalyticsService {
  private gTagId: string | undefined;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.gTagId = environment.googleAnalyticsMeasurementId;
  }

  initializeGtagJs() {
    if (!this.isBrowser || typeof document === 'undefined') {
      return;
    }

    if (this.gTagId) {
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.gTagId}`;
      script.async = true;
      document.head.appendChild(script);

      const inlineScript = document.createElement('script');
      inlineScript.text = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${this.gTagId}');
      `;
      document.head.appendChild(inlineScript);
    }
  }
}
