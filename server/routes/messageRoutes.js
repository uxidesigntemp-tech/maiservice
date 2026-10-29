// server/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { requireAuth, requireCustomer } = require('../middleware/auth');

router.use(requireAuth, requireCustomer);

// 1. GET ALL CONVERSATIONS FOR CURRENT USER
router.get('/conversations', (req, res) => {
  const currentUserId = req.user.id;
  const conversations = store.filter('conversations', c => c.customerId === currentUserId);

  conversations.sort((a, b) => new Date(b.lastMessageAt || b.createdAt || 0) - new Date(a.lastMessageAt || a.createdAt || 0));
  res.status(200).json(conversations);
});

// 2. GET MESSAGES FOR A SPECIFIC CONVERSATION (WITH STRICT PARTICIPANT CHECK - WORKFLOW G)
router.get('/conversations/:id/messages', (req, res) => {
  const currentUserId = req.user.id;
  const conversation = store.find('conversations', c => c.id === req.params.id);

  if (!conversation) {
    return res.status(404).json({ error: 'NotFound', message: 'Conversation not found.' });
  }

  // STRICT PARTICIPANT CHECK
  if (conversation.customerId !== currentUserId) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Access denied. You are not a participant in this conversation.' 
    });
  }

  const messages = store.filter('messages', m => m.conversationId === conversation.id);
  messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // Mark messages as read for customer
  messages.forEach(m => {
    if (m.recipientId === currentUserId && !m.isRead) {
      store.update('messages', m.id, { isRead: true });
    }
  });

  store.update('conversations', conversation.id, { unreadCountCustomer: 0 });

  res.status(200).json({
    conversation,
    messages
  });
});

// 3. SEND A MESSAGE IN A CONVERSATION
router.post('/conversations/:id/messages', (req, res) => {
  const currentUserId = req.user.id;
  const conversation = store.find('conversations', c => c.id === req.params.id);

  if (!conversation) {
    return res.status(404).json({ error: 'NotFound', message: 'Conversation not found.' });
  }

  // STRICT PARTICIPANT CHECK
  if (conversation.customerId !== currentUserId) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Access denied. You cannot send messages in this conversation.' 
    });
  }

  const content = (req.body.content || req.body.text || req.body.message || '').trim();
  if (!content) {
    return res.status(400).json({ error: 'ValidationError', message: 'Message content cannot be empty.' });
  }

  const pro = store.find('professionals', p => p.id === conversation.professionalId);
  const recipientId = pro ? (pro.userId || pro.id) : conversation.professionalId;

  const newMessage = {
    id: 'msg-' + Date.now(),
    conversationId: conversation.id,
    senderId: currentUserId,
    senderRole: 'customer',
    recipientId: recipientId,
    content: content.trim(),
    isRead: false,
    createdAt: new Date().toISOString()
  };

  store.insert('messages', newMessage);

  // Update conversation
  store.update('conversations', conversation.id, {
    lastMessageText: content.trim(),
    lastMessageAt: newMessage.createdAt,
    unreadCountPro: (conversation.unreadCountPro || 0) + 1
  });

  res.status(201).json({
    message: 'Message sent successfully',
    sentMessage: newMessage
  });
});

// 4. START OR GET CONVERSATION WITH PROFESSIONAL (Optionally linked to booking)
router.post('/conversations', (req, res) => {
  const currentUserId = req.user.id;
  const { professionalId, bookingId } = req.body;

  if (!professionalId) {
    return res.status(400).json({ error: 'ValidationError', message: 'professionalId is required.' });
  }

  const pro = store.find('professionals', p => p.id === professionalId);
  if (!pro) {
    return res.status(404).json({ error: 'NotFound', message: 'Professional not found.' });
  }

  let booking = null;
  if (bookingId) {
    booking = store.find('bookings', b => b.id === bookingId || b.bookingReference === bookingId);
  }

  // Check if conversation already exists
  let existing = store.find('conversations', c => 
    c.customerId === currentUserId && c.professionalId === professionalId
  );

  if (existing) {
    return res.status(200).json(existing);
  }

  const newConv = {
    id: 'conv-' + Date.now(),
    customerId: currentUserId,
    customerName: req.user.name,
    customerAvatar: req.user.avatar,
    professionalId: pro.id,
    professionalName: pro.name,
    professionalAvatar: pro.avatar,
    bookingId: booking ? booking.id : null,
    bookingReference: booking ? booking.bookingReference : null,
    lastMessageText: 'Conversation started',
    lastMessageAt: new Date().toISOString(),
    unreadCountCustomer: 0,
    unreadCountPro: 0,
    createdAt: new Date().toISOString()
  };

  store.insert('conversations', newConv);
  res.status(201).json(newConv);
});

module.exports = router;
