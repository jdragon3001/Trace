const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');

const router = express.Router();

// Get current subscription status - This matches what your SubscriptionService.checkSubscriptionStatus() expects
router.get('/check', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    const subscription = await get(`
      SELECT 
        s.*,
        u.stripe_customer_id
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = ?
    `, [userId]);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No subscription found'
      });
    }

    // If there's a Stripe subscription, sync the status
    if (subscription.stripe_subscription_id) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        
        // Update local subscription with Stripe data
        await run(`
          UPDATE subscriptions 
          SET 
            status = ?,
            current_period_start = datetime(?, 'unixepoch'),
            current_period_end = datetime(?, 'unixepoch'),
            cancel_at_period_end = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          stripeSubscription.status,
          stripeSubscription.current_period_start,
          stripeSubscription.current_period_end,
          stripeSubscription.cancel_at_period_end,
          subscription.id
        ]);

        subscription.status = stripeSubscription.status;
        subscription.current_period_start = new Date(stripeSubscription.current_period_start * 1000).toISOString();
        subscription.current_period_end = new Date(stripeSubscription.current_period_end * 1000).toISOString();
        subscription.cancel_at_period_end = stripeSubscription.cancel_at_period_end;
      } catch (stripeError) {
        console.error('Failed to sync with Stripe:', stripeError);
        // Continue with local data if Stripe fails
      }
    }

    // Check if subscription is considered active
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const isExpired = subscription.current_period_end && new Date(subscription.current_period_end) < new Date();

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planId: subscription.plan_id,
        planName: subscription.plan_name,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        machineLimit: subscription.machine_limit,
        isActive,
        isExpired
      }
    });

  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create Stripe checkout session for new subscription
router.post('/create-checkout', authenticateToken, async (req, res) => {
  try {
    const { userId, email } = req.user;
    const { planId, returnUrl } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: 'Plan ID is required'
      });
    }

    // Get or create Stripe customer
    let customer;
    const user = await get('SELECT stripe_customer_id FROM users WHERE id = ?', [userId]);
    
    if (user.stripe_customer_id) {
      customer = await stripe.customers.retrieve(user.stripe_customer_id);
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: { userId }
      });
      
      await run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customer.id, userId]);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price: planId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?canceled=true`,
      metadata: {
        userId,
        planId
      }
    });

    await logAction(userId, 'CHECKOUT_CREATED', { planId, sessionId: session.id }, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Checkout creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session'
    });
  }
});

// Get billing portal URL - This matches what your SubscriptionService expects
router.post('/billing-portal', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { returnUrl } = req.body;

    const user = await get('SELECT stripe_customer_id FROM users WHERE id = ?', [userId]);
    
    if (!user.stripe_customer_id) {
      return res.status(400).json({
        success: false,
        error: 'No billing account found'
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl || 'http://localhost:3000'
    });

    await logAction(userId, 'BILLING_PORTAL_ACCESSED', {}, req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      portalUrl: portalSession.url
    });

  } catch (error) {
    console.error('Billing portal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create billing portal session'
    });
  }
});

// Stripe webhook handler
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    
    res.json({received: true});
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({error: 'Webhook processing failed'});
  }
});

// Webhook handlers
async function handleCheckoutCompleted(session) {
  const userId = session.metadata.userId;
  const planId = session.metadata.planId;
  
  if (session.mode === 'subscription') {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await updateOrCreateSubscription(userId, subscription, planId);
    await logAction(userId, 'SUBSCRIPTION_CREATED', { planId, stripeId: subscription.id });
  }
}

async function handleSubscriptionCreated(subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer);
  const userId = customer.metadata.userId;
  
  if (userId) {
    await updateOrCreateSubscription(userId, subscription);
    await logAction(userId, 'SUBSCRIPTION_ACTIVATED', { stripeId: subscription.id });
  }
}

async function handleSubscriptionUpdated(subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer);
  const userId = customer.metadata.userId;
  
  if (userId) {
    await updateOrCreateSubscription(userId, subscription);
    await logAction(userId, 'SUBSCRIPTION_UPDATED', { 
      stripeId: subscription.id, 
      status: subscription.status 
    });
  }
}

async function handleSubscriptionDeleted(subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer);
  const userId = customer.metadata.userId;
  
  if (userId) {
    await run(`
      UPDATE subscriptions 
      SET 
        status = 'canceled',
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND stripe_subscription_id = ?
    `, [userId, subscription.id]);
    
    await logAction(userId, 'SUBSCRIPTION_CANCELED', { stripeId: subscription.id });
  }
}

async function handlePaymentSucceeded(invoice) {
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const customer = await stripe.customers.retrieve(subscription.customer);
    const userId = customer.metadata.userId;
    
    if (userId) {
      await logAction(userId, 'PAYMENT_SUCCEEDED', { 
        invoiceId: invoice.id,
        amount: invoice.amount_paid 
      });
    }
  }
}

async function handlePaymentFailed(invoice) {
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const customer = await stripe.customers.retrieve(subscription.customer);
    const userId = customer.metadata.userId;
    
    if (userId) {
      await logAction(userId, 'PAYMENT_FAILED', { 
        invoiceId: invoice.id,
        amount: invoice.amount_due 
      });
    }
  }
}

async function updateOrCreateSubscription(userId, stripeSubscription, planId = null) {
  const existingSubscription = await get(
    'SELECT id FROM subscriptions WHERE user_id = ? AND stripe_subscription_id = ?',
    [userId, stripeSubscription.id]
  );

  const machineLimit = getMachineLimitForPlan(stripeSubscription);

  if (existingSubscription) {
    // Update existing subscription
    await run(`
      UPDATE subscriptions 
      SET 
        status = ?,
        current_period_start = datetime(?, 'unixepoch'),
        current_period_end = datetime(?, 'unixepoch'),
        cancel_at_period_end = ?,
        machine_limit = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      stripeSubscription.status,
      stripeSubscription.current_period_start,
      stripeSubscription.current_period_end,
      stripeSubscription.cancel_at_period_end,
      machineLimit,
      existingSubscription.id
    ]);
  } else {
    // Create new subscription
    const subscriptionId = uuidv4();
    await run(`
      INSERT INTO subscriptions 
      (id, user_id, stripe_subscription_id, status, plan_id, plan_name, 
       current_period_start, current_period_end, cancel_at_period_end, machine_limit)
      VALUES (?, ?, ?, ?, ?, ?, datetime(?, 'unixepoch'), datetime(?, 'unixepoch'), ?, ?)
    `, [
      subscriptionId,
      userId,
      stripeSubscription.id,
      stripeSubscription.status,
      planId || 'monthly',
      'Monthly Subscription',
      stripeSubscription.current_period_start,
      stripeSubscription.current_period_end,
      stripeSubscription.cancel_at_period_end,
      machineLimit
    ]);
  }
}

function getMachineLimitForPlan(subscription) {
  // You can customize this based on your pricing tiers
  const basicLimit = parseInt(process.env.MACHINE_LIMIT_BASIC) || 2;
  const proLimit = parseInt(process.env.MACHINE_LIMIT_PRO) || 5;
  
  // Check if it's a pro plan (you'd set this up in your Stripe pricing)
  const priceId = subscription.items.data[0]?.price?.id;
  if (priceId && priceId.includes('pro')) {
    return proLimit;
  }
  
  return basicLimit;
}

module.exports = router; 