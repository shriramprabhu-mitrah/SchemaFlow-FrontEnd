import { Component, OnInit, ChangeDetectorRef, NgZone, ViewEncapsulation, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EnquiryService } from '../../core/services/enquiry.service';
import { Icons } from '../../core/component/icons/icons';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Icons],
  templateUrl: './contact.html',
  styleUrls: ['./contact.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ContactComponent implements OnInit {
  
  contactForm!: FormGroup;
  isSubmitting = signal(false);
  submitSuccess = signal(false);
  submitError = signal('');

  constructor(private fb: FormBuilder, private enquiryService: EnquiryService) {}

  ngOnInit(): void {
    this.contactForm = this.fb.group({
      company_email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      company_name: [''],
      subject: [''],
      project_details: ['', Validators.required],
      // Required by backend but we can hardcode or leave blank if we remove them from UI
      enquiry_type: ['Support'], 
      phone_number: ['0000000000'],
      country: [''],
      image_url: ['']
    });
  }

  resetForm() {
    this.submitSuccess.set(false);
    this.submitError.set('');
    this.contactForm.reset();
    this.contactForm.patchValue({ enquiry_type: 'Support', phone_number: '0000000000' });
    this.contactForm.markAsUntouched();
    this.contactForm.markAsPristine();
  }

  onSubmit() {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set('');

    const formValue = { ...this.contactForm.value };

    this.enquiryService.submitEnquiry(formValue).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.submitSuccess.set(true);
      },
      error: (err: any) => {
        this.isSubmitting.set(false);
        this.submitError.set(err.error?.message || 'Something went wrong. Please try again.');
      }
    });
  }
}
