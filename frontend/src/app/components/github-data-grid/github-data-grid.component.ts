import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { ColDef, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { GithubDataService } from '../../services/github-data.service';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-github-data-grid',
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './github-data-grid.component.html',
  styleUrls: ['./github-data-grid.component.css'],
  standalone: true,
})
export class GithubDataGridComponent implements OnInit, OnChanges {
  isBrowser: boolean;
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  @Input() isConnected: boolean = false;

  private githubService = inject(GithubDataService);

  integrations = ['Github'];
  selectedIntegration = 'Github';
  entities: string[] = [];
  selectedEntity = 'users';
  searchText = '';
  columnDefs: ColDef[] = [];
  rowData: any[] = [];

  defaultColDef: ColDef = {
    filter: true,
    sortable: true,
    resizable: true,
  };

  ngOnInit(): void {
    // Optionally pre-load here, but keep it empty if you only want to load on isConnected
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['isConnected'] &&
      changes['isConnected'].currentValue !==
        changes['isConnected'].previousValue
    ) {
      if (this.isConnected) {
        console.log('I am connected');
        setTimeout(() => this.loadCollections(), 1000);
      } else {
        console.log('I am not connected');
        this.selectedEntity = 'users';
        this.searchText = '';
        setTimeout(() => this.loadCollections(), 1000);
      }
    }
  }

  loadCollections(): void {
    this.githubService.getCollection().subscribe({
      next: (res) => {
        this.entities = res.collections || [];
        if (this.entities.length > 0) {
          this.fetchCollectionData(this.selectedEntity);
        }
      },
      error: (err) => console.error('Error fetching collections', err),
    });
  }

  fetchCollectionData(collection: string) {
    this.githubService.getDataFromCollection(collection).subscribe({
      next: (data) => {
        this.rowData = data;

        if (data.length > 0) {
          this.columnDefs = Object.keys(data[0]).map((key) => ({
            field: key,
            headerName: this.toTitleCase(key),
          }));
        } else {
          this.columnDefs = [];
        }
      },
      error: (err) =>
        console.error('Error fetching data from', collection, err),
    });
  }

  toTitleCase(str: string): string {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  onEntityChange(collectionName: string): void {
    this.fetchCollectionData(collectionName);
  }

  onSearch(): void {
    const collection = this.selectedEntity;
    const query = this.searchText.trim();

    if (!query) {
      this.fetchCollectionData(collection);
      return;
    }

    this.githubService.getFilteredCollectionData(collection, query).subscribe({
      next: (data) => {
        this.rowData = data;

        if (data.length > 0) {
          this.columnDefs = Object.keys(data[0]).map((key) => ({
            field: key,
            headerName: this.toTitleCase(key),
          }));
        } else {
          this.columnDefs = [];
        }
      },
      error: (err) => console.error('Search failed:', err),
    });
  }
}
