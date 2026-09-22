import { Injectable } from '@angular/core';
import { environment } from '../../../environment/environment';

declare var gtag: any;

@Injectable({
  providedIn: 'root'
})
export class GoogleAnalyticsService {
  private gTagId: string | undefined;

  constructor() {
    this.gTagId = environment.googleAnalyticsMeasurementId;
  }

  initializeGtagJs() {
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
