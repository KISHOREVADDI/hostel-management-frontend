import { Component, EventEmitter, Output } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-add-student',
  templateUrl: './add-student.component.html',
  styleUrls: ['./add-student.component.css']
})
export class AddStudentComponent {
  @Output() close = new EventEmitter<void>();

  student: any = {
    name: '',
    collegePin: '',
    hostelId: '',
    block: '',
    roomNo: '',
    password: '',
    gender: 'MALE',
    branch: '',
    department: '',
    currentYear: '',
    parentMobileNumber: '',
    village: '',
    mandal: '',
    district: '',
    state: '',
    country: '',
    profileImage: '',
    status: 'IN_HOSTEL' // Default status
  };

  constructor(private http: HttpClient, private authService: AuthService, private toastService: ToastService) { }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.student.profileImage = e.target.result; // Base64
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit() {
    const token = this.authService.getToken();
    this.http.post('https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/student', this.student, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (res) => {
        this.toastService.show('Student added successfully!', 'success');
        // Reset form
        this.student = { ...this.student, name: '', collegePin: '', password: '' };
      },
      error: (err) => this.toastService.show('Error adding student', 'error')
    });
  }

  closeCard() {
    this.close.emit();
  }
}
