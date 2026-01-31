import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { BarcodeFormat } from '@zxing/library';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  activeTab: string = 'dashboard';
  students: any[] = [];
  permissions: any[] = [];
  history: any[] = [];

  // Scanner Logic
  scan = { pin: '', message: '' };
  showScannerModal = false;
  showLetterModal = false;
  scannedData: any = null;
  allowedFormats = [BarcodeFormat.QR_CODE];
  scanStatus = 'PENDING'; // 'PENDING', 'SUCCESS'
  isSidebarOpen = false;
  isScanning = false; // Debounce flag

  availableDevices: MediaDeviceInfo[] = [];
  currentDevice: MediaDeviceInfo | undefined;
  hasDevices: boolean | null = null;
  hasPermission: boolean | null = null;

  // Detail View
  selectedStudent: any = null;

  // Filter State
  statusFilter: string = '';

  // Room Availability Categories
  boysRooms: any[] = [];
  girlsRooms: any[] = [];
  acRooms: any[] = [];

  // Room Detail Modal
  selectedRoom: any = null;
  roomOccupants: any[] = [];

  // Debug Variables
  allRoomsDebug: any[] = [];
  uniqueHostelIds: string[] = [];
  fetchError: string = '';

  // New View State
  selectedHostelView: string | null = null; // 'BOYS', 'GIRLS', 'AC'

  selectHostelView(view: string) {
    this.selectedHostelView = view;
  }

  clearHostelView() {
    this.selectedHostelView = null;
  }

  loadRoomAvailability() {
    const token = this.authService.getToken();

    // 1. Fetch ALL Students first to ensure accurate occupancy calculation
    this.http.get<any[]>('https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/students', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (allStudents) => {
        // Save to cache for modal usage
        this.allStudentsCache = allStudents || [];

        // 2. Then Fetch Rooms
        this.http.get<any[]>('https://hostelmanagement-backend-1-no3d.onrender.com/api/rooms', {
          headers: { Authorization: `Bearer ${token}` }
        }).subscribe({
          next: (roomsData) => {
            // Debugging
            this.allRoomsDebug = roomsData;
            this.uniqueHostelIds = [...new Set(roomsData.map(r => r.hostelId))];
            console.log('Fetched Rooms (Silent Refresh):', roomsData.length);

            // Create Map for easy lookup and processing
            // Key: Block-RoomNo (Assuming Blocks are unique across hostels: A,B for Boys, C,D for Girls)
            const map = new Map<string, any>();

            roomsData.forEach(r => {
              // Use Block-RoomNo as key to allow status/ID flexibility
              const key = `${r.block}-${r.roomNo}`;
              map.set(key, { ...r, occupants: 0, status: 'AVAILABLE' });
            });

            // Calculate Occupancy using FRESH allStudents list
            if (allStudents) {
              allStudents.forEach(s => {
                // Match by Location (Block + Room), ignore ID mismatch
                if (s.status === 'IN_HOSTEL' && s.block && s.roomNo) {
                  const key = `${s.block}-${s.roomNo}`;
                  if (map.has(key)) {
                    const room = map.get(key);
                    room.occupants++;
                  }
                }
              });
            }

            // Update Status
            map.forEach(room => {
              room.status = room.occupants >= room.capacity ? 'FULL' : 'AVAILABLE';
            });

            // Sort and Segregate
            const allRooms = Array.from(map.values()).sort((a, b) => {
              // Sort by Block then Room No
              if (a.block !== b.block) return a.block.localeCompare(b.block);
              // Numeric sort for room numbers if possible
              const roomA = parseInt(a.roomNo) || 0;
              const roomB = parseInt(b.roomNo) || 0;
              if (roomA !== roomB) return roomA - roomB;
              return a.roomNo.localeCompare(b.roomNo);
            });

            this.boysRooms = allRooms.filter(r => ['A', 'B'].includes(r.block));
            this.girlsRooms = allRooms.filter(r => ['C', 'D'].includes(r.block));
            this.acRooms = allRooms.filter(r => ['E'].includes(r.block));
          },
          error: (err) => {
            console.error('Failed to load rooms', err);
            // Silent fail or console log only as per request
          }
        });
      },
      error: (err) => {
        console.error('Failed to load students for occupancy', err);
      }
    });
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.isSidebarOpen = false; // Close sidebar on mobile

    if (tab === 'attendance') {
      this.loadAttendance(new Date());
    } else if (tab === 'complaints') {
      this.loadAllComplaints();
    }
  }

  // Attendance
  attendanceList: any[] = [];
  attendanceGender: string = 'MALE';
  attendanceDate: string = new Date().toISOString().split('T')[0];
  attendanceDay: string = ''; // Stores day name (e.g., 'Monday')
  attendanceHistory: any[] = [];
  attendanceSearchText: string = ''; // Search filter

  // History Feature
  showAttendanceHistory: boolean = false;
  historySearchPin: string = '';
  studentHistory: any[] = [];
  isStudentHistoryMode: boolean = false;

  constructor(public authService: AuthService, private http: HttpClient, private toastService: ToastService) {
    this.updateDayName();
  }

  ngOnInit() {
    // Load initial stats
    // Assuming checkScreenSize and loadStats are methods that need to be added or already exist
    // For now, I'll just add the calls as requested.
    // If they don't exist, you'll need to define them.
    // this.checkScreenSize(); // This method is not in the original code, will cause error if not added.
    // this.loadStats(); // This method is not in the original code, will cause error if not added.
    this.loadPermissions();
    this.loadHistory(); // Load permission history
  }

  // Attendance Methods
  setAttendanceGender(gender: string) {
    this.attendanceGender = gender;
    this.loadAttendance();
  }

  onDateChange(newDate: string) {
    this.attendanceDate = newDate;
    this.updateDayName();
    this.loadAttendance();
    this.showAttendanceHistory = false; // Switch back to list view on date change
  }

  updateDayName() {
    const date = new Date(this.attendanceDate);
    this.attendanceDay = date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  loadAttendance(date: Date = new Date()) {
    const dateString = date.toISOString().split('T')[0];
    this.attendanceDate = dateString;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    this.attendanceDay = days[date.getDay()];

    const token = this.authService.getToken();
    this.http.get<any[]>(`https://hostelmanagement-backend-1-no3d.onrender.com/api/attendance?date=${dateString}&gender=${this.attendanceGender}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (data) => {
        this.attendanceList = data;
      },
      error: (err) => console.error('Error loading attendance', err)
    });
  }

  loadAttendanceHistory() {
    const token = this.authService.getToken();
    this.http.get<any[]>(`https://hostelmanagement-backend-1-no3d.onrender.com/api/attendance/history`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (data) => {
        // Data is typically [date, presentCount, absentCount]
        this.attendanceHistory = data;
        this.showAttendanceHistory = true;
        this.isStudentHistoryMode = false; // Reset to daily summary view
      },
      error: (err) => console.error('Failed to load history', err)
    });
  }

  searchStudentHistory() {
    if (!this.historySearchPin.trim()) {
      this.toastService.show('Please enter a PIN number', 'error');
      return;
    }

    const token = this.authService.getToken();
    this.http.get<any[]>(`https://hostelmanagement-backend-1-no3d.onrender.com/api/attendance/student/${this.historySearchPin}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (data) => {
        this.studentHistory = data;
        this.isStudentHistoryMode = true;
      },
      error: (err) => {
        console.error('Failed to load student history', err);
        // If 404, it might mean the endpoint doesn't exist yet (backend not restarted) or student not found
        this.toastService.show('Student not found or Backend not updated. Please restart server.', 'error');
      }
    });
  }

  resetHistoryView() {
    this.isStudentHistoryMode = false;
    this.historySearchPin = '';
    this.studentHistory = [];
  }

  viewHistoryDate(date: string) {
    this.attendanceDate = date;
    this.updateDayName();
    this.showAttendanceHistory = false;
    this.loadAttendance();
  }

  markPresent(record: any) {
    record.status = 'PRESENT';
  }

  markAbsent(record: any) {
    record.status = 'ABSENT';
  }

  toggleAttendanceStatus(record: any) {
    // Deprecated in favor of explicit buttons, but kept for compatibility if needed
    record.status = record.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';
  }

  markAll(status: string) {
    this.filteredAttendanceList.forEach(record => record.status = status);
  }

  attendanceHostelId: string = ''; // Filter by Hostel ID

  get filteredAttendanceList() {
    let list = this.attendanceList;

    // Filter by Search Text (Name/PIN)
    if (this.attendanceSearchText) {
      const lower = this.attendanceSearchText.toLowerCase();
      list = list.filter(item =>
        item.student.name.toLowerCase().includes(lower) ||
        item.student.collegePin.toLowerCase().includes(lower)
      );
    }

    // Filter by Hostel ID
    if (this.attendanceHostelId) {
      const lowerHostel = this.attendanceHostelId.toLowerCase();
      list = list.filter(item =>
        item.student.hostelId && item.student.hostelId.toLowerCase().includes(lowerHostel)
      );
    }

    return list;
  }

  saveAttendance() {
    const token = this.authService.getToken();
    this.http.post(`https://hostelmanagement-backend-1-no3d.onrender.com/api/attendance`, this.attendanceList, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => this.toastService.show('Attendance saved successfully!', 'success'),
      error: () => this.toastService.show('Failed to save attendance', 'error')
    });
  }

  showTab(tab: string) {
    this.activeTab = tab;
    // Reset status filter when switching main tabs
    this.statusFilter = '';

    if (tab === 'boys') this.loadStudents('MALE');
    if (tab === 'girls') this.loadStudents('FEMALE');
    if (tab === 'rooms') {
      this.selectedHostelView = null; // Reset to landing page
      // Load BOTH lists to get full picture is tricky without backend change
      // We will default to loading MALE for now as base, or ideally call a new getAllStudents endpoint.
      // Let's use getStudents with no params to get ALL.
      this.loadAllStudentsForRooms();
    }
    if (tab === 'permissions') this.loadPermissions();
    if (tab === 'history') this.loadHistory();
    if (tab === 'attendance') this.loadAttendance();
  }

  // Filter Change Handler
  onStatusFilterChange() {
    if (this.activeTab === 'boys') this.loadStudents('MALE');
    if (this.activeTab === 'girls') this.loadStudents('FEMALE');
  }

  loadStudents(gender: string) {
    const token = this.authService.getToken();
    let url = `https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/students?gender=${gender}`;

    if (this.statusFilter) {
      url += `&status=${this.statusFilter}`;
    }

    this.http.get<any[]>(url, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(data => this.students = data);
  }

  loadAllStudentsForRooms() {
    const token = this.authService.getToken();
    this.http.get<any[]>(`https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/students`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (data) => {
        this.students = data;
        this.loadRoomAvailability();
      },
      error: (err) => {
        console.error('Failed to load students for rooms:', err);
        this.toastService.show('Failed to sync student data. Showing default rooms.', 'error');
        // Still load rooms so the grid is not empty
        this.loadRoomAvailability();
      }
    });
  }

  loadPermissions() {
    const token = this.authService.getToken();
    this.http.get<any[]>(`https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/permissions`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(data => this.permissions = data);
  }

  loadHistory() {
    const token = this.authService.getToken();
    this.http.get<any[]>(`https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/history`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(data => this.history = data);
  }

  approve(id: number) {
    const token = this.authService.getToken();
    this.http.post(`https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/approve/${id}`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(() => { this.loadPermissions(); this.loadHistory(); });
  }

  reject(id: number) {
    const token = this.authService.getToken();
    this.http.post(`https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/reject/${id}`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(() => { this.loadPermissions(); this.loadHistory(); });
  }

  // Permission Letter View
  viewingLetter: string | null = null;

  viewLetter(proofImage: string) {
    if (proofImage) {
      this.viewingLetter = proofImage;
    } else {
      this.toastService.show('No letter attached', 'warning');
    }
  }

  closeLetter() {
    this.viewingLetter = null;
  }

  // Handle Real QR Scan
  onCodeResult(resultString: string) {
    if (resultString) {
      this.processScan(resultString);
    }
  }

  // Camera Device Handling
  onCamerasFound(devices: MediaDeviceInfo[]): void {
    console.log('Cameras found:', devices);
    this.availableDevices = devices;
    this.hasDevices = Boolean(devices && devices.length);

    if (this.hasDevices) {
      // Try to find a back camera
      const backCamera = devices.find(device =>
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );

      // Use back camera if found, otherwise use the first available device
      this.currentDevice = backCamera || devices[0];
      console.log('Selected device:', this.currentDevice.label);
    } else {
      console.warn('No cameras found.');
    }
  }

  onDeviceSelectChange(selectedStr: string) {
    const device = this.availableDevices.find(x => x.deviceId === selectedStr);
    if (device) this.currentDevice = device;
  }

  // Complaints
  complaintsList: any[] = [];
  selectedProofImage: string | null = null;

  loadAllComplaints() {
    const token = this.authService.getToken();
    this.http.get<any[]>('https://hostelmanagement-backend-1-no3d.onrender.com/api/complaints', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (data) => this.complaintsList = data,
      error: (err) => console.error('Error loading complaints', err)
    });
  }

  updateComplaintStatus(id: number, status: string) {
    const token = this.authService.getToken();
    this.http.put(`https://hostelmanagement-backend-1-no3d.onrender.com/api/complaints/${id}/status?status=${status}`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.loadAllComplaints(); // Refresh list
      },
      error: (err) => console.error('Error updating status', err)
    });
  }

  viewProof(base64Image: string) {
    this.selectedProofImage = 'data:image/jpeg;base64,' + base64Image;
  }

  closeProof() {
    this.selectedProofImage = null;
  }

  onHasPermission(has: boolean) {
    console.log('Camera permission:', has);
    this.hasPermission = has;
    if (!has) {
      this.scanStatus = 'ERROR';
      this.scan.message = 'Camera permission denied.';
      console.error('Camera permission denied!');
    }
  }

  onScanError(error: any) {
    console.error('Scanner error:', error);
    // Alert the user so they know something happened
    this.scanStatus = 'ERROR';
    this.scan.message = typeof error === 'string' ? error : 'Scan Failed';
    this.toastService.show(this.scan.message, 'error');
  }

  // Handle Image Upload Scan
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.decodeImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  async decodeImage(imageSrc: string) {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const codeReader = new BrowserMultiFormatReader();
      const img = new Image();
      img.src = imageSrc;
      img.onload = async () => {
        try {
          const result = await codeReader.decodeFromImageElement(img);
          this.processScan(result.getText());
        } catch (err) {
          this.toastService.show('Could not decode QR code.', 'error');
        }
      };
    } catch (e) {
      console.error(e);
    }
  }

  // Common Scan Processor
  processScan(pinCode: string) {
    if (!pinCode || this.isScanning) return;

    this.isScanning = true;
    this.scan.pin = pinCode;
    this.scanStatus = 'PENDING';
    const token = this.authService.getToken();

    this.http.post(`https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/scan?collegePin=${this.scan.pin}`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (res: any) => {
        this.scanStatus = 'SUCCESS';
        this.scannedData = res;
        this.scan.message = res.message;

        // Sync status across all views
        if (res.student) {
          this.updateLocalStatus(res.student);
        }

        setTimeout(() => {
          this.showScannerModal = false;
          this.showLetterModal = true;
          this.scan.pin = '';
          this.scanStatus = 'PENDING';
          this.isScanning = false; // Reset flag after user sees success (or modal closes)
        }, 500);
      },
      error: (err) => {
        this.scanStatus = 'PENDING'; // Or ERROR
        this.isScanning = false; // Reset flag immediately on error to allow retry
        let msg = 'Student Not Found';
        if (err.error) {
          msg = typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
        }
        this.onScanError(msg); // Use improved error handler
      }
    });
  }

  updateLocalStatus(updatedStudent: any) {
    // 1. Update in main list
    const index = this.students.findIndex(s => s.collegePin === updatedStudent.collegePin);
    if (index !== -1) {
      this.students[index] = { ...this.students[index], status: updatedStudent.status };
    }

    // 2. Update selected student modal if open
    if (this.selectedStudent && this.selectedStudent.collegePin === updatedStudent.collegePin) {
      this.selectedStudent.status = updatedStudent.status;
    }

    // 3. Refresh stats/history (Optional but good for consistency)
    // We can just reload history since a new scan entry exists
    this.loadHistory();
  }

  scanStudent() {
    this.processScan(this.scan.pin);
  }

  viewStudent(student: any) {
    this.selectedStudent = student;
  }

  // --- Delete Student Confirmation ---
  showDeleteConfirmation: boolean = false;
  studentToDelete: any = null;

  confirmDeleteStudent(student: any) {
    this.studentToDelete = student;
    this.showDeleteConfirmation = true;
  }

  cancelDelete() {
    this.showDeleteConfirmation = false;
    this.studentToDelete = null;
  }

  proceedWithDelete() {
    if (!this.studentToDelete) return;

    const student = this.studentToDelete;
    this.http.delete(`https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/student/${student.id}`, {
      headers: { Authorization: `Bearer ${this.authService.getToken()}` }
    }).subscribe({
      next: () => {
        this.toastService.show('Student deleted successfully', 'success');
        this.loadStudents(this.activeTab === 'boys' ? 'MALE' : 'FEMALE');
        this.cancelDelete();
      },
      error: (err) => {
        console.error('Delete error:', err);
        this.toastService.show(err.error || 'Failed to delete student', 'error');
        this.cancelDelete();
      }
    });
  }

  // Deprecated direct delete
  // deleteStudent(student: any) { ... }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  getFormattedStatus(status: string): string {
    return status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  // Cache for Room Availability to ensure modal Details are accurate regardless of tab
  allStudentsCache: any[] = [];

  viewRoomDetails(room: any) {
    this.selectedRoom = room;
    // Find students in this room looking at the COMPLETE cache first, fallback to this.students
    const sourceList = (this.allStudentsCache && this.allStudentsCache.length > 0) ? this.allStudentsCache : this.students;

    if (sourceList) {
      this.roomOccupants = sourceList.filter(s =>
        s.status === 'IN_HOSTEL' &&
        // Match by Location only (Block + Room), ignore ID mismatch
        s.block == room.block &&
        s.roomNo == room.roomNo
      );
    } else {
      this.roomOccupants = [];
    }
  }

  allocateStudent() {
    if (!this.searchedStudent) {
      this.toastService.show('Please search and select a student first', 'error');
      return;
    }

    if (!this.selectedRoom) return;

    const token = this.authService.getToken();
    const body = {
      studentId: this.searchedStudent.id,
      hostelId: this.selectedRoom.hostelId,
      block: this.selectedRoom.block,
      roomNo: this.selectedRoom.roomNo
    };

    this.http.post('https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/allocate-room', body, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.toastService.show('Student allocated successfully!', 'success');
        this.loadRoomAvailability();
        this.closeRoomModal();
      },
      error: (err) => {
        console.error(err);
        const msg = err.error || 'Allocation Failed';
        this.toastService.show(msg, 'error');
      }
    });
  }

  formatHostelId(id: string): string {
    if (!id) return '';
    // If it's a BOYS_HOSTEL/GIRLS_HOSTEL, format it nicely
    if (id.includes('_')) {
      return id.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
    // Otherwise return as is (e.g. numeric ID), do NOT append ' Hostel'
    return id;
  }

  // --- Allocation Modal Logic ---
  showAllocateModal: boolean = false;
  allocateSearchPin: string = '';
  searchedStudent: any = null;

  openAllocateModal() {
    this.showAllocateModal = true;
    this.allocateSearchPin = '';
    this.searchedStudent = null;
  }

  closeAllocateModal() {
    this.showAllocateModal = false;
    this.allocateSearchPin = '';
    this.searchedStudent = null;
  }

  searchStudentForAllocation() {
    if (!this.allocateSearchPin) return;

    this.http.get<any>(`https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/student/search/hostel-id?hostelId=${this.allocateSearchPin}`, {
      headers: { Authorization: `Bearer ${this.authService.getToken()}` }
    }).subscribe({
      next: (student) => {
        this.searchedStudent = student;
      },
      error: (err) => {
        console.error(err);
        this.searchedStudent = null;
        this.toastService.show('Student not found with this Hostel ID', 'error');
      }
    });
  }

  confirmAllocation() {
    if (!this.selectedRoom || !this.searchedStudent) return;

    const token = this.authService.getToken();
    const body = {
      pin: this.searchedStudent.collegePin,
      // Fix: Use the STUDENT'S specific Hostel ID (e.g. numeric), NOT the Room's generic Hostel Type (e.g. "BOYS_HOSTEL")
      // Only fallback to room's hostelId if student has none (which shouldn't happen for valid students)
      hostelId: this.searchedStudent.hostelId || this.selectedRoom.hostelId,
      block: this.selectedRoom.block,
      roomNo: this.selectedRoom.roomNo
    };

    this.http.post('https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/allocate-room', body, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.toastService.show('Student allocated successfully!', 'success');
        this.loadRoomAvailability();
        this.closeAllocateModal();
        // close room modal too? maybe keep it open to see result.
        // We'll reopen/refresh the room modal data manually or close it.
        this.closeRoomModal();
      },
      error: (err) => {
        console.error('Allocation error:', err);
        let msg = 'Allocation Failed';
        if (err.error) {
          if (typeof err.error === 'string') {
            msg = err.error;
          } else if (typeof err.error === 'object' && err.error.message) {
            msg = err.error.message;
          }
        }
        this.toastService.show(msg, 'error');
      }
    });
  }

  removeStudent(pin: string) {
    if (!confirm('Are you sure you want to remove this student from the room?')) return;

    const token = this.authService.getToken();
    // Using form data or query param as per controller
    this.http.post(`https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/vacate-room?collegePin=${pin}`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.toastService.show('Student removed from room', 'success');
        this.loadRoomAvailability();
        this.closeRoomModal(); // Refresh view
      },
      error: (err) => {
        console.error('Remove error UI:', err);
        let msg = 'Failed to remove student';
        if (err.error) {
          if (typeof err.error === 'string') {
            msg = err.error;
          } else if (typeof err.error === 'object' && err.error.message) {
            msg = err.error.message;
          }
        }
        this.toastService.show(msg, 'error');
      }
    });
  }

  closeRoomModal() {
    this.selectedRoom = null;
    this.roomOccupants = [];
  }

  // --- Remove Student Confirmation ---
  showRemoveConfirmation: boolean = false;
  studentToRemovePin: string | null = null;

  confirmRemoveStudent(pin: string) {
    this.studentToRemovePin = pin;
    this.showRemoveConfirmation = true;
  }

  cancelRemove() {
    this.showRemoveConfirmation = false;
    this.studentToRemovePin = null;
  }

  proceedWithRemove() {
    if (!this.studentToRemovePin) return;

    // Execute Removal logic (extracted from original removeStudent)
    const token = this.authService.getToken();
    this.http.post(`https://hostelmanagement-backend-1-no3d.onrender.com/api/admin/vacate-room?collegePin=${this.studentToRemovePin}`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        this.toastService.show('Student removed from room', 'success');
        this.loadRoomAvailability();
        // Refresh the detail modal occupancy list locally or close/reopen
        // We need to remove the student from roomOccupants array to reflect immediately
        this.roomOccupants = this.roomOccupants.filter(s => s.collegePin !== this.studentToRemovePin);

        this.cancelRemove();
      },
      error: (err) => {
        console.error('Remove error UI:', err);
        let msg = 'Failed to remove student';
        if (err.error && typeof err.error === 'string') msg = err.error;
        else if (err.error && err.error.message) msg = err.error.message;

        this.toastService.show(msg, 'error');
        this.cancelRemove();
      }
    });
  }

  // Deprecated/Unused direct remove method (kept for reference if needed, but replaced by above flow)
  // removeStudent(pin: string) { ... } 
}
