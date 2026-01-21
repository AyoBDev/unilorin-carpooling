// /**
//  * Ride Controller
//  * Path: src/api/controllers/ride.controller.js
//  *
//  * Handles all ride-related HTTP requests
//  */

// const RideService = require('@core/services/ride.service');
// const { createResponse, createErrorResponse } = require('@shared/utils/response');
// const { validateRide, validateRideSearch } = require('@api/validators/ride.validator');
// const logger = require('@shared/utils/logger');

// class RideController {
//   constructor() {
//     this.rideService = new RideService();
//   }

//   /**
//    * Create a new ride offer (Driver only)
//    * POST /api/v1/rides
//    */
//   async createRide(req, res, next) {
//     try {
//       const driverId = req.user.id;
//       const rideData = req.body;

//       // Validate input
//       const validation = validateRide(rideData);
//       if (validation.error) {
//         return res
//           .status(400)
//           .json(createErrorResponse('Validation failed', validation.error.details));
//       }

//       // Add driver information
//       rideData.driverId = driverId;

//       // Create ride
//       const ride = await this.rideService.createRide(rideData);

//       return res.status(201).json(
//         createResponse('Ride created successfully', {
//           ride,
//           shareableLink: `/rides/${ride.id}`,
//           message: `Your ride from ${ride.startLocation.area} to ${ride.endLocation.area} has been created`
//         }),
//       );
//     } catch (error) {
//       logger.error('Failed to create ride', { error, driverId });
//       next(error);
//     }
//   }

//   /**
//    * Search for available rides
//    * GET /api/v1/rides/search
//    */
//   async searchRides(req, res, next) {
//     try {
//       const {
//         date,
//         from,
//         to,
//         fromLat,
//         fromLng,
//         toLat,
//         toLng,
//         minSeats = 1,
//         maxPrice,
//         startTime,
//         endTime,
//         page = 1,
//         limit = 20,
//       } = req.query;

//       // Validate search parameters
//       const validation = validateRideSearch(req.query);
//       if (validation.error) {
//         return res
//           .status(400)
//           .json(createErrorResponse('Invalid search parameters', validation.error.details));
//       }

//       // Build search criteria
//       const searchCriteria = {
//         date: date || new Date().toISOString().split('T')[0],
//         startLocation: from ? { city: from } : (fromLat && fromLng ? { lat: parseFloat(fromLat), lng: parseFloat(fromLng) } : null),
//         endLocation: to ? { city: to } : (toLat && toLng ? { lat: parseFloat(toLat), lng: parseFloat(toLng) } : null),
//         minSeats: parseInt(minSeats),
//         maxPrice: maxPrice ? parseFloat(maxPrice) : null,
//         timeRange: startTime && endTime ? { start: startTime, end: endTime } : null
//       };

//       const rides = await this.rideService.searchRides(searchCriteria, {
//         page: parseInt(page),
//         limit: parseInt(limit)
//       });

//       // Enhance ride data with additional info
//       const enhancedRides = await this.rideService.enhanceRidesWithDriverInfo(rides);

//       return res.json(
//         createResponse('Rides found', {
//           rides: enhancedRides,
//           count: enhancedRides.length,
//           searchCriteria,
//           pagination: {
//             page: parseInt(page),
//             limit: parseInt(limit)
//           }
//         })
//       );
//     } catch (error) {
//       logger.error('Failed to search rides', { error });
//       next(error);
//     }
//   }

//   /**
//    * Get ride details
//    * GET /api/v1/rides/:rideId
//    */
//   async getRideDetails(req, res, next) {
//     try {
//       const { rideId } = req.params;
//       const includeDriver = req.query.includeDriver === 'true';

//       const ride = await this.rideService.getRideById(rideId, { includeDriver });

//       if (!ride) {
//         return res.status(404).json(createErrorResponse('Ride not found'));
//       }

//       // Get booking count if user is authenticated
//       let userBooking = null;
//       if (req.user) {
//         userBooking = await this.rideService.getUserBookingForRide(rideId, req.user.id);
//       }

