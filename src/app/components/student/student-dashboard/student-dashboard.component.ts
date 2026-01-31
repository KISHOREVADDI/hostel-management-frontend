import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-student-dashboard',
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.css']
})
export class StudentDashboardComponent implements OnInit {
  student: any = null;
  history: any[] = [];
  permission: any = { type: 'OUTING', reason: '', proofImage: '' };
  showApply = false;
  showQR = false;
  selectedLetter: any = null;

  // Sidebar State
  isSidebarOpen: boolean = false;

  // Navigation
  activeTab = 'profile';

  constructor(private http: HttpClient, public authService: AuthService) { }

  // Polling
  private statusInterval: any;

  // Complaints
  complaints: any[] = [];
  newComplaint = {
    category: 'MAINTENANCE',
    description: '',
    roomNo: '',
    block: '',
    hostelId: '',
    proofImage: ''
  };
  isSubmittingComplaint = false;

  ngOnInit() {
    this.loadProfile();
    // Poll for status updates every 30 seconds
    this.statusInterval = setInterval(() => {
      this.loadProfile();
    }, 30000);
  }

  onProofSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.newComplaint.proofImage = e.target.result.split(',')[1]; // Store Base64 only
      };
      reader.readAsDataURL(file);
    }
  }

  loadProfile() {
    const pin = localStorage.getItem('username');
    const token = this.authService.getToken();

    if (pin) {
      this.http.get(`https://hostelmanagement-backend-1-no3d.onrender.com/api/student/${pin}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe(data => {
        this.student = data;
        this.loadHistory(pin);
        this.loadComplaints(pin); // Load complaints
      });
    }
  }

  loadComplaints(pin: string) {
    const token = this.authService.getToken();
    this.http.get<any[]>(`https://hostelmanagement-backend-1-no3d.onrender.com/api/complaints/student/${pin}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (data) => this.complaints = data,
      error: (err) => console.error("Error loading complaints", err)
    });
  }

  submitComplaint() {
    if (!this.newComplaint.description.trim()) {
      this.showNotification('Please describe your issue.', 'error');
      return;
    }

    const pin = localStorage.getItem('username');
    const token = this.authService.getToken();
    this.isSubmittingComplaint = true;

    this.http.post(`https://hostelmanagement-backend-1-no3d.onrender.com/api/complaints/${pin}`, this.newComplaint, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (res) => {
        this.showNotification('Complaint submitted successfully!', 'success');
        this.newComplaint = {
          category: 'MAINTENANCE',
          description: '',
          roomNo: '',
          block: '',
          hostelId: '',
          proofImage: ''
        };
        this.isSubmittingComplaint = false;
        this.loadComplaints(pin!);
      },
      error: (err) => {
        this.showNotification('Failed to submit complaint.', 'error');
        this.isSubmittingComplaint = false;
      }
    });
  }

  getCompliaintStatusColor(status: string): string {
    switch (status) {
      case 'OPEN': return '#3498db'; // Blue
      case 'IN_PROGRESS': return '#f39c12'; // Orange
      case 'RESOLVED': return '#2ecc71'; // Green
      case 'REJECTED': return '#e74c3c'; // Red
      default: return '#95a5a6';
    }
  }

  loadHistory(pin: string) {
    const token = this.authService.getToken();
    this.http.get<any[]>(`https://hostelmanagement-backend-1-no3d.onrender.com/api/student/history/${pin}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(data => this.history = data);
  }

  // Notification State
  notification = { message: '', type: '', show: false };

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.permission.proofImage = e.target.result; // Base64
      };
      reader.readAsDataURL(file);
    }
  }

  applyPermission() {
    const pin = localStorage.getItem('username');
    const token = this.authService.getToken();

    if (!this.permission.reason) {
      this.showNotification('Please provide a reason', 'error');
      return;
    }



    this.http.post(`https://hostelmanagement-backend-1-no3d.onrender.com/api/student/apply/${pin}`, this.permission, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.showNotification('Application Submitted Successfully', 'success');
        this.showApply = false;
        this.loadHistory(pin!);
        this.loadProfile(); // Reload profile to update status if auto-approved
        this.permission = { type: 'OUTING', reason: '', proofImage: '' }; // Reset form
      },
      error: () => {
        this.showNotification('Failed to submit application', 'error');
      }
    });
  }

  showNotification(msg: string, type: string) {
    this.notification = { message: msg, type: type, show: true };
    setTimeout(() => {
      this.notification.show = false;
    }, 3000);
  }

  openLetter(letter: any) {
    this.selectedLetter = letter;
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  downloadQR() {
    if (this.student && this.student.qrCode) {
      const link = document.createElement('a');
      link.href = 'data:image/png;base64,' + this.student.qrCode;
      link.download = `GGU_Student_${this.student.collegePin}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  getFormattedStatus(status: string): string {
    if (!status) return '';
    return status.replace(/_/g, ' ');
  }
}
