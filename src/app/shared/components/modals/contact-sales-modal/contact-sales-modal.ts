import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef, NgZone, ViewEncapsulation, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EnquiryService } from '../../../../core/services/enquiry.service';
import { Icons } from '../../../../core/component/icons/icons';

@Component({
  selector: 'app-contact-sales-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Icons],
  templateUrl: './contact-sales-modal.html',
  styleUrls: ['./contact-sales-modal.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ContactSalesModalComponent implements OnInit {
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();
  
  contactForm!: FormGroup;
  isSubmitting = signal(false);
  submitSuccess = signal(false);
  submitError = signal('');
  showCountryDropdown = false;
  selectedFileName = signal('');
  isDragging = false;

  countries = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 
    'France', 'India', 'Japan', 'Brazil', 'Other'
  ];

  constructor(private fb: FormBuilder, private enquiryService: EnquiryService, private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit(): void {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      company_email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
      enquiry_type: ['Sales', Validators.required],
      project_details: ['', Validators.required],
      phone_number: ['', [Validators.required, Validators.pattern(/^[0-9\+\-\s\(\)]{10,20}$/)]],
      country: [''],
      image_url: ['']
    });
  }

  get enquiryType() {
    return this.contactForm.get('enquiry_type')?.value;
  }

  setEnquiryType(type: 'Sales' | 'Support') {
    this.contactForm.patchValue({ enquiry_type: type });
  }

  onFileChange(event: any) {
    const file = event.target.files[0];
    this.handleFile(file);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    this.handleFile(file);
  }

  handleFile(file: File | undefined | null) {
    if (file) {
      this.selectedFileName.set(file.name);
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.contactForm.patchValue({ image_url: e.target.result });
      };
      reader.readAsDataURL(file);
    } else {
      this.selectedFileName.set('');
      this.contactForm.patchValue({ image_url: '' });
    }
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.showCountryDropdown = false;
  }

  closeModal() {
    this.visible = false;
    this.submitSuccess.set(false);
    this.submitError.set('');
    this.showCountryDropdown = false;
    this.selectedFileName.set('');
    this.contactForm.reset();
    this.contactForm.patchValue({ enquiry_type: 'Sales' });
    this.contactForm.markAsUntouched();
    this.contactForm.markAsPristine();
    this.close.emit();
  }

  onSubmit() {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set('');

    const formValue = { ...this.contactForm.value };
    const nameParts = formValue.name ? formValue.name.trim().split(' ') : [];
    formValue.first_name = nameParts[0] || 'Unknown';
    formValue.last_name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ' ';
    delete formValue.name;

    this.enquiryService.submitEnquiry(formValue).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.submitSuccess.set(true);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.submitError.set(err.error?.message || 'Something went wrong. Please try again.');
      }
    });
  }
}
