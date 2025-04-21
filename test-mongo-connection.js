// Simple script to test MongoDB connection
const { MongoClient } = require('mongodb');

// Connection string - make sure this matches your .env.local file
const uri = 'mongodb://root:example@localhost:27017/im_listening?authSource=admin';

async function testConnection() {
  const client = new MongoClient(uri);
  
  try {
    // Connect to the MongoDB server
    await client.connect();
    console.log('✅ Successfully connected to MongoDB!');
    
    // Get the database
    const db = client.db('im_listening');
    
    // Try to insert a document
    const collection = db.collection('test_collection');
    const result = await collection.insertOne({ 
      test: 'data', 
      timestamp: new Date(),
      message: 'This is a test document to verify MongoDB connection'
    });
    
    console.log('✅ Successfully inserted a document:', result);
    
    // Try to query the document
    const document = await collection.findOne({ _id: result.insertedId });
    console.log('✅ Successfully retrieved the document:', document);
    
    console.log('\n🔍 Connection details:');
    console.log('- MongoDB version:', await db.admin().serverInfo().then(info => info.version));
    console.log('- Database name:', db.databaseName);
    console.log('- Available collections:', await db.listCollections().toArray().then(cols => cols.map(c => c.name).join(', ')));
    
    console.log('\n📝 Next steps:');
    console.log('1. Make sure your .env.local file has this exact connection string:');
    console.log('   MONGODB_URI=mongodb://root:example@localhost:27017/im_listening?authSource=admin');
    console.log('2. Restart your Next.js server if it\'s running');
    console.log('3. Try the article loading endpoint again');
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    
    if (error.message.includes('Authentication failed')) {
      console.log('\n🔐 Authentication error detected. Please check:');
      console.log('1. Your MongoDB container is running: docker ps');
      console.log('2. The username and password match what\'s in your docker-compose.yml');
      console.log('3. The authSource is set to "admin"');
    }
    
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

testConnection();
