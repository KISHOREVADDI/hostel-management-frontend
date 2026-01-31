import { Component } from '@angular/core';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
    selector: 'app-toast',
    templateUrl: './toast.component.html',
    styleUrls: ['./toast.component.css']
})
export class ToastComponent {
    toasts$ = this.toastService.toasts$;

    constructor(public toastService: ToastService) { }

    remove(id: number) {
        if (id !== undefined) {
            this.toastService.remove(id);
        }
    }
}
