import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
  private resolution: number = 0; // meters per pixel
  private mapWidthPixels: number = 0;
  private mapHeightPixels: number = 0;
  private mapWidthMeters: number = 0;
  private mapHeightMeters: number = 0;
  private mapOrigin: { x: number, y: number, theta: number } | null = null;
  private originMarker: any = null;
  public hasError: boolean = false;
  public errorMessage: string = '';

  constructor(private mapService: MapService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    // Fetch initial map data
    this.mapService.getMapData().subscribe({
      next: (data) => {
        console.log('Map data received:', data);
        this.mapId = data.localization.map.data;
        this.resolution = data.localization.map.resolution; //resolution of the map in meters/pixel
        this.mapOrigin = data.localization.map.origin; // origin position {x, y, theta}
        console.log('Map resolution:', this.resolution, 'meters/pixel');
        console.log('Map origin:', this.mapOrigin);
        this.loadMapImage();
      },
      error: (error) => {
        console.error('Error fetching map data:', error);
        this.hasError = true;
        this.errorMessage = 'Failed to fetch map data from server. Please check if the map service is running at http://192.168.1.81';
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
        this.hasError = true;
        this.errorMessage = 'Failed to load map image from server. Map ID: ' + this.mapId;
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

    // Set initial view
    this.map.setView([250, 250], 0);

    if (this.mapImageUrl) {
      this.displayMapImage();
    }
  }

  // Coordinate conversion methods
  private metersToPixelsX(meters: number): number {
    return meters / this.resolution;
  }

  private metersToPixelsY(meters: number): number {
    return meters / this.resolution;
  }

  private pixelsToMetersX(pixels: number): number {
    return pixels * this.resolution;
  }

  private pixelsToMetersY(pixels: number): number {
    return pixels * this.resolution;
  }

  // Calculate appropriate robot scale based on physical size and map resolution
  private calculateRobotScale(): number {
    if (!this.resolution) return 2; // fallback scale
    
    // Robot physical size in pixels
    const robotWidthPixels = this.ROBOT_WIDTH / this.resolution;
    const robotLengthPixels = this.ROBOT_LENGTH / this.resolution;
    
    // Base marker size is 30px, scale to match robot's actual size
    // Use the larger dimension to ensure robot is visible
    const maxDimension = Math.max(robotWidthPixels, robotLengthPixels);
    const baseSize = 30;
    const scale = Math.max(maxDimension / baseSize, 0.5); // minimum scale of 0.5
    
    console.log('Robot scale calculation:', {
      physicalWidth: this.ROBOT_WIDTH,
      physicalLength: this.ROBOT_LENGTH,
      widthPixels: robotWidthPixels,
      lengthPixels: robotLengthPixels,
      calculatedScale: scale,
      resolution: this.resolution
    });
    
    return scale;
  }

  // Create a crosshair marker at the map origin
  private addOriginCrosshair(): void {
    if (!this.mapOrigin) {
      console.log('No map origin data available');
      return;
    }

    try {
      // Remove existing origin marker
      if (this.originMarker) {
        this.originMarker.remove();
      }

      // Convert origin coordinates from meters to pixels
      const originXPixels = this.metersToPixelsX(this.mapOrigin.x);
      const originYPixels = this.metersToPixelsY(this.mapOrigin.y);

      // Create crosshair SVG icon
      const crosshairSize = 40;
      const crosshairIcon = new Icon({
        iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="${crosshairSize}" height="${crosshairSize}" viewBox="0 0 ${crosshairSize} ${crosshairSize}">
            <!-- Outer circle -->
            <circle cx="20" cy="20" r="18" fill="none" stroke="#666666" stroke-width="2" opacity="0.8"/>
            <!-- Horizontal line -->
            <line x1="4" y1="20" x2="36" y2="20" stroke="#666666" stroke-width="2" opacity="0.8"/>
            <!-- Vertical line -->
            <line x1="20" y1="4" x2="20" y2="36" stroke="#666666" stroke-width="2" opacity="0.8"/>
            <!-- Center dot -->
            <circle cx="20" cy="20" r="2" fill="#666666" opacity="0.9"/>
            <!-- Origin label -->
            <text x="20" y="52" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#666666" opacity="0.8">ORIGIN</text>
          </svg>
        `),
        iconSize: [crosshairSize, crosshairSize + 12], // Extra height for label
        iconAnchor: [crosshairSize / 2, crosshairSize / 2] // Center the crosshair
      });

      // Create the origin marker
      this.originMarker = marker([originYPixels, originXPixels], {
        icon: crosshairIcon,
        interactive: false, // Make it non-interactive so it doesn't interfere with map interactions
        zIndexOffset: -1000 // Put it behind other markers
      });

      this.originMarker.addTo(this.map);

      console.log('Origin crosshair added:', {
        originMeters: [this.mapOrigin.x, this.mapOrigin.y],
        originPixels: [originXPixels.toFixed(1), originYPixels.toFixed(1)],
        theta: this.mapOrigin.theta
      });
    } catch (error) {
      console.error('Error creating origin crosshair:', error);
    }
  }

  private displayMapImage(): void {
    // Create an image element to get the natural dimensions
    const img = new Image();
    img.onload = () => {
      this.mapWidthPixels = img.width;
      this.mapHeightPixels = img.height;
      
      // Calculate map dimensions in meters
      this.mapWidthMeters = this.mapWidthPixels * this.resolution;
      this.mapHeightMeters = this.mapHeightPixels * this.resolution;
      
      console.log('Map dimensions:', {
        widthPixels: this.mapWidthPixels,
        heightPixels: this.mapHeightPixels,
        widthMeters: this.mapWidthMeters.toFixed(2),
        heightMeters: this.mapHeightMeters.toFixed(2),
        resolution: this.resolution
      });
      
      // Define the bounds for the image overlay in pixels (CRS.Simple coordinate system)
      const bounds = new LatLngBounds(
        [0, 0],
        [this.mapHeightPixels, this.mapWidthPixels]
      );

      // Add the image overlay to the map
      imageOverlay(this.mapImageUrl!, bounds).addTo(this.map);

      // Fit the map to the image bounds
      this.map.fitBounds(bounds);
      
      // Add markers layer after the image is loaded
      this.markersLayer.addTo(this.map);

      // Add robot marker at the center of the map
      this.addRobotMarker();
      
      // Add a test marker for reference
      this.addTestMarker();
      
      // Add crosshair at the origin
      this.addOriginCrosshair();
    };
    img.src = this.mapImageUrl!;
  }

  private addRobotMarker(): void {
    try {
      // Remove existing robot marker
      if (this.robotMarker) {
        this.robotMarker.remove();
      }

      // Place robot at center of map in meters, then convert to pixels
      const centerXMeters = this.mapWidthMeters / 2;
      const centerYMeters = this.mapHeightMeters / 2;
      
      const centerXPixels = this.metersToPixelsX(centerXMeters);
      const centerYPixels = this.metersToPixelsY(centerYMeters);

      // Calculate robot scale based on its physical size
      const robotScale = this.calculateRobotScale();
      
      // Create robot marker (note: Leaflet uses [lat, lng] which maps to [y, x] in pixels)
      this.robotMarker = new RotatableMarker([centerYPixels, centerXPixels], { scale: robotScale });
      
      // Add event listeners for real-time position updates
      this.robotMarker.on('drag', () => {
        this.cdr.detectChanges();
      });
      
      this.robotMarker.on('dragend', () => {
        const pose = this.getRobotPose();
        if (pose) {
          console.log('Robot moved to (meters):', pose);
        }
        this.cdr.detectChanges();
      });
      
      this.robotMarker.addTo(this.map);
      
      console.log('Robot marker added:', {
        positionMeters: [centerXMeters.toFixed(2), centerYMeters.toFixed(2)],
        positionPixels: [centerXPixels.toFixed(1), centerYPixels.toFixed(1)],
        scale: robotScale.toFixed(2)
      });
    } catch (error) {
      console.error('Error creating robot marker:', error);
    }
  }

  private addTestMarker(): void {
    try {
      // Add test marker at 1/4 position (25% from origin)
      const testXMeters = this.mapWidthMeters * 0.25;
      const testYMeters = this.mapHeightMeters * 0.25;
      
      const testXPixels = this.metersToPixelsX(testXMeters);
      const testYPixels = this.metersToPixelsY(testYMeters);

      const testMarker = marker([testYPixels, testXPixels], {
        icon: new Icon({
          iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
              <circle cx="10" cy="10" r="8" fill="red" stroke="black" stroke-width="2"/>
            </svg>
          `),
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      });
      testMarker.addTo(this.map);
      
      console.log('Test marker added:', {
        positionMeters: [testXMeters.toFixed(2), testYMeters.toFixed(2)],
        positionPixels: [testXPixels.toFixed(1), testYPixels.toFixed(1)]
      });
    } catch (error) {
      console.error('Error creating test marker:', error);
    }
  }

  // Method to update robot position and rotation (input in meters)
  public updateRobotPosition(xMeters: number, yMeters: number, angle: number): void {
    if (this.robotMarker) {
      // Convert meters to pixels for Leaflet
      const xPixels = this.metersToPixelsX(xMeters);
      const yPixels = this.metersToPixelsY(yMeters);
      
      this.robotMarker.setLatLng([yPixels, xPixels]);
      this.robotMarker.rotate(angle);
      
      console.log('Robot position updated:', {
        metersInput: [xMeters, yMeters],
        pixelsConverted: [xPixels, yPixels],
        angle: angle
      });
    }
  }

  // Method to get current robot pose in meters
  public getRobotPose(): { x: number, y: number, angle: number } | null {
    if (this.robotMarker) {
      const pose = this.robotMarker.getPose();
      // Convert from pixels back to meters
      return {
        x: this.pixelsToMetersX(pose.x),
        y: this.pixelsToMetersY(pose.y),
        angle: pose.angle
      };
    }
    return null;
  }

  // Method to log current robot state (for testing)
  public logRobotState(): void {
    const pose = this.getRobotPose();
    if (pose) {
      console.log('Current robot pose:', pose);
    }
  }

  // Methods for UI display (showing values in meters)
  public getRobotPositionText(): string {
    const pose = this.getRobotPose();
    if (pose) {
      return `(${pose.x.toFixed(2)}m, ${pose.y.toFixed(2)}m)`;
    }
    return 'Unknown';
  }

  public getRobotRotationText(): string {
    const pose = this.getRobotPose();
    if (pose) {
      return `${pose.angle.toFixed(1)}°`;
    }
    return 'Unknown';
  }

  // Additional methods for debugging
  public getMapDimensionsText(): string {
    if (this.mapWidthMeters && this.mapHeightMeters) {
      return `${this.mapWidthMeters.toFixed(1)}m × ${this.mapHeightMeters.toFixed(1)}m`;
    }
    return 'Unknown';
  }

  public getResolutionText(): string {
    if (this.resolution) {
      return `${(this.resolution * 1000).toFixed(1)}mm/pixel`;
    }
    return 'Unknown';
  }

  public getOriginText(): string {
    if (this.mapOrigin) {
      return `(${this.mapOrigin.x.toFixed(2)}m, ${this.mapOrigin.y.toFixed(2)}m, ${this.mapOrigin.theta.toFixed(1)}°)`;
    }
    return 'Unknown';
  }

  // Retry connection method
  public retryConnection(): void {
    this.hasError = false;
    this.errorMessage = '';
    console.log('Retrying connection to map service...');
    this.ngOnInit();
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
    if (this.originMarker) {
      this.originMarker.remove();
    }
    if (this.markersLayer) {
      this.markersLayer.clearLayers();
    }
  }
}
