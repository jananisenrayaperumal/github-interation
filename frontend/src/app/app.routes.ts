import { Routes } from '@angular/router';
import { GithubDataComponent } from './components/github-data/github-data.component';
import { UserSearchComponent } from './components/user-search/user-search.component';
import { RelationshipTableComponent } from './components/relationship-table/relationship-table.component';

export const routes: Routes = [
  {
    path: '',
    component: GithubDataComponent,
  },
  { path: 'user-search', component: UserSearchComponent },
  { path: 'relationship-table', component: RelationshipTableComponent },
];
