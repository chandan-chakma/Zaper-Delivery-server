const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); //mongodb
require('dotenv').config() //import dotenv
const stripe = require('stripe')(process.env.STRIPE_KEY); //import stripe
const express = require('express');
const cors = require('cors')
const cookieParser = require('cookie-parser'); // import cookies-parser
const port = process.env.PORT || 3000;
const jwt = require('jsonwebtoken');
const app = express()
//middleware
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173',
    credentials:true
})) // for conneting server and client
app.use(cookieParser());
const crypto = require('crypto');

// custom verfy jwt token httponlyCookies
const verifyIdToken = (req, res, next) => {
    const token = req.cookies.token
    // console.log('cokies', cookiesToken);
    // console.log(token);
    if (!token) {
        return res.status(401).send({ message: 'UnAuthorize Access' });
    }
    jwt.verify(token, process.env.jWT_SECRET, (err,decoded) => {
        if (err) {
            return res.status(401).send({ message: 'UnAuthorize Access' });
        }
        // console.log('decoded',decoded)
        req.token_email = decoded.email;

        next();
    })

    
}
// const admin = require("firebase-admin");
// const credential =require('firebase-admin');
// const { initializeApp, cert } = require('firebase-admin/app');
// const { getAuth } = require('firebase-admin/auth');
// const serviceAccount = require("./zap-delivery-315ca-firebase-adminsdk-fbsvc-5e32126750.json");

// initializeApp({
//     credential: cert(serviceAccount),
// });
// const verfyToken = async (req, res, next) => {
//     // console.log('headers', req.headers.authorization);
//     const token = req.headers.authorization;
//     console.log(token)
//     if (!token) {
//         return res.status(401).send({meassge:'Unauthorize Access'})
//     }

//     try {
//         const idToken = token.split(' ')[1];
//         console.log(idToken)
//         // const decoded = await getAuth().verifyIdToken(idToken);
//         // console.log("decode",decoded)
//         // console.log("decode", req.decoded_email)
//     }
//     catch (err) {
//         console.log(err);
//         console.log("message",err.message);
//         // return res.status(401).send({message:'unAuthorize Access'})
//     }

//     next();
// }




