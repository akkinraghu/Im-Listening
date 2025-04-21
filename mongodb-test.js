require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

console.log('MongoDB URI:', process.env.MONGODB_URI);

async function testConnection() {
  try {
    // Try to connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connection successful!');
    console.log('Connection state:', mongoose.connection.readyState);
    
    // Try to create a test collection
    const testCollection = mongoose.connection.collection('test_collection');
    const result = await testCollection.insertOne({ test: 'data', timestamp: new Date() });
    console.log('Successfully inserted document:', result);
    
    // Close the connection
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    
    if (error.message.includes('authentication')) {
      console.log('\nSuggestion: Your MongoDB requires authentication.');
      console.log('Try one of these connection strings:');
      console.log('1. With admin credentials:');
      console.log('   MONGODB_URI=mongodb://admin:password@localhost:27017/im_listening?authSource=admin');
      console.log('2. With database-specific credentials:');
      console.log('   MONGODB_URI=mongodb://username:password@localhost:27017/im_listening?authSource=im_listening');
    }
  }
}

testConnection();