//       return res.json(
//         createResponse('Ride details', {
//           ride,
//           userBooking,
//           canBook: ride.availableSeats > 0 && ride.status === 'active'
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get available rides
//    * GET /api/v1/rides
//    */
//   async getAvailableRides(req, res, next) {
//     try {
//       const { date, route, sortBy = 'departureTime', page = 1, limit = 20 } = req.query;

//       const filters = {
//         date: date || new Date().toISOString().split('T')[0],
//         route,
//         status: 'active',
//       };

//       const rides = await this.rideService.getAvailableRides(filters, {
//         sortBy,
//         page: parseInt(page),
//         limit: parseInt(limit)
//       });

//       return res.json(
//         createResponse('Available rides', {
//           rides,
//           filters,
//           pagination: {
//             page: parseInt(page),
//             limit: parseInt(limit),
//             total: rides.length,
//           },
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Update ride (Driver only)
//    * PUT /api/v1/rides/:rideId
//    */
//   async updateRide(req, res, next) {
//     try {
//       const { rideId } = req.params;
//       const driverId = req.user.id;
//       const updates = req.body;

//       // Validate updates
//       if (updates.departureTime || updates.startLocation || updates.endLocation) {
//         const validation = validateRide(updates);
//         if (validation.error) {
//           return res
//             .status(400)
//             .json(createErrorResponse('Invalid updates', validation.error.details));
//         }
//       }

//       const updatedRide = await this.rideService.updateRide(rideId, driverId, updates);

//       return res.json(createResponse('Ride updated successfully', updatedRide));
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Cancel ride (Driver only)
//    * POST /api/v1/rides/:rideId/cancel
//    */
//   async cancelRide(req, res, next) {
//     try {
//       const { rideId } = req.params;
//       const { reason } = req.body;
//       const driverId = req.user.id;

//       if (!reason) {
//         return res.status(400).json(createErrorResponse('Cancellation reason is required'));
//       }

//       const cancelledRide = await this.rideService.cancelRide(rideId, driverId, reason);

//       return res.json(
//         createResponse('Ride cancelled successfully', {
//           ride: cancelledRide,
//           affectedBookings: cancelledRide.affectedBookings || 0,
//           message: 'All passengers have been notified',
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Complete ride (Driver only)
//    * POST /api/v1/rides/:rideId/complete
//    */
//   async completeRide(req, res, next) {
//     try {
//       const { rideId } = req.params;
//       const driverId = req.user.id;

//       const completedRide = await this.rideService.completeRide(rideId, driverId);

//       // Get ride statistics
//       const stats = await this.rideService.getRideStatistics(rideId);

//       return res.json(
//         createResponse('Ride completed successfully', {
//           ride: completedRide,
//           statistics: {
//             totalPassengers: stats.totalPassengers,
//             totalEarnings: stats.totalEarnings,
//             completedBookings: stats.completedBookings,
//             averageRating: stats.averageRating,
//           },
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get driver's rides
//    * GET /api/v1/rides/driver/my-rides
//    */
//   async getMyRides(req, res, next) {
//     try {
//       const driverId = req.user.id;
//       const {
//         status,
//         startDate,
//         endDate,
//         sortBy = 'departureTime',
//         order = 'desc',
//         page = 1,
//         limit = 20,
//       } = req.query;

//       const filters = {
//         status,
//         startDate,
//         endDate,
//       };

//       const rides = await this.rideService.getDriverRides(driverId, filters, {
//         sortBy,
//         order,
//         page: parseInt(page),
//         limit: parseInt(limit)
//       });

//       // Get statistics
//       const stats = await this.rideService.getDriverStatistics(driverId);

//       return res.json(
//         createResponse('Your rides', {
//           rides,
//           statistics: stats,
//           pagination: {
//             page: parseInt(page),
//             limit: parseInt(limit),
//             total: rides.length,
//           },
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Create recurring ride (Driver only)
//    * POST /api/v1/rides/recurring
//    */
//   async createRecurringRide(req, res, next) {
//     try {
//       const driverId = req.user.id;
//       const recurringData = req.body;

