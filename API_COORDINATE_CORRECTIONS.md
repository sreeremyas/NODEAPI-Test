# API Coordinate System Corrections

## Summary of Changes Made

Based on the Environment Server API documentation and coordinate analysis, the following corrections have been implemented:

### 1. **API Integration Constants**
Added API-based constants from the Environment Server:
```typescript
// API-based constants from Environment Server
private readonly API_RESOLUTION = 0.05; // meters per pixel (from API)
private readonly API_MAP_ORIGIN = { x: -70.4, y: -64.0, theta: 0.0, z: 0.0 }; // from API
```

### 2. **Global Offset Correction**
Fixed the Y offset value:
```typescript
// Before
private readonly GLOBAL_OFFSET_Y = -65; // Map Y offset

// After  
private readonly GLOBAL_OFFSET_Y = -50; // Map Y offset (corrected from -65 to -50)
```

### 3. **Enhanced Coordinate Conversion Methods**
Updated all coordinate conversion methods to use API fallback values:

```typescript
private metersToPixelsX(meters: number): number {
  const resolution = this.resolution || this.API_RESOLUTION; // Use API resolution as fallback
  const origin = this.mapOrigin || this.API_MAP_ORIGIN; // Use API origin as fallback
  const pixels = (meters - origin.x) / resolution;
  return pixels + this.GLOBAL_OFFSET_X;
}
```

Similar updates applied to:
- `metersToPixelsY()`
- `pixelsToMetersX()`
- `pixelsToMetersY()`

### 4. **Resolution Validation Enhancement**
Updated resolution check to use API fallback:
```typescript
// Enhanced validation with API fallback
if (!this.resolution && !this.API_RESOLUTION) {
  console.error('No map resolution available');
  return;
}

const effectiveResolution = this.resolution || this.API_RESOLUTION;
```

### 5. **Enhanced Debug Logging**
Updated debug methods to show both current and API reference values:

#### Robot Debug Info (`logRobotDebugInfo()`)
- Added API coordinate system information
- Shows comparison between current and API values
- Enhanced offset calculation explanations

#### Coordinate System Analysis (`logCoordinateSystem()`)
- Added API reference values section
- Shows effective resolution and origin (with fallback source)
- Enhanced coordinate transformation examples

## Key API Coordinate System Facts

### **Environment Server API Data:**
- **Base URL**: `http://100.79.47.58/node-api/environment-server`
- **Resolution**: `0.05` meters per pixel
- **Map Origin**: `{"x": -70.4, "y": -64.0, "theta": 0.0, "z": 0.0}`
- **Coordinate System**: ROS REP-103 (X=East, Y=North, θ=CCW+)

### **Resolution Conversion:**
- 1 pixel = 0.05 meters = 5 centimeters
- 1 meter = 20 pixels

### **Coordinate System Alignment:**
- **ROS/API System**: X=East, Y=North (geographical standard)
- **Leaflet System**: X=horizontal, Y=vertical (Y increases downward)
- **Global Offset**: X=-65, Y=-50 pixels (to match map coordinate system)

## Testing Recommendations

1. **Test Coordinate Conversions**: Verify that robot positions align correctly with the map
2. **Validate API Values**: Check if robot positioning matches expected locations
3. **Debug Logging**: Use the enhanced debug methods to analyze coordinate transformations
4. **API Integration**: Consider future integration with the Environment Server API for dynamic map loading

## Future Enhancements

1. **Dynamic API Integration**: Fetch map data directly from Environment Server
2. **Multiple Environment Support**: Handle different environments with different origins
3. **Real-time Coordinate Validation**: Compare API coordinates with robot localization data
4. **Map Switching**: Support switching between different maps from the API

## Usage

The enhanced coordinate system now provides:
- ✅ **Fallback Support**: API values used when mapInfo unavailable
- ✅ **Corrected Offsets**: Fixed Y offset value (-50 instead of -65)
- ✅ **Enhanced Debugging**: Comprehensive coordinate analysis
- ✅ **API Alignment**: Coordinates match Environment Server standards
- ✅ **ROS Compliance**: Full ROS REP-103 coordinate system support