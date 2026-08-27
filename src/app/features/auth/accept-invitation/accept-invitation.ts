import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DashboardService } from '../../../core/services/dashboard.service';
import { AuthService } from '../../../core/services/auth.service';
import { EntitlementService } from '../../../core/services/entitlement.service';
import { Icons } from '../../../core/component/icons/icons';

@Component({
  selector: 'app-accept-invitation',
  standalone: true,
  imports: [CommonModule, Icons, RouterModule],
  templateUrl: './accept-invitation.html'
})
export class AcceptInvitationComponent implements OnInit {
  workspaceId = '';
  workspaceName = '';
  isLoading = false;
  isSuccess = false;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public svc: DashboardService,
    public auth: AuthService,
    public entitlementService: EntitlementService,
    private cdr: ChangeDetectorRef
  ) {}

  
  orgId = '';
  inviteToken = '';
  isOrgInvite = false;
  invitedEmail = '';
  isRegistered = false;
  emailMismatch = false;
  isChecking = false;

  get userEmail(): string {
    return this.auth.getUserEmail();
  }

  ngOnInit(): void {
    const extractIdOrToken = () => {
      const p = this.route.snapshot.params;
      const qp = this.route.snapshot.queryParams;

      const foundId = p['id'] || p['token'] || qp['token'] || qp['id'] || qp['workspaceId'] || qp['inviteId'] || qp['invitationId'] || '';
      if (foundId) {
        this.workspaceId = foundId;
      }
      
      // Check for orgId explicitly for Organization Invitations
      if (qp['orgId']) {
        this.orgId = qp['orgId'];
        this.isOrgInvite = true;
        if (qp['token']) {
            this.inviteToken = qp['token'];
        }
      }

      if (qp['name']) {
        this.workspaceName = qp['name'];
      }
      if (qp['workspaceName']) {
        this.workspaceName = qp['workspaceName'];
      }
      if (qp['orgName']) {
        this.workspaceName = qp['orgName'];
      }

      if (this.isOrgInvite && this.orgId) {
        this.isChecking = true;
        this.svc.checkOrgInvitation(this.inviteToken || null, this.orgId).subscribe({
          next: (res: any) => {
            this.isChecking = false;
            if (res.invitation && res.invitation.email) {
              this.invitedEmail = res.invitation.email;
              if (this.auth.isLoggedIn() && this.userEmail.toLowerCase() !== this.invitedEmail.toLowerCase()) {
                this.emailMismatch = true;
              }
            }
            if (res.org && res.org.name) {
              this.workspaceName = res.org.name;
            }
            this.isRegistered = res.isRegistered || false;
            this.cdr.markForCheck();
            
            // Auto-redirect if not logged in
            if (!this.auth.isLoggedIn() || this.emailMismatch) {
              this.savePendingInvitation();
              if (this.isRegistered) {
                this.loginRequired = true;
              } else {
                this.registrationRequired = true;
              }
              this.cdr.markForCheck();
            }
          },
          error: (err) => {
            this.isChecking = false;
            this.errorMessage = 'Failed to fetch invitation details. The link may be invalid or expired.';
            this.cdr.markForCheck();
          }
        });
      } else if (!this.isOrgInvite && this.workspaceId) {
        // Workspace flow: auto-redirect if not logged in
        if (!this.auth.isLoggedIn()) {
          this.savePendingInvitation();
          this.loginRequired = true;
          this.cdr.markForCheck();
        }
      }
    };

    extractIdOrToken();

    this.route.params.subscribe(() => {
      extractIdOrToken();
      this.cdr.markForCheck();
    });
    this.route.queryParams.subscribe(() => {
      extractIdOrToken();
      this.cdr.markForCheck();
    });
  }

  loginRequired = false;
  registrationRequired = false;

  savePendingInvitation(): void {
    localStorage.setItem('pending_accept_invitation_id', this.isOrgInvite ? this.orgId : this.workspaceId);
    localStorage.setItem('pending_accept_invitation_url', this.router.url);
    localStorage.setItem('pending_accept_invitation_type', this.isOrgInvite ? 'org' : 'workspace');
    localStorage.setItem('pending_accept_invitation_token', this.inviteToken || '');
    
    if (this.isOrgInvite) {
      if (this.invitedEmail) {
        localStorage.setItem('pending_invite_email', this.invitedEmail);
      }
      
    }

    
  }

  onAcceptInvitation(): void {
    if (!this.workspaceId && !this.orgId) {
      this.errorMessage = 'No valid invitation ID found in URL.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const acceptCall = this.isOrgInvite 
        ? this.svc.acceptOrgInvitation({ token: this.inviteToken || null, orgId: this.orgId })
        : this.svc.acceptInvitation(this.workspaceId);

    acceptCall.subscribe({
      next: () => {
        this.isLoading = false;
        this.isSuccess = true;
        this.svc.showToast('Invitation accepted successfully!', 3000);
        this.entitlementService.loadEntitlements(true).subscribe();
        this.cdr.markForCheck();

        const navigateToApp = () => {
          setTimeout(() => {
            if (this.auth.isOrganizationAdmin() || this.auth.isOrganizationMember()) {
              this.router.navigate(['/organization']);
            } else {
              this.router.navigate(['/dashboard'], { queryParams: { welcome: 'true' } });
            }
          }, 1500);
        };

        if (this.isOrgInvite) {
          this.auth.getUserFeatures().subscribe({
            next: () => navigateToApp(),
            error: (err) => {
              console.error('Failed to update user features:', err);
              navigateToApp();
            }
          });
        } else {
          navigateToApp();
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Failed to accept invitation:', err);

        let errorMsg = '';
        if (err?.error) {
          try {
            const parsed = typeof err.error === 'string' ? JSON.parse(err.error) : err.error;
            errorMsg = parsed?.message || parsed?.error || (typeof err.error === 'string' ? err.error : '');
          } catch (ex) {
            if (typeof err.error === 'string') {
              errorMsg = err.error;
            }
          }
        }

        if (!errorMsg && err?.message) {
          errorMsg = err.message;
        }

        if (err?.status === 403) {
          this.errorMessage = errorMsg || 'Forbidden: You do not have permission to accept this invitation.';
        } else {
          this.errorMessage = errorMsg || 'Failed to accept invitation. The invitation link may be invalid or expired.';
        }
        this.cdr.markForCheck();
      }
    });
  }

  onDecline(): void {
    this.router.navigate(['/dashboard']);
  }
}
