import { Routes } from '@angular/router';
import { authGuard } from './core/authguard/auth.guard';
import { superAdminGuard } from './core/authguard/super-admin.guard';
import { orgAdminGuard } from './core/authguard/org-admin.guard';
import { orgOwnerGuard } from './core/authguard/org-owner.guard';
import { premiumOrgGuard } from './core/authguard/premium-org.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Login - DBNexus',
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'auth/register',
    title: 'Sign Up - DBNexus',
    loadComponent: () => import('./features/auth/register/register').then(m => m.RegisterComponent)
  },
  {
    path: 'reset-password',
    title: 'Reset Password - DBNexus',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'accept-invitation',
    title: 'Accept Invitation - DBNexus',
    loadComponent: () => import('./features/auth/accept-invitation/accept-invitation').then(m => m.AcceptInvitationComponent)
  },
  {
    path: 'dashboard',
    title: 'Dashboard - DBNexus',
    loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard)
  },
  {
    path: 'diff',
    title: 'Diff Checker - DBNexus',
    loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard)
  },
  {
    path: 'profile',
    title: 'Profile - DBNexus',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile').then(m => m.ProfileComponent),
  },
  {
    // Individual user subscription management
    path: 'profile/subscription',
    title: 'Subscription - DBNexus',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/subscription/user-subscription').then(m => m.UserSubscriptionComponent),
  },
  {
    path: 'pricing',
    title: 'Pricing Plans - DBNexus',
    loadComponent: () => import('./features/pricing/pricing').then(m => m.PricingComponent)
  },
  // Super Admin Panel
  {
    path: 'admin',
    title: 'Admin - DBNexus',
    canActivate: [superAdminGuard],
    loadComponent: () => import('./features/admin/admin-layout/admin-layout').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', title: 'Admin Dashboard - DBNexus', loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent) },
      { path: 'plans', title: 'Plan Management - DBNexus', loadComponent: () => import('./features/admin/plan-management/plan-management').then(m => m.PlanManagementComponent) },
      { path: 'features', title: 'Feature Management - DBNexus', loadComponent: () => import('./features/admin/feature-management/feature-management').then(m => m.FeatureManagementComponent) },
      { path: 'organizations', title: 'Organization Management - DBNexus', loadComponent: () => import('./features/admin/organization-management/organization-management').then(m => m.OrganizationManagementComponent) },
      { path: 'users', title: 'User Management - DBNexus', loadComponent: () => import('./features/admin/user-management/user-management').then(m => m.UserManagementComponent) },
      { path: 'subscriptions', title: 'Subscription Management - DBNexus', loadComponent: () => import('./features/admin/subscription-management/subscription-management').then(m => m.SubscriptionManagementComponent) },
      { path: 'enquiries', title: 'Enquiries - DBNexus', loadComponent: () => import('./features/admin/enquiries-management/enquiries-management').then(m => m.EnquiriesManagementComponent) },
      { path: 'audit-logs', title: 'Audit Logs - DBNexus', loadComponent: () => import('./features/admin/audit-logs/audit-logs').then(m => m.AuditLogsComponent) },
      { path: 'docs', title: 'CMS Documentation - DBNexus', loadComponent: () => import('./features/admin/cms-docs/cms-docs').then(m => m.CmsDocsComponent) },
    ]
  },
  // Public Application Documentation
  {
    path: 'docs',
    title: 'Documentation - DBNexus',
    loadComponent: () => import('./features/docs/public-docs/public-docs').then(m => m.PublicDocsComponent)
  },
  {
    path: 'docs/:slug',
    title: 'Documentation - DBNexus',
    loadComponent: () => import('./features/docs/public-docs/public-docs').then(m => m.PublicDocsComponent)
  },
  // Tenant Organization Settings
  {
    path: 'organization',
    title: 'Organization - DBNexus',
    canActivate: [orgAdminGuard],
    loadComponent: () => import('./features/organization/org-layout/org-layout').then(m => m.OrgLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', title: 'Organization Dashboard - DBNexus', loadComponent: () => import('./features/organization/org-dashboard/org-dashboard').then(m => m.OrgDashboardComponent) },
      { path: 'settings', title: 'Organization Settings - DBNexus', loadComponent: () => import('./features/organization/org-settings/org-settings').then(m => m.OrgSettingsComponent) },
      { path: 'subscription', title: 'Organization Subscription - DBNexus', canActivate: [orgOwnerGuard, premiumOrgGuard], loadComponent: () => import('./features/organization/subscription/subscription').then(m => m.SubscriptionComponent) },
      { path: 'members', title: 'Team Members - DBNexus', canActivate: [premiumOrgGuard], loadComponent: () => import('./features/organization/members/members').then(m => m.MembersComponent) },
      { path: 'audit-logs', title: 'Organization Audit Logs - DBNexus', canActivate: [premiumOrgGuard], loadComponent: () => import('./features/organization/org-audit-logs/org-audit-logs.component').then(m => m.OrgAuditLogsComponent) },
    ]
  },

  {
    path: '',
    title: 'DBNexus - Database Schema Design Tool',
    loadComponent: () => import('./features/home/home').then(m => m.HomeComponent)
  },
  {
    path: 'public-diagram/:token',
    title: 'Public Diagram - DBNexus',
    canActivate: [authGuard],
    loadComponent: () => import('./features/public-viewer/public-viewer').then(m => m.PublicViewerComponent)
  },
  {
    path: '**',
    title: '404 - Page Not Found - DBNexus',
    loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFoundComponent)
  }
];
