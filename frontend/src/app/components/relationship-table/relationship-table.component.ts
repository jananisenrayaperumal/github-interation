import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AgGridModule } from 'ag-grid-angular';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
// import { AllCommunityModules } from '@ag-grid-community/all-modules';
// import { CellSelectionModule } from '@ag-grid-enterprise/cell-selection';
// import { MasterDetailModule } from '@ag-grid-enterprise/master-detail';
ModuleRegistry.registerModules([AllCommunityModule]);
// ModuleRegistry.registerModules([CellSelectionModule, MasterDetailModule]);

import {
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-community';
import { GithubDataService } from '../../services/github-data.service';

interface Repository {
  _id: string;
  githubId: number;
  full_name: string;
  name: string;
  organizationLogin: string;
}

interface AggregatedData {
  _id: string;
  sha: string;
  message: string;
  authorName: string;
  date: string;
  repoName: string;
  orgLogin: string;
  pullRequests: any[];
  issues: any[];
}

interface ApiResponse {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  data: AggregatedData[];
}

@Component({
  selector: 'app-relationship-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatToolbarModule,
    AgGridModule,
  ],
  templateUrl: './relationship-table.component.html',
  styleUrls: ['./relationship-table.component.css'],
})
export class RelationshipTableComponent implements OnInit {
  repositories: Repository[] = [];
  selectedRepo: Repository | null = null;
  rowData: AggregatedData[] = [];
  columnDefs: ColDef[] = [];

  loadingRepos = false;
  loadingData = false;

  searchTerm = '';
  prStateFilter = '';
  issueStateFilter = '';
  authorFilter = '';

  currentPage = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 0;

  private gridApi!: GridApi;
  private searchTimeout: any;

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 120,
  };

  detailCellRendererParams = {
    detailGridOptions: {
      columnDefs: [
        { field: 'type', headerName: 'Type', width: 100 },
        { field: 'title', headerName: 'Title', flex: 1 },
        { field: 'state', headerName: 'State', width: 100 },
        { field: 'created_at', headerName: 'Created', width: 150 },
        { field: 'updated_at', headerName: 'Updated', width: 150 },
      ],
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true,
      },
    },
    getDetailRowData: (params: any) => {
      const relatedData: any[] = [];

      if (params.data.pullRequests && params.data.pullRequests.length > 0) {
        params.data.pullRequests.forEach((pr: any) => {
          relatedData.push({
            type: 'Pull Request',
            title: pr.title,
            state: pr.state,
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            number: pr.number,
            author: pr.user?.login,
          });
        });
      }

      if (params.data.issues && params.data.issues.length > 0) {
        params.data.issues.forEach((issue: any) => {
          relatedData.push({
            type: 'Issue',
            title: issue.title,
            state: issue.state,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            number: issue.number,
            author: issue.user?.login,
          });
        });
      }

      params.successCallback(relatedData);
    },
  };

  constructor(
    private githubservice: GithubDataService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadRepositories();
  }

  loadRepositories() {
    this.loadingRepos = true;
    this.githubservice.getRepositories().subscribe({
      next: (repos) => {
        this.repositories = repos;
        this.loadingRepos = false;
        if (repos.length > 0) {
          this.selectedRepo = repos[0];
          this.onRepoChange();
        }
      },
      error: (error) => {
        console.error('Error loading repositories:', error);
        this.loadingRepos = false;
      },
    });
  }

  onRepoChange() {
    this.currentPage = 1;
    this.loadAggregatedData();
  }

  loadAggregatedData() {
    if (!this.selectedRepo) return;

    this.loadingData = true;

    const params: any = {
      page: this.currentPage.toString(),
      limit: this.pageSize.toString(),
    };

    if (this.searchTerm) params.search = this.searchTerm;
    if (this.prStateFilter) params.prState = this.prStateFilter;
    if (this.issueStateFilter) params.issueState = this.issueStateFilter;
    if (this.authorFilter) params.authorName = this.authorFilter;

    this.githubservice
      .getRepoAggregatedData(
        this.selectedRepo.organizationLogin,
        this.selectedRepo.name,
        params
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.rowData = response.data;
          this.totalCount = response.totalCount;
          this.totalPages = response.totalPages;
          this.generateDynamicColumns();
          this.loadingData = false;
        },
        error: (error) => {
          console.error('Error loading aggregated data:', error);
          this.loadingData = false;
        },
      });
  }

  generateDynamicColumns() {
    if (this.rowData.length === 0) return;

    const columns: ColDef[] = [
      {
        field: 'sha',
        headerName: 'Commit Hash',
        width: 120,
        cellRenderer: (params: ICellRendererParams) =>
          params.value?.substring(0, 8) || '',
      },
      {
        field: 'message',
        headerName: 'Commit Message',
        flex: 2,
        minWidth: 200,
      },
      { field: 'authorName', headerName: 'Author', width: 150 },
      {
        field: 'date',
        headerName: 'Date',
        width: 150,
        cellRenderer: (params: ICellRendererParams) =>
          params.value ? new Date(params.value).toLocaleDateString() : '',
      },
      {
        field: 'pullRequests',
        headerName: 'PRs',
        width: 80,
        cellRenderer: (params: ICellRendererParams) => {
          const count = params.value ? params.value.length : 0;
          return `<span class="count-badge pr-badge">${count}</span>`;
        },
      },
      {
        field: 'issues',
        headerName: 'Issues',
        width: 80,
        cellRenderer: (params: ICellRendererParams) => {
          const count = params.value ? params.value.length : 0;
          return `<span class="count-badge issue-badge">${count}</span>`;
        },
      },
    ];

    this.columnDefs = columns;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onSearchChange() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.loadAggregatedData();
    }, 500);
  }

  applyFilters() {
    this.currentPage = 1;
    this.loadAggregatedData();
  }

  clearSearch() {
    this.searchTerm = '';
    this.onSearchChange();
  }

  clearAllFilters() {
    this.searchTerm = '';
    this.prStateFilter = '';
    this.issueStateFilter = '';
    this.authorFilter = '';
    this.applyFilters();
  }

  goToRelationshipTable() {
    this.router.navigate(['/relationship-table']);
  }
}
