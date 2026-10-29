// server/routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { requireAuth, requireCustomer } = require('../middleware/auth');
const { validateBooking } = require('../middleware/validation');

// All booking routes require authenticated customer
router.use(requireAuth, requireCustomer);

// 1. GET USER'S BOOKINGS (with optional status filter)
router.get('/', (req, res) => {
  const currentUserId = req.user.id;
  let userBookings = store.filter('bookings', b => b.customerId === currentUserId);
  const { status } = req.query;

  if (status && status !== 'all') {
    const targetStatus = status.toUpperCase();
    if (targetStatus === 'UPCOMING') {
      userBookings = userBookings.filter(b => b.bookingStatus === 'CONFIRMED' || b.bookingStatus === 'PENDING');
    } else if (targetStatus === 'ACTIVE') {
      userBookings = userBookings.filter(b => b.bookingStatus === 'IN_PROGRESS');
    } else {
      userBookings = userBookings.filter(b => b.bookingStatus === targetStatus);
    }
  }

  // Sort descending by date
  userBookings.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  res.status(200).json(userBookings);
});

// 2. GET SINGLE BOOKING BY ID (WITH STRICT OWNERSHIP CHECK)
router.get('/:id', (req, res) => {
  const currentUserId = req.user.id;
  const booking = store.find('bookings', b => b.id === req.params.id || b.bookingReference === req.params.id);

  if (!booking) {
    return res.status(404).json({ error: 'NotFound', message: `Booking '${req.params.id}' not found.` });
  }

  // STRICT RESOURCE-LEVEL AUTHORIZATION CHECK (Workflow G)
  if (booking.customerId !== currentUserId) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Access denied. You are not authorized to view this customer booking record.' 
    });
  }

  // Attach associated payment and messages info if available
  const payments = store.filter('payments', p => p.bookingId === booking.id || p.bookingReference === booking.bookingReference);
  const service = store.find('services', s => s.id === booking.serviceId);
  const professional = booking.professionalId ? store.find('professionals', p => p.id === booking.professionalId) : null;

  res.status(200).json({
    ...booking,
    serviceDetails: service,
    professionalDetails: professional,
    payments
  });
});

