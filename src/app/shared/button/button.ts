import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.html',
  host: {
    'style': 'display: contents;'
  }
})
export class ButtonComponent {
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() variant: string = 'default';
  @Input() disabled = false;
  @Input() tooltip?: string;
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' = 'top';
  @Input() id?: string;
  @Input() customClass?: string;

  @Output() onClick = new EventEmitter<MouseEvent>();

  handleClick(e: MouseEvent): void {
    if (!this.disabled) {
      this.onClick.emit(e);
    }
  }
}
