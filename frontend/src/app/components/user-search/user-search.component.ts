import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GithubDataService } from '../../services/github-data.service';
import { AgGridModule } from 'ag-grid-angular';

@Component({
  selector: 'app-user-search',
  imports: [AgGridModule],
  templateUrl: './user-search.component.html',
  styleUrl: './user-search.component.css',
})
export class UserSearchComponent implements OnInit {
  user: string = '';
  rowData: any[] = [];
  defaultColDef = { filter: true, sortable: true, resizable: true };
  columnDefs = [
    { field: 'id', headerName: 'Ticket ID' },
    { field: 'user', headerName: 'User' },
    { field: 'date', headerName: 'Date' },
    { field: 'title', headerName: 'Summary' },
    { field: 'message', headerName: 'Description' },
  ];

  constructor(
    private route: ActivatedRoute,
    private githubService: GithubDataService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.user = params['user'] || '';

      if (this.user) {
        this.fetchUserData(this.user);
      }
    });
  }

  // fetchUserData(user: string) {
  //   this.githubService.getUserTickets(user).subscribe({
  //     next: (data) => {
  //       this.rowData = data;

  //       if (data.length > 0) {
  //         this.columnDefs = Object.keys(data[0]).map((key) => ({
  //           field: key,
  //           headerName: this.toTitleCase(key),
  //         }));
  //       } else {
  //         this.columnDefs = [];
  //       }
  //     },
  //     error: (err) => {
  //       console.error('Failed to fetch user tickets:', err);
  //     },
  //   });
  // }

  fetchUserData(user: string) {
    this.githubService.getUserTickets(user).subscribe({
      next: (data) => {
        this.rowData = data;
      },
      error: (err) => {
        console.error('Failed to fetch user tickets:', err);
      },
    });
  }

  toTitleCase(str: string) {
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }
}
