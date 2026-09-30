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
  isDragging = signal(false);
  selectedFileName = signal('');
  selectedFile: File | null = null;
  enquiryType: string = 'Support';
  showCountryDropdown = false;
  countries = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
    'France', 'India', 'Japan', 'Brazil', 'Other'
  ];

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
      phone_number: ['', [Validators.required, Validators.pattern(/^(?=(?:\D*\d){10,15}\D*$)\+?[\d\s()-]+$/)]],
      country: [''],
      image_url: ['']
    });
  }

  resetForm() {
    this.submitSuccess.set(false);
    this.submitError.set('');
    this.selectedFileName.set('');
    this.selectedFile = null;
    this.enquiryType = 'Support';
    this.contactForm.reset();
    this.contactForm.patchValue({ enquiry_type: 'Support' });
    this.contactForm.markAsUntouched();
    this.contactForm.markAsPristine();
  }

  setEnquiryType(type: string) {
    this.enquiryType = type;
    this.contactForm.patchValue({ enquiry_type: type });
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.showCountryDropdown = false;
  }

  @HostListener('dragover', ['$event'])
  onDragOverGlobal(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  @HostListener('drop', ['$event'])
  onDropGlobal(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File) {
    if (file.type.startsWith('image/')) {
      this.selectedFileName.set(file.name);
      this.selectedFile = file;
      this.submitError.set('');
    } else {
      this.submitError.set('Please select an image file.');
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('The selected image could not be read.'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('The selected image could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  async onSubmit() {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set('');

    const formValue = { ...this.contactForm.value };
    try {
      if (this.selectedFile) {
        formValue.image_url = await this.readFileAsDataUrl(this.selectedFile);
      }
    } catch {
      this.isSubmitting.set(false);
      this.submitError.set('Could not read the selected image. Please choose it again.');
      return;
    }

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
