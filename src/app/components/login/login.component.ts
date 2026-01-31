import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  credentials = { username: '', password: '' };
  error = '';

  constructor(private authService: AuthService, private router: Router) { }

  login() {
    this.authService.login(this.credentials).subscribe({
      next: (res) => {
        const role = this.authService.getRole();
        if (role === 'ROLE_ADMIN') {
          this.router.navigate(['/admin-dashboard']);
        } else {
          this.router.navigate(['/student-dashboard']);
        }
      },
      error: (err) => {
        this.error = 'Invalid Credentials';
      }
    });
  }
}