// 3. CREATE BOOKING (AUTHORITATIVE BACKEND PRICING CALCULATION)
router.post('/', validateBooking, (req, res) => {
  const currentUserId = req.user.id;
  const {
    serviceId,
    professionalId,
    addressId,
    customAddress,
    serviceDate,
    timeSlot,
    durationHours,
    quantity,
    workDescription,
    additionalRequirements
  } = req.body;

  // 1. Authoritative Service Lookup
  const service = store.find('services', s => s.id === serviceId);
  if (!service) {
    return res.status(404).json({ error: 'ServiceNotFound', message: 'The requested service was not found.' });
  }

  // 2. Professional Lookup (if specified)
  let pro = null;
  if (professionalId) {
    pro = store.find('professionals', p => p.id === professionalId);
  } else if (service.professionalId) {
    pro = store.find('professionals', p => p.id === service.professionalId);
  }

  // 2b. Professional Availability & Conflicting Booking Verification
  if (pro && serviceDate && timeSlot) {
    const conflict = store.find('bookings', b => 
      b.professionalId === pro.id &&
      b.serviceDate === serviceDate &&
      b.timeSlot === timeSlot &&
      b.bookingStatus !== 'CANCELLED'
    );
    if (conflict) {
      return res.status(409).json({
        error: 'Conflict',
        message: `${pro.name} already has an appointment booked on ${serviceDate} during ${timeSlot}. Please select another arrival window or date.`
      });
    }
  }

  // 3. Address resolution
  let addressSnapshot = null;
  let resolvedAddressId = addressId || null;

  if (addressId) {
    const addr = store.find('addresses', a => a.id === addressId && a.userId === currentUserId);
    if (addr) {
      addressSnapshot = {
        title: addr.title,
        streetAddress: addr.streetAddress,
        apartment: addr.apartment,
        city: addr.city,
        postalCode: addr.postalCode
      };
    }
  } else if (customAddress) {
    addressSnapshot = {
      title: 'Custom Location',
      streetAddress: customAddress.streetAddress || customAddress,
      city: customAddress.city || 'London',
      postalCode: customAddress.postalCode || ''
    };
  } else {
    // Default to user's default address
    const defaultAddr = store.find('addresses', a => a.userId === currentUserId && a.isDefault);
    if (defaultAddr) {
      resolvedAddressId = defaultAddr.id;
      addressSnapshot = {
        title: defaultAddr.title,
        streetAddress: defaultAddr.streetAddress,
        apartment: defaultAddr.apartment,
        city: defaultAddr.city,
        postalCode: defaultAddr.postalCode
      };
    }
  }

  // 4. AUTHORITATIVE PRICE CALCULATION (Do NOT trust client price!)
  const pricingModel = service.pricingModel || 'hourly';
  const unitPrice = parseFloat(service.price || service.startingPrice || 100);
  const parsedDuration = Math.max(1, parseFloat(durationHours) || 1);
  const parsedQty = Math.max(1, parseInt(quantity, 10) || 1);

  let subtotal = 0;
  if (pricingModel === 'hourly') {
    subtotal = unitPrice * parsedDuration * parsedQty;
  } else {
    subtotal = unitPrice * parsedQty;
  }

  const serviceFee = parseFloat((subtotal * 0.05).toFixed(2)); // 5% platform fee
  const discount = 0;
  const totalAmount = parseFloat((subtotal + serviceFee - discount).toFixed(2));

  // 5. Unique Reference Generator
  const refNumber = Math.floor(10000 + Math.random() * 90000);
  const bookingReference = `MAI-BK-${refNumber}`;
  const bookingId = `bk-${Date.now()}`;

  const newBooking = {
    id: bookingId,
    bookingReference,
    customerId: currentUserId,
    customerName: req.user.name,
    customerEmail: req.user.email,
    serviceId: service.id,
    serviceTitle: service.title,
    serviceCategory: service.categoryName || service.category,
    professionalId: pro ? pro.id : null,
    professionalName: pro ? pro.name : 'Assigned Technician',
    professionalAvatar: pro ? pro.avatar : null,
    serviceDate: serviceDate,
    timeSlot: timeSlot,
    durationHours: parsedDuration,
    quantity: parsedQty,
    pricingModel,
    unitPrice,
    subtotal,
    serviceFee,
    discount,
    totalAmount,
    bookingStatus: 'PENDING',
    paymentStatus: 'PENDING',
    addressId: resolvedAddressId,
    addressSnapshot,
    workDescription: workDescription ? workDescription.trim() : '',
    additionalRequirements: additionalRequirements ? additionalRequirements.trim() : '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  store.insert('bookings', newBooking);

  // Generate Notification
  store.insert('notifications', {
    id: 'notif-' + Date.now(),
    userId: currentUserId,
    title: 'Booking Request Submitted',
    message: `Your booking for ${service.title} (${bookingReference}) has been created and is pending confirmation.`,
    type: 'BOOKING_CREATED',
    relatedBookingId: bookingId,
    relatedBookingRef: bookingReference,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    message: 'Booking created successfully',
    booking: newBooking
  });
});

// 4. CANCEL BOOKING (WITH STRICT OWNERSHIP & STATE TRANSITION CHECK)
router.patch('/:id/cancel', (req, res) => {
  const currentUserId = req.user.id;
  const booking = store.find('bookings', b => b.id === req.params.id || b.bookingReference === req.params.id);

  if (!booking) {
    return res.status(404).json({ error: 'NotFound', message: `Booking '${req.params.id}' not found.` });
  }

  // STRICT OWNERSHIP CHECK
  if (booking.customerId !== currentUserId) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Access denied. You can only cancel your own bookings.' 
    });
  }

  // STATE TRANSITION CHECK: Only PENDING or CONFIRMED bookings can be cancelled by customer
  if (booking.bookingStatus === 'COMPLETED') {
    return res.status(400).json({ 
      error: 'InvalidTransition', 
      message: 'Completed bookings cannot be cancelled.' 
    });
  }

  if (booking.bookingStatus === 'CANCELLED') {
    return res.status(400).json({ 
      error: 'InvalidTransition', 
      message: 'This booking has already been cancelled.' 
    });
  }

  const cancellationReason = req.body.reason || 'Customer requested cancellation';

  const updatedBooking = store.update('bookings', booking.id, {
    bookingStatus: 'CANCELLED',
    cancellationReason,
    updatedAt: new Date().toISOString()
  });

  // Notification
  store.insert('notifications', {
    id: 'notif-' + Date.now(),
    userId: currentUserId,
    title: 'Booking Cancelled',
    message: `Your booking ${booking.bookingReference} for ${booking.serviceTitle} has been cancelled.`,
    type: 'BOOKING_CANCELLED',
    relatedBookingId: booking.id,
    relatedBookingRef: booking.bookingReference,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  res.status(200).json({
    message: 'Booking cancelled successfully',
    booking: updatedBooking
  });
});

