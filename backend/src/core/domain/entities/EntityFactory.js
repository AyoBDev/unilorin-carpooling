/**
 * Entity Factory
 * Creates appropriate entity instances based on type
 */

const { User, Student, Staff, Driver, Vehicle } = require('./index');

class EntityFactory {
  /**
   * Create a user entity based on role
   */
  static createUser(userData) {
    switch (userData.userRole) {
      case 'student':
        return new Student(userData);
      case 'staff':
        return new Staff(userData);
      case 'admin':
        return new User({ ...userData, userRole: 'admin' });
      default:
        throw new Error(`Invalid user role: ${userData.userRole}`);
    }
  }

  /**
   * Create a driver entity
   */
  static createDriver(driverData) {
    return new Driver(driverData);
  }

  /**
   * Create a vehicle entity
   */
  static createVehicle(vehicleData) {
    return new Vehicle(vehicleData);
  }

  /**
   * Create entity from database data
   */
  static fromDatabase(entityType, data) {
    switch (entityType) {
      case 'user':
        return User.fromDatabase(data);
      case 'student':
        return Student.fromDatabase(data);
      case 'staff':
        return Staff.fromDatabase(data);
      case 'driver':
        return Driver.fromDatabase(data);
      case 'vehicle':
        return Vehicle.fromDatabase(data);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }
}

module.exports = EntityFactory;
