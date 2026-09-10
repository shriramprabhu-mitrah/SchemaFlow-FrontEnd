import { Injectable, Inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  constructor(private title: Title, private meta: Meta, @Inject(DOCUMENT) private document: Document) {}

  updateTags(config: { title: string; description: string; image?: string; url?: string }) {
    this.title.setTitle(config.title);

    this.meta.updateTag({ name: 'description', content: config.description });

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: config.title });
    this.meta.updateTag({ property: 'og:description', content: config.description });
    if (config.image) {
      this.meta.updateTag({ property: 'og:image', content: config.image });
    }
    if (config.url) {
      this.meta.updateTag({ property: 'og:url', content: config.url });
    }

    // Twitter Card
    this.meta.updateTag({ name: 'twitter:title', content: config.title });
    this.meta.updateTag({ name: 'twitter:description', content: config.description });
    if (config.image) {
      this.meta.updateTag({ name: 'twitter:image', content: config.image });
    }

    if (config.url) {
      this.setCanonicalUrl(config.url);
    }
  }

  setCanonicalUrl(url: string) {
    const head = this.document.getElementsByTagName('head')[0];
    let element: HTMLLinkElement | null = this.document.querySelector(`link[rel='canonical']`) || null;
    if (!element) {
      element = this.document.createElement('link');
      element.setAttribute('rel', 'canonical');
      head.appendChild(element);
    }
    element.setAttribute('href', url);
  }

  setStructuredData(data: any) {
    const head = this.document.getElementsByTagName('head')[0];
    let script: HTMLScriptElement | null = this.document.querySelector(`script[type='application/ld+json']`) || null;
    if (!script) {
      script = this.document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }
}