//       // Validate recurring ride data
//       if (!recurringData.days || recurringData.days.length === 0) {
//         return res
//           .status(400)
//           .json(createErrorResponse('Please select at least one day for recurring ride'));
//       }

//       const recurringRides = await this.rideService.createRecurringRide(driverId, recurringData);

//       return res.status(201).json(
//         createResponse('Recurring rides created successfully', {
//           rides: recurringRides,
//           schedule: {
//             days: recurringData.days,
//             time: recurringData.departureTime,
//             duration: recurringData.duration || '4 weeks'
//           }
//         })
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get driver's recurring rides
//    * GET /api/v1/rides/recurring/my-recurring
//    */
//   async getMyRecurringRides(req, res, next) {
//     try {
//       const driverId = req.user.id;

//       const recurringRides = await this.rideService.getDriverRecurringRides(driverId);

//       return res.json(createResponse('Your recurring rides', recurringRides));
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get popular routes
//    * GET /api/v1/rides/stats/popular-routes
//    */
//   async getPopularRoutes(req, res, next) {
//     try {
//       const { days = 30, limit = 10 } = req.query;

//       const popularRoutes = await this.rideService.getPopularRoutes({
//         days: parseInt(days),
//         limit: parseInt(limit)
//       });

//       return res.json(
//         createResponse('Popular routes', {
//           routes: popularRoutes,
//           period: `Last ${days} days`,
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get ride bookings (Driver only)
//    * GET /api/v1/rides/:rideId/bookings
//    */
//   async getRideBookings(req, res, next) {
//     try {
//       const { rideId } = req.params;
//       const driverId = req.user.id;

//       // Verify driver owns this ride
//       const ride = await this.rideService.getRideById(rideId);
//       if (ride.driverId !== driverId) {
//         return res
//           .status(403)
//           .json(createErrorResponse('You are not authorized to view bookings for this ride'));
//       }

//       const bookings = await this.rideService.getRideBookings(rideId);

//       return res.json(
//         createResponse('Ride bookings', {
//           ride: {
//             id: ride.id,
//             route: `${ride.startLocation.area} to ${ride.endLocation.area}`,
//             departureTime: ride.departureTime,
//             totalSeats: ride.totalSeats,
//             availableSeats: ride.availableSeats,
//           },
//           bookings,
//           summary: {
//             total: bookings.length,
//             confirmed: bookings.filter((b) => b.status === 'confirmed').length,
//             pending: bookings.filter((b) => b.status === 'pending').length,
//             cashPending: bookings.filter((b) => b.paymentStatus === 'cash_pending').length,
//             cashReceived: bookings.filter((b) => b.paymentStatus === 'cash_received').length,
//           },
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get ride suggestions based on user history
//    * GET /api/v1/rides/suggestions
//    */
//   async getRideSuggestions(req, res, next) {
//     try {
//       const userId = req.user.id;
//       const { date, limit = 5 } = req.query;

//       const suggestions = await this.rideService.getRideSuggestions(userId, {
//         date: date || new Date().toISOString().split('T')[0],
//         limit: parseInt(limit)
//       });

//       return res.json(createResponse('Ride suggestions', suggestions));
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Update available seats (Driver only)
//    * PATCH /api/v1/rides/:rideId/seats
//    */
//   async updateAvailableSeats(req, res, next) {
//     try {
//       const { rideId } = req.params;
//       const { availableSeats } = req.body;
//       const driverId = req.user.id;

//       if (availableSeats === undefined || availableSeats < 0) {
//         return res
//           .status(400)
//           .json(createErrorResponse('Valid available seats number is required'));
//       }

//       const updatedRide = await this.rideService.updateAvailableSeats(
//         rideId,
//         driverId,
//         availableSeats,
//       );

//       return res.json(
//         createResponse('Available seats updated', {
//           rideId: updatedRide.id,
//           availableSeats: updatedRide.availableSeats,
//           totalSeats: updatedRide.totalSeats,
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }
// }

// module.exports = new RideController();