const generateTrackingId = () => {
    const prefix = "PRCL";
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${date}-${random}`;
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.l05lfvs.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // we will create api heree /
        const db = client.db('zaper');
        const userCollection = db.collection('users');
        const ridersCollection = db.collection('riders');
        const percelsCollection = db.collection('percels');
        const paymentCollection = db.collection('payments')

        // now make verfy admin route

        const verifyAdmin = async (req, res, next) => {
            const email = req.token_email;
            // console.log(email)
            const query = { email }
            const user = await userCollection.findOne(query);
            if (!user || user.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden Access' })
            }

            next()
        }




        // create jwt or post jwt token 
        app.post('/getToken',(req, res) => {
            const logUser = req.body;
            const token = jwt.sign(
                logUser,
                process.env.jWT_SECRET,
                {expiresIn:'1h'}
            )
            res.cookie('token', token, {
                httpOnly: true,
                secure: false,
                sameSite:'lax'
            })
        // console.log(token)
        res.send({success:true})
            
        })

       

        app.post('/users', async (req, res) => {
            const user = req.body;
            const email = user.email;
            // const query = req.query.email
            user.role = 'user';
            user.createdAt = new Date();
            const userExisting = await userCollection.findOne({email});
            if (userExisting) {
                return res.send({
                    message: 'user already exist',
                    user:userExisting
                })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        app.get('/users', async (req, res) => {
            // const user = req.body;
            const searchText = req.query.search;
            const query = {}
            if (searchText) {
                // if multiple quersy suppos i can search by name or email we user or 
                query.$or= [
                    { displayName: { $regex: searchText, $options: 'i' } },
                    { email: { $regex: searchText, $options:'i'}}
                ]
                // one query supoose some search only by name 
                // query.displayName = {
                //     $regex: searchText,
                //     $options:'i'
                // };
            }
            const cursor = userCollection.find(query)
            const result = await cursor.toArray();
            res.send(result);
        })

        // /user role update
        app.patch('/users/:id/role', verifyIdToken, verifyAdmin, async (req, res) => {
            const id = req.params;
            const roleInfo = req.body;
            // console.log(roleInfo)
            const query = { _id: new ObjectId(id) };
            const updateRole = {
                $set: {
                    role:roleInfo.role
                }
            }
            const result = await userCollection.updateOne(query, updateRole);
            res.send(result)
        })


        // get role for private route
        app.get('/users/:email/role', async (req, res) => {
            const email = req.params.email;
            // console.log(email)
            const query = { email }
            // console.log(query)
            const user = await userCollection.findOne(query);
            // console.log(user.role)
            res.send({role:user?.role || 'user'});
        })


        // riders /
        app.post('/riders', async (req, res) => {
            const rider = req.body;
            rider.status = 'pending';
            rider.createdAt = new Date();
            const result = await ridersCollection.insertOne(rider);
            res.send(result)
        })

        app.get('/riders', async (req, res) => {
            const query = {};
            if (req.query.status) {
                query.status = req.query.status;
            }
            const cursor = ridersCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.patch('/riders/:id',verifyIdToken, verifyAdmin, async (req, res) => {
            const status = req.body.status;
            // console.log(status);
            const id = req.params
            // console.log(id);
            const query ={_id: new ObjectId(id)}
            const update = {
                $set:{
                    status:status
                }
            }

            const result = await ridersCollection.updateOne(query, update);

            if (status === 'Approved') {
                const email = req.body.email;
                // console.log('emaol',email)
                const userQuery ={email}
                const updateDoc = {
                    $set: {
                        role: 'rider'
                    }
                }
                const userResult = await userCollection.updateOne(userQuery, updateDoc)
            }
            res.send(result)
           
        })

        app.delete('/riders/:id', async (req, res) => {
            const id = req.params
            const query = { _id: new ObjectId(id) };
            const result = await ridersCollection.deleteOne(query);
            res.send(result);
        })





        app.get('/percels', async (req, res) => {
            const query = {}
            const { email } = req.query;
            // console.log(email)
            if (email) {
                query.senderEmail = email;
            }
            const option ={sort:{createdAt:-1}}
            
            const cursor = percelsCollection.find(query,option);
            const result = await cursor.toArray();
            res.send(result)
        })

        app.post('/percels', async (req, res) => {
            const percel = req.body;
            // console.log(percel)
            percel.createdAt = new Date()
            const result = await percelsCollection.insertOne(percel);
            res.send(result)
        })

        app.delete('/percels/:id', async (req, res) => {
            const id = req.params;
            console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await percelsCollection.deleteOne(query);
            res.send(result)
        })
        
        // get percel pay 
        app.get('/percels/:id', async (req, res) => {
            const id = req.params;
            const query = { _id: new ObjectId(id) };
            const result = await percelsCollection.findOne(query);
            res.send(result)
            
        })

        // recap 
        app.post('/payment-checkout-seccion', async(req, res) => {
            const paymentInfo = req.body;
            const costs = parseInt(paymentInfo.costs) * 100;

            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        // Provide the exact Price ID (for example, price_1234) of the product you want to sell
                        price_data: {
                            currency: 'USD',
                            unit_amount: costs,
                            product_data: {
                                name: paymentInfo.percelName
                            }
                            
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                metadata: {
                    percelId: paymentInfo.percelId,
                    percelName: paymentInfo.percelName
                    
                },
                customer_email: paymentInfo.senderEmail,
                success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
              
                // Provide a name (for example, hosted_web_0001) to label this Checkout integration and measure its conversion independently
                // integration_identifier: '{{INTEGRATION_ID}}',
            });

            res.send({url:session.url})
        })

        // Payment  old
        app.post('/create-checkout-session', async (req, res) => {
            const paymentInfo = req.body;
            // console.log(paymentInfo)
            const amount = parseInt(paymentInfo.costs) * 100;
            const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    // Provide the exact Price ID (for example, price_1234) of the product you want to sell
                    price_data: {
                        currency: 'USD',
                        unit_amount:amount,
                        product_data: {
                            name: paymentInfo.percelName
                        }
                    },
                    quantity: 1,
                },
                ],
                customer_email :paymentInfo.senderEmail,
                mode: 'payment',
                metadata: {
                    percelID: paymentInfo
                    .percelId
                },
                success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`

            })
            console.log(session);
            res.send({url:session.url})

            
        })

        app.patch('/payment-success', async (req, res) => {
            const sessionedId = req.query.session_id;
            // console.log(sessionedId);
            const trackingId= generateTrackingId()
            const session = await stripe.checkout.sessions.retrieve(sessionedId);
            console.log(session);
            // for duplicate paymet upload 
            const trasactionId = session.payment_intent;
            const query = { trasactionId: trasactionId }
            const existingPayment = await paymentCollection.findOne(query);
            if (existingPayment) {
                return res.send({
                    message: 'already exist',
                    trasactionId:existingPayment.trasactionId,
                    trackingId:existingPayment.trackingId
                })
            }
            if (session.payment_status === 'paid') {
                const id = session.metadata.percelId;
                const query = { _id: new ObjectId(id) }
                console.log(trackingId,id)
                const update = {
                    $set: {
                        paymentStatus: 'paid',
                        trackingId: trackingId
                    }
                }

                const result = await percelsCollection.updateOne(query, update);
                const payment = {
                    amount: session.amount_total / 100,
                    currency: session.currency,
                    customerEmail: session.customer_email,
                    parcelId: session.metadata.percelId,
                    percelName: session.metadata.percelName,
                    trasactionId: session.payment_intent,
                    paymentStatus: session.payment_status,
                    paidAt: new Date(),
                    trackingId: trackingId

                }
                if (session.payment_status === 'paid') {
                    const resultPayment = await paymentCollection.insertOne(payment);
                    return res.send({
                        success: true,
                        modifyPercel: result,
                        trackingId: trackingId,
                        transactionId: session.payment_intent,
                        paymentInfo: resultPayment
                    })

                    
                }
                // console.log(result)
                // return res.send(result)
            }
            return res.send({success:false})
        })

        // get payment for history 
        app.get('/payments', verifyIdToken, async (req, res) => {
           
            const { email } = req.query;
            // console.log("headers", req.headers);
            // console.log(email)
           
            const query = {}
            if (email) {
                query.customerEmail = email;
            }
            // console.log(email)
            if (email !== req.token_email) {
                return res.status(403).send({message:'Forbidden Access'})
            }
            const cursor = paymentCollection.find(query);
            const result = await cursor.toArray();
            // console.log(result)
            res.send(result);
            
        })






        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
    
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    // console.log("hello zaper delivery");
    res.send('hello from zaper')
});

app.listen(port, () => {
    console.log(`here is our zaper port ${port}`)
})