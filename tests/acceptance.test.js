// tests/acceptance.test.js
// Automated verification for Acceptance Workflows A through H (Section 20)
const http = require('http');
const app = require('../server/server.js');

const PORT = 5088;
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

async function runTests() {
  console.log('====================================================');
  console.log('  STARTING MAI SERVICE FULL ACCEPTANCE TEST SUITE   ');
  console.log('====================================================\n');

  const server = app.listen(PORT);
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // WORKFLOW A: Public Browsing
    // ----------------------------------------------------
    console.log('[WORKFLOW A] Public Browsing & Category Hierarchy:');
    
    // 1. Fetch categories
    const catRes = await request('/api/categories');
    assert(catRes.status === 200 && Array.isArray(catRes.data), 'GET /api/categories returns 200 array');
    
    const carpenter = catRes.data.find(c => c.slug === 'carpenter');
    assert(carpenter && carpenter.name === 'Carpenter', 'Carpenter category exists in database');

    // 2. Fetch subcategories for Carpenter
    const subRes = await request(`/api/categories/${carpenter.id}/subcategories`);
    assert(subRes.status === 200 && subRes.data.length >= 3, 'Carpenter subcategories returned');
    
    const doorInstall = subRes.data.find(s => s.slug === 'door-installation');
    assert(doorInstall && doorInstall.name === 'Door Installation', 'Door Installation subcategory found');

    // 3. Fetch services for subcategory
    const srvSubRes = await request(`/api/subcategories/${doorInstall.id}/services`);
    assert(srvSubRes.status === 200 && srvSubRes.data.length > 0, 'Services for Door Installation returned');

    // 4. Open PVC Door Installation
    const pvcRes = await request('/api/services/srv-pvc-door');
    assert(pvcRes.status === 200 && pvcRes.data.title === 'PVC Door Installation', 'PVC Door Installation details returned');
    assert(pvcRes.data.price === 100 && pvcRes.data.pricingModel === 'hourly', 'PVC Door Installation rate is £100/hour');
    assert(Array.isArray(pvcRes.data.inclusions) && pvcRes.data.inclusions.length > 0, 'PVC Door Installation inclusions present');

    // ----------------------------------------------------
    // WORKFLOW B: Professional Discovery
    // ----------------------------------------------------
    console.log('\n[WORKFLOW B] Professional Discovery & Filtering:');
    
    // 1. Fetch all pros
    const prosRes = await request('/api/professionals');
    assert(prosRes.status === 200 && prosRes.data.length >= 5, 'GET /api/professionals returns pros');

    // 2. Search for Thomas Jenkins
    const searchRes = await request('/api/professionals?search=Thomas');
    assert(searchRes.status === 200 && searchRes.data.some(p => p.name.includes('Thomas')), 'Search by name works');

    // 3. Category filter for carpenter
    const filterRes = await request('/api/professionals?category=carpenter');
    assert(filterRes.status === 200 && filterRes.data.some(p => p.category === 'carpenter'), 'Category filtering works');

    // 4. Professional profile
    const proProfileRes = await request('/api/professionals/pro-10');
    assert(proProfileRes.status === 200 && proProfileRes.data.name === 'Thomas Jenkins', 'Pro profile returned');
    assert(Array.isArray(proProfileRes.data.services) && proProfileRes.data.services.length > 0, 'Pro offered services returned');

    // ----------------------------------------------------
    // WORKFLOW C: Registration Flow
    // ----------------------------------------------------
    console.log('\n[WORKFLOW C] Customer Registration Flow:');
    
    const testRegEmail = `test.user.${Date.now()}@example.com`;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'New Test Customer',
        email: testRegEmail,
        password: 'Password123!',
        phone: '+44 7700 900999'
      }
    });

    assert(regRes.status === 201 && regRes.data.user && regRes.data.token, 'Customer registered with auth token');
    const newCustomerToken = regRes.data.token;
    const newCustomerId = regRes.data.user.id;

    // ----------------------------------------------------
    // WORKFLOW D: Login Flow & Session
    // ----------------------------------------------------
    console.log('\n[WORKFLOW D] Authentication & Login Flow:');
    
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'alex@example.com',
        password: 'Password123!'
      }
    });

    assert(loginRes.status === 200 && loginRes.data.user.name === 'Alex Morgan', 'Login successful for Alex Morgan');
    const alexToken = loginRes.data.token;

    // Verify session
    const meRes = await request('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${alexToken}` }
    });
    assert(meRes.status === 200 && meRes.data.user.email === 'alex@example.com', 'GET /api/auth/me returns Alex Morgan session');

    // ----------------------------------------------------
    // WORKFLOW E: Booking Workflow (8 Steps End-to-End)
    // ----------------------------------------------------
    console.log('\n[WORKFLOW E] Complete Booking & Payment Workflow:');
    
    // Create new booking for PVC door with a unique test date
    const uniqueDay = String(10 + Math.floor(Math.random() * 18)).padStart(2, '0');
    const testServiceDate = `2027-01-${uniqueDay}`;
    const testTimeSlot = '10:00 - 12:00';

    const bookingRes = await request('/api/bookings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${newCustomerToken}` },
      body: {
        serviceId: 'srv-pvc-door',
        professionalId: 'pro-10',
        serviceDate: testServiceDate,
        timeSlot: testTimeSlot,
        durationHours: 3,
        workDescription: 'Front door replacement test'
      }
    });

    assert(bookingRes.status === 201 && bookingRes.data.booking, 'Booking record created');
    const createdBk = bookingRes.data.booking;
    assert(createdBk.bookingReference.startsWith('MAI-BK-'), 'Generated booking reference MAI-BK-XXXXX');
    assert(createdBk.unitPrice === 100, 'Authoritative unit rate verified as £100/hr');
    assert(createdBk.subtotal === 300, 'Subtotal correctly computed on backend as £300 (3 hrs * £100)');
    assert(createdBk.totalAmount === 315, 'Total computed with 5% service fee (£315)');
    assert(createdBk.bookingStatus === 'PENDING', 'Initial booking status is PENDING');

    // Verify Conflict Prevention: Another customer attempting same pro + date + slot
    const conflictRes = await request('/api/bookings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${alexToken}` },
      body: {
        serviceId: 'srv-pvc-door',
        professionalId: 'pro-10',
        serviceDate: testServiceDate,
        timeSlot: testTimeSlot,
        durationHours: 2,
        workDescription: 'Conflicting booking attempt'
      }
    });
    assert(conflictRes.status === 409, 'Conflict prevention active: returns 409 Conflict when pro has overlapping appointment');

    // Process payment
    const payRes = await request('/api/payments/pay', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${newCustomerToken}` },
      body: {
        bookingId: createdBk.id,
        paymentMethod: 'Card (Visa ending 4242)'
      }
    });

    assert(payRes.status === 200 && payRes.data.payment, 'Payment processed successfully');
    assert(payRes.data.payment.paymentReference.startsWith('MAI-PAY-'), 'Generated payment reference MAI-PAY-XXXXX');
    assert(payRes.data.payment.status === 'PAID', 'Payment status is PAID');

    // Verify booking updated in My Bookings
    const userBookingsRes = await request('/api/bookings', {
      headers: { 'Authorization': `Bearer ${newCustomerToken}` }
    });
    const foundBk = userBookingsRes.data.find(b => b.id === createdBk.id);
    assert(foundBk && foundBk.paymentStatus === 'PAID', 'Booking appears in My Bookings with PAID status');

    // Verify Rescheduling flow: PATCH /api/bookings/:id/reschedule
    const rescheduleRes = await request(`/api/bookings/${createdBk.id}/reschedule`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${newCustomerToken}` },
      body: {
        serviceDate: `2027-02-01`,
        timeSlot: '14:00 - 16:00',
        reason: 'Customer schedule change'
      }
    });
    assert(rescheduleRes.status === 200 && rescheduleRes.data.booking.timeSlot === '14:00 - 16:00', 'PATCH /api/bookings/:id/reschedule updates booking slot');

    // Verify Cancellation flow: PATCH /api/bookings/:id/cancel
    const cancelRes = await request(`/api/bookings/${createdBk.id}/cancel`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${newCustomerToken}` },
      body: { reason: 'Test flow cancellation' }
    });
    assert(cancelRes.status === 200 && cancelRes.data.booking.bookingStatus === 'CANCELLED', 'PATCH /api/bookings/:id/cancel marks booking as CANCELLED with audit');

    // ----------------------------------------------------
    // WORKFLOW F: Dashboard & All Modules
    // ----------------------------------------------------
    console.log('\n[WORKFLOW F] Dashboard & Customer Features:');
    
    // Addresses
    const addAddrRes = await request('/api/addresses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${alexToken}` },
      body: {
        title: 'New Project Site',
        streetAddress: '100 King Street',
        city: 'London',
        postalCode: 'W6 0QA'
      }
    });
    assert(addAddrRes.status === 201 && addAddrRes.data.address, 'POST /api/addresses adds new address');

    // Saved Items
    const saveRes = await request('/api/saved', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${alexToken}` },
      body: { itemType: 'service', itemId: 'srv-pvc-door' }
    });
    assert(saveRes.status === 201 || saveRes.status === 200, 'POST /api/saved saves item');

    // Messages
    const convsRes = await request('/api/messages/conversations', {
      headers: { 'Authorization': `Bearer ${alexToken}` }
    });
    assert(convsRes.status === 200 && Array.isArray(convsRes.data), 'GET /api/messages/conversations returns user chats');

    // Notifications
    const notifsRes = await request('/api/notifications', {
      headers: { 'Authorization': `Bearer ${alexToken}` }
    });
    assert(notifsRes.status === 200 && Array.isArray(notifsRes.data.notifications), 'GET /api/notifications returns user notifications');

    // Support Tickets
    const ticketRes = await request('/api/support/tickets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${alexToken}` },
      body: { subject: 'Test Inquiry', message: 'Testing support persistence' }
    });
    assert(ticketRes.status === 201 && ticketRes.data.ticket.ticketReference.startsWith('MAI-TCK-'), 'POST /api/support/tickets creates ticket');

    // ----------------------------------------------------
    // WORKFLOW G: Authorization & Security Isolation
    // ----------------------------------------------------
    console.log('\n[WORKFLOW G] Strict Resource-Level Authorization:');
    
    // Customer A (Alex) attempts to access Customer B's private booking
    const customerBAccess = await request('/api/bookings/bk-customer-b-1', {
      headers: { 'Authorization': `Bearer ${alexToken}` }
    });
    assert(customerBAccess.status === 403, 'Customer A denied access to Customer B booking (403 Forbidden)');

    // Customer A attempts to access Customer B's payment record
    const customerBPayAccess = await request('/api/payments/pay-customer-b-1', {
      headers: { 'Authorization': `Bearer ${alexToken}` }
    });
    assert(customerBPayAccess.status === 403, 'Customer A denied access to Customer B payment (403 Forbidden)');

    // Customer A attempts to access Customer B's private messages
    const customerBMsgAccess = await request('/api/messages/conversations/conv-customer-b-1/messages', {
      headers: { 'Authorization': `Bearer ${alexToken}` }
    });
    assert(customerBMsgAccess.status === 403, 'Customer A denied access to Customer B private chat (403 Forbidden)');

    // ----------------------------------------------------
    // WORKFLOW H: Error Handling & Validation
    // ----------------------------------------------------
    console.log('\n[WORKFLOW H] Error Handling & Validation:');
    
    // 1. Duplicate email registration
    const dupRes = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Duplicate User', email: 'alex@example.com', password: 'Password123!' }
    });
    assert(dupRes.status === 409, 'Duplicate registration returns 409 Conflict');

    // 2. Incorrect password login
    const badPwRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'alex@example.com', password: 'WrongPassword999!' }
    });
    assert(badPwRes.status === 401, 'Incorrect password returns 401 Unauthorized');

    // 3. Invalid booking validation (missing time slot)
    const badBkRes = await request('/api/bookings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${alexToken}` },
      body: { serviceId: 'srv-pvc-door' }
    });
    assert(badBkRes.status === 400, 'Invalid booking request returns 400 Validation Error');

    // 4. Missing service details
    const nonExistSrv = await request('/api/services/non-existent-service-123');
    assert(nonExistSrv.status === 404, 'Non-existent service returns 404 Not Found');

    console.log('\n====================================================');
    if (failed === 0) {
      console.log('  ALL ACCEPTANCE WORKFLOWS (A - H) PASSED (100%)    ');
    } else {
      console.log(`  COMPLETED WITH ${failed} FAILURES                 `);
    }
    console.log('====================================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    try {
      const store = require('../server/data/store');
      store.set('users', store.get('users').filter(u => !u.email.includes('test.user')));
      store.set('bookings', store.get('bookings').filter(b => !b.customerEmail || !b.customerEmail.includes('test.user')));
      store.set('payments', store.get('payments').filter(p => !p.userId || !p.userId.startsWith('usr-179')));
      store.set('supportTickets', store.get('supportTickets').filter(t => t.subject !== 'Test Inquiry'));
      store.set('addresses', store.get('addresses').filter(a => a.title !== 'New Project Site'));
    } catch (e) {
      // non-critical test cleanup
    }
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
