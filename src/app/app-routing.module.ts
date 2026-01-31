import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { StudentDashboardComponent } from './components/student/student-dashboard/student-dashboard.component';
import { AdminDashboardComponent } from './components/admin/admin-dashboard/admin-dashboard.component';
import { WelcomeComponent } from './components/welcome/welcome.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', component: WelcomeComponent },
  { path: 'login', redirectTo: '', pathMatch: 'full' }, // Redirect login to welcome since it's a modal now
  { path: 'student-dashboard', component: StudentDashboardComponent, canActivate: [AuthGuard] },
  { path: 'admin-dashboard', component: AdminDashboardComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
