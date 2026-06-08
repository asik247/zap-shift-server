const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId, ServerType } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 3000;
//?FireBS Admin and services Accoutn;
const admin = require("firebase-admin");
const serviceAccount = require("./zap-shift-bde07-firebase-adminsdk.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
//!Genereate Tracking id;
const generateTrackingId = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `ZAP-${Date.now()}-${randomNum}`;
}
const stripe = require('stripe')(process.env.STRIP_SECRIT);
const app = express();
//?middleware;
app.use(cors());
app.use(express.json())
//! FireBase Verify;
const fireBsVerify = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'unauthorization access' })
    }
    const token = authorization.split(' ')[1];
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded_email = decoded.email
        next()
    }
    catch {
        return res.status(401).send({ message: 'unauthorization access' })
    }

}
//?root apis;
app.get('/', (req, res) => {
    res.send('Hello this is root apis here now')
})
//? listiner here;
app.listen(port, () => {
    console.log(`This server is runing in port ${port}`);
})
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASSWORD}@cluster0.fdzc9ua.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        await client.connect();
        const myDB = client.db("zap-shif");
        const userColl = myDB.collection('users');
        const myPercelColl = myDB.collection("percelDatas");
        const paymentColl = myDB.collection("payments")
        const ridersColl = myDB.collection("riders")
        //? vefify Admin token;
        // const verifyAdmin = async (req,res,next) =>{
        //     const email = req.decoded_email;
        //     const query = { email };
        //     const user = await userColl.findOne(query);
        //     if(!user || user.role !== 'admin'){
        //         return res.status(403).send({message:'forbiden access'})
        //     }
        //     next()
        // }
        const verifyAdmin = async (req,res,next)=>{
            const email = req.decoded_email;
            const query = { email };
            const user = await userColl.findOne(query);
            if(!user || user.role !=='admin'){
                return res.status(403).send({message:'Forbidien accesss'})
            }
            next()
        }
        //? Users relaive apis get metod;
        app.get('/users',async(req,res)=>{
            const searchText = req.query.searchText;
            // console.log('search text',searchText);
            const query = {};
            // ! condition;
            if(searchText){
                // query.displayName = searchText
                //? $regex usign;
                // query.displayName = {$regex:searchText,$options:'i'}
                //? usign or;
                query.$or = [
                    {displayName: {$regex:searchText, $options:'i'}},
                    {email: { $regex: searchText, $options: 'i'}}
                ]
            }
            const cursor = userColl.find(query).sort({createdAT:-1}).limit(5);
            const result = await cursor.toArray();
            res.send(result)
        })
        //? Users get apis using id and email;
        app.get('/users/:id',async(req,res)=>{

        })
        //? Users get apis using email query;
        app.get('/users/:email/role',async(req,res)=>{
            const email = req.params.email;
            const query = { email };
            const user = await userColl.findOne(query);
            // console.log(user);
            // console.log(email);
            // res.send({success:true})
            res.send({role:user?.role || 'user'});
        })

        // app.get('/users/:email/role',async(req,res)=>{
        //     const email = req.params.email;
        //     const query = { email };
        //     const user = await userColl.findOne(query);
        //     res.send({role:user?.role || 'user'});
        // })
        //?Users relative apis here;
        app.post('/users', async (req, res) => {
            const user = req.body;
            user.role = 'user';
            user.createdAT = new Date();
            //? already user in then no added;
            const email = user.email;
            const userExists = await userColl.findOne({ email });
            if (userExists) {
                return res.send({ message: 'user already exist' })
            }

            const result = await userColl.insertOne(user);
            res.send(result);
        })
        //? Users relative apis patch method;
        app.patch('/users/:id/role',fireBsVerify,verifyAdmin,async(req,res)=>{
            const id = req.params.id;
            const roleInfo = req.body;
            // console.log(id,roleInfo.role);
            const query = { _id : new ObjectId(id)};
            const updateRole = {
                $set:{
                    role:roleInfo.role
                }
            }
            const result = await userColl.updateOne(query,updateRole)
            res.send(result)
        })
        //?get db myperceldata;
        app.get('/percelDatas', async (req, res) => {
            const query = {};
            const {email,deliveryStatus} = req.query;
            if (email) {
                query.senderEmail = email
            }
            if(deliveryStatus){
                query.deliveryStatus = deliveryStatus
            }
            const options = { sort: { createdAT: -1 } }
            const cursor = myPercelColl.find(query, options);
            const result = await cursor.toArray();
            res.send(result)
        })
        //?specifique percle load;
        app.get('/percelDatas/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await myPercelColl.findOne(query);
            res.send(result)
        })
        //?post db addPercel data;
        app.post('/percelDatas', async (req, res) => {
            const allPercels = req.body;
            allPercels.createdAT = new Date();
            const result = await myPercelColl.insertOne(allPercels);
            res.send(result);

        })
        // ? percels delete method;
        app.delete('/percelDatas/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) };
            const result = await myPercelColl.deleteOne(query);
            res.send(result);
        })
        //?Payment relative apis checkout-session;
        app.post('/create-checkout-session', async (req, res) => {
            const paymentInfo = req.body
            const amount = parseInt(paymentInfo.cost) * 100;
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'USD',
                            unit_amount: amount,
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
                success_url: `${process.env.STRIP_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.STRIP_DOMAIN}/dashboard/payment-cancelled?session_id={CHECKOUT_SESSION_ID}`,
            })
            res.send({ url: session.url })
        })
        //?Payment success api retrive;
        app.patch('/payment-success', async (req, res) => {
            const sessionId = req.query.session_id;
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            // console.log('session retirve', session);
            const trackingId = generateTrackingId();
            //?Existing transactiondId;
            const transactionId = session.payment_intent;
            const query = { transactionId: transactionId }
            const paymentExist = await paymentColl.findOne(query);
            console.log(paymentExist);
            if (paymentExist) {
                return res.send({ message: 'already exists', transactionId, trackingId: paymentExist.trackingId })
            }
            if (session.payment_status === 'paid') {
                const id = session.metadata.percelId;
                const query = { _id: new ObjectId(id) };
                const update = {
                    $set: {
                        paymentStatus: 'paid',
                        deliveryStatus:'pending-pickup',
                        trackingId: trackingId
                    }
                }
                const result = await myPercelColl.updateOne(query, update);
                //Todo payment info post db;
                const payment = {
                    amount: session.amount_total / 100,
                    currency: session.currency,
                    customerEmail: session.customer_email,
                    percelId: session.metadata.percelId,
                    percelName: session.metadata.percelName,
                    transactionId: session.payment_intent,
                    paymentStatus: session.payment_status,
                    paidAt: new Date(),
                    trackingId: trackingId
                }
                console.log(payment);
                //? ay khen a validation kro transactionid diya jeno reload korley oo db te 2 ber add na hoy?
                if (session.payment_status === 'paid') {
                    const resultPayment = await paymentColl.insertOne(payment)
                    res.send({
                        success: true, modifyPercel: result,
                        trackingId: trackingId,
                        transactionId: session.payment_intent,
                        paymentInfo: resultPayment
                    })
                }

            }
            res.send({ success: false })
        })
        //? get all payment or query set get db;
        app.get('/payment', fireBsVerify, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded_email
            if (decodedEmail !== email) {
                return res.status(403).send({ message: 'forbidien access' })
            }
            const query = {};
            if (email) {
                query.customerEmail = email
            }
            const cursor = paymentColl.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })
        //? query using riders data load;
        app.get('/riders', async (req, res) => {
            const {status,district,workStatus,} = req.query
            const query = {};
            if (status) {
                query.status = status
            }
            // console.log('staust foren end',status,workStatus,district);
            if(district){
                query.region = district
            }
            if(workStatus){
                query.workStatus = workStatus
            }
            const cursor = ridersColl.find(query);
            const result = await cursor.toArray();
            // console.log(result);
            res.send(result)
        })
        //? riders api here;
        app.post('/riders', async (req, res) => {
            const rider = req.body;
            // console.log(rider);
            rider.status = 'pending',
                rider.createdAT = new Date()
            const result = await ridersColl.insertOne(rider);
            res.send(result)
        })
        app.delete('/riders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await ridersColl.deleteOne(query);
            res.send(result);
        })
        //? riders update apis here;
        app.patch('/riders/:id', async (req, res) => {
            const status = req.body.status;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const upatedDoc = {
                $set: {
                    status: status,
                    workStatus:'available'
                }
            }
            const result = await ridersColl.updateOne(query, upatedDoc);
            if (status === 'Approved') {
                const email = req.body.email;
                const emailQuery = { email };
                const updateUserRole = {
                    $set: {
                        role: 'rider'
                    }
                }
                const userResult = await userColl.updateOne(emailQuery, updateUserRole)
            }
            res.send(result)


        })






        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir)