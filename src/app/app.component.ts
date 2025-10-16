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
  private mapOrigin: { x: number, y: number, theta: number, z: number } | null = null;
  private originMarker: any = null;
  private isLocalized: boolean = false;
  private localizationConfidence: number = 0;
  private mapName: string = '';
  public hasError: boolean = false;
  public errorMessage: string = '';

  constructor(private mapService: MapService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    // Fetch initial AMR state data
    this.mapService.getMapData().subscribe({
      next: (amrState) => {
        console.log('AMR State received:', amrState);
        
        // Check if localization and map data are available
        if (!amrState.localization) {
          console.error('No localization data in AMR State');
          this.hasError = true;
          this.errorMessage = 'No localization data available from AMR';
          return;
        }
        
        if (!amrState.localization.map) {
          console.error('No map data in localization');
          this.hasError = true;
          this.errorMessage = 'No map data available in localization';
          return;
        }
        
        // Extract map information from AMR State
        const mapInfo = amrState.localization.map;
        this.mapId = mapInfo.data; // UUID for map resource
        this.resolution = mapInfo.resolution; // resolution in meters/pixel
        this.mapOrigin = mapInfo.origin; // Pose25D with x, y, theta, z
        this.mapName = mapInfo.name; // Human readable map name
        
        console.log('Map ID (UUID):', this.mapId);
        console.log('Map resolution:', this.resolution, 'meters/pixel');
        console.log('Map origin (Pose25D):', this.mapOrigin);
        console.log('Map name:', mapInfo.name);
        
        // Check localization status
        this.isLocalized = amrState.localization.localized;
        this.localizationConfidence = amrState.localization.confidence;
        console.log('Localization status:', { 
          localized: this.isLocalized, 
          confidence: this.localizationConfidence 
        });
        
        if (!this.isLocalized) {
          console.warn('AMR is not localized - initial pose may be required');
        }
        
        if (this.localizationConfidence < 0.5) {
          console.warn('Low localization confidence:', this.localizationConfidence);
        }
        
        this.loadMapImage();
      },
      error: (error) => {
        console.error('Error fetching AMR State:', error);
        this.hasError = true;
        this.errorMessage = 'Failed to fetch AMR State from server. Please check if the AMR service is running at http://192.168.1.81';
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
      minZoom: -5,
      maxZoom: 5,
      zoomControl: true,
      attributionControl: false,
      zoomSnap: 0.25, // Allow quarter-step zooming for smoother experience
      zoomDelta: 0.25, // Use quarter steps for zoom controls
      wheelPxPerZoomLevel: 120, // Smoother mouse wheel zooming
      fadeAnimation: false, // Disable fade animation to prevent visual glitches
      zoomAnimation: true, // Keep zoom animation for smoothness
      markerZoomAnimation: true // Animate markers during zoom
    });

    // Don't set an initial view yet - wait for the image to load
    if (this.mapImageUrl) {
      this.displayMapImage();
    }
  }

  // Coordinate conversion methods - Direct mapping without Y-axis flip
  // Map origin represents the real-world coordinates of the bottom-left corner of the PNG image
  // X increases from left to right, Y increases downward (decreases when going up)
  // Direct pixel-to-meter mapping for both X and Y coordinates

  private metersToPixelsX(meters: number): number {
    // X: Convert real-world meters to pixels, origin is bottom-left
    const pixels = (meters - (this.mapOrigin?.x || 0)) / this.resolution;
    return pixels;
  }

  private metersToPixelsY(meters: number): number {
    // Y: Convert real-world meters to pixels, with Y decreasing when going up
    // No Y-axis flip - direct mapping where higher Y meters = higher Y pixels (down on screen)
    const metersFromOrigin = meters - (this.mapOrigin?.y || 0);
    const pixelsFromOrigin = metersFromOrigin / this.resolution;
    return pixelsFromOrigin;
  }

  private pixelsToMetersX(pixels: number): number {
    // X: Convert pixels back to meters, origin is bottom-left
    return (this.mapOrigin?.x || 0) + (pixels * this.resolution);
  }

  private pixelsToMetersY(pixels: number): number {
    // Y: Convert pixels back to meters, with Y decreasing when going up
    // Direct mapping - no Y-axis flip
    const metersFromOrigin = pixels * this.resolution;
    return (this.mapOrigin?.y || 0) + metersFromOrigin;
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

      // Convert origin coordinates from meters to pixels - direct mapping
      const originXPixels = this.metersToPixelsX(this.mapOrigin.x);
      const originYPixels = this.metersToPixelsY(this.mapOrigin.y);

      // Create crosshair SVG icon that scales better with zoom
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
            <!-- Origin label with height info -->
            <text x="20" y="52" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" fill="#666666" opacity="0.8">ORIGIN</text>
            <text x="20" y="62" text-anchor="middle" font-family="Arial, sans-serif" font-size="6" fill="#666666" opacity="0.6">Z: ${this.mapOrigin.z.toFixed(2)}m</text>
          </svg>
        `),
        iconSize: [crosshairSize, crosshairSize + 22], // Extra height for labels
        iconAnchor: [crosshairSize / 2, crosshairSize / 2] // Center the crosshair
      });

      // Create the origin marker
      this.originMarker = marker([originYPixels, originXPixels], {
        icon: crosshairIcon,
        interactive: false, // Make it non-interactive so it doesn't interfere with map interactions
        zIndexOffset: -1000 // Put it behind other markers
      });

      this.originMarker.addTo(this.map);

      console.log('Origin crosshair added (ROS REP-103):', {
        originMeters: [this.mapOrigin.x, this.mapOrigin.y, this.mapOrigin.z],
        originPixels: [originXPixels.toFixed(1), originYPixels.toFixed(1)],
        theta: this.mapOrigin.theta,
        thetaDegrees: (this.mapOrigin.theta * 180 / Math.PI).toFixed(1)
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
      // Note: In CRS.Simple, coordinates are [y, x] not [lat, lng]
      // Use exact pixel boundaries to maintain aspect ratio
      const bounds = new LatLngBounds(
        [0, 0], // Southwest corner (bottom-left)
        [this.mapHeightPixels, this.mapWidthPixels] // Northeast corner (top-right)
      );

      // Add the image overlay to the map with proper options
      const imageLayer = imageOverlay(this.mapImageUrl!, bounds, {
        interactive: false, // Prevent interaction issues
        crossOrigin: 'anonymous' // Prevent CORS issues
      });
      imageLayer.addTo(this.map);

      // Calculate proper initial zoom to maintain aspect ratio
      const mapContainer = this.map.getContainer();
      const containerWidth = mapContainer.clientWidth;
      const containerHeight = mapContainer.clientHeight;
      
      // Calculate zoom that fits the image properly
      const widthRatio = containerWidth / this.mapWidthPixels;
      const heightRatio = containerHeight / this.mapHeightPixels;
      const optimalRatio = Math.min(widthRatio, heightRatio);
      
      // Convert ratio to Leaflet zoom level (approximately)
      const baseZoom = Math.log2(optimalRatio);
      const initialZoom = Math.max(-3, Math.min(1, baseZoom)); // Clamp between -3 and 1

      // Set the map view to center with calculated zoom
      const center: [number, number] = [this.mapHeightPixels / 2, this.mapWidthPixels / 2];
      this.map.setView(center, initialZoom);

      // Set maximum bounds with minimal padding to prevent coordinate drift
      const paddedBounds = bounds.pad(0.02); // Only 2% padding to prevent drift
      this.map.setMaxBounds(paddedBounds);
      
      // Add event listeners to maintain aspect ratio and prevent proportion loss
      this.map.on('zoom', () => {
        // Get current zoom level and bounds
        const currentZoom = this.map.getZoom();
        const currentBounds = this.map.getBounds();
        
        // Check if we've drifted outside acceptable bounds
        if (!bounds.intersects(currentBounds)) {
          console.log('Correcting map bounds drift at zoom:', currentZoom);
          // Gently correct the view without jarring animation
          this.map.fitBounds(bounds, { 
            animate: false,
            maxZoom: currentZoom // Maintain current zoom level
          });
        }
      });
      
      // Add resize event listener to handle window/container size changes
      this.map.on('resize', () => {
        // Recalculate optimal zoom when container size changes
        setTimeout(() => {
          const mapContainer = this.map.getContainer();
          const newContainerWidth = mapContainer.clientWidth;
          const newContainerHeight = mapContainer.clientHeight;
          
          if (newContainerWidth > 0 && newContainerHeight > 0) {
            const newWidthRatio = newContainerWidth / this.mapWidthPixels;
            const newHeightRatio = newContainerHeight / this.mapHeightPixels;
            const newOptimalRatio = Math.min(newWidthRatio, newHeightRatio);
            const newBaseZoom = Math.log2(newOptimalRatio);
            const newOptimalZoom = Math.max(-3, Math.min(1, newBaseZoom));
            
            // Only adjust if the change is significant
            const currentZoom = this.map.getZoom();
            if (Math.abs(currentZoom - newOptimalZoom) > 0.5) {
              this.map.setZoom(newOptimalZoom);
            }
          }
        }, 100); // Small delay to ensure resize is complete
      });
      
      // Add markers layer after the image is loaded
      this.markersLayer.addTo(this.map);

      // Add robot marker at the center of the map
      this.addRobotMarker();
      
      // Add crosshair at the origin
      this.addOriginCrosshair();
      
      console.log('Map initialized with proper aspect ratio:', {
        containerSize: [containerWidth, containerHeight],
        imageSize: [this.mapWidthPixels, this.mapHeightPixels],
        initialZoom: initialZoom.toFixed(2),
        center: center
      });
    };
    img.src = this.mapImageUrl!;
  }

  private addRobotMarker(): void {
    try {
      // Remove existing robot marker
      if (this.robotMarker) {
        this.robotMarker.remove();
      }

      // Place robot at center of map in real-world coordinates
      // Center is origin + half the map dimensions
      const centerXMeters = (this.mapOrigin?.x || 0) + (this.mapWidthMeters / 2);
      const centerYMeters = (this.mapOrigin?.y || 0) + (this.mapHeightMeters / 2);
      
      const centerXPixels = this.metersToPixelsX(centerXMeters);
      const centerYPixels = this.metersToPixelsY(centerYMeters);

      // Calculate robot scale based on its physical size
      const robotScale = this.calculateRobotScale();
      
      // Create robot marker (note: Leaflet uses [lat, lng] which maps to [y, x] in pixels)
      // Direct coordinate mapping without Y-axis flipping
      this.robotMarker = new RotatableMarker([centerYPixels, centerXPixels], { scale: robotScale });
      
      // Add event listeners for real-time position updates
      this.robotMarker.on('drag', () => {
        this.cdr.detectChanges();
      });
      
      this.robotMarker.on('dragend', () => {
        const pose = this.getRobotPose();
        if (pose && this.robotMarker) {
          const rawPose = this.robotMarker.getPose();
          console.log('Robot moved to (meters):', pose);
          console.log('Raw Leaflet position:', {
            leafletX: rawPose.x.toFixed(2),
            leafletY: rawPose.y.toFixed(2),
            angle: rawPose.angle.toFixed(2)
          });
        }
        this.cdr.detectChanges();
      });
      
      // Add zoom event listener to maintain robot visibility
      this.map.on('zoomend', () => {
        this.cdr.detectChanges();
      });
      
      this.robotMarker.addTo(this.map);
      
      console.log('Robot marker added:', {
        positionMeters: [centerXMeters.toFixed(2), centerYMeters.toFixed(2)],
        positionPixels: [centerXPixels.toFixed(1), centerYPixels.toFixed(1)],
        leafletCoords: [centerYPixels.toFixed(1), centerXPixels.toFixed(1)],
        scale: robotScale.toFixed(2)
      });
    } catch (error) {
      console.error('Error creating robot marker:', error);
    }
  }

  // Method to update robot position and rotation (input: meters for position, degrees for angle)
  // ROS REP-103 COMPLIANT: 0° = East, 90° = North, 180° = West, 270° = South
  // Counter-clockwise positive rotation (yaw increases counter-clockwise)
  public updateRobotPosition(xMeters: number, yMeters: number, angleDegrees: number): void {
    if (this.robotMarker) {
      // Convert meters to pixels using direct coordinate mapping
      const xPixels = this.metersToPixelsX(xMeters);
      const yPixels = this.metersToPixelsY(yMeters);
      
      // Direct coordinate mapping without Y-axis flipping
      this.robotMarker.setLatLng([yPixels, xPixels]);
      this.robotMarker.rotate(angleDegrees); // RotatableMarker expects degrees (0°=East, 90°=North, 180°=West, 270°=South)
      
      console.log('Robot position updated:', {
        metersInput: [xMeters, yMeters],
        pixelsConverted: [xPixels.toFixed(1), yPixels.toFixed(1)],
        leafletCoords: [yPixels.toFixed(1), xPixels.toFixed(1)],
        angleDegrees: angleDegrees,
        angleRadians: (angleDegrees * Math.PI / 180).toFixed(3)
      });
    }
  }

  // Method to update robot position and rotation using radians (ROS REP-103 preferred)
  // ROS REP-103 COMPLIANT: 0 rad = East, π/2 rad = North, π rad = West, 3π/2 rad = South  
  // Counter-clockwise positive rotation (yaw increases counter-clockwise)
  public updateRobotPositionRadians(xMeters: number, yMeters: number, angleRadians: number): void {
    const angleDegrees = angleRadians * 180 / Math.PI;
    this.updateRobotPosition(xMeters, yMeters, angleDegrees);
  }

  // Method to get current robot pose in meters (angle in degrees)
  // ROS REP-103 COMPLIANT: 0° = East, 90° = North, 180° = West, 270° = South
  public getRobotPose(): { x: number, y: number, angle: number } | null {
    if (this.robotMarker) {
      const pose = this.robotMarker.getPose();

      // Direct coordinate mapping without Y-axis flipping
      // Reverse the direction of the angle (make clockwise positive)
      return {
        x: this.pixelsToMetersX(pose.x),
        y: this.pixelsToMetersY(pose.y),
        angle: (360 - pose.angle) % 360 // Clockwise positive, 0°=East, 90°=South, 180°=West, 270°=North
      };
    }
    return null;
  }

  // Method to get current robot pose with radians (ROS REP-103 preferred)
  // ROS REP-103 COMPLIANT: 0 rad = East, π/2 rad = North, π rad = West, 3π/2 rad = South
  public getRobotPoseRadians(): { x: number, y: number, angleRadians: number } | null {
    if (this.robotMarker) {
      const pose = this.robotMarker.getPoseRadians();
      
      // Direct coordinate mapping without Y-axis flipping
      // Convert from pixels back to meters using direct coordinate system
      return {
        x: this.pixelsToMetersX(pose.x),
        y: this.pixelsToMetersY(pose.y),
        angleRadians: pose.angleRadians // This is in radians from RotatableMarker (ROS REP-103 compliant)
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
    
    // Also log raw Leaflet positions for debugging
    if (this.robotMarker) {
      const rawPose = this.robotMarker.getPose();
      console.log('Raw Leaflet position:', {
        leafletX: rawPose.x,
        leafletY: rawPose.y,
        angleDegrees: rawPose.angle
      });
    }
  }

  // Method to log current robot state in radians (ROS REP-103 preferred)
  public logRobotStateRadians(): void {
    const poseRadians = this.getRobotPoseRadians();
    if (poseRadians) {
      console.log('Current robot pose (radians):', poseRadians);
    }
    
    // Also log raw Leaflet positions for debugging
    if (this.robotMarker) {
      const rawPose = this.robotMarker.getPoseRadians();
      console.log('Raw Leaflet position (radians):', {
        leafletX: rawPose.x,
        leafletY: rawPose.y,
        angleRadians: rawPose.angleRadians
      });
    }
  }

  // Helper method to get orientation description (ROS REP-103 compliant)
  private getOrientationDescription(angleDegrees: number): string {
    // Normalize angle to 0-360 range
    const normalizedAngle = ((angleDegrees % 360) + 360) % 360;
    
    if (normalizedAngle >= 315 || normalizedAngle < 45) {
      return 'East (0°/0 rad)';
    } else if (normalizedAngle >= 45 && normalizedAngle < 135) {
      return 'North (90°/π/2 rad)';
    } else if (normalizedAngle >= 135 && normalizedAngle < 225) {
      return 'West (180°/π rad)';
    } else {
      return 'South (270°/3π/2 rad)';
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
      const radians = pose.angle * Math.PI / 180;
      const direction = this.getOrientationDescription(pose.angle);
      return `${pose.angle.toFixed(1)}° (${radians.toFixed(3)} rad) - ${direction}`;
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
      return `${this.resolution } m/pixel`;
    }
    return 'Unknown';
  }

  public getOriginText(): string {
    if (this.mapOrigin) {
      const thetaDegrees = (this.mapOrigin.theta * 180 / Math.PI).toFixed(1);
      return `(${this.mapOrigin.x.toFixed(2)}m, ${this.mapOrigin.y.toFixed(2)}m, ${this.mapOrigin.z.toFixed(2)}m, ${thetaDegrees}°)`;
    }
    return 'Unknown';
  }

  public getZoomLevelText(): string {
    if (this.map) {
      return `Zoom: ${this.map.getZoom().toFixed(1)}`;
    }
    return 'Unknown';
  }

  public getMapNameText(): string {
    return this.mapName || 'Unknown';
  }

  public getLocalizationStatusText(): string {
    if (this.isLocalized) {
      return `Localized (${(this.localizationConfidence * 100).toFixed(1)}%)`;
    }
    return 'Not Localized';
  }

  public getLocalizationConfidenceColor(): string {
    if (!this.isLocalized) return '#ff4444'; // Red for not localized
    if (this.localizationConfidence >= 0.8) return '#44ff44'; // Green for high confidence
    if (this.localizationConfidence >= 0.5) return '#ffaa44'; // Orange for medium confidence
    return '#ff4444'; // Red for low confidence
  }

  // Retry connection method
  public retryConnection(): void {
    this.hasError = false;
    this.errorMessage = '';
    console.log('Retrying connection to map service...');
    this.ngOnInit();
  }

  // Initialize localization with current robot position
  public initializeLocalization(): void {
    const robotPose = this.getRobotPose();
    if (!robotPose) {
      console.error('Cannot initialize localization: Robot pose not available');
      alert('Error: Robot position not available. Please ensure the robot marker is properly positioned.');
      return;
    }

    // Convert angle from degrees to radians for API
    const angleInRadians = robotPose.angle * Math.PI / 180;

    console.log('Initializing localization with robot pose:', {
      positionMeters: [robotPose.x, robotPose.y],
      angleDegrees: robotPose.angle,
      angleRadians: angleInRadians
    });

    this.mapService.initializeLocalization(robotPose.x, robotPose.y, angleInRadians).subscribe({
      next: (response) => {
        console.log('Localization initialized successfully:', response);
        alert(`Localization initialized successfully!\nPosition: (${robotPose.x.toFixed(2)}m, ${robotPose.y.toFixed(2)}m)\nAngle: ${robotPose.angle.toFixed(1)}° (${angleInRadians.toFixed(3)} rad)`);
        
        // Refresh AMR state to get updated localization status
        this.ngOnInit();
      },
      error: (error) => {
        console.error('Error initializing localization:', error);
        let errorMessage = 'Failed to initialize localization.';
        
        if (error.status === 403) {
          errorMessage = 'Forbidden: Check API permissions or authentication.';
        } else if (error.status === 404) {
          errorMessage = 'API endpoint not found. Check server configuration.';
        } else if (error.status === 422) {
          errorMessage = 'Validation error: Invalid position data.';
        } else if (error.error && error.error.error_details) {
          errorMessage = `Error: ${error.error.error_details}`;
        }
        
        alert(`Localization initialization failed!\n${errorMessage}\n\nPosition attempted: (${robotPose.x.toFixed(2)}m, ${robotPose.y.toFixed(2)}m)\nAngle: ${robotPose.angle.toFixed(1)}° (${angleInRadians.toFixed(3)} rad)`);
      }
    });
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
