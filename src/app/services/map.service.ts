import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private apiUrl = 'http://192.168.1.81';

  constructor(private http: HttpClient) {}

  getMapData(): Observable<any> {
    return this.http.get(`${this.apiUrl}/node-api/edge/state`);
  }

  getMapDetails(mapId: string): Observable<string> {
    return this.http.get(
      `${this.apiUrl}/node-api/environment-server/maps/${mapId}`,
      { responseType: 'blob' }
    ).pipe(
      map(blob => {
        return URL.createObjectURL(blob);
      })
    );
  }

  // Method to load map image and convert to blob URL
  getMapImage(mapId: string): Observable<string> {
    return this.http.get(
      `${this.apiUrl}/node-api/environment-server/maps/${mapId}`,
      { responseType: 'blob' }
    ).pipe(
      map(blob => URL.createObjectURL(blob))
    );
  }

  // Method to release blob URL when no longer needed
  releaseMapImage(url: string): void {
    URL.revokeObjectURL(url);
  }
}
