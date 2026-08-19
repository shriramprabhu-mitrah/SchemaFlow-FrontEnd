import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Icons } from './icons';

describe('Icons', () => {
  let component: Icons;
  let fixture: ComponentFixture<Icons>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Icons],
    }).compileComponents();

    fixture = TestBed.createComponent(Icons);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a registered icon when a name is provided', () => {
    component.name = 'arrow-right';
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});
