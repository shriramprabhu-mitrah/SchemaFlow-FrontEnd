import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef, NgZone, ViewEncapsulation, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EnquiryService } from '../../../../core/services/enquiry.service';

@Component({
  selector: 'app-contact-sales-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './contact-sales-modal.html',
  styleUrls: ['./contact-sales-modal.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ContactSalesModalComponent implements OnInit {
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();
  
  contactForm!: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitError = '';
  showCountryDropdown = false;

  countries = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 
    'France', 'India', 'Japan', 'Brazil', 'Other'
  ];

  constructor(private fb: FormBuilder, private enquiryService: EnquiryService, private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit(): void {
    this.contactForm = this.fb.group({
      contact_type: ['email_me', Validators.required],
      project_details: [''],
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      company_email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
      phone_number: ['', [Validators.required, Validators.pattern(/^[0-9\+\-\s\(\)]{10,20}$/)]],
      country: ['']
    });
  }

  get contactType() {
    return this.contactForm.get('contact_type')?.value;
  }

  setContactType(type: 'email_me' | 'book_call') {
    this.contactForm.patchValue({ contact_type: type });
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.showCountryDropdown = false;
  }

  closeModal() {
    this.visible = false;
    this.submitSuccess = false;
    this.submitError = '';
    this.showCountryDropdown = false;
    this.contactForm.reset();
    this.contactForm.patchValue({ contact_type: 'email_me' });
    this.contactForm.markAsUntouched();
    this.contactForm.markAsPristine();
    this.close.emit();
  }

  onSubmit() {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    this.enquiryService.submitEnquiry(this.contactForm.value).subscribe({
      next: () => {
        this.ngZone.run(() => {
          setTimeout(() => {
            this.isSubmitting = false;
            this.submitSuccess = true;
            this.cdr.detectChanges();
          }, 0);
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          setTimeout(() => {
            this.isSubmitting = false;
            this.submitError = err.error?.message || 'Something went wrong. Please try again.';
            this.cdr.detectChanges();
          }, 0);
        });
      }
    });
  }
}
