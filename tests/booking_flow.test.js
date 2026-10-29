// tests/booking_flow.test.js
// Comprehensive Verification of Phase 2 (Booking Flow) and Phase 3 (Dashboard & Features)
const http = require('http');
const app = require('../server/server.js');
const store = require('../server/data/store');

const PORT = 5089;
const BASE_URL = `http://localhost:${PORT}`;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runBookingFlowTests() {
  console.log('====================================================');
  console.log('  TESTING MAI SERVICE FULL BOOKING & DASHBOARD FLOW  ');
  console.log('====================================================\n');

  const server = app.listen(PORT);
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  let testCustomerToken = null;
  let testCustomerId = null;
  let createdAddressId = null;
  let createdBookingId = null;
  let testServiceDate = `2027-03-${String(10 + Math.floor(Math.random() * 18)).padStart(2, '0')}`;
  let testTimeSlot = '11:30 - 13:30';

  try {
    // ----------------------------------------------------
    // 1. Unauthenticated Security Gate
    // ----------------------------------------------------
    console.log('[TEST 1] Unauthenticated Guest Booking Attempt:');
    const guestBookingRes = await request('/api/bookings', {
      method: 'POST',
      body: { serviceId: 'srv-pvc-door', serviceDate: testServiceDate, timeSlot: testTimeSlot }
    });
    assert(guestBookingRes.status === 401, 'Unauthenticated booking attempt blocked with 401 Unauthorized');

    // ----------------------------------------------------
    // 2. Customer Registration & Session
    // ----------------------------------------------------
    console.log('\n[TEST 2] Customer Authentication & Session:');
    const testEmail = `booking.test.${Date.now()}@example.com`;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Jordan Smith',
        email: testEmail,
        password: 'Password123!',
        phone: '+44 7700 900555'
      }
    });
    assert(regRes.status === 201 && regRes.data.token, 'Customer Jordan Smith registered with JWT token');
    testCustomerToken = regRes.data.token;
    testCustomerId = regRes.data.user.id;

    // ----------------------------------------------------
    // 3. Inline Address Creation (Phase 2 Step 3)
    // ----------------------------------------------------
    console.log('\n[TEST 3] Inline Address Creation & Selection:');
    const addAddrRes = await request('/api/addresses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testCustomerToken}` },
      body: {
        title: 'Primary Residence',
        streetAddress: '42 Highfield Terrace',
        city: 'London',
        postalCode: 'SW11 4NU',
        isDefault: true
      }
    });
    assert(addAddrRes.status === 201 && addAddrRes.data.address, 'Address created via POST /api/addresses');
    createdAddressId = addAddrRes.data.address.id;

    const listAddrRes = await request('/api/addresses', {
      headers: { 'Authorization': `Bearer ${testCustomerToken}` }
    });
    assert(listAddrRes.status === 200 && listAddrRes.data.length >= 1, 'Addresses list returns created address');

    // ----------------------------------------------------
    // 4. Booking Creation with Authoritative Pricing (Phase 2 Step 4 & 5)
    // ----------------------------------------------------
    console.log('\n[TEST 4] Authoritative Booking Creation:');
    const bookingRes = await request('/api/bookings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testCustomerToken}` },
      body: {
        serviceId: 'srv-pvc-door',
        professionalId: 'pro-10',
        addressId: createdAddressId,
        serviceDate: testServiceDate,
        timeSlot: testTimeSlot,
        durationHours: 3,
        workDescription: 'Inspect and replace double patio PVC door latch mechanism.'
      }
    });

    assert(bookingRes.status === 201 && bookingRes.data.booking, 'Booking successfully created (201 Created)');
    const bk = bookingRes.data.booking;
    createdBookingId = bk.id;
    assert(bk.bookingReference.startsWith('MAI-BK-'), `Booking Reference generated: ${bk.bookingReference}`);
    assert(bk.unitPrice === 100, 'Authoritative unit rate locked at £100/hr');
    assert(bk.subtotal === 300, 'Subtotal correctly computed as £300 (3 hrs × £100)');
    assert(bk.serviceFee === 15, 'Service escrow fee computed as £15 (5%)');
    assert(bk.totalAmount === 315, 'Total authoritative price is £315 GBP');
    assert(bk.bookingStatus === 'PENDING', 'Booking initial status is PENDING');
    assert(bk.paymentStatus === 'PENDING' || bk.paymentStatus === 'UNPAID', 'Booking initial paymentStatus is PENDING/UNPAID');

    // ----------------------------------------------------
    // 5. Booking Conflict Prevention (Phase 2 Step 2)
    // ----------------------------------------------------
    console.log('\n[TEST 5] Professional Double-Booking Conflict Prevention:');
    const conflictRes = await request('/api/bookings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testCustomerToken}` },
      body: {
        serviceId: 'srv-pvc-door',
        professionalId: 'pro-10',
        addressId: createdAddressId,
        serviceDate: testServiceDate,
        timeSlot: testTimeSlot,
        durationHours: 2,
        workDescription: 'Overlapping appointment booking attempt'
      }
    });
    assert(conflictRes.status === 409, 'Double booking blocked with 409 Conflict');
    assert(conflictRes.data.error === 'Conflict', 'Conflict error payload returned with pro availability explanation');

    // ----------------------------------------------------
    // 6. Payment Processing (Phase 2 Step 6)
    // ----------------------------------------------------
    console.log('\n[TEST 6] Escrow Payment Processing:');
    const payRes = await request('/api/payments/pay', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testCustomerToken}` },
      body: {
        bookingId: createdBookingId,
        paymentMethod: 'Card (Visa ending 4242)'
      }
    });

    assert(payRes.status === 200 && payRes.data.payment, 'Payment processed successfully (200 OK)');
    const pay = payRes.data.payment;
    assert(pay.paymentReference.startsWith('MAI-PAY-'), `Payment Reference generated: ${pay.paymentReference}`);
    assert(pay.status === 'PAID', 'Payment status is PAID');
    assert(pay.amount === 315, 'Payment amount matches booking total (£315)');
    assert(pay.receiptUrl.includes(pay.paymentReference), 'Receipt URL generated');

    // Verify booking updated to CONFIRMED
    const verifyBkRes = await request(`/api/bookings/${createdBookingId}`, {
      headers: { 'Authorization': `Bearer ${testCustomerToken}` }
    });
    assert(verifyBkRes.status === 200, 'Booking retrieved');
    assert(verifyBkRes.data.bookingStatus === 'CONFIRMED', 'Booking status updated to CONFIRMED');
    assert(verifyBkRes.data.paymentStatus === 'PAID', 'Payment status updated to PAID');

    // ----------------------------------------------------
    // 7. Post-Booking Notifications & Messaging (Phase 2 Step 8)
    // ----------------------------------------------------
    console.log('\n[TEST 7] Post-Booking Notifications & Messaging:');
    const notifsRes = await request('/api/notifications', {
      headers: { 'Authorization': `Bearer ${testCustomerToken}` }
    });
    assert(notifsRes.status === 200, 'Notifications retrieved');
    const paymentNotif = notifsRes.data.notifications.find(n => n.type === 'PAYMENT_RECEIVED');
    assert(paymentNotif && paymentNotif.relatedBookingId === createdBookingId, 'Payment confirmation notification recorded');

    // Start conversation with pro
    const convRes = await request('/api/messages/conversations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testCustomerToken}` },
      body: {
        professionalId: 'pro-10',
        bookingId: createdBookingId
      }
    });
    assert(convRes.status === 200 || convRes.status === 201, 'Conversation with pro initiated');
    const conversationId = convRes.data.conversation?.id || convRes.data.id;

    // Send chat message
    const sendMsgRes = await request(`/api/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testCustomerToken}` },
      body: { content: 'Hi Thomas, look forward to the PVC door repair!' }
    });
    assert(sendMsgRes.status === 201, 'Message delivered into conversation thread');

    // ----------------------------------------------------
    // 8. Rescheduling Workflow (Phase 2 Post-Booking)
    // ----------------------------------------------------
    console.log('\n[TEST 8] Booking Rescheduling Flow:');
    const newServiceDate = `2027-04-${String(10 + Math.floor(Math.random() * 18)).padStart(2, '0')}`;
    const newTimeSlot = '14:00 - 16:00';

    const rescheduleRes = await request(`/api/bookings/${createdBookingId}/reschedule`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${testCustomerToken}` },
      body: {
        serviceDate: newServiceDate,
        timeSlot: newTimeSlot,
        reason: 'Client requested afternoon arrival'
      }
    });

    assert(rescheduleRes.status === 200 && rescheduleRes.data.booking, 'Reschedule accepted (200 OK)');
    assert(rescheduleRes.data.booking.serviceDate === newServiceDate, 'Booking serviceDate updated');
    assert(rescheduleRes.data.booking.timeSlot === newTimeSlot, 'Booking timeSlot updated to afternoon window');

    // ----------------------------------------------------
    // 9. Cancellation & Refund Policy Workflow
    // ----------------------------------------------------
    console.log('\n[TEST 9] Booking Cancellation & Policy:');
    const cancelRes = await request(`/api/bookings/${createdBookingId}/cancel`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${testCustomerToken}` },
      body: { reason: 'No longer required - work carried out earlier' }
    });

    assert(cancelRes.status === 200 && cancelRes.data.booking, 'Cancellation processed (200 OK)');
    assert(cancelRes.data.booking.bookingStatus === 'CANCELLED', 'Booking status is now CANCELLED');

    // Attempting to reschedule cancelled booking must be rejected
    const badReschedule = await request(`/api/bookings/${createdBookingId}/reschedule`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${testCustomerToken}` },
      body: { serviceDate: '2027-05-01', timeSlot: '10:00 - 12:00' }
    });
    assert(badReschedule.status === 400, 'Rescheduling cancelled booking rejected (400 Bad Request)');

    // ----------------------------------------------------
    // 10. Saved Items & Support Tickets (Dashboard Modules)
    // ----------------------------------------------------
    console.log('\n[TEST 10] Saved Items & Support Persistence:');
    const saveProRes = await request('/api/saved', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testCustomerToken}` },
      body: { itemType: 'professional', itemId: 'pro-10' }
    });
    assert(saveProRes.status === 200 || saveProRes.status === 201, 'Professional added to Saved / Favourites');

    const ticketRes = await request('/api/support/tickets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testCustomerToken}` },
      body: { subject: 'Patio Door Guarantee', message: 'Inquiring about 12-month workmanship guarantee.' }
    });
    assert(ticketRes.status === 201 && ticketRes.data.ticket.ticketReference.startsWith('MAI-TCK-'), 'Support ticket created with MAI-TCK- reference');

    console.log('\n====================================================');
    if (failed === 0) {
      console.log('  ALL 10 BOOKING & DASHBOARD TESTS PASSED (100%)    ');
    } else {
      console.log(`  COMPLETED WITH ${failed} FAILURES                 `);
    }
    console.log('====================================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Clean up test records
    try {
      store.set('users', store.get('users').filter(u => u.id !== testCustomerId));
      store.set('bookings', store.get('bookings').filter(b => b.id !== createdBookingId));
      store.set('addresses', store.get('addresses').filter(a => a.id !== createdAddressId));
      store.set('payments', store.get('payments').filter(p => p.bookingId !== createdBookingId));
      store.set('notifications', store.get('notifications').filter(n => n.relatedBookingId !== createdBookingId));
      store.set('supportTickets', store.get('supportTickets').filter(t => t.subject !== 'Patio Door Guarantee'));
      store.set('saved', store.get('saved').filter(s => s.userId !== testCustomerId));
    } catch (e) {
      // non-critical cleanup
    }
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runBookingFlowTests();
