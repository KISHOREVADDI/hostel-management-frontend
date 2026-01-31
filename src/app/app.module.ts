import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { AdminDashboardComponent } from './components/admin/admin-dashboard/admin-dashboard.component';
import { StudentDashboardComponent } from './components/student/student-dashboard/student-dashboard.component';
import { AddStudentComponent } from './components/admin/add-student/add-student.component';
import { StudentListComponent } from './components/admin/student-list/student-list.component';
import { PermissionCardComponent } from './components/student/permission-card/permission-card.component';
import { WelcomeComponent } from './components/welcome/welcome.component';
import { ToastComponent } from './components/toast/toast.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    AdminDashboardComponent,
    StudentDashboardComponent,
    AddStudentComponent,
    StudentListComponent,
    PermissionCardComponent,
    WelcomeComponent,
    ToastComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ZXingScannerModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
