// /**
//  * Booking Controller
//  * Path: src/api/controllers/booking.controller.js
//  *
//  * Handles all booking-related HTTP requests
//  * Phase 1: Cash payment management
//  */

// const BookingService = require('@core/services/booking.service');
// const { createResponse, createErrorResponse } = require('@shared/utils/response');
// const { validateBooking, validateCashPayment } = require('@api/validators/booking.validator');
// const logger = require('@shared/utils/logger');

// class BookingController {
//   constructor() {
//     this.bookingService = new BookingService();
//   }

//   /**
//    * Create a new booking
//    * POST /api/v1/bookings
//    */
//   async createBooking(req, res, next) {
//     try {
//       const userId = req.user.id;
//       const { rideId, seats, pickupPointId, notes } = req.body;

//       // Validate input
//       const validation = validateBooking(req.body);
//       if (validation.error) {
//         return res
//           .status(400)
//           .json(createErrorResponse('Validation failed', validation.error.details));
//       }

//       // Create booking with cash payment (Phase 1 default)
//       const bookingData = {
//         rideId,
//         seats,
//         pickupPointId,
//         notes,
//         paymentMethod: 'cash', // Default for Phase 1
//       };

//       const booking = await this.bookingService.createBooking(bookingData, userId);

//       // Return booking with payment instructions
//       return res.status(201).json(
//         createResponse(
//           `Booking created successfully. Please pay ₦${booking.fare} in cash to the driver.`,
//           {
//             booking,
//             paymentInstructions: {
//               method: 'cash',
//               amount: booking.fare,
//               currency: 'NGN',
//               instruction: 'Pay driver in cash when boarding',
//               verificationCode: booking.verificationCode,
//               bookingCode: booking.bookingCode,
//             },
//           },
//         ),
//       );
//     } catch (error) {
//       logger.error('Failed to create booking', { error, userId: req.user.id });
//       next(error);
//     }
//   }

//   /**
//    * Get booking details
//    * GET /api/v1/bookings/:bookingId
//    */
//   async getBookingDetails(req, res, next) {
//     try {
//       const { bookingId } = req.params;
//       const userId = req.user.id;

//       const booking = await this.bookingService.getBookingById(bookingId);

//       // Check if user is authorized to view this booking
//       if (booking.passengerId !== userId && booking.driverId !== userId) {
//         return res
//           .status(403)
//           .json(createErrorResponse('You are not authorized to view this booking'));
//       }

//       return res.json(createResponse('Booking details retrieved', booking));
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get user's bookings
//    * GET /api/v1/bookings/my-bookings
//    */
//   async getMyBookings(req, res, next) {
//     try {
//       const userId = req.user.id;
//       const {
//         role = 'passenger',
//         status,
//         paymentStatus,
//         startDate,
//         endDate,
//         page = 1,
//         limit = 20,
//       } = req.query;

//       const filters = {
//         status,
//         paymentStatus,
//         startDate,
//         endDate,
//       };

//       const bookings = await this.bookingService.getUserBookings(userId, role, filters, {
//         page,
//         limit,
//       });

//       // Add payment summary for drivers
//       let paymentSummary = null;
//       if (role === 'driver') {
//         paymentSummary = await this.bookingService.getPaymentSummary(userId);
//       }

//       return res.json(
//         createResponse('Bookings retrieved', {
//           bookings,
//           paymentSummary,
//           pagination: {
//             page: parseInt(page),
//             limit: parseInt(limit),
//             total: bookings.length,
//           },
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Cancel booking
//    * POST /api/v1/bookings/:bookingId/cancel
//    */
//   async cancelBooking(req, res, next) {
//     try {
//       const { bookingId } = req.params;
//       const { reason } = req.body;
//       const userId = req.user.id;

//       if (!reason) {
//         return res.status(400).json(createErrorResponse('Cancellation reason is required'));
//       }

//       const cancelledBooking = await this.bookingService.cancelBooking(bookingId, userId, reason);

//       return res.json(createResponse('Booking cancelled successfully', cancelledBooking));
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Verify passenger (Driver action)
//    * POST /api/v1/bookings/:bookingId/verify-passenger
//    */
//   async verifyPassenger(req, res, next) {
//     try {
//       const { bookingId } = req.params;
//       const { verificationCode } = req.body;
//       const driverId = req.user.id;

//       if (!verificationCode) {
//         return res.status(400).json(createErrorResponse('Verification code is required'));
//       }

//       const result = await this.bookingService.verifyPassenger(
//         bookingId,
//         driverId,
//         verificationCode,
//       );

//       return res.json(
//         createResponse('Passenger verified successfully', {
//           verified: true,
//           booking: result,
//           nextStep: 'Start the ride when ready',
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Start ride (Driver action)
//    * POST /api/v1/bookings/:bookingId/start
//    */
//   async startRide(req, res, next) {
//     try {
//       const { bookingId } = req.params;
//       const { verificationCode } = req.body;
//       const driverId = req.user.id;

//       const booking = await this.bookingService.startRide(bookingId, driverId, verificationCode);

//       return res.json(
//         createResponse('Ride started successfully', {
//           booking,
//           status: 'in_progress',
//           message: 'Ride is now in progress',
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Complete booking and confirm cash payment (Driver action)
//    * POST /api/v1/bookings/:bookingId/complete
//    */
//   async completeBooking(req, res, next) {
//     try {
//       const { bookingId } = req.params;
//       const { amountReceived, paymentNotes } = req.body;
//       const driverId = req.user.id;

//       // Validate cash payment details
//       const validation = validateCashPayment(req.body);
//       if (validation.error) {
//         return res
//           .status(400)
//           .json(createErrorResponse('Invalid payment details', validation.error.details));
//       }

//       const completedBooking = await this.bookingService.completeBooking(bookingId, driverId, {
//         amountReceived,
//         paymentNotes,
//       });

//       return res.json(
//         createResponse('Booking completed and cash payment confirmed', {
//           booking: completedBooking,
//           payment: {
//             status: 'cash_received',
//             amount: amountReceived,
//             notes: paymentNotes,
//           }
//         })
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Confirm cash payment separately (Driver action)
//    * POST /api/v1/bookings/:bookingId/confirm-cash
//    */
//   async confirmCashPayment(req, res, next) {
//     try {
//       const { bookingId } = req.params;
//       const { amountReceived, paymentNotes } = req.body;
//       const driverId = req.user.id;

//       const booking = await this.bookingService.confirmCashPayment(
//         bookingId,
//         driverId,
//         amountReceived,
//         paymentNotes,
//       );

//       return res.json(
//         createResponse('Cash payment confirmed', {
//           bookingId: booking.id,
//           paymentStatus: 'cash_received',
//           amountReceived,
//           confirmedAt: booking.paymentConfirmedAt,
//         })
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Mark passenger as no-show (Driver action)
//    * POST /api/v1/bookings/:bookingId/no-show
//    */
//   async markNoShow(req, res, next) {
//     try {
//       const { bookingId } = req.params;
//       const driverId = req.user.id;

//       const booking = await this.bookingService.markNoShow(bookingId, driverId);

//       return res.json(createResponse('Passenger marked as no-show', booking));
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get driver's daily cash report
//    * GET /api/v1/bookings/driver/cash-report
//    */
//   async getCashReport(req, res, next) {
//     try {
//       const driverId = req.user.id;
//       const { date } = req.query; // YYYY-MM-DD format

//       const reportDate = date || new Date().toISOString().split('T')[0];
//       const report = await this.bookingService.getDailyCashReport(driverId, reportDate);

//       return res.json(
//         createResponse('Daily cash report', {
//           date: reportDate,
//           summary: {
//             totalRides: report.totalRides,
//             completedRides: report.completedRides,
//             totalExpectedCash: report.totalExpectedCash,
//             totalCollectedCash: report.totalCollectedCash,
//             pendingCash: report.pendingCash,
//           },
//           bookings: report.bookings,
//           exportUrl: `/api/v1/reports/driver/cash-report/export?date=${reportDate}`,
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get driver's pending payments
//    * GET /api/v1/bookings/driver/pending-payments
//    */
//   async getPendingPayments(req, res, next) {
//     try {
//       const driverId = req.user.id;
//       const { startDate, endDate } = req.query;

//       const pendingBookings = await this.bookingService.getPendingPayments(driverId, {
//         startDate,
//         endDate,
//       });

//       const totalPending = pendingBookings.reduce((sum, booking) => sum + booking.fare, 0);

//       return res.json(
//         createResponse('Pending payments', {
//           totalPending,
//           count: pendingBookings.length,
//           bookings: pendingBookings.map(b => ({
//             bookingCode: b.bookingCode,
//             passengerName: b.passengerName,
//             amount: b.fare,
//             rideDate: b.scheduledPickupTime,
//             daysPending: Math.floor((new Date() - new Date(b.createdAt)) / (1000 * 60 * 60 * 24)),
//           })),
//         }),
//       );
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Rate booking (both driver and passenger can rate)
//    * POST /api/v1/bookings/:bookingId/rate
//    */
//   async rateBooking(req, res, next) {
//     try {
//       const { bookingId } = req.params;
//       const { rating, comment } = req.body;
//       const userId = req.user.id;

//       if (!rating || rating < 1 || rating > 5) {
//         return res.status(400).json(createErrorResponse('Rating must be between 1 and 5'));
//       }

//       const ratingResult = await this.bookingService.addRating(bookingId, userId, rating, comment);

//       return res.json(createResponse('Rating submitted successfully', ratingResult));
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get booking statistics
//    * GET /api/v1/bookings/statistics
//    */
//   async getBookingStatistics(req, res, next) {
//     try {
//       const userId = req.user.id;
//       const { role = 'passenger', period = '30days' } = req.query;

//       const stats = await this.bookingService.getBookingStatistics(userId, role, period);

//       return res.json(createResponse('Booking statistics', stats));
//     } catch (error) {
//       next(error);
//     }
//   }

//   /**
//    * Get booking QR code (for easy verification)
//    * GET /api/v1/bookings/:bookingId/qr-code
//    */
//   async getBookingQRCode(req, res, next) {
//     try {
//       const { bookingId } = req.params;
//       const userId = req.user.id;

//       const qrCode = await this.bookingService.generateBookingQRCode(bookingId, userId);

//       return res.json(
//         createResponse('QR code generated', {
//           qrCode,
//           verificationCode: qrCode.verificationCode,
//         })
//       );
//     } catch (error) {
//       next(error);
//     }
//   }
// }

// module.exports = new BookingController();
