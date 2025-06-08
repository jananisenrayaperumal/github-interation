import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { GithubDataService } from '../../services/github-data.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { GithubDataGridComponent } from '../github-data-grid/github-data-grid.component';

@Component({
  selector: 'app-github-data',
  standalone: true,
  imports: [
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    CommonModule,
    GithubDataGridComponent,
  ],
  templateUrl: './github-data.component.html',
  styleUrl: './github-data.component.css',
})
export class GithubDataComponent implements OnInit {
  isBrowser: boolean;
  isConnected = false;
  lastSynced = '';

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

  connectToGit() {
    if (this.isBrowser) {
      window.location.href = 'http://localhost:3000/api/github/auth'; // your auth url
    }
  }

  setConnected(token: string) {
    if (this.isBrowser) {
      this.isConnected = true;
      localStorage.setItem('github_token', token);

      const now = new Date();
      this.lastSynced = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(now);

      this.githubDataService.syncData(token).subscribe({
        next: () => {},
        error: () => {},
      });
    }
  }

  removeConnection() {
    if (this.isBrowser) {
      this.isConnected = false;
      this.lastSynced = '';
      localStorage.removeItem('github_token');
      this.githubDataService.deleteGithubCollections().subscribe({
        next: () => {},
        error: () => {},
      });
      this.router.navigate(['/']);
    }
  }
}
