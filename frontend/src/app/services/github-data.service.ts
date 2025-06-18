import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GithubDataService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getCollection(): Observable<{ collections: string[] }> {
    return this.http.get<{ collections: string[] }>(
      `${this.baseUrl}/db/collection`
    );
  }

  getDataFromCollection(collectionName: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.baseUrl}/db/collection/${collectionName}`
    );
  }

  getFilteredCollectionData(collection: string, searchText: string) {
    return this.http.get<any[]>(
      `${this.baseUrl}/db/collection/${collection}/search`,
      {
        params: {
          q: searchText,
        },
      }
    );
  }

  globalSearch(searchText: string) {
    return this.http.get<any[]>(`${this.baseUrl}/db/global-search`, {
      params: { q: searchText },
    });
  }

  getUserTickets(user: string) {
    return this.http.get<any[]>(`${this.baseUrl}/db/user-tickets`, {
      params: { user },
    });
  }

  syncData(token: string) {
    return this.http.get(`${this.baseUrl}/github/sync`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  getRepositories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/db/repos`);
  }

  getRepoAggregatedData(
    orgLogin: string,
    repoName: string,
    params: any = {}
  ): Observable<any> {
    const query = new HttpParams({ fromObject: params });
    return this.http.get<any>(
      `${this.baseUrl}/db/repos/${orgLogin}/${repoName}/data`,
      {
        params: query,
      }
    );
  }

  deleteGithubCollections() {
    return this.http.delete(`${this.baseUrl}/db/delete-github-collections`);
  }
}
