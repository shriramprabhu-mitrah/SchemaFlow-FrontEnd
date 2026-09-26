import { NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { iconRegistry } from './generated-icons';

@Component({
  standalone: true,
  selector: 'app-icons',
  imports: [NgIf],
  templateUrl: './icons.html',
})
export class Icons {
  @Input() name = '';
  @Input() size = '24';
  @Input() color = 'currentColor';

  public iconMarkup: SafeHtml | null = null;

  constructor(private readonly sanitizer: DomSanitizer) { }

  get sizeAsNumber(): number {
    const value = Number(this.size);
    return Number.isFinite(value) && value > 0 ? value : 24;
  }

  ngOnChanges(): void {
    this.renderIcon();
  }

  private renderIcon(): void {
    const svgMarkup = iconRegistry[this.name] ?? '';

    if (!svgMarkup) {
      this.iconMarkup = null;
      return;
    }

    let replacedMarkup = svgMarkup;
    if (this.color && this.color !== 'preserve' && this.color !== 'original' && this.color !== 'none') {
      replacedMarkup = svgMarkup
        .replace(/stroke="(?!none\b)[^"]*"/g, `stroke="${this.color}"`)
        .replace(/fill="(?!none\b)[^"]*"/g, `fill="${this.color}"`);
    }

    // Parse the <svg> opening tag specifically to inject/update width and height
    const svgTagMatch = replacedMarkup.match(/<svg([^>]*)>/);
    if (svgTagMatch) {
      let attrs = svgTagMatch[1];
      // Remove any existing width or height attributes from the <svg> tag specifically
      attrs = attrs.replace(/(?<=\s|^)width="[^"]*"\s*/g, '').replace(/(?<=\s|^)height="[^"]*"\s*/g, '');
      // Add the new width and height attributes
      let calculatedWidth = this.sizeAsNumber;
      const viewBoxMatch = attrs.match(/viewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/);
      if (viewBoxMatch) {
        const vbWidth = parseFloat(viewBoxMatch[3]);
        const vbHeight = parseFloat(viewBoxMatch[4]);
        if (vbWidth > 0 && vbHeight > 0) {
          calculatedWidth = Math.round(this.sizeAsNumber * (vbWidth / vbHeight));
        }
      }

      attrs = ` width="${calculatedWidth}" height="${this.sizeAsNumber}"` + (attrs.startsWith(' ') ? attrs : ' ' + attrs);
      replacedMarkup = replacedMarkup.replace(/<svg[^>]*>/, `<svg${attrs}>`);
    }

    this.iconMarkup = this.sanitizer.bypassSecurityTrustHtml(replacedMarkup);
  }
}
