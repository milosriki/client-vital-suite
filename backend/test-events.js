const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Test Purchase Event
async function testPurchase() {
  console.log('\n=== Testing Purchase Event ===');
  try {
    const response = await axios.post(`${BASE_URL}/api/events/Purchase`, {
      event_time: Math.floor(Date.now() / 1000),
      event_id: `test_${Date.now()}`,
      user_data: {
        email: 'test@ptdfitness.com',
        phone: '+971501234567',
        first_name: 'John',
        last_name: 'Doe',
        external_id: 'client_123',
        fbp: 'fb.1.1234567890123.1234567890',
        fbc: 'fb.1.1234567890.AbCdEfGhIjKlMnOpQrStUvWxYz1234567890'
      },
      custom_data: {
        currency: 'AED',
        value: 500.00,
        content_name: 'Personal Training Package',
        content_type: 'product'
      }
    });
    console.log('✓ Purchase event sent successfully:', response.data);
  } catch (error) {
    console.error('✗ Purchase event failed:', error.response?.data || error.message);
  }
}

// Test Batch Events
async function testBatch() {
  console.log('\n=== Testing Batch Events ===');
  try {
    const response = await axios.post(`${BASE_URL}/api/events/batch`, {
      events: [
        {
          event_name: 'ViewContent',
          event_time: Math.floor(Date.now() / 1000),
          event_id: `batch_view_${Date.now()}`,
          user_data: {
            email: 'user1@ptdfitness.com',
            fbp: 'fb.1.1234567890123.1234567890'
          }
        },
        {
          event_name: 'AddToCart',
          event_time: Math.floor(Date.now() / 1000),
          event_id: `batch_cart_${Date.now()}`,
          user_data: {
            email: 'user2@ptdfitness.com',
            fbp: 'fb.1.1234567890123.0987654321'
          },
          custom_data: {
            currency: 'AED',
            value: 300.00
          }
        }
      ]
    });
    console.log('✓ Batch events sent successfully:', response.data);
  } catch (error) {
    console.error('✗ Batch events failed:', error.response?.data || error.message);
  }
}

// Test Health Check
async function testHealth() {
  console.log('\n=== Testing Health Check ===');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✓ Health check passed:', response.data);
  } catch (error) {
    console.error('✗ Health check failed:', error.response?.data || error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('Starting Meta CAPI Proxy Tests...');
  console.log(`Target: ${BASE_URL}`);
  
  await testHealth();
  await testPurchase();
  await testBatch();
  
  console.log('\n=== Tests Complete ===\n');
}

runTests();
