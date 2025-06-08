import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
  PLATFORM_ID,
  Inject,
  AfterViewInit,
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
export class GithubDataGridComponent
  implements OnInit, OnChanges, AfterViewInit
{
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
    wrapText: true,
    autoHeight: true,
    cellStyle: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
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
        setTimeout(() => this.loadCollections(), 2000);
      } else {
        console.log('I am not connected');
        this.selectedEntity = 'users';
        this.searchText = '';
        setTimeout(() => this.loadCollections(), 2000);
      }
    }
  }

  ngAfterViewInit() {
    const gridDiv = document.querySelector('.ag-theme-alpine.grid');

    if (gridDiv) {
      gridDiv.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;

        if (target && target.classList.contains('find-user-link')) {
          event.preventDefault();

          // Get the user value from data attribute
          const user = target.getAttribute('data-user') || '';

          // Construct your URL for the new tab
          const userSearchUrl = `/user-search?user=${encodeURIComponent(user)}`;

          // Open in new tab
          window.open(userSearchUrl, '_blank');
        }
      });
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

  flattenObject(obj: any, parentKey = '', result: any = {}) {
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      const value = obj[key];

      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'object' && item !== null) {
            for (const nestedKey in item) {
              if (item.hasOwnProperty(nestedKey)) {
                const flatKey = `${key}-${nestedKey}`;
                result[flatKey] = item[nestedKey];
              }
            }
          } else {
            result[key] = value.join(', ');
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        this.flattenObject(value, key, result);
      } else {
        const flatKey = parentKey ? `${parentKey}-${key}` : key;
        result[flatKey] = value;
      }
    }
    return result;
  }

  fetchCollectionData(collection: string) {
    this.githubService.getDataFromCollection(collection).subscribe({
      next: (data) => {
        const flattenedData = data.map((item) => this.flattenObject(item));
        this.rowData = flattenedData;

        if (flattenedData.length > 0) {
          this.columnDefs = Object.keys(flattenedData[0]).map((key) => {
            const baseColumnDef = {
              field: key,
              headerName: this.toTitleCase(key),
              tooltipField: key,
              autoHeight: true,
              wrapText: true,
              filter: true,
            };

            // 🎯 Avatar field (image renderer)
            if (key === 'avatar') {
              return {
                ...baseColumnDef,
                cellRenderer: (params: any) => {
                  return `<img src="${params.value}" alt="avatar" style="height: 40px; width: 40px; border-radius: 50%;" />`;
                },
                width: 160,
                sortable: false,
              };
            }

            // 📅 Date filter
            if (this.isDateColumn(key, flattenedData[0][key])) {
              return {
                ...baseColumnDef,
                filter: 'agDateColumnFilter',
                filterParams: {
                  comparator: (
                    filterLocalDateAtMidnight: Date,
                    cellValue: string
                  ) => {
                    if (!cellValue) return -1;
                    const cellDate = new Date(cellValue);
                    if (isNaN(cellDate.getTime())) return -1;
                    cellDate.setHours(0, 0, 0, 0);

                    if (
                      filterLocalDateAtMidnight.getTime() === cellDate.getTime()
                    ) {
                      return 0;
                    }
                    return cellDate < filterLocalDateAtMidnight ? -1 : 1;
                  },
                  browserDatePicker: true,
                },
              };
            }

            return baseColumnDef;
          });
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

  // onSearch(): void {
  //   const collection = this.selectedEntity;
  //   const query = this.searchText.trim();

  //   if (!query) {
  //     this.fetchCollectionData(collection);
  //     return;
  //   }

  //   this.githubService.getFilteredCollectionData(collection, query).subscribe({
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
  //     error: (err) => console.error('Search failed:', err),
  //   });
  // }

  private isDateColumn(columnName: string, sampleValue: any): boolean {
    const dateColumns = ['createdAt', 'updatedAt', 'date', 'timestamp'];
    return dateColumns.includes(columnName);
  }

  onSearch(): void {
    const query = this.searchText.trim();

    if (!query) {
      // No search text → show data for selected collection or clear if none selected
      if (this.selectedEntity) {
        this.fetchCollectionData(this.selectedEntity);
      } else {
        this.rowData = [];
        this.columnDefs = [];
      }
      return;
    }

    // If there is a query, always do global search ignoring selectedEntity
    this.githubService.globalSearch(query).subscribe({
      next: (data) => {
        this.rowData = data;
        if (data.length > 0) {
          this.columnDefs = [
            {
              headerName: 'finduser-hyperlink',
              field: 'findUser',
              cellRenderer: (params: any) => {
                const user =
                  params.data.user || params.data.userLogin || 'unknown';
                const encodedUser = encodeURIComponent(user);
                return `
                  <a 
                    href="/user-search?user=${encodedUser}" 
                    target="_blank" 
                    style="color:blue; text-decoration: underline;"
                  >
                    Find User
                  </a>`;
              },
              width: 100,
              sortable: false,
              filter: false,
            },
            ...Object.keys(data[0]).map((key) => {
              const baseColumnDef = {
                field: key,
                headerName: this.toTitleCase(key),
                filter: true,
              };

              // Apply date filter for date columns in search results too
              if (this.isDateColumn(key, data[0][key])) {
                return {
                  ...baseColumnDef,
                  filter: 'agDateColumnFilter',
                  filterParams: {
                    comparator: (
                      filterLocalDateAtMidnight: Date,
                      cellValue: string
                    ) => {
                      if (!cellValue) return -1;

                      const cellDate = new Date(cellValue);
                      if (isNaN(cellDate.getTime())) return -1;

                      cellDate.setHours(0, 0, 0, 0);

                      if (
                        filterLocalDateAtMidnight.getTime() ===
                        cellDate.getTime()
                      ) {
                        return 0;
                      }
                      return cellDate < filterLocalDateAtMidnight ? -1 : 1;
                    },
                    browserDatePicker: true,
                  },
                };
              }

              return baseColumnDef;
            }),
          ];
        } else {
          this.columnDefs = [];
        }
      },
      error: (err) => console.error('Global search failed:', err),
    });
  }
}
