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
        const trackingsColl = myDB.collection("trackings")
        //? vefify Admin token;
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded_email;
            const query = { email };
            const user = await userColl.findOne(query);
            if (!user || user.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidien accesss' })
            }
            next()
        }
        //? verify Rider Token;



        //? Users relaive apis get metod;
        app.get('/users', async (req, res) => {
            const searchText = req.query.searchText;
            // console.log('search text',searchText);
            const query = {};
            // ! condition;
            if (searchText) {
                // query.displayName = searchText
                //? $regex usign;
                // query.displayName = {$regex:searchText,$options:'i'}
                //? usign or;
                query.$or = [
                    { displayName: { $regex: searchText, $options: 'i' } },
                    { email: { $regex: searchText, $options: 'i' } }
                ]
            }
            const cursor = userColl.find(query).sort({ createdAT: -1 }).limit(5);
            const result = await cursor.toArray();
            res.send(result)
        })
        //? Users get apis using id and email;
        app.get('/users/:id', async (req, res) => {

        })
        //? Users get apis using email query;
        app.get('/users/:email/role', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await userColl.findOne(query);
            res.send({ role: user?.role || 'user' });
        })
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
        app.patch('/users/:id/role', fireBsVerify, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const roleInfo = req.body;
            // console.log(id,roleInfo.role);
            const query = { _id: new ObjectId(id) };
            const updateRole = {
                $set: {
                    role: roleInfo.role
                }
            }
            const result = await userColl.updateOne(query, updateRole)
            res.send(result)
        })
        //?get db myperceldata;
        app.get('/percelDatas', async (req, res) => {
            const query = {};
            const { email, deliveryStatus } = req.query;
            if (email) {
                query.senderEmail = email
            }
            if (deliveryStatus) {
                query.deliveryStatus = deliveryStatus
            }
            const options = { sort: { createdAT: -1 } }
            const cursor = myPercelColl.find(query, options);
            const result = await cursor.toArray();
            res.send(result)
        })
        //? driver-assign data loadin;
        app.get('/percelDatas/rider', async (req, res) => {
            const { riderEmail, deliveryStatus } = req.query;
            const query = {};
            if (riderEmail) {
                query.riderEmail = riderEmail
            }
            if (deliveryStatus !== 'parcel_delivered') {
                //? just driver-assign get:- query.deliveryStatus = deliveryStatus
                // query.deliveryStatus = { $in:['driver-assign','rider-arriving']}
                query.deliveryStatus = { $nin: ['parcel_delivered'] }
            }
            else {
                query.deliveryStatus = deliveryStatus
            }
            const cursor = myPercelColl.find(query);
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
        //?  get all count usign pipeline;
        app.get('/percelDatas/delivery-status/stats', async (req, res) => {
            //? Aggregation Pipeline;
            const pipeline = [
                {
                    $group: {
                        _id: '$deliveryStatus',
                        count: { $sum: 1 }
                    }
                }, {
                    $project: {
                        status: '$_id',
                        count: 1,
                        // _id:0
                    }
                }
            ]
            const result = await myPercelColl.aggregate(pipeline).toArray();
            return res.send(result)
        })
        //?post db addPercel data;
        app.post('/percelDatas', async (req, res) => {
            //? generate tracking id;
            const trackingId = generateTrackingId();
            const allPercels = req.body;
            allPercels.createdAT = new Date();
            allPercels.trackingId = trackingId
            logTracking(trackingId, 'created-parcel')
            const result = await myPercelColl.insertOne(allPercels);
            res.send(result);

        })
        //? Parcel data patch and workStatus deliveryStatus update;
        app.patch('/percelDatas/:id', async (req, res) => {
            const id = req.params.id;
            const { riderId, trackingId, riderEmail, riderName, parcelId } = req.body
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    deliveryStatus: 'driver-assign',
                    riderEmail: riderEmail,
                    riderName: riderName,
                    riderId: riderId

                }
            }
            const result = await myPercelColl.updateOne(query, updateDoc);
            const riderQuery = { _id: new ObjectId(riderId) }
            const updateRiderDoc = {
                $set: {
                    workStatus: 'in-delivery'
                }
            }
            const riderResult = await ridersColl.updateOne(riderQuery, updateRiderDoc);
            //? trackingsLog cal code here;
            logTracking(trackingId, 'driver-assign')
            res.send(riderResult)
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
                    percelName: paymentInfo.percelName,
                    trackingId: paymentInfo.trackingId
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
            // Todo: don not generateTracking id ? ;
            const trackingId = session.metadata.trackingId;
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
                        deliveryStatus: 'parcel-paid'
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
                    const resultPayment = await paymentColl.insertOne(payment);
                    // ? logTracking call code here;
                    logTracking(trackingId, 'parcel-paid')

                    return res.send({
                        success: true, modifyPercel: result,
                        trackingId: trackingId,
                        transactionId: session.payment_intent,
                        paymentInfo: resultPayment
                    })
                }

            }
            return res.send({ success: false })
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
            const { status, workStatus, district } = req.query
            // console.log(status,workStatus,district);
            const query = {};
            if (status) {
                query.status = status
            }
            //! 3 text validation rider collectin then send data in assignRider page!
            if (workStatus) {
                query.workStatus = workStatus
            }
            if (district) {
                query.district = district
            }
            const cursor = ridersColl.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })
        //? Aggregration using get rider data❌❌❌;
        app.get('/riders/delivery-per-day', async (req, res) => {
            const email = req.query.email;
            // const pipeline = [
            //     {
            //         $match: {
            //             riderEmail: email,
            //             deliveryStatus: 'parcel_delivered'
            //         }
            //     },
            //     {
            //         $lookup: {
            //             from: 'trackings',
            //             localField: 'trackingId',
            //             foreignField: 'trackingId',
            //             as: 'parcel_trackings'
            //         }
            //     }, {
            //         $unwind:'$parcel_trackings'
            //     },{
            //         $match:{
            //             'parcel_trackings.status':'parcel_delivered'
            //         }
            //     }
            // ]
            //? new pipeline;
            const pipeline = [
                {
                    $match: {
                        riderEmail: email,
                        deliveryStatus: 'parcel_delivered'
                    }
                },
                {
                    $lookup: {
                        from: 'trackings',
                        localField: 'trackingId',
                        foreignField: 'trackingId',
                        as: 'parcel_trackings'
                    }
                },
                {
                    $unwind: '$parcel_trackings'
                },
                {
                    $match: {
                        'parcel_trackings.status': 'parcel_delivered'
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$parcel_trackings.createdAT'
                            }
                        },
                        deliveredCount: {
                            $sum: 1
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        date: '$_id',
                        deliveredCount: 1
                    }
                },
                {
                    $sort: {
                        date: 1
                    }
                }
            ];
            const result = await myPercelColl.aggregate(pipeline).toArray();
            return res.send(result)
        })

        //? riders api here;
        app.post('/riders', async (req, res) => {
            const rider = req.body;
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
                    workStatus: 'available'
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
        //?Rider Accept parcels now update deliveryStatus;
        app.patch('/percelDatas/:id/status', async (req, res) => {
            const id = req.params.id;
            const { riderId, deliveryStatus, trackingId } = req.body
            // console.log(deliveryStatus,id);
            const query = { _id: new ObjectId(id) };
            const updateStatusDoc = {
                $set: {
                    deliveryStatus: deliveryStatus
                }
            }
            if (deliveryStatus === 'parcel_delivered') {

                const riderQuery = { _id: new ObjectId(riderId) }
                const updateRiderDoc = {
                    $set: {
                        workStatus: 'available'
                    }
                }
                const riderResult = await ridersColl.updateOne(riderQuery, updateRiderDoc);
            }
            const result = await myPercelColl.updateOne(query, updateStatusDoc);
            //? logtracking call code here;
            logTracking(trackingId, deliveryStatus)
            res.send(result)

        })
        //? Tracking collection insert tracking info;
        const logTracking = async (trackingId, status) => {
            const log = {
                trackingId,
                status,
                details: status.split('-').join(' '),
                createdAT: new Date()
            }
            const result = await trackingsColl.insertOne(log);
            return result;
        }
        //? get trackingId usign trackingColl data;
        app.get('/trackings/:trackingId/logs', async (req, res) => {
            const trackingId = req.params.trackingId;
            const query = { trackingId };
            const result = await trackingsColl.find(query).toArray();
            res.send(result)
        })





        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir)