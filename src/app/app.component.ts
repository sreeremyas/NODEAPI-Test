import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { Map, map, tileLayer, LayerGroup, marker, Icon, latLng, imageOverlay, LatLngBounds, CRS, Point } from 'leaflet';
import 'leaflet-rotatedmarker';
import { MapService } from './services/map.service';
import { RotatableMarker } from './rotatable-marker';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private map!: Map;
  private mapData: any;
  private mapId: string = '';
  private markersLayer: LayerGroup = new LayerGroup();
  private mapImageUrl: string | null = null;
  private robotMarker: RotatableMarker | null = null;
  private readonly ROBOT_WIDTH = 0.89; // meters
  private readonly ROBOT_LENGTH = 1.6; // meters
  private pixelsPerMeter = 100; // This will be adjusted based on map scale
  private resolution: number = 0;

  constructor(private mapService: MapService) {}

  ngOnInit() {
    // Fetch initial map data
    this.mapService.getMapData().subscribe({
      next: (data) => {
        console.log('Map data received:', data);
        this.mapId = data.localization.map.data;
        this.resolution = data.localization.map.resolution;
        this.loadMapImage();
      },
      error: (error) => {
        console.error('Error fetching map data:', error);
      }
    });
  }

  private loadMapImage(): void {
    if (!this.mapId) {
      console.error('No map ID available');
      return;
    }

    if (!this.resolution) {
      console.error('No map resolution available');
      return;
    }

    this.mapService.getMapImage(this.mapId).subscribe({
      next: (imageUrl) => {
        if (!imageUrl) {
          console.error('No image URL returned from server');
          return;
        }
        this.mapImageUrl = imageUrl;
        if (this.map) {
          this.displayMapImage();
        }
      },
      error: (error) => {
        console.error('Error loading map image:', error);
      }
    });
  }

  ngAfterViewInit() {
    this.initMap();
  }

  private initMap(): void {
    // Initialize the map with a CRS.Simple coordinate system for image overlay
    this.map = map('map', {
      crs: CRS.Simple,
      minZoom: -2
    });

    if (this.mapImageUrl) {
      this.displayMapImage();
    }
  }

  private displayMapImage(): void {
    // Create an image element to get the natural dimensions
    const img = new Image();
    img.onload = () => {
      const width = img.width;
      const height = img.height;
      
      // Define the bounds for the image overlay
      const bounds = new LatLngBounds(
        [0, 0],
        [height, width]
      );

      // Add the image overlay to the map
      imageOverlay(this.mapImageUrl!, bounds).addTo(this.map);

      // Fit the map to the image bounds
      this.map.fitBounds(bounds);
      
      // Add markers layer after the image is loaded
      this.markersLayer.addTo(this.map);

      // Add robot marker at the origin
      this.addRobotMarker(height);
    };
    img.src = this.mapImageUrl!;
  }

  private addRobotMarker(mapHeight: number): void {
    try {
      // Calculate robot dimensions in pixels based on resolution
      const robotWidthPx = this.ROBOT_WIDTH / this.resolution;
      const robotLengthPx = this.ROBOT_LENGTH / this.resolution;

      // Create a custom icon for the robot
      const robotIcon = new Icon({
        iconUrl: 'assets/robot-icon.png',
        iconSize: [robotWidthPx, robotLengthPx],
        iconAnchor: [robotWidthPx / 2, robotLengthPx / 2], // Center point of the icon
      });

    // Create the marker at the origin (bottom-left of the map)
    // Note: In CRS.Simple, y increases from bottom to top
    if (this.robotMarker) {
      this.robotMarker.remove();
    }

    this.robotMarker = marker([mapHeight / 2, mapHeight / 2], {
      icon: robotIcon,
      rotationAngle: 0, // Initial rotation
      rotationOrigin: 'center center'
    }) as unknown as RotatableMarker;
    this.robotMarker.addTo(this.map);
  } catch (error) {
    console.error('Error creating robot marker:', error);
  }
}

  // Method to update robot position and rotation
  public updateRobotPosition(x: number, y: number, angle: number): void {
    if (this.robotMarker) {
      this.robotMarker.setLatLng([y, x]);
      this.robotMarker.setRotationAngle(angle);
    }
  }

  ngOnDestroy() {
    // Clean up resources
    if (this.mapImageUrl) {
      this.mapService.releaseMapImage(this.mapImageUrl);
    }
    if (this.map) {
      this.map.remove();
    }
    if (this.robotMarker) {
      this.robotMarker.remove();
    }
    if (this.markersLayer) {
      this.markersLayer.clearLayers();
    }
  }

  ngOnDestroy() {
    // Clean up resources
    if (this.mapImageUrl) {
      this.mapService.releaseMapImage(this.mapImageUrl);
    }
    if (this.map) {
      this.map.remove();
    }
  }
}
