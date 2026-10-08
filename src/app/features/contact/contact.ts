import { Component, OnInit, ViewEncapsulation, HostListener, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { EnquiryService } from '../../core/services/enquiry.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { SeoService } from '../../core/services/seo.service';
import { Icons } from '../../core/component/icons/icons';
import { ButtonComponent } from '../../shared/button/button';
import { Footer } from '../../shared/components/footer/footer';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, Icons, ButtonComponent, Footer],
  templateUrl: './contact.html',
  styleUrls: ['./contact.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ContactComponent implements OnInit {

  isFeaturesDropdownOpen = false;

  toggleFeaturesDropdown(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.isFeaturesDropdownOpen = !this.isFeaturesDropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  closeFeaturesDropdownOnGlobalClick(event: Event): void {
    this.isFeaturesDropdownOpen = false;
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.isFeaturesDropdownOpen) {
      this.isFeaturesDropdownOpen = false;
    }
  }


  @ViewChild('fileUploadInput') fileUploadInput?: ElementRef<HTMLInputElement>;

  isLoggedIn = false;
  isMobileMenuOpen = false;

  contactForm!: FormGroup;
  isSubmitting = signal(false);
  submitSuccess = signal(false);
  submitError = signal('');
  isDragging = signal(false);
  selectedFileName = signal('');
  selectedFile: File | null = null;
  enquiryType: string = 'Sales';
  showCountryDropdown = false;
  countries = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
    'France', 'India', 'Japan', 'Brazil', 'Other'
  ];

  private fb = inject(FormBuilder);
  private enquiryService = inject(EnquiryService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private svc = inject(DashboardService);
  private seoService = inject(SeoService);

  ngOnInit(): void {
    this.seoService.updateTags({
      title: 'Contact the dbNexus Team - dbNexus',
      description: 'Contact the dbNexus team for sales inquiries, enterprise solutions, technical help, or documentation.',
      url: 'https://dbnexus.up.railway.app/contact'
    });

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
      this.isLoggedIn = this.auth.isLoggedIn();
    }

    const typeParam = this.route.snapshot.queryParamMap.get('type');
    if (typeParam && (typeParam.toLowerCase() === 'sales' || typeParam.toLowerCase() === 'support')) {
      this.enquiryType = typeParam.charAt(0).toUpperCase() + typeParam.slice(1).toLowerCase();
    } else {
      this.enquiryType = 'Sales';
    }

    this.contactForm = this.fb.group({
      company_email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      company_name: [''],
      subject: [''],
      project_details: ['', Validators.required],
      enquiry_type: [this.enquiryType], 
      phone_number: ['', [Validators.required, Validators.pattern(/^(?=(?:\D*\d){10,15}\D*$)\+?[\d\s()-]+$/)]],
      country: [''],
      image_url: ['']
    });
  }

  
  isMobileFeaturesDropdownOpen = false;

  toggleMobileFeaturesDropdown(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.isMobileFeaturesDropdownOpen = !this.isMobileFeaturesDropdownOpen;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  onCreateDiagram(): void {
    if (this.isLoggedIn) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/dashboard'], { queryParams: { sample: 'true' } });
    }
  }

  logout(): void {
    this.auth.logout();
    this.isLoggedIn = false;
    this.svc.showToast('Logged out successfully.', 2500, 'success');
  }

  resetForm() {
    this.submitSuccess.set(false);
    this.submitError.set('');
    this.selectedFileName.set('');
    this.selectedFile = null;
    if (this.fileUploadInput?.nativeElement) {
      this.fileUploadInput.nativeElement.value = '';
    }
    this.enquiryType = 'Sales';
    this.contactForm.reset();
    this.contactForm.patchValue({
      enquiry_type: 'Sales',
      first_name: '',
      last_name: '',
      company_email: '',
      phone_number: '',
      company_name: '',
      subject: '',
      project_details: '',
      country: '',
      image_url: ''
    });
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
      next: (res: any) => {
        this.isSubmitting.set(false);
        this.resetForm();
        this.svc.showToast(res?.message || 'Your inquiry has been submitted successfully! We will get back to you shortly.', 4000, 'success');
      },
      error: (err: any) => {
        this.isSubmitting.set(false);
        const errMsg = err?.error?.message || 'Something went wrong. Please try again.';
        this.submitError.set(errMsg);
        this.svc.showToast(errMsg, 4000, 'error');
      }
    });
  }
}
