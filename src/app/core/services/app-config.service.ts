import { inject, Injectable, APP_INITIALIZER, Provider } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../../environment/environment';

export function injectPreconnectLink(origin: string, crossorigin?: boolean): void {
  if (!origin || typeof document === 'undefined') {
    return;
  }

  try {
    const url = new URL(origin);
    const resolvedOrigin = url.origin;

    if (!resolvedOrigin || resolvedOrigin === 'null') {
      return;
    }

    const existing = document.head.querySelector(`link[rel="preconnect"][href="${resolvedOrigin}"]`);
    if (existing) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = resolvedOrigin;
    if (crossorigin) {
      link.crossOrigin = '';
    }
    document.head.appendChild(link);
  } catch {
    // Invalid URL — silently ignore
  }
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly http = inject(HttpClient);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public environment: any;

  loadConfiguration(): Promise<void> {
    const url = `assets/config/config.${environment.name}.json`;
    return lastValueFrom(this.http.get(url)).then((configData: any) => {
      this.environment = configData;
      if (this.environment?.configuration) {
        console.log('App configuration loaded:', {
          environment: this.environment.configuration.environment,
          version: this.environment.configuration.version,
          releaseName: this.environment.configuration.releaseName,
        });
      }
      this.injectPreconnectHints(configData);
    });
  }

  private injectPreconnectHints(config: any): void {
    const baseUrl = config?.apiConfig?.baseUrl;
    if (baseUrl) {
      injectPreconnectLink(baseUrl, true);
    }
  }
}

export function provideAppConfig(): Provider {
  return {
    provide: APP_INITIALIZER,
    useFactory: (appConfig: AppConfigService) => async () => {
      await appConfig.loadConfiguration();
    },
    deps: [AppConfigService],
    multi: true,
  };
}
