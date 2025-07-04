const { Router } = require('express');
const protect = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const channelController = require('../controllers/channelController');

const router = Router();

// Create your own channel
router.post(
    '/create-channel', 
    protect, 
    upload.single('profileImage'), 
    channelController.createChannel
);

// Update your channel
router.put(
  '/:channelId',
  protect,
  upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'bannerImage', maxCount: 1 }
  ]),
  channelController.updateChannel
);

// Get public channel info by ID
router.get('/public/:identifier', channelController.getPublicChannel);

// Subscribe
router.post(
  "/:channelId/subscribe",
  protect,
  channelController.subscribe
);

// Unsubscribe
router.delete(
  "/:channelId/subscribe",
  protect,
  channelController.unsubscribe
);

// get my subscriptions
router.get(
  '/me/subscriptions',
  protect,
  channelController.getMySubscriptions
);

module.exports = router;