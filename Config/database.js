const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); //mongodb

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.l05lfvs.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function connectDatabase() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // we will create api heree /
        const db = client.db('zaper');//create database
        return {
            db,
            collection: {
                userCollection :db.collection('users'),
                ridersCollection : db.collection('riders'),
                percelsCollection : db.collection('percels'),
                paymentCollection : db.collection('payments'),
                trackingCollection :db.collection('tracking')
                
            }
        }
      
    }
    catch (error) {
        console.error('Database connection error:', error);
        throw error;
    }
}

module.exports = { connectDatabase, client };