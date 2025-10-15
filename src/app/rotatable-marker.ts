import { Icon, Marker, DivIcon } from 'leaflet';

export class RotatableMarker extends Marker {
  private angle: number = 0;
  private customIcon: DivIcon;
  private scale: number;

  constructor(latlng: [number, number], options?: { scale?: number }) {
    super(latlng);
    
    this.scale = options?.scale || 1;
    const size = 30 * this.scale; // Base size of 30 pixels, scaled by the map zoom

    // Create a custom div icon with the robot image
    this.customIcon = new DivIcon({
      className: 'robot-marker',
      html: `<div style="
        transform: rotate(${this.angle}deg);
        width: ${size}px;
        height: ${size}px;
        background-image: url('assets/images/robot.png');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        transition: transform 0.3s ease-out;
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });

    this.setIcon(this.customIcon);
  }

  // Method to rotate the marker
  rotate(angle: number) {
    this.angle = angle;
    this.updateIcon();
  }

  // Method to update the scale
  setScale(scale: number) {
    this.scale = scale;
    this.updateIcon();
  }

  // Update the icon with current angle and scale
  private updateIcon() {
    const size = 30 * this.scale;
    const newIcon = new DivIcon({
      className: 'robot-marker',
      html: `<div style="
        transform: rotate(${this.angle}deg);
        width: ${size}px;
        height: ${size}px;
        background-image: url('assets/images/robot.png');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        transition: transform 0.3s ease-out;
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
    this.setIcon(newIcon);
  }
}
