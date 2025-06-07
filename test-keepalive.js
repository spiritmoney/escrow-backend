const fetch = require('node-fetch');

async function testHealthEndpoint() {
  try {
    console.log('Testing health endpoint...');

    // Test localhost (development)
    const localUrl = 'http://localhost:10000/health';
    console.log(`Testing: ${localUrl}`);

    const response = await fetch(localUrl);

    if (!response.ok) {
      console.log(`❌ Health check failed with status: ${response.status}`);
      return false;
    }

    const data = await response.json();
    console.log('✅ Health check successful:', data);
    return true;
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    console.log('💡 This is expected if the server is not running');
    return false;
  }
}

async function testKeepaliveLogic() {
  console.log('\n🧪 Testing Keepalive Service Logic...');

  // Simulate the configuration check
  const isProduction = process.env.NODE_ENV === 'production';
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Is Production: ${isProduction}`);

  if (!isProduction) {
    console.log('ℹ️  Keepalive service would not start in development mode');
  } else {
    console.log('✅ Keepalive service would start in production mode');
  }

  // Test the health check logic
  const healthResult = await testHealthEndpoint();

  if (healthResult) {
    console.log('✅ Keepalive service would successfully initialize');
  } else {
    console.log('⚠️  Keepalive service would retry health checks');
  }
}

// Run the test
testKeepaliveLogic();
