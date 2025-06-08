import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GithubDataService } from '../../services/github-data.service';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-search',
  imports: [AgGridModule, CommonModule, FormsModule],
  templateUrl: './user-search.component.html',
  styleUrl: './user-search.component.css',
})
export class UserSearchComponent implements OnInit {
  user: string = '';
  rowData: any[] = [];
  defaultColDef = {
    filter: true,
    sortable: true,
    resizable: true,
  };

  // Updated columnDefs with built-in date filter
  columnDefs: ColDef[] = [
    { field: 'id', headerName: 'Ticket ID' },
    { field: 'user', headerName: 'User' },
    {
      field: 'date',
      headerName: 'Date',
      filter: 'agDateColumnFilter',
      filterParams: {
        // Comparator function to handle your date format
        comparator: (filterLocalDateAtMidnight: Date, cellValue: string) => {
          if (!cellValue) return -1;

          // Parse the cell date - adjust this based on your actual date format
          const cellDate = new Date(cellValue);

          // Handle invalid dates
          if (isNaN(cellDate.getTime())) return -1;

          // Set to midnight for proper comparison
          cellDate.setHours(0, 0, 0, 0);

          if (filterLocalDateAtMidnight.getTime() === cellDate.getTime()) {
            return 0;
          }

          if (cellDate < filterLocalDateAtMidnight) {
            return -1;
          }

          if (cellDate > filterLocalDateAtMidnight) {
            return 1;
          }

          return 0;
        },
        // Enable floating filter for quick access
        suppressAndOrCondition: false,
        // You can customize the date format display
        browserDatePicker: true,
      },
    },
    { field: 'title', headerName: 'Summary' },
    { field: 'message', headerName: 'Description' },
  ];

  gridApi!: GridApi;
  startDate: string = '';
  endDate: string = '';

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

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

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
