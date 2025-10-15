import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private apiUrl = 'http://100.79.47.58';

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

  // Get map metadata including resolution and scaling information
  getMapMetadata(mapId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/node-api/environment-server/maps/${mapId}/metadata`);
  }

  // Get environment server documentation
  getEnvironmentServerDocs(): Observable<any> {
    return this.http.get(`${this.apiUrl}/node-api/environment-server/docs`, { responseType: 'text' });
  }

  // Get edge API documentation
  getEdgeDocs(): Observable<any> {
    return this.http.get(`${this.apiUrl}/node-api/edge/docs`, { responseType: 'text' });
  }

  // Get all available maps
  getAvailableMaps(): Observable<any> {
    return this.http.get(`${this.apiUrl}/node-api/environment-server/maps`);
  }

  // Get map info (including resolution, origin, etc.)
  getMapInfo(mapId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/node-api/environment-server/maps/${mapId}/info`);
  }

  // Initialize localization with robot's current position
  initializeLocalization(x: number, y: number, theta: number): Observable<any> {
    const payload = {
      x: x,
      y: y,
      theta: theta
    };

    return this.http.put(`${this.apiUrl}/node-api/edge/localization/initialize`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*'
      }
    });
  }

  // Initialize localization from POI (Point of Interest)
  initializeLocalizationFromPOI(poi: string, theta?: number, deviation?: {x: number, y: number, theta: number}): Observable<any> {
    const payload: any = {
      poi: poi
    };

    if (theta !== undefined) {
      payload.theta = theta;
    }

    if (deviation) {
      payload.deviation = deviation;
    }

    return this.http.put(`${this.apiUrl}/node-api/edge/localization/initialize`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*'
      }
    });
  }
}
