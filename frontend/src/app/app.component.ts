import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterOutlet } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { GithubDataService } from './services/github-data.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    CommonModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  standalone: true,
})
export class AppComponent implements OnInit {
  isBrowser: boolean;
  constructor(
    private route: ActivatedRoute,
    private githubDataService: GithubDataService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.route.queryParams.subscribe((params) => {
        const token = params['token'];
        if (token && !this.isConnected) {
          this.setConnected(token);
        }
      });
    }
  }

  moveoToHomeScreen() {
    this.router.navigate(['/']);
  }

  connectToGit() {
    if (isPlatformBrowser(this.platformId)) {
      window.location.href = 'http://localhost:3000/api/github/auth';
    }
  }

  isConnected = false;
  lastSynced = '';

  setConnected(token: string) {
    if (isPlatformBrowser(this.platformId)) {
      this.isConnected = true;
      localStorage.setItem('github_token', token);

      const now = new Date();
      this.lastSynced = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(now);

      //call sync api, to get the github-data in db
      this.githubDataService.syncData(token).subscribe({
        next: (res) => {},
        error: (err) => {},
      });
    }
  }

  removeConnection() {
    if (isPlatformBrowser(this.platformId)) {
      this.isConnected = false;
      this.lastSynced = '';
      localStorage.removeItem('github_token');
      this.githubDataService.deleteGithubCollections().subscribe({
        next: (res) => {},
        error: (err) => {},
      });
      this.moveoToHomeScreen();
    }
  }
}
