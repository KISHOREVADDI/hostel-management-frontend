import { Component } from '@angular/core';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent {
  showLogin = false;

  scrollToHome() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
