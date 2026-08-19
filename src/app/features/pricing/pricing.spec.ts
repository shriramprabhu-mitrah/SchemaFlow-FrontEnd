import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PricingComponent } from './pricing';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('PricingComponent', () => {
  let component: PricingComponent;
  let fixture: ComponentFixture<PricingComponent>;
  let mockRouter: any;
  let mockAuth: any;
  let mockDashboardService: any;

  beforeEach(async () => {
    mockRouter = {
      navigate: vi.fn()
    };
    mockAuth = {
      isLoggedIn: vi.fn().mockReturnValue(false),
      logout: vi.fn()
    };
    mockDashboardService = {
      showToast: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [PricingComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuth },
        { provide: DashboardService, useValue: mockDashboardService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PricingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle billing cycle', () => {
    expect(component.isAnnual).toBe(true);
    component.toggleBilling(false);
    expect(component.isAnnual).toBe(false);
    component.toggleBilling(true);
    expect(component.isAnnual).toBe(true);
  });
});
