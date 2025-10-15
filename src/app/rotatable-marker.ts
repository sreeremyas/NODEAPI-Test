import { Icon, Marker, DivIcon, DragEndEvent, Map } from 'leaflet';

/**
 * RotatableMarker class for displaying a robot with position and orientation
 * 
 * ROS REP-103 COMPLIANT ORIENTATION SYSTEM:
 * - 0° (0 rad) = facing East (positive X direction)
 * - 90° (π/2 rad) = facing North (positive Y direction)  
 * - 180° (π rad) = facing West (negative X direction)
 * - 270° (3π/2 rad) = facing South (negative Y direction)
 * 
 * This follows ROS REP-103 standard:
 * - Right-hand rule coordinate system
 * - Counter-clockwise positive rotation (yaw increases counter-clockwise)
 * - Zero yaw when pointing East
 * - Angles in radians (internal storage in degrees for CSS compatibility)
 */
export class RotatableMarker extends Marker {
  private angleDegrees: number = 0; // Internal storage in degrees for CSS transform compatibility
  private customIcon!: DivIcon;
  private scale: number;
  private isDragging: boolean = false;
  private isRotating: boolean = false;

  constructor(latlng: [number, number], options?: { scale?: number }) {
    super(latlng);
    
    this.scale = options?.scale || 1;
    this.createIcon();
    
    // Enable dragging
    this.dragging?.enable();
    
    // Add event listeners after the marker is added to the map
    this.on('add', () => {
      this.setupInteractions();
    });

    // Add drag events for position updates
    this.on('dragend', (e: DragEndEvent) => {
      const position = e.target.getLatLng();
      console.log('Robot moved to:', [position.lat, position.lng]);
    });
  }

  private createIcon(): void {
    const size = 30 * this.scale;
    
    this.customIcon = new DivIcon({
      className: 'robot-marker',
      html: `
        <div class="robot-container" style="position: relative; width: ${size}px; height: ${size}px;">
          <div class="robot-icon" style="
            transform: rotate(${this.angleDegrees}deg);
            width: ${size}px;
            height: ${size}px;
            background-image: url('assets/robot.png');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            background-color: #ff4444;
            border: 2px solid #000;
            border-radius: 50%;
            transition: transform 0.3s ease-out;
            cursor: move;
            position: relative;
          "></div>
          <div class="rotation-handle" style="
            position: absolute;
            top: -10px;
            right: -10px;
            width: 20px;
            height: 20px;
            background-color: #4CAF50;
            border: 2px solid #fff;
            border-radius: 50%;
            cursor: grab;
            z-index: 1000;
          " title="Drag to rotate"></div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });

    this.setIcon(this.customIcon);
  }

  private setupInteractions(): void {
    const markerElement = this.getElement();
    if (!markerElement) return;

    const rotationHandle = markerElement.querySelector('.rotation-handle') as HTMLElement;
    const robotIcon = markerElement.querySelector('.robot-icon') as HTMLElement;

    if (rotationHandle) {
      this.setupRotationInteraction(rotationHandle, markerElement);
    }

    if (robotIcon) {
      // Add click event for rotation increment
      robotIcon.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.rotate(this.angleDegrees + 45);
      });
    }
  }

  private setupRotationInteraction(handle: HTMLElement, markerElement: HTMLElement): void {
    let startAngle = 0;
    let startMouseAngle = 0;

    const getMouseAngle = (e: MouseEvent, center: { x: number, y: number }) => {
      const dx = e.clientX - center.x;
      const dy = e.clientY - center.y;
      // Use standard atan2 (dy, dx) for counter-clockwise angle increases
      return Math.atan2(dy, dx) * 180 / Math.PI;
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      this.isRotating = true;
      this.dragging?.disable(); // Disable marker dragging during rotation
      
      const rect = markerElement.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      
      startAngle = this.angleDegrees;
      startMouseAngle = getMouseAngle(e, center);
      
      handle.style.cursor = 'grabbing';
      document.body.style.cursor = 'grabbing';

      const onMouseMove = (e: MouseEvent) => {
        if (!this.isRotating) return;
        
        const currentMouseAngle = getMouseAngle(e, center);
        const deltaAngle = currentMouseAngle - startMouseAngle;
        // Direct delta angle calculation for counter-clockwise increases
        const newAngle = startAngle + deltaAngle;
        
        this.setRotationAngle(newAngle);
      };

      const onMouseUp = () => {
        this.isRotating = false;
        this.dragging?.enable(); // Re-enable marker dragging
        
        handle.style.cursor = 'grab';
        document.body.style.cursor = 'default';
        
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        console.log('Robot rotated to:', this.angleDegrees, 'degrees');
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
  }

  // Method to rotate the marker
  // @param angle: Orientation in degrees (0°=East, 90°=North, 180°=West, 270°=South)
  // Angles increase counter-clockwise (ROS REP-103 standard)
  public rotate(angle: number): void {
    this.setRotationAngle(angle);
  }

  // Method to rotate the marker using radians (ROS REP-103 preferred)
  // @param angleRadians: Orientation in radians (0=East, π/2=North, π=West, 3π/2=South)
  // Angles increase counter-clockwise (ROS REP-103 standard)
  public rotateRadians(angleRadians: number): void {
    const angleDegrees = angleRadians * 180 / Math.PI;
    this.setRotationAngle(angleDegrees);
  }

  // Method to get current rotation in radians (ROS REP-103 compliant)
  public getRotationRadians(): number {
    return this.angleDegrees * Math.PI / 180;
  }

  // Method to set rotation angle with normalization
  private setRotationAngle(angle: number): void {
    // Normalize angle to 0-360 range
    this.angleDegrees = ((angle % 360) + 360) % 360;
    this.updateIcon();
  }

  // Method to get current rotation
  public getRotation(): number {
    return this.angleDegrees;
  }

  // Method to update the scale
  public setScale(scale: number): void {
    this.scale = scale;
    this.updateIcon();
  }

  // Update the icon with current angle and scale
  private updateIcon(): void {
    const size = 30 * this.scale;
    const newIcon = new DivIcon({
      className: 'robot-marker',
      html: `
        <div class="robot-container" style="position: relative; width: ${size}px; height: ${size}px;">
          <div class="robot-icon" style="
            transform: rotate(${this.angleDegrees}deg);
            width: ${size}px;
            height: ${size}px;
            background-image: url('assets/robot.png');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            background-color: #ff4444;
            border: 2px solid #000;
            border-radius: 50%;
            transition: transform 0.3s ease-out;
            cursor: move;
            position: relative;
          "></div>
          <div class="rotation-handle" style="
            position: absolute;
            top: -10px;
            right: -10px;
            width: 20px;
            height: 20px;
            background-color: #4CAF50;
            border: 2px solid #fff;
            border-radius: 50%;
            cursor: grab;
            z-index: 1000;
          " title="Drag to rotate"></div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
    
    this.setIcon(newIcon);
    
    // Re-setup interactions after icon update
    setTimeout(() => {
      this.setupInteractions();
    }, 10);
  }

  // Method to get current position and rotation as an object
  public getPose(): { x: number, y: number, angle: number } {
    const pos = this.getLatLng();
    return {
      x: pos.lng,
      y: pos.lat,
      angle: this.angleDegrees
    };
  }

  // Method to get current position and rotation with radians (ROS REP-103 compliant)
  public getPoseRadians(): { x: number, y: number, angleRadians: number } {
    const pos = this.getLatLng();
    return {
      x: pos.lng,
      y: pos.lat,
      angleRadians: this.angleDegrees * Math.PI / 180
    };
  }
}
