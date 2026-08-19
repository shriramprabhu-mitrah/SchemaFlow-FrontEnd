import { Component, ChangeDetectorRef, Inject, PLATFORM_ID, afterNextRender, NgZone, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../core/layout/header/header';
import { LoaderComponent } from '../../shared/loader/loader';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, LoaderComponent],
  templateUrl: './profile.html'
})
export class ProfileComponent {
  displayName = signal<string>('');
  email = signal<string>('');

  previewUrl = signal<SafeUrl | null>(null);
  base64Image = signal<string | null>(null);
  showSuccessMessage = signal<boolean>(false);
  showErrorMessage = signal<boolean>(false);
  errorMessage = signal<string>('');
  
  isLoading = signal<boolean>(false);
  loadingText = signal<string>('Loading...');

  constructor(
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private auth: AuthService,
    private location: Location,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    afterNextRender(() => {
      this.ngZone.run(() => {
        this.fetchUserDetails();
      });
    });
  }

  fetchUserDetails(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedEmail = localStorage.getItem('profile_email');
      if (savedEmail) {
        this.email.set(savedEmail);
      }
      
      this.isLoading.set(true);
      this.loadingText.set('Loading profile...');
      this.auth.getUserDetails().subscribe({
        next: (res) => {
          this.isLoading.set(false);
          const user = res?.data || res;
          if (user) {
            this.displayName.set(user.username || user.userName || user.name || '');
            this.email.set(user.email || this.email());
            const profilePic = user.profilepicture || user.profilePicture;
            if (profilePic) {
              this.previewUrl.set(this.sanitizer.bypassSecurityTrustUrl(profilePic));
              this.base64Image.set(profilePic);
            }
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error('Failed to get user details:', err);
        }
      });
    }
  }

  saveProfile(): void {
    const payload = {
      userName: this.displayName(),
      profilePicture: this.base64Image()
    };

    this.isLoading.set(true);
    this.loadingText.set('Saving profile...');
    this.auth.updateProfile(payload).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const newPic = res?.data?.profilepicture || res?.data?.profilePicture;
        if (newPic) {
          this.auth.setUserProfilePicture(newPic);
        }
        this.showSuccessMessage.set(true);
        setTimeout(() => {
          this.showSuccessMessage.set(false);
          this.location.back();
        }, 1500);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Failed to update profile:', err);
        const msg = err?.error?.message || err?.message || 'Failed to update profile.';
        this.errorMessage.set(msg);
        this.showErrorMessage.set(true);
        setTimeout(() => {
          this.showErrorMessage.set(false);
        }, 3000);
      }
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      this.previewUrl.set(this.sanitizer.bypassSecurityTrustUrl(objectUrl));

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.base64Image.set(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  goBack(): void {
    this.location.back();
  }


}