// 5. RESCHEDULE BOOKING (WITH OWNERSHIP, TRANSITION & AVAILABILITY CHECK)
router.patch('/:id/reschedule', (req, res) => {
  const currentUserId = req.user.id;
  const booking = store.find('bookings', b => b.id === req.params.id || b.bookingReference === req.params.id);

  if (!booking) {
    return res.status(404).json({ error: 'NotFound', message: `Booking '${req.params.id}' not found.` });
  }

  // STRICT OWNERSHIP CHECK
  if (booking.customerId !== currentUserId) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Access denied. You can only reschedule your own bookings.' 
    });
  }

  // TRANSITION CHECK: Only PENDING or CONFIRMED can be rescheduled
  if (booking.bookingStatus === 'CANCELLED' || booking.bookingStatus === 'COMPLETED') {
    return res.status(400).json({ 
      error: 'InvalidTransition', 
      message: `Cannot reschedule a ${booking.bookingStatus.toLowerCase()} booking.` 
    });
  }

  const { newDate, newTimeSlot, newSlot } = req.body;
  const targetDate = newDate || req.body.serviceDate;
  const targetSlot = newTimeSlot || newSlot || req.body.timeSlot;

  if (!targetDate || !targetSlot) {
    return res.status(400).json({ 
      error: 'ValidationError', 
      message: 'Both newDate and newTimeSlot are required to reschedule.' 
    });
  }

  // Availability / Conflict Check for assigned specialist
  if (booking.professionalId) {
    const conflict = store.find('bookings', b => 
      b.id !== booking.id &&
      b.professionalId === booking.professionalId &&
      b.serviceDate === targetDate &&
      b.timeSlot === targetSlot &&
      b.bookingStatus !== 'CANCELLED'
    );
    if (conflict) {
      return res.status(409).json({ 
        error: 'Conflict', 
        message: `The assigned specialist already has a booking scheduled on ${targetDate} during ${targetSlot}. Please select another slot.` 
      });
    }
  }

  const updatedBooking = store.update('bookings', booking.id, {
    serviceDate: targetDate,
    timeSlot: targetSlot,
    updatedAt: new Date().toISOString()
  });

  // Notification
  store.insert('notifications', {
    id: 'notif-' + Date.now(),
    userId: currentUserId,
    title: 'Booking Rescheduled',
    message: `Your booking ${booking.bookingReference} has been rescheduled to ${targetDate} (${targetSlot}).`,
    type: 'BOOKING_RESCHEDULED',
    relatedBookingId: booking.id,
    relatedBookingRef: booking.bookingReference,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  res.status(200).json({
    message: 'Booking rescheduled successfully',
    booking: updatedBooking
  });
});

module.exports = router;
