/**
 * Location Value Object
 */
class Location {
  constructor({ address, coordinates, name = null }) {
    this.address = address;
    this.coordinates = coordinates; // { lat, lng }
    this.name = name;

    this.validate();
  }

  validate() {
    if (!this.address) {
      throw new Error('Address is required');
    }

    if (!this.coordinates || !this.coordinates.lat || !this.coordinates.lng) {
      throw new Error('Valid coordinates (lat, lng) are required');
    }

    if (this.coordinates.lat < -90 || this.coordinates.lat > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }

    if (this.coordinates.lng < -180 || this.coordinates.lng > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
  }

  equals(other) {
    if (!(other instanceof Location)) return false;

    return (
      this.coordinates.lat === other.coordinates.lat &&
      this.coordinates.lng === other.coordinates.lng
    );
  }

  distanceTo(other) {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in kilometers
    const lat1 = (this.coordinates.lat * Math.PI) / 180;
    const lat2 = (other.coordinates.lat * Math.PI) / 180;
    const deltaLat = ((other.coordinates.lat - this.coordinates.lat) * Math.PI) / 180;
    const deltaLng = ((other.coordinates.lng - this.coordinates.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in kilometers
  }

  toJSON() {
    return {
      address: this.address,
      coordinates: this.coordinates,
      name: this.name,
    };
  }
}

module.exports = Location;
