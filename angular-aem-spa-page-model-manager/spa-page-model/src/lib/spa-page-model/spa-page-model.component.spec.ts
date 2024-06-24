import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpaPageModelComponent } from './spa-page-model.component';

describe('SpaPageModelComponent', () => {
    let component: SpaPageModelComponent;
    let fixture: ComponentFixture<SpaPageModelComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SpaPageModelComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(SpaPageModelComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
