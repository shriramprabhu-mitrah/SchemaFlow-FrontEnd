import { Routes } from '@angular/router';
import { authGuard } from './core/authguard/auth.guard';
import { superAdminGuard } from './core/authguard/super-admin.guard';
import { orgAdminGuard } from './core/authguard/org-admin.guard';
import { orgOwnerGuard } from './core/authguard/org-owner.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.RegisterComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPasswordComponent)
  },
  { path: 'accept-invitation', loadComponent: () => import('./features/auth/accept-invitation/accept-invitation').then(m => m.AcceptInvitationComponent) },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard)
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile').then(m => m.ProfileComponent),
  },
  {
    // Individual user subscription management
    path: 'profile/subscription',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/subscription/user-subscription').then(m => m.UserSubscriptionComponent),
  },
  {
    path: 'pricing',
    loadComponent: () => import('./features/pricing/pricing').then(m => m.PricingComponent)
  },
  // Super Admin Panel
  {
    path: 'admin',
    canActivate: [superAdminGuard],
    loadComponent: () => import('./features/admin/admin-layout/admin-layout').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent) },
      { path: 'plans', loadComponent: () => import('./features/admin/plan-management/plan-management').then(m => m.PlanManagementComponent) },
      { path: 'features', loadComponent: () => import('./features/admin/feature-management/feature-management').then(m => m.FeatureManagementComponent) },
      { path: 'organizations', loadComponent: () => import('./features/admin/organization-management/organization-management').then(m => m.OrganizationManagementComponent) },
      { path: 'users', loadComponent: () => import('./features/admin/user-management/user-management').then(m => m.UserManagementComponent) },
      { path: 'subscriptions', loadComponent: () => import('./features/admin/subscription-management/subscription-management').then(m => m.SubscriptionManagementComponent) },
      { path: 'audit-logs', loadComponent: () => import('./features/admin/audit-logs/audit-logs').then(m => m.AuditLogsComponent) },
    ]
  },
  // Tenant Organization Settings
  {
    path: 'organization',
    canActivate: [orgAdminGuard],
    loadComponent: () => import('./features/organization/org-layout/org-layout').then(m => m.OrgLayoutComponent),
    children: [
      { path: '', redirectTo: 'settings', pathMatch: 'full' },
      { path: 'settings', loadComponent: () => import('./features/organization/org-settings/org-settings').then(m => m.OrgSettingsComponent) },
      { path: 'subscription', canActivate: [orgOwnerGuard], loadComponent: () => import('./features/organization/subscription/subscription').then(m => m.SubscriptionComponent) },
      { path: 'members', loadComponent: () => import('./features/organization/members/members').then(m => m.MembersComponent) },
      { path: 'roles', loadComponent: () => import('./features/organization/roles/roles').then(m => m.RolesComponent) },
    ]
  },
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.HomeComponent)
  },
  {
    path: 'public-diagram/:token',
    loadComponent: () => import('./features/public-viewer/public-viewer').then(m => m.PublicViewerComponent)
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFoundComponent)
  }
];
